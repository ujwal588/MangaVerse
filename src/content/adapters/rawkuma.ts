import { BaseSiteAdapter } from './base';
import { DetectedSeriesMetadata, DetectedChapterMetadata } from '../../types/adapter';
import { normalizeChapter } from '../../services/chapterNormalizer';

export class RawkumaAdapter extends BaseSiteAdapter {
  id = 'rawkuma';
  name = 'Rawkuma (Raw Manga)';
  description = 'Dedicated adapter for rawkuma.net Japanese raw manga reader';

  domainMatches(url: string): boolean {
    return /rawkuma\.net/i.test(url);
  }

  isReaderPage(url: string, doc: Document): boolean {
    const isChapterUrl = /\/chapter-?\d+/i.test(url) || url.includes('/manga/') && url.includes('chapter');
    const hasReaderContainer = !!doc.querySelector('.reading-content, .read-container, #readerarea, .wp-manga-chapter-img');
    return isChapterUrl || hasReaderContainer;
  }

  async detectSeries(doc: Document, url: string): Promise<DetectedSeriesMetadata | null> {
    let title = '';

    // 1. Try Breadcrumbs: .c-breadcrumb a, .breadcrumb a, ol.breadcrumb a, .allc a
    const breadcrumbLinks = doc.querySelectorAll<HTMLAnchorElement>(
      '.c-breadcrumb a, .breadcrumb a, ol.breadcrumb li a, .allc a, a[href*="/manga/"]'
    );
    for (const link of Array.from(breadcrumbLinks)) {
      const text = link.textContent?.trim() || '';
      const href = link.href || '';
      // Find link pointing to series overview (/manga/{slug}/) and not home or chapters
      if (href.includes('/manga/') && !href.includes('/chapter') && text.length > 1 && !text.toLowerCase().includes('home') && !text.toLowerCase().includes('manga')) {
        title = text;
        break;
      }
    }

    // 2. Try Open Graph title
    if (!title) {
      const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) {
        // e.g. "Kashita Maryoku wa Revo-barai de Kyousei Choushuu - Chapter 39 - Rawkuma"
        title = ogTitle.split(/\s*-\s*Chapter|\s*-\s*Rawkuma|\|/i)[0].trim();
      }
    }

    // 3. Try Chapter Heading: h1#chapter-heading, h1.entry-title
    if (!title) {
      const heading = doc.querySelector('h1#chapter-heading, h1.entry-title');
      if (heading?.textContent) {
        title = heading.textContent.split(/\s*-\s*Chapter|Chapter/i)[0].trim();
      }
    }

    // 4. Fallback to URL parsing: https://rawkuma.net/manga/{slug}/chapter-{n}/
    if (!title) {
      const match = url.match(/rawkuma\.net\/manga\/([^/]+)/i);
      if (match && match[1]) {
        title = match[1]
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }

    if (!title) {
      title = doc.title.split(/Chapter|-|\|/i)[0].trim() || 'Raw Manga';
    }

    // Determine source series URL
    const seriesLink = doc.querySelector<HTMLAnchorElement>('.c-breadcrumb a[href*="/manga/"], .allc a');
    const sourceSeriesUrl = seriesLink?.href || url.split('/chapter')[0];

    return {
      title,
      sourceSeriesUrl,
      format: 'manga',
      defaultReadingMode: 'rtl',
    };
  }

  async detectChapter(doc: Document, url: string): Promise<DetectedChapterMetadata | null> {
    let chapterNum: number | undefined;

    // 1. Try URL regex: chapter-39 or chapter-39.5
    const urlMatch = url.match(/chapter-(\d+(?:\.\d+)?)/i);
    if (urlMatch && urlMatch[1]) {
      chapterNum = parseFloat(urlMatch[1]);
    }

    // 2. Try active dropdown or heading
    const activeOption = doc.querySelector<HTMLOptionElement>('select.single-post-select option:checked, select#chapter-changer option:checked');
    const headingEl = doc.querySelector('h1#chapter-heading, .c-breadcrumb span.active, .breadcrumb li.active');
    const rawLabel = activeOption?.textContent?.trim() || headingEl?.textContent?.trim() || '';

    const normalized = normalizeChapter(rawLabel);
    const finalNumber = chapterNum !== undefined ? chapterNum : normalized.chapterNumber;
    const finalLabel = rawLabel || `Chapter ${finalNumber}`;

    return {
      chapterNumber: finalNumber,
      chapterLabel: finalLabel,
      sourceChapterUrl: url,
    };
  }

  extractPageElements(doc: Document): HTMLElement[] {
    const images = doc.querySelectorAll<HTMLImageElement>(
      '.reading-content img, .read-container img, #readerarea img, .wp-manga-chapter-img, .page-break img'
    );
    return Array.from(images);
  }
}
