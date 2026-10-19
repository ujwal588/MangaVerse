import { BaseSiteAdapter } from './base';
import { DetectedSeriesMetadata, DetectedChapterMetadata } from '../../types/adapter';
import { normalizeChapter } from '../../services/chapterNormalizer';

export class GenericLongstripAdapter extends BaseSiteAdapter {
  id = 'generic_longstrip';
  name = 'Vertical Webtoon Reader';
  description = 'Heuristic adapter for long-strip vertical manhwa and webtoon reading websites';

  domainMatches(_url: string): boolean {
    return true; // Fallback
  }

  isReaderPage(url: string, doc: Document): boolean {
    const hasLongstripContainer = !!doc.querySelector(
      '.reading-content, #readerarea, .readercontent, .comic-view, .webtoon-image-list, #chapter-container'
    );
    const hasManyImages = doc.querySelectorAll('img[src*="chapter"], img[loading="lazy"], .wp-manga-chapter-img').length >= 3;
    return hasLongstripContainer || (hasManyImages && /\/(?:chapter|read|c)[\/-]?\d+/i.test(url));
  }

  async detectSeries(doc: Document, url: string): Promise<DetectedSeriesMetadata | null> {
    const breadcrumbSeries = doc.querySelector<HTMLAnchorElement>(
      '.breadcrumb a:nth-child(2), .breadcrumbs li:nth-child(2) a, a.back-to-series'
    );
    let title = breadcrumbSeries?.textContent?.trim();
    let seriesUrl = breadcrumbSeries?.href;

    if (!title) {
      const heading = doc.querySelector('h1, h2.entry-title');
      if (heading?.textContent) {
        title = heading.textContent.split(/chapter|ch\.?|ep/i)[0].trim();
      }
    }

    if (!title) {
      title = doc.title.split(/chapter|ch\.?|-|–|\|/i)[0].trim() || 'Manhwa Title';
    }

    return {
      title,
      sourceSeriesUrl: seriesUrl || url,
      format: 'manhwa',
      defaultReadingMode: 'vertical'
    };
  }

  async detectChapter(doc: Document, url: string): Promise<DetectedChapterMetadata | null> {
    const heading = doc.querySelector('h1, h2.chapter-title, span.current-chapter');
    let rawText = heading?.textContent || '';

    if (!rawText) {
      const match = url.match(/(?:chapter|ch|episode|ep)[_\/-]?(\d+(?:\.\d+)?)/i);
      rawText = match ? `Chapter ${match[1]}` : doc.title;
    }

    const normalized = normalizeChapter(rawText);

    return {
      chapterNumber: normalized.chapterNumber,
      chapterLabel: normalized.displayLabel,
      sourceChapterUrl: url
    };
  }

  extractPageElements(doc: Document): HTMLElement[] {
    const images = doc.querySelectorAll<HTMLImageElement>(
      '.reading-content img, #readerarea img, .readercontent img, .wp-manga-chapter-img, .comic-view img'
    );
    return Array.from(images);
  }
}
