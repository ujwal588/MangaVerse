import { SiteAdapter } from '../../types/adapter';

export abstract class BaseSiteAdapter implements SiteAdapter {
  abstract id: string;
  abstract name: string;
  abstract description: string;

  abstract domainMatches(url: string): boolean;
  abstract isReaderPage(url: string, doc: Document): boolean;
  abstract detectSeries(doc: Document, url: string): Promise<import('../../types/adapter').DetectedSeriesMetadata | null>;
  abstract detectChapter(doc: Document, url: string): Promise<import('../../types/adapter').DetectedChapterMetadata | null>;
  abstract extractPageElements(doc: Document): HTMLElement[];

  getNextChapterUrl(doc: Document): string | null {
    const nextEl = doc.querySelector<HTMLAnchorElement>(
      'a[rel="next"], a.next, a.next_page, a.btn-next, a[title*="Next Chapter" i], a[aria-label*="next chapter" i]'
    );
    if (nextEl?.href) return nextEl.href;
    const textLink = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]')).find((anchor) =>
      /\bnext\s*(chapter|ch\.?|episode|ep\.?)?\b/i.test(anchor.textContent || '')
    );
    return textLink?.href || null;
  }

  getPrevChapterUrl(doc: Document): string | null {
    const prevEl = doc.querySelector<HTMLAnchorElement>(
      'a[rel="prev"], a.prev, a.prev_page, a.btn-prev, a[title*="Prev Chapter" i]'
    );
    return prevEl?.href || null;
  }
}
