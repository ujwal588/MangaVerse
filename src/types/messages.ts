import { Series, Chapter, ReadingProgress, NotificationRecord } from './library';
import { DetectedSeriesMetadata, DetectedChapterMetadata } from './adapter';

export type ExtensionMessageType =
  | 'PAGE_INIT'
  | 'PAGE_INIT_RESPONSE'
  | 'UPDATE_PROGRESS'
  | 'UPDATE_PROGRESS_ACK'
  | 'GET_SERIES_STATE'
  | 'TRIGGER_CHECK_UPDATES'
  | 'UPDATE_CHECK_COMPLETE'
  | 'OPEN_DASHBOARD'
  | 'OPEN_MANGA_TRANSLATOR'
  | 'OPEN_OFFLINE_SAVER'
  | 'OFFLINE_SAVE_START'
  | 'OFFLINE_SAVE_PAGE'
  | 'OFFLINE_SAVE_FINISH'
  | 'MT_CHECK'
  | 'MT_CHECK_RESPONSE';

export interface OfflinePageSource {
  url: string;
  alt?: string;
}

export interface OfflineChapterInfo {
  chapterId: string;
  seriesId: string;
  seriesTitle: string;
  chapterNumber: number;
  chapterLabel: string;
  sourceUrl: string;
  nextChapterUrl?: string;
  offlineDownloadAhead: number;
  pages: OfflinePageSource[];
}

export interface OpenOfflineSaverMessage {
  type: 'OPEN_OFFLINE_SAVER';
}

export interface OfflineSaveStartMessage {
  type: 'OFFLINE_SAVE_START';
  chapter: Omit<OfflineChapterInfo, 'pages'>;
  pageCount: number;
}

export interface OfflineSavePageMessage {
  type: 'OFFLINE_SAVE_PAGE';
  chapterId: string;
  pageIndex: number;
  pageUrl: string;
}

export interface OfflineSaveFinishMessage {
  type: 'OFFLINE_SAVE_FINISH';
  chapterId: string;
  success: boolean;
  error?: string;
}

export interface PageInitMessage {
  type: 'PAGE_INIT';
  url: string;
  detectedSeries: DetectedSeriesMetadata;
  detectedChapter: DetectedChapterMetadata;
  isOfflinePreload?: boolean;
}

export interface PageInitResponse {
  type: 'PAGE_INIT_RESPONSE';
  series: Series;
  currentChapter: Chapter;
  progress?: ReadingProgress;
  totalChaptersTracked: number;
  unreadCount: number;
  offlineDownloadAhead: number;
}

export interface UpdateProgressMessage {
  type: 'UPDATE_PROGRESS';
  seriesId: string;
  chapterId: string;
  chapterNumber: number;
  scrollPercent: number;
  scrollPixelOffset: number;
  isCompleted: boolean;
}

export interface CheckUpdatesMessage {
  type: 'TRIGGER_CHECK_UPDATES';
}

export interface CheckUpdatesResponse {
  type: 'UPDATE_CHECK_COMPLETE';
  newChaptersFound: number;
  notificationsGenerated: NotificationRecord[];
}

export interface OpenDashboardMessage {
  type: 'OPEN_DASHBOARD';
}

export interface OpenMangaTranslatorMessage {
  type: 'OPEN_MANGA_TRANSLATOR';
  port?: number;
}

export interface MtCheckMessage {
  type: 'MT_CHECK';
  port: number;
}

export interface MtCheckResponse {
  type: 'MT_CHECK_RESPONSE';
  available: boolean;
}

export type ExtensionMessage =
  | PageInitMessage
  | PageInitResponse
  | UpdateProgressMessage
  | CheckUpdatesMessage
  | CheckUpdatesResponse
  | OpenDashboardMessage
  | OpenMangaTranslatorMessage
  | OpenOfflineSaverMessage
  | OfflineSaveStartMessage
  | OfflineSavePageMessage
  | OfflineSaveFinishMessage
  | MtCheckMessage
  | MtCheckResponse;
