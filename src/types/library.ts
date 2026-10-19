export type ComicFormat = 'manga' | 'manhwa' | 'manhua' | 'webtoon' | 'comic';

export type SeriesPublicationStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled';

export type UserReadingStatus = 'reading' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_read';

export type ReadingDirection = 'ltr' | 'rtl' | 'vertical' | 'webtoon';

export interface Series {
  id: string; // UUID v4 or canonical slug
  title: string;
  altTitles: string[];
  canonicalSlug: string;
  author?: string;
  artist?: string;
  coverUrl?: string;
  format: ComicFormat;
  status: SeriesPublicationStatus;
  userStatus: UserReadingStatus;
  rating?: number; // 1-10
  userNotes?: string;
  genres: string[];
  tags: string[];
  bingeThreshold: number; // e.g. 5, 10, 20. 0 means disabled
  totalChaptersKnown?: number;
  lastReadChapterNumber?: number;
  unreadCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SeriesSourceMapping {
  id: string; // UUID
  seriesId: string; // Foreign key to Series.id
  sourceName: string; // e.g. "mangadex", "generic_horizontal", "generic_longstrip"
  sourceDomain: string; // e.g. "mangadex.org"
  sourceSeriesUrl: string;
  lastCheckedAt?: number;
  latestSourceChapter?: string;
  isPrimary: boolean;
  /** Number of next chapters to fetch for offline reading from this source (0 disables ahead downloads). */
  offlineDownloadAhead?: number;
}

export interface Chapter {
  id: string; // UUID
  seriesId: string; // Foreign key to Series.id
  sourceMappingId: string; // Foreign key to SeriesSourceMapping.id
  chapterNumber: number; // Float for sub-chapters: 12.5, 12.1
  chapterLabel: string; // e.g. "Chapter 12.5: Bonus Illustration"
  sourceUrl: string;
  publishTimestamp?: number;
  detectedAt: number;
  isRead: boolean;
  readAt?: number;
}

export interface ReadingProgress {
  seriesId: string; // Primary key
  lastReadChapterId: string;
  lastReadChapterNumber: number;
  scrollPositionPercent: number; // 0.0 - 1.0
  scrollPixelOffset: number;
  activeReadingMode: ReadingDirection;
  lastReadTimestamp: number;
  completedChapterIds: string[];
}

export interface NotificationRecord {
  id: string;
  seriesId: string;
  chapterId?: string;
  seriesTitle: string;
  chapterLabel?: string;
  message: string;
  sourceUrl: string;
  timestamp: number;
  isRead: boolean;
  type: 'chapter_update' | 'binge_threshold' | 'hiatus_return';
}

export interface ReadingSession {
  id: string;
  seriesId: string;
  chapterId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
}

export interface OfflineChapter {
  chapterId: string;
  seriesId: string;
  seriesTitle: string;
  chapterNumber: number;
  chapterLabel: string;
  sourceUrl: string;
  savedAt: number;
  status: 'downloading' | 'ready' | 'failed';
  pageCount: number;
  downloadedPages: number;
  totalBytes: number;
  error?: string;
}

export interface OfflinePage {
  chapterId: string;
  pageIndex: number;
  image: Blob;
  mimeType: string;
  sourceUrl: string;
  byteSize: number;
}
