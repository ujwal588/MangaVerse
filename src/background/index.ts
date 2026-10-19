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
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => {
      console.error('[MangaVerse] Error handling message:', err);
      sendResponse({ error: String(err) });
    });
  return true; // Keep channel open for async response
});

async function handleMessage(message: ExtensionMessage, sender?: chrome.runtime.MessageSender): Promise<any> {
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
        offlineDownloadAhead: mapping.offlineDownloadAhead ?? 0,
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

    case 'OPEN_OFFLINE_SAVER': {
      const tabId = sender?.tab?.id;
      if (tabId === undefined) return { success: false, error: 'Open the saver from a manga chapter page.' };
      const url = new URL(chrome.runtime.getURL('src/dashboard/index.html'));
      url.searchParams.set('offlineSaveTabId', String(tabId));
      await chrome.tabs.create({ url: url.toString() });
      return { success: true };
    }

    case 'OFFLINE_SAVE_START': {
      const { chapter, pageCount } = message;
      if (!chapter.chapterId || !chapter.seriesId || pageCount < 1 || pageCount > 500) {
        return { success: false, error: 'This chapter has no downloadable pages or exceeds the 500-page limit.' };
      }
      const record = {
        ...chapter,
        savedAt: Date.now(),
        status: 'downloading' as const,
        pageCount,
        downloadedPages: 0,
        totalBytes: 0,
      };
      await db.transaction('rw', db.offlineChapters, db.offlinePages, async () => {
        await db.offlinePages.where('chapterId').equals(chapter.chapterId).delete();
        await db.offlineChapters.put(record);
      });
      return { success: true };
    }

    case 'OFFLINE_SAVE_PAGE': {
      const { chapterId, pageIndex, pageUrl } = message;
      const record = await db.offlineChapters.get(chapterId);
      if (!record || record.status !== 'downloading' || pageIndex < 0 || pageIndex >= record.pageCount) {
        return { success: false, error: 'The chapter download is no longer active.' };
      }

      const parsedPageUrl = new URL(pageUrl);
      if (parsedPageUrl.protocol !== 'https:' && parsedPageUrl.protocol !== 'http:') {
        return { success: false, error: 'This page uses an unsupported image URL.' };
      }
      const originPattern = `${parsedPageUrl.origin}/*`;
      const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
      if (!hasPermission) {
        return { success: false, error: `MangaVerse does not have permission to download images from ${parsedPageUrl.host}.` };
      }

      const response = await fetch(parsedPageUrl.toString(), {
        credentials: 'include',
        referrer: record.sourceUrl,
      });
      if (!response.ok) throw new Error(`Page ${pageIndex + 1} returned HTTP ${response.status}.`);
      const image = await response.blob();
      if (!image.size || image.size > 75 * 1024 * 1024) {
        throw new Error(`Page ${pageIndex + 1} is empty or larger than 75 MB.`);
      }
      if (!image.type.startsWith('image/')) {
        throw new Error(`Page ${pageIndex + 1} did not return an image. The site may block offline downloads.`);
      }

      const previousPage = await db.offlinePages.get([chapterId, pageIndex]);
      if (record.totalBytes - (previousPage?.byteSize || 0) + image.size > 500 * 1024 * 1024) {
        throw new Error('This chapter would use more than 500 MB of local storage.');
      }
      await db.transaction('rw', db.offlineChapters, db.offlinePages, async () => {
        await db.offlinePages.put({
          chapterId,
          pageIndex,
          image,
          mimeType: image.type,
          sourceUrl: parsedPageUrl.toString(),
          byteSize: image.size,
        });
        const current = await db.offlineChapters.get(chapterId);
        if (current) {
          await db.offlineChapters.update(chapterId, {
            downloadedPages: current.downloadedPages + (previousPage ? 0 : 1),
            totalBytes: current.totalBytes - (previousPage?.byteSize || 0) + image.size,
          });
        }
      });
      return { success: true, byteSize: image.size };
    }

    case 'OFFLINE_SAVE_FINISH': {
      const record = await db.offlineChapters.get(message.chapterId);
      if (!record) return { success: false, error: 'Saved chapter record was not found.' };
      const ready = message.success && record.downloadedPages === record.pageCount;
      await db.offlineChapters.update(message.chapterId, {
        status: ready ? 'ready' : 'failed',
        error: ready ? undefined : (message.error || 'Some pages could not be saved.'),
        savedAt: ready ? Date.now() : record.savedAt,
      });
      return { success: ready, error: ready ? undefined : message.error };
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
