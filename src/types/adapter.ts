import { ComicFormat, ReadingDirection } from './library';

export interface DetectedSeriesMetadata {
  title: string;
  altTitles?: string[];
  canonicalSlug?: string;
  sourceSeriesUrl: string;
  coverUrl?: string;
  author?: string;
  artist?: string;
  format?: ComicFormat;
  defaultReadingMode?: ReadingDirection;
}

export interface DetectedChapterMetadata {
  chapterNumber: number; // Float, e.g. 12.5
  chapterLabel: string;
  sourceChapterUrl: string;
  seriesUrl?: string;
  seriesTitle?: string;
  publishTimestamp?: number;
}

export interface SiteAdapter {
  id: string;
  name: string;
  description: string;
  domainMatches(url: string): boolean;
  isReaderPage(url: string, doc: Document): boolean;
  detectSeries(doc: Document, url: string): Promise<DetectedSeriesMetadata | null>;
  detectChapter(doc: Document, url: string): Promise<DetectedChapterMetadata | null>;
  extractPageElements(doc: Document): HTMLElement[];
  getNextChapterUrl?(doc: Document): string | null;
  getPrevChapterUrl?(doc: Document): string | null;
  fetchLatestChapters?(seriesUrl: string): Promise<DetectedChapterMetadata[]>;
}
