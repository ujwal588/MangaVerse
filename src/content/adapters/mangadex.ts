import { BaseSiteAdapter } from './base';
import { DetectedSeriesMetadata, DetectedChapterMetadata } from '../../types/adapter';
import { normalizeChapter } from '../../services/chapterNormalizer';

export class MangaDexAdapter extends BaseSiteAdapter {
  id = 'mangadex';
  name = 'MangaDex';
  description = 'Official integration and reader support for MangaDex.org';

  domainMatches(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes('mangadex.org');
    } catch {
      return false;
    }
  }

  isReaderPage(url: string, _doc: Document): boolean {
    return url.includes('/chapter/');
  }

  async detectSeries(doc: Document, url: string): Promise<DetectedSeriesMetadata | null> {
    // 1. Try to find link pointing to /title/{uuid} in DOM
    const titleLink = doc.querySelector<HTMLAnchorElement>('a[href*="/title/"]');
    let title = titleLink?.textContent?.trim();
    let seriesUrl = titleLink?.href;

    // 2. If not found in DOM, extract chapter UUID from URL and query MangaDex API
    if (!title) {
      const chapterIdMatch = url.match(/\/chapter\/([a-f0-9-]+)/i);
      if (chapterIdMatch) {
        try {
          const resp = await fetch(`https://api.mangadex.org/chapter/${chapterIdMatch[1]}?includes[]=manga`);
          if (resp.ok) {
            const data = await resp.json();
            const mangaRel = data.data?.relationships?.find((r: any) => r.type === 'manga');
            if (mangaRel) {
              const mangaId = mangaRel.id;
              seriesUrl = `https://mangadex.org/title/${mangaId}`;
              // Get title in en or first available language
              const titleObj = mangaRel.attributes?.title || {};
              title = titleObj.en || Object.values(titleObj)[0] as string || 'MangaDex Title';
            }
          }
        } catch (e) {
          console.warn('[MangaVerse] MangaDex API lookup failed, falling back to document title:', e);
        }
      }
    }

    // Fallback: document title
    if (!title) {
      title = doc.title.split('-')[0].trim() || 'Unknown MangaDex Series';
      seriesUrl = seriesUrl || url;
    }

    return {
      title,
      sourceSeriesUrl: seriesUrl || url,
      format: 'manga',
      defaultReadingMode: 'rtl'
    };
  }

  async detectChapter(doc: Document, url: string): Promise<DetectedChapterMetadata | null> {
    // 1. Look for chapter title or selector text
    const chapterMatch = url.match(/\/chapter\/([a-f0-9-]+)/i);
    let rawChapterText = '';

    // Document title on MangaDex often has: "Chapter 12 - Series Name - MangaDex"
    const titleMatch = doc.title.match(/(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i);
    if (titleMatch) {
      rawChapterText = titleMatch[0];
    } else {
      // Look for reader controls or chapter dropdown in DOM
      const readerHeader = doc.querySelector('[class*="reader--header"], [class*="chapter"]');
      if (readerHeader?.textContent) {
        rawChapterText = readerHeader.textContent;
      }
    }

    if (!rawChapterText && chapterMatch) {
      // Query API for chapter metadata
      try {
        const resp = await fetch(`https://api.mangadex.org/chapter/${chapterMatch[1]}`);
        if (resp.ok) {
          const json = await resp.json();
          const chNum = json.data?.attributes?.chapter;
          const chTitle = json.data?.attributes?.title;
          rawChapterText = chNum ? `Chapter ${chNum}${chTitle ? `: ${chTitle}` : ''}` : 'Chapter 1';
        }
      } catch {
        rawChapterText = 'Chapter 1';
      }
    }

    const normalized = normalizeChapter(rawChapterText || 'Chapter 1');

    return {
      chapterNumber: normalized.chapterNumber,
      chapterLabel: normalized.displayLabel,
      sourceChapterUrl: url
    };
  }

  extractPageElements(doc: Document): HTMLElement[] {
    const images = doc.querySelectorAll<HTMLImageElement>(
      '.reader--container img, .md-reader-container img, [data-page-index] img'
    );
    return Array.from(images);
  }
}
