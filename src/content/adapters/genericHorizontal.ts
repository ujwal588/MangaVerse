import { BaseSiteAdapter } from './base';
import { DetectedSeriesMetadata, DetectedChapterMetadata } from '../../types/adapter';
import { normalizeChapter } from '../../services/chapterNormalizer';

export class GenericHorizontalAdapter extends BaseSiteAdapter {
  id = 'generic_horizontal';
  name = 'Standard Horizontal Reader';
  description = 'Heuristic adapter for paginated manga reader websites';

  domainMatches(_url: string): boolean {
    return true; // Used as a fallback adapter
  }

  isReaderPage(url: string, doc: Document): boolean {
    // Check if URL or DOM contains indicators of a reader chapter
    const hasChapterInUrl = /\/(?:chapter|ch|read|episode|c)[\/-]?\d+/i.test(url);
    const hasReaderImage = !!doc.querySelector('img#open-image, img.viewer-img, #image-container img, .page-image img');
    return hasChapterInUrl || hasReaderImage;
  }

  async detectSeries(doc: Document, url: string): Promise<DetectedSeriesMetadata | null> {
    // Try to find breadcrumb link back to series
    const breadcrumbSeries = doc.querySelector<HTMLAnchorElement>(
      '.breadcrumb a:nth-last-child(2), .breadcrumbs a:nth-last-child(2), .navi-change-chapter-btn-prev'
    );
    let title = breadcrumbSeries?.textContent?.trim();
    let seriesUrl = breadcrumbSeries?.href;

    if (!title) {
      // Look for meta title or og:title
      const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) {
        title = ogTitle.split(/chapter|ch\.?|ep/i)[0].trim();
      }
    }

    if (!title) {
      // Split page title
      title = doc.title.split(/chapter|ch\.?|-|–|\|/i)[0].trim() || 'Manga Title';
    }

    return {
      title,
      sourceSeriesUrl: seriesUrl || url,
      format: 'manga',
      defaultReadingMode: 'rtl'
    };
  }

  async detectChapter(doc: Document, url: string): Promise<DetectedChapterMetadata | null> {
    // Try to extract chapter string from select dropdown or current breadcrumb
    const activeChapterOption = doc.querySelector<HTMLOptionElement>(
      'select.chapter-select option:checked, select#chapter-changer option:checked, .breadcrumb span:last-child'
    );
    let rawText = activeChapterOption?.textContent || '';

    if (!rawText) {
      // Extract from URL
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
      'img#open-image, img.viewer-img, #image-container img, .page-image img, .reader-main img'
    );
    return Array.from(images);
  }
}
