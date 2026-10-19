import { BaseSiteAdapter } from './base';
import { DetectedSeriesMetadata, DetectedChapterMetadata } from '../../types/adapter';
import { normalizeChapter } from '../../services/chapterNormalizer';

export class WebtoonsAdapter extends BaseSiteAdapter {
  id = 'webtoons';
  name = 'LINE Webtoons';
  description = 'Dedicated adapter for Webtoons.com official reader';

  domainMatches(url: string): boolean {
    return /webtoons\.com/i.test(url);
  }

  isReaderPage(url: string, doc: Document): boolean {
    const isViewerUrl = /\/viewer/i.test(url) || url.includes('episode_no=');
    const hasViewerBox = !!doc.querySelector('#_viewerBox, .viewer_lst, #_imageList, .viewer_img');
    return isViewerUrl || hasViewerBox;
  }

  async detectSeries(doc: Document, url: string): Promise<DetectedSeriesMetadata | null> {
    // 1. Try DOM elements: header title, episode info
    const subjEl = doc.querySelector('.subj_info a.subj, .subj_info h1, .subj_episode, .subj');
    let title = subjEl?.textContent?.trim();

    // 2. Try Open Graph meta tag
    if (!title) {
      const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) {
        title = ogTitle.split(/\||-|Episode/i)[0].trim();
      }
    }

    // 3. Fallback to parsing URL slug: /en/action/necromancer-the-ultimate-scourge/episode-5/viewer
    if (!title) {
      const match = url.match(/webtoons\.com\/[^/]+\/[^/]+\/([^/]+)\//i);
      if (match && match[1]) {
        title = match[1]
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }

    if (!title) {
      title = doc.title.split(/\||-/)[0].trim() || 'Webtoon Series';
    }

    // Try finding series home link
    const seriesLink = doc.querySelector<HTMLAnchorElement>('.subj_info a, a.back_btn');
    const sourceSeriesUrl = seriesLink?.href || url.split('/viewer')[0];

    return {
      title,
      sourceSeriesUrl,
      format: 'webtoon',
      defaultReadingMode: 'vertical',
    };
  }

  async detectChapter(doc: Document, url: string): Promise<DetectedChapterMetadata | null> {
    // 1. Try URL query parameter: episode_no=5
    let chapterNum: number | undefined;
    const urlObj = new URL(url, 'https://www.webtoons.com');
    const epParam = urlObj.searchParams.get('episode_no');
    if (epParam) {
      const parsed = parseFloat(epParam);
      if (!isNaN(parsed)) chapterNum = parsed;
    }

    // 2. Try URL path: episode-5
    if (chapterNum === undefined) {
      const match = url.match(/episode-(\d+(?:\.\d+)?)/i);
      if (match && match[1]) {
        chapterNum = parseFloat(match[1]);
      }
    }

    // 3. Try DOM: .subj_episode
    const subjEpisode = doc.querySelector('.subj_episode, .date, span.tx')?.textContent?.trim();
    const label = subjEpisode || (chapterNum !== undefined ? `Episode ${chapterNum}` : 'Episode 1');
    const normalized = normalizeChapter(label);

    return {
      chapterNumber: chapterNum !== undefined ? chapterNum : normalized.chapterNumber,
      chapterLabel: label,
      sourceChapterUrl: url,
    };
  }

  extractPageElements(doc: Document): HTMLElement[] {
    const images = doc.querySelectorAll<HTMLImageElement>(
      '#_viewerBox img, .viewer_lst img, .viewer_img img, #_imageList img, div[class*="viewer"] img'
    );
    return Array.from(images);
  }
}
