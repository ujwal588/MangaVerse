import { AdapterRegistry } from './adapters/registry';
import { ScrollTracker } from './scrollTracker';
import { ReaderHUD } from './hud/ReaderHUD';
import { PageInitMessage, PageInitResponse, UpdateProgressMessage, OfflineChapterInfo } from '../types/messages';

let activeHUD: ReaderHUD | null = null;
let activeTracker: ScrollTracker | null = null;
let currentTrackingUrl: string = '';
let activeAdapter: ReturnType<typeof AdapterRegistry.getMatchingAdapter> = null;
let activeOfflineChapter: Omit<OfflineChapterInfo, 'pages'> | null = null;

const MT_PORT = 7676;

async function initContentScript(retryCount = 0) {
  const pageUrl = new URL(window.location.href);
  const isOfflinePreload = pageUrl.searchParams.get('mangaverse_offline_preload') === '1';
  pageUrl.searchParams.delete('mangaverse_offline_preload');
  const url = pageUrl.toString();
  const adapter = AdapterRegistry.getMatchingAdapter(url, document);

  if (!adapter) {
    return;
  }

  // Avoid duplicate initialization on exact same URL
  if (currentTrackingUrl === url && activeHUD) {
    return;
  }

  console.log(`[MangaVerse] Matched adapter: ${adapter.name} (${adapter.id})`);

  try {
    const [seriesMeta, chapterMeta] = await Promise.all([
      adapter.detectSeries(document, url),
      adapter.detectChapter(document, url),
    ]);

    if (!seriesMeta || !chapterMeta) {
      if (retryCount < 3) {
        console.log(`[MangaVerse] Retrying metadata detection (attempt ${retryCount + 1})...`);
        setTimeout(() => initContentScript(retryCount + 1), 600);
      } else {
        console.warn('[MangaVerse] Could not detect series or chapter metadata after retries');
      }
      return;
    }

    currentTrackingUrl = url;
    console.log(`[MangaVerse] Detected: ${seriesMeta.title} - ${chapterMeta.chapterLabel}`);

    // Clean up previous HUD/tracker if navigating across chapters in same tab (SPA)
    if (activeHUD) {
      activeHUD.unmount();
      activeHUD = null;
    }
    if (activeTracker) {
      activeTracker.stop();
      activeTracker = null;
    }
    // Send page init to background worker
    const initMsg: PageInitMessage = {
      type: 'PAGE_INIT',
      url,
      detectedSeries: seriesMeta,
      detectedChapter: chapterMeta,
      isOfflinePreload,
    };

    const response: PageInitResponse = await chrome.runtime.sendMessage(initMsg);

    if (!response || !response.series) {
      console.error('[MangaVerse] Invalid response from background worker');
      return;
    }

    const { series, currentChapter, progress } = response;
    activeAdapter = adapter;
    activeOfflineChapter = {
      chapterId: currentChapter.id,
      seriesId: series.id,
      seriesTitle: series.title,
      chapterNumber: currentChapter.chapterNumber,
      chapterLabel: currentChapter.chapterLabel,
      sourceUrl: url,
      offlineDownloadAhead: response.offlineDownloadAhead ?? 0,
    };

    // Preload tabs only collect chapter data. They must not create a visible HUD
    // or overwrite the reader's actual reading progress.
    if (isOfflinePreload) return;

    // Create Reader HUD
    const hud = new ReaderHUD({
      seriesTitle: series.title,
      chapterLabel: currentChapter.chapterLabel,
      initialPercent: progress?.scrollPositionPercent || 0,
      isInitiallyCompleted: currentChapter.isRead,
      mtPort: MT_PORT,
      onOpenDashboard: () => {
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      },
      onOpenTranslator: () => {
        chrome.runtime.sendMessage({ type: 'OPEN_MANGA_TRANSLATOR', port: MT_PORT });
      },
      onSaveOffline: () => {
        chrome.runtime.sendMessage({ type: 'OPEN_OFFLINE_SAVER' });
      },
      onToggleCompleted: (isCompleted) => {
        const updateMsg: UpdateProgressMessage = {
          type: 'UPDATE_PROGRESS',
          seriesId: series.id,
          chapterId: currentChapter.id,
          chapterNumber: currentChapter.chapterNumber,
          scrollPercent: isCompleted ? 1.0 : 0.0,
          scrollPixelOffset: window.scrollY,
          isCompleted,
        };
        chrome.runtime.sendMessage(updateMsg);
      },
    });

    hud.mount();
    activeHUD = hud;

    // Setup scroll tracker
    const tracker = new ScrollTracker({
      onProgress: (percent, pixel, isCompleted) => {
        hud.updateProgress(percent, isCompleted);

        const updateMsg: UpdateProgressMessage = {
          type: 'UPDATE_PROGRESS',
          seriesId: series.id,
          chapterId: currentChapter.id,
          chapterNumber: currentChapter.chapterNumber,
          scrollPercent: percent,
          scrollPixelOffset: pixel,
          isCompleted,
        };

        chrome.runtime.sendMessage(updateMsg);
      },
    });

    tracker.start();
    activeTracker = tracker;

    // Send immediate initial progress (0%) so it registers in db without waiting for first scroll
    const initialProgressMsg: UpdateProgressMessage = {
      type: 'UPDATE_PROGRESS',
      seriesId: series.id,
      chapterId: currentChapter.id,
      chapterNumber: currentChapter.chapterNumber,
      scrollPercent: progress?.scrollPositionPercent || 0,
      scrollPixelOffset: window.scrollY || 0,
      isCompleted: currentChapter.isRead,
    };
    chrome.runtime.sendMessage(initialProgressMsg);

    // Restore previous scroll position if available and chapter was partially read
    if (progress && !currentChapter.isRead && progress.scrollPixelOffset > 100) {
      setTimeout(() => {
        tracker.restoreScroll(progress.scrollPixelOffset, progress.scrollPositionPercent);
      }, 600);
    }
  } catch (err) {
    console.error('[MangaVerse] Error initializing reading companion:', err);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_SERIES_CHAPTER_LINKS') {
    const seen = new Set<string>();
    const chapters = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((anchor) => {
        const href = anchor.href;
        const text = [anchor.textContent, anchor.getAttribute('title'), anchor.getAttribute('aria-label')]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const match = text.match(/(?:chapter|ch\.?|episode|ep\.?)\s*#?\s*(\d+(?:\.\d+)?)/i)
          || href.match(/(?:chapter|ch|episode|ep)[_\/-]?(\d+(?:\.\d+)?)(?:\D|$)/i);
        if (!match || seen.has(href)) return null;
        try {
          if (new URL(href).origin !== window.location.origin) return null;
        } catch {
          return null;
        }
        seen.add(href);
        return {
          url: href,
          chapterNumber: Number(match[1]),
          chapterLabel: text || `Chapter ${match[1]}`,
        };
      })
      .filter((chapter): chapter is { url: string; chapterNumber: number; chapterLabel: string } => chapter !== null)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
    sendResponse({ success: true, chapters });
    return;
  }

  if (message?.type !== 'GET_OFFLINE_CHAPTER_INFO') return;
  if (!activeOfflineChapter || !activeAdapter) {
    sendResponse({ success: false, error: 'MangaVerse has not finished identifying this chapter yet.' });
    return;
  }

  const seen = new Set<string>();
  const pages = activeAdapter.extractPageElements(document)
    .filter((element): element is HTMLImageElement => element instanceof HTMLImageElement)
    .map((image) => {
      image.loading = 'eager';
      const candidates = [
        image.getAttribute('data-src'),
        image.getAttribute('data-lazy-src'),
        image.getAttribute('data-original'),
        image.getAttribute('data-cfsrc'),
        image.currentSrc,
        image.getAttribute('src'),
      ];
      const rawUrl = candidates.find((candidate) => candidate && !/^(?:data|blob):/i.test(candidate));
      if (!rawUrl) return null;
      try {
        const url = new URL(rawUrl, window.location.href).toString();
        if (!/^https?:/i.test(url) || seen.has(url)) return null;
        seen.add(url);
        return { url, alt: image.alt || undefined };
      } catch {
        return null;
      }
    })
    .filter((page): page is { url: string; alt: string | undefined } => page !== null);

  sendResponse({
    success: true,
    chapter: {
      ...activeOfflineChapter,
      nextChapterUrl: activeAdapter.getNextChapterUrl?.(document) || undefined,
      pages,
    },
  });
});

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initContentScript());
} else {
  initContentScript();
}

// Observe SPA URL navigation (e.g. clicking next chapter without page reload)
let lastObservedUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastObservedUrl) {
    lastObservedUrl = window.location.href;
    console.log('[MangaVerse] Detected URL change to:', lastObservedUrl);
    initContentScript();
  }
}, 800);
window.addEventListener('popstate', () => {
  lastObservedUrl = window.location.href;
  initContentScript();
});
