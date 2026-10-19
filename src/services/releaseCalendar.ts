import { db } from './db';

export interface CalendarEvent {
  id: string;
  seriesId: string;
  seriesTitle: string;
  expectedChapterNumber: number;
  expectedDate: string; // ISO format: YYYY-MM-DD
  confidence: 'confirmed' | 'high_prediction' | 'estimated';
  intervalDays?: number;
}

/**
 * Projects upcoming chapter releases based on historical publishing cadence.
 */
export async function generateReleaseCalendar(daysAhead: number = 14): Promise<CalendarEvent[]> {
  const activeSeries = await db.series
    .filter(s => s.userStatus === 'reading' && s.status === 'ongoing')
    .toArray();

  const events: CalendarEvent[] = [];
  const now = Date.now();
  const maxFuture = now + daysAhead * 24 * 60 * 60 * 1000;

  for (const series of activeSeries) {
    const chapters = await db.chapters
      .where('seriesId')
      .equals(series.id)
      .filter(c => !!c.publishTimestamp)
      .sortBy('publishTimestamp');

    if (chapters.length >= 2) {
      // Calculate average interval between recent chapters
      const recent = chapters.slice(-5);
      const intervals: number[] = [];
      for (let i = 1; i < recent.length; i++) {
        const diff = (recent[i].publishTimestamp! - recent[i - 1].publishTimestamp!) / (1000 * 60 * 60 * 24);
        if (diff > 0.5 && diff < 45) {
          intervals.push(diff);
        }
      }

      if (intervals.length > 0) {
        const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
        const lastRelease = recent[recent.length - 1].publishTimestamp!;
        const nextEstimatedTimestamp = lastRelease + avgInterval * 24 * 60 * 60 * 1000;

        if (nextEstimatedTimestamp <= maxFuture) {
          const highestNum = Math.max(...chapters.map(c => c.chapterNumber));
          events.push({
            id: crypto.randomUUID(),
            seriesId: series.id,
            seriesTitle: series.title,
            expectedChapterNumber: highestNum + 1,
            expectedDate: new Date(nextEstimatedTimestamp).toISOString().split('T')[0],
            confidence: avgInterval >= 6 && avgInterval <= 8 ? 'high_prediction' : 'estimated',
            intervalDays: avgInterval,
          });
        }
      }
    }
  }

  // Sort chronologically
  events.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  return events;
}
