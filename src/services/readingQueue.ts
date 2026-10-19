import { db } from './db';
import { Series, Chapter } from '../types/library';

export interface QueueItem {
  seriesId: string;
  seriesTitle: string;
  format: string;
  nextChapter: Chapter;
  estimatedMinutes: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ReadingQueuePlan {
  totalEstimatedMinutes: number;
  items: QueueItem[];
}

/**
 * Builds an intelligent Reading Queue from unread chapters of series in 'reading' status.
 */
export async function generateReadingQueue(maxMinutesBudget?: number): Promise<ReadingQueuePlan> {
  const activeSeries = await db.series
    .filter(s => s.userStatus === 'reading')
    .toArray();

  const queueItems: QueueItem[] = [];

  for (const series of activeSeries) {
    // Find the next unread chapter
    const nextChapter = await db.chapters
      .where('seriesId')
      .equals(series.id)
      .filter(c => !c.isRead)
      .sortBy('chapterNumber')
      .then(chs => chs[0]);

    if (nextChapter) {
      // Manhwa / Webtoon typically takes ~7-8 mins, Manga takes ~5-6 mins
      const estimatedMinutes = series.format === 'manhwa' || series.format === 'webtoon' ? 8 : 6;
      const priority = (series.unreadCount || 0) >= 10 ? 'high' : 'medium';

      queueItems.push({
        seriesId: series.id,
        seriesTitle: series.title,
        format: series.format,
        nextChapter,
        estimatedMinutes,
        priority,
      });
    }
  }

  // Sort queue: high priority first
  queueItems.sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return priorityWeight[b.priority] - priorityWeight[a.priority];
  });

  // Filter by budget if provided
  let filteredItems = queueItems;
  if (maxMinutesBudget && maxMinutesBudget > 0) {
    let accumulated = 0;
    filteredItems = [];
    for (const item of queueItems) {
      if (accumulated + item.estimatedMinutes <= maxMinutesBudget) {
        filteredItems.push(item);
        accumulated += item.estimatedMinutes;
      }
    }
  }

  const totalEstimatedMinutes = filteredItems.reduce((acc, curr) => acc + curr.estimatedMinutes, 0);

  return {
    totalEstimatedMinutes,
    items: filteredItems,
  };
}
