import { AdapterRegistry } from './adapters/registry';
import { ScrollTracker } from './scrollTracker';
import { ReaderHUD } from './hud/ReaderHUD';
import { PageInitMessage, PageInitResponse, UpdateProgressMessage } from '../types/messages';

async function initContentScript() {
  const url = window.location.href;
  const adapter = AdapterRegistry.getMatchingAdapter(url, document);

  if (!adapter) {
    // Not a supported reader page
    return;
  }

  console.log(`[MangaVerse] Matched adapter: ${adapter.name} (${adapter.id})`);

  try {
    const [seriesMeta, chapterMeta] = await Promise.all([
      adapter.detectSeries(document, url),
      adapter.detectChapter(document, url),
    ]);

    if (!seriesMeta || !chapterMeta) {
      console.warn('[MangaVerse] Could not detect series or chapter metadata');
      return;
    }

    console.log(`[MangaVerse] Detected: ${seriesMeta.title} - ${chapterMeta.chapterLabel}`);

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
      initialPercent: progress?.scrollPositionPercent,
      isInitiallyCompleted: currentChapter.isRead,
      onOpenDashboard: () => {
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
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
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}
