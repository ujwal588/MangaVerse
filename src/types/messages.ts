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
  | 'PROXY_FETCH_IMAGE'
  | 'PROXY_FETCH_IMAGE_RESPONSE'
  | 'OPEN_DASHBOARD';

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

export interface ProxyFetchImageMessage {
  type: 'PROXY_FETCH_IMAGE';
  imageUrl: string;
}

export interface ProxyFetchImageResponse {
  type: 'PROXY_FETCH_IMAGE_RESPONSE';
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface CheckUpdatesMessage {
  type: 'TRIGGER_CHECK_UPDATES';
}

export interface CheckUpdatesResponse {
  type: 'UPDATE_CHECK_COMPLETE';
  newChaptersFound: number;
  notificationsGenerated: NotificationRecord[];
}

export type ExtensionMessage =
  | PageInitMessage
  | PageInitResponse
  | UpdateProgressMessage
  | ProxyFetchImageMessage
  | ProxyFetchImageResponse
  | CheckUpdatesMessage
  | CheckUpdatesResponse;
