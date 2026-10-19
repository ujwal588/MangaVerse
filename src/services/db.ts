import Dexie, { type EntityTable } from 'dexie';
import { Series, SeriesSourceMapping, Chapter, ReadingProgress, NotificationRecord, ReadingSession } from '../types/library';
import { PageTranslationResult, TerminologyGlossaryEntry } from './translation/types';

export class MangaVerseDatabase extends Dexie {
  series!: EntityTable<Series, 'id'>;
  sourceMappings!: EntityTable<SeriesSourceMapping, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  progress!: EntityTable<ReadingProgress, 'seriesId'>;
  notifications!: EntityTable<NotificationRecord, 'id'>;
  sessions!: EntityTable<ReadingSession, 'id'>;
  translationCache!: EntityTable<PageTranslationResult, 'pageHash'>;
  glossary!: EntityTable<TerminologyGlossaryEntry, 'id'>;

  constructor() {
    super('MangaVerseDB');
    this.version(1).stores({
      series: 'id, canonicalSlug, userStatus, format, rating, unreadCount, updatedAt, title',
      sourceMappings: 'id, seriesId, sourceName, sourceDomain, [seriesId+sourceDomain], sourceSeriesUrl',
      chapters: 'id, seriesId, sourceMappingId, chapterNumber, isRead, publishTimestamp, detectedAt, [seriesId+chapterNumber]',
      progress: 'seriesId, lastReadChapterNumber, lastReadTimestamp',
      notifications: 'id, seriesId, timestamp, isRead, type',
      sessions: 'id, seriesId, startedAt',
    });

    this.version(2).stores({
      translationCache: 'pageHash, imageUrl, createdAt',
      glossary: 'id, seriesId, sourceTerm, targetTerm, [seriesId+sourceTerm]',
    });
  }
}

export const db = new MangaVerseDatabase();
