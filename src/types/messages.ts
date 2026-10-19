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
  | 'MT_CHECK'
  | 'MT_CHECK_RESPONSE';

export interface PageInitMessage {
  type: 'PAGE_INIT';
  url: string;
  detectedSeries: DetectedSeriesMetadata;
  detectedChapter: DetectedChapterMetadata;
}

export interface PageInitResponse {
  type: 'PAGE_INIT_RESPONSE';
  series: Series;
  currentChapter: Chapter;
  progress?: ReadingProgress;
  totalChaptersTracked: number;
  unreadCount: number;
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
  | MtCheckMessage
  | MtCheckResponse;
