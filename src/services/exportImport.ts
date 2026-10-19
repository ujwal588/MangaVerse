import { db } from './db';
import { Series, SeriesSourceMapping, Chapter, ReadingProgress, NotificationRecord } from '../types/library';

export interface MangaVerseBackup {
  version: number;
  exportedAt: number;
  series: Series[];
  sourceMappings: SeriesSourceMapping[];
  chapters: Chapter[];
  progress: ReadingProgress[];
  notifications: NotificationRecord[];
}

export async function exportLibraryAsJson(): Promise<string> {
  const [series, sourceMappings, chapters, progress, notifications] = await Promise.all([
    db.series.toArray(),
    db.sourceMappings.toArray(),
    db.chapters.toArray(),
    db.progress.toArray(),
    db.notifications.toArray(),
  ]);

  const backup: MangaVerseBackup = {
    version: 1,
    exportedAt: Date.now(),
    series,
    sourceMappings,
    chapters,
    progress,
    notifications,
  };

  return JSON.stringify(backup, null, 2);
}

export async function importLibraryFromJson(jsonString: string): Promise<{ importedSeriesCount: number }> {
  const data = JSON.parse(jsonString) as MangaVerseBackup;

  if (!data || !Array.isArray(data.series)) {
    throw new Error('Invalid backup format: missing series array');
  }

  await db.transaction('rw', [db.series, db.sourceMappings, db.chapters, db.progress, db.notifications], async () => {
    // Upsert series
    for (const s of data.series) {
      await db.series.put(s);
    }
    if (Array.isArray(data.sourceMappings)) {
      for (const sm of data.sourceMappings) {
        await db.sourceMappings.put(sm);
      }
    }
    if (Array.isArray(data.chapters)) {
      for (const ch of data.chapters) {
        await db.chapters.put(ch);
      }
    }
    if (Array.isArray(data.progress)) {
      for (const p of data.progress) {
        await db.progress.put(p);
      }
    }
    if (Array.isArray(data.notifications)) {
      for (const n of data.notifications) {
        await db.notifications.put(n);
      }
    }
  });

  return { importedSeriesCount: data.series.length };
}

export async function wipeAllUserData(): Promise<void> {
  await db.transaction('rw', [db.series, db.sourceMappings, db.chapters, db.progress, db.notifications, db.sessions], async () => {
    await db.series.clear();
    await db.sourceMappings.clear();
    await db.chapters.clear();
    await db.progress.clear();
    await db.notifications.clear();
    await db.sessions.clear();
  });

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.clear();
  }
}
