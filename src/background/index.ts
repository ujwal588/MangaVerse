import { setupAlarms } from './alarms';
import { performUpdateCheck } from './updateChecker';
import { resolveOrCreateSeries } from '../services/seriesResolver';
import { db } from '../services/db';
import { ReadingProgress } from '../types/library';
import {
  ExtensionMessage,
  PageInitResponse,
  MtCheckResponse,
} from '../types/messages';

// Initialize alarms on extension install / update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[MangaVerse] Extension installed/updated.');
  setupAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[MangaVerse] Browser started.');
  setupAlarms();
});

// Central message listener
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => {
      console.error('[MangaVerse] Error handling message:', err);
      sendResponse({ error: String(err) });
    });
  return true; // Keep channel open for async response
});

async function handleMessage(message: ExtensionMessage): Promise<any> {
  switch (message.type) {
    case 'PAGE_INIT': {
      const { url, detectedSeries, detectedChapter } = message;
      const parsedUrl = new URL(url);
      const sourceDomain = parsedUrl.hostname;
      let sourceName = 'generic';
      if (sourceDomain.includes('mangadex')) sourceName = 'mangadex';
      else if (sourceDomain.includes('webtoons')) sourceName = 'webtoons';

      // 1. Resolve or create canonical series
      const { series, mapping } = await resolveOrCreateSeries(
        detectedSeries,
        sourceName,
        sourceDomain
      );

      // 2. Find or register current chapter
      let chapter = await db.chapters
        .where('[seriesId+chapterNumber]')
        .equals([series.id, detectedChapter.chapterNumber])
        .first();

      if (!chapter) {
        chapter = {
          id: crypto.randomUUID(),
          seriesId: series.id,
          sourceMappingId: mapping.id,
          chapterNumber: detectedChapter.chapterNumber,
          chapterLabel: detectedChapter.chapterLabel,
          sourceUrl: detectedChapter.sourceChapterUrl,
          detectedAt: Date.now(),
          isRead: false,
        };
        await db.chapters.add(chapter);
      }

      // 3. Immediately persist or update reading progress so it shows in library & popup instantly
      let progress = await db.progress.get(series.id);
      const now = Date.now();

      if (!progress) {
        progress = {
          seriesId: series.id,
          lastReadChapterId: chapter.id,
          lastReadChapterNumber: chapter.chapterNumber,
          scrollPositionPercent: 0,
          scrollPixelOffset: 0,
          activeReadingMode: detectedSeries.defaultReadingMode || 'vertical',
          lastReadTimestamp: now,
          completedChapterIds: [],
        };
      } else {
        progress.lastReadChapterId = chapter.id;
        progress.lastReadChapterNumber = chapter.chapterNumber;
        progress.lastReadTimestamp = now;
      }
      await db.progress.put(progress);

      // Also ensure series has updated timestamp and current chapter
      await db.series.update(series.id, {
        lastReadChapterNumber: chapter.chapterNumber,
        updatedAt: now,
      });

      const totalChapters = await db.chapters.where('seriesId').equals(series.id).count();
      const unreadCount = await db.chapters
        .where('seriesId')
        .equals(series.id)
        .filter((c) => !c.isRead)
        .count();

      const response: PageInitResponse = {
        type: 'PAGE_INIT_RESPONSE',
        series,
        currentChapter: chapter,
        progress,
        totalChaptersTracked: totalChapters,
        unreadCount,
      };

      return response;
    }

    case 'UPDATE_PROGRESS': {
      const { seriesId, chapterId, chapterNumber, scrollPercent, scrollPixelOffset, isCompleted } = message;

      const now = Date.now();

      // Update chapter completion status
      if (isCompleted) {
        await db.chapters.update(chapterId, {
          isRead: true,
          readAt: now,
        });

        // Recalculate unread count
        const unreadCount = await db.chapters
          .where('seriesId')
          .equals(seriesId)
          .filter((c) => !c.isRead)
          .count();

        await db.series.update(seriesId, {
          lastReadChapterNumber: chapterNumber,
          unreadCount,
          updatedAt: now,
        });
      }

      // Update reading progress record
      const existingProgress = await db.progress.get(seriesId);
      const completedSet = new Set(existingProgress?.completedChapterIds || []);
      if (isCompleted) completedSet.add(chapterId);

      const updatedProgress: ReadingProgress = {
        seriesId,
        lastReadChapterId: chapterId,
        lastReadChapterNumber: chapterNumber,
        scrollPositionPercent: scrollPercent,
        scrollPixelOffset,
        activeReadingMode: existingProgress?.activeReadingMode || 'vertical',
        lastReadTimestamp: now,
        completedChapterIds: Array.from(completedSet),
      };

      await db.progress.put(updatedProgress);
      return { success: true };
    }

    case 'TRIGGER_CHECK_UPDATES': {
      const result = await performUpdateCheck();
      return {
        type: 'UPDATE_CHECK_COMPLETE',
        newChaptersFound: result.newChaptersCount,
        notificationsGenerated: [],
      };
    }

    case 'OPEN_DASHBOARD': {
      const dashboardUrl = chrome.runtime.getURL('src/dashboard/index.html');
      chrome.tabs.create({ url: dashboardUrl });
      return { success: true };
    }

    case 'MT_CHECK': {
      const port = (message as any).port ?? 7676;
      // MangaTranslator moved its Gradio API under /gradio_api in v6.
      // Keep the legacy path for older installations.
      for (const path of ['/gradio_api/info', '/info']) {
        try {
          const resp = await fetch(`http://localhost:${port}${path}`, {
            signal: AbortSignal.timeout(2000),
          });
          if (resp.ok) {
            const result: MtCheckResponse = { type: 'MT_CHECK_RESPONSE', available: true };
            return result;
          }
        } catch {
          // Try the next supported health endpoint.
        }
      }
      return { type: 'MT_CHECK_RESPONSE', available: false };
    }

    case 'OPEN_MANGA_TRANSLATOR': {
      const port = (message as any).port ?? 7676;
      await chrome.tabs.create({ url: `http://localhost:${port}` });
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
