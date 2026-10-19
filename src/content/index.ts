import { AdapterRegistry } from './adapters/registry';
import { ScrollTracker } from './scrollTracker';
import { ReaderHUD } from './hud/ReaderHUD';
import { PageInitMessage, PageInitResponse, UpdateProgressMessage } from '../types/messages';

let activeHUD: ReaderHUD | null = null;
let activeTracker: ScrollTracker | null = null;
let currentTrackingUrl: string = '';

const MT_PORT = 7676;

async function initContentScript(retryCount = 0) {
  const url = window.location.href;
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
    };

    const response: PageInitResponse = await chrome.runtime.sendMessage(initMsg);

    if (!response || !response.series) {
      console.error('[MangaVerse] Invalid response from background worker');
      return;
    }

    const { series, currentChapter, progress } = response;

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
