import { db } from './db';
import { Chapter, ReadingProgress } from '../types/library';

export interface ProgressMergeSummary {
  seriesId: string;
  previousHighestRead: number;
  newHighestRead: number;
  totalChaptersMarkedRead: number;
  hasChanged: boolean;
}

/**
 * Reconciles reading progress across multiple sources for a series.
 * Ensures the highest read chapter number and all completed chapter numbers
 * are unified without data loss or regressions.
 */
export async function mergeCrossSourceProgress(seriesId: string): Promise<ProgressMergeSummary> {
  const [existingProgress, allChapters] = await Promise.all([
    db.progress.get(seriesId),
    db.chapters.where('seriesId').equals(seriesId).toArray(),
  ]);

  const previousHighest = existingProgress?.lastReadChapterNumber || 0;

  // 1. Collect all chapter numbers that are flagged as read
  const readChapterNumbers = new Set<number>();
  for (const ch of allChapters) {
    if (ch.isRead) {
      readChapterNumbers.add(ch.chapterNumber);
    }
  }

  // 2. Cross-mark any chapter with equivalent chapterNumber as read across all sources
  let markedCount = 0;
  await db.transaction('rw', db.chapters, async () => {
    for (const ch of allChapters) {
      if (!ch.isRead && readChapterNumbers.has(ch.chapterNumber)) {
        await db.chapters.update(ch.id, {
          isRead: true,
          readAt: Date.now(),
        });
        markedCount++;
      }
    }
  });

  // 3. Compute new highest read chapter
  let newHighest = previousHighest;
  for (const num of readChapterNumbers) {
    if (num > newHighest) {
      newHighest = num;
    }
  }

  // 4. Update ReadingProgress record
  const allReadChapterIds = allChapters
    .filter(c => c.isRead || readChapterNumbers.has(c.chapterNumber))
    .map(c => c.id);

  if (newHighest !== previousHighest || markedCount > 0) {
    const updatedProgress: ReadingProgress = {
      seriesId,
      lastReadChapterId: existingProgress?.lastReadChapterId || (allChapters[0]?.id || ''),
      lastReadChapterNumber: newHighest,
      scrollPositionPercent: existingProgress?.scrollPositionPercent || 1.0,
      scrollPixelOffset: existingProgress?.scrollPixelOffset || 0,
      activeReadingMode: existingProgress?.activeReadingMode || 'vertical',
      lastReadTimestamp: Date.now(),
      completedChapterIds: allReadChapterIds,
    };

    const unreadCount = allChapters.length - readChapterNumbers.size;

    await db.transaction('rw', [db.progress, db.series], async () => {
      await db.progress.put(updatedProgress);
      await db.series.update(seriesId, {
        lastReadChapterNumber: newHighest,
        unreadCount: Math.max(0, unreadCount),
        updatedAt: Date.now(),
      });
    });

    return {
      seriesId,
      previousHighestRead: previousHighest,
      newHighestRead: newHighest,
      totalChaptersMarkedRead: markedCount,
      hasChanged: true,
    };
  }

  return {
    seriesId,
    previousHighestRead: previousHighest,
    newHighestRead: previousHighest,
    totalChaptersMarkedRead: 0,
    hasChanged: false,
  };
}
