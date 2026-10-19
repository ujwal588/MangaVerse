import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle, Download, HardDrive, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { db } from '../../services/db';
import { OfflineChapter, OfflinePage } from '../../types/library';
import { OfflineChapterInfo } from '../../types/messages';

interface OfflineSavePageProps {
  sourceTabId: number;
}

interface OfflineChapterInfoResponse {
  success: boolean;
  chapter?: OfflineChapterInfo;
  error?: string;
}

interface SourceChapterLink {
  url: string;
  chapterNumber: number;
  chapterLabel: string;
}

interface SourceChapterLinksResponse {
  success: boolean;
  chapters?: SourceChapterLink[];
  error?: string;
}

async function waitForTabMessage<T>(tabId: number, message: unknown, timeoutMs = 30000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  let injectionAttempted = false;
  while (Date.now() < deadline) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message) as T;
      if (response) {
        const early = response as T & { success?: boolean; error?: string };
        if (early.success === false && /has not finished identifying/i.test(early.error || '')) {
          await new Promise(resolve => window.setTimeout(resolve, 500));
          continue;
        }
        return response;
      }
    } catch (cause) {
      lastError = cause;
      const errorText = cause instanceof Error ? cause.message : String(cause);
      if (!injectionAttempted && /receiving end does not exist|could not establish connection/i.test(errorText)) {
        const tab = await chrome.tabs.get(tabId).catch(() => undefined);
        if (tab?.status === 'complete') {
          injectionAttempted = true;
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['dist/src/content/index.js'],
            });
            await new Promise(resolve => window.setTimeout(resolve, 100));
            continue;
          } catch (injectionError) {
            const reason = injectionError instanceof Error ? injectionError.message : String(injectionError);
            throw new Error(`MangaVerse could not start its chapter helper on this website: ${reason}`);
          }
        }
      }
    }
    await new Promise(resolve => window.setTimeout(resolve, 500));
  }
  throw new Error(lastError instanceof Error ? lastError.message : 'The page did not respond to MangaVerse.');
}

async function saveOfflineChapterBatch(
  chapters: OfflineChapterInfo[],
  onProgress: (label: string, savedPages: number) => void,
): Promise<string[]> {
  const failures: string[] = [];
  let savedPages = 0;
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
    const item = chapters[chapterIndex];
    const existing = await db.offlineChapters.get(item.chapterId);
    if (existing?.status === 'ready') continue;
    onProgress(`${chapterIndex + 1}/${chapters.length} · ${item.chapterLabel}`, savedPages);
    const start = await chrome.runtime.sendMessage({
      type: 'OFFLINE_SAVE_START',
      chapter: {
        chapterId: item.chapterId,
        seriesId: item.seriesId,
        seriesTitle: item.seriesTitle,
        chapterNumber: item.chapterNumber,
        chapterLabel: item.chapterLabel,
        sourceUrl: item.sourceUrl,
      },
      pageCount: item.pages.length,
    });
    if (!start?.success) {
      failures.push(`${item.chapterLabel}: ${start?.error || 'could not start saving'}`);
      continue;
    }
    try {
      for (let pageIndex = 0; pageIndex < item.pages.length; pageIndex += 1) {
        const result = await chrome.runtime.sendMessage({
          type: 'OFFLINE_SAVE_PAGE',
          chapterId: item.chapterId,
          pageIndex,
          pageUrl: item.pages[pageIndex].url,
        });
        if (!result?.success) throw new Error(result?.error || `Could not save page ${pageIndex + 1}.`);
        savedPages += 1;
        onProgress(`${chapterIndex + 1}/${chapters.length} · ${item.chapterLabel}`, savedPages);
      }
      const finish = await chrome.runtime.sendMessage({ type: 'OFFLINE_SAVE_FINISH', chapterId: item.chapterId, success: true });
      if (!finish?.success) throw new Error(finish?.error || 'The chapter was only partially saved.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await chrome.runtime.sendMessage({ type: 'OFFLINE_SAVE_FINISH', chapterId: item.chapterId, success: false, error: message });
      failures.push(`${item.chapterLabel}: ${message}`);
    }
  }
  return failures;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const openOfflineReader = (chapterId: string) => {
  const url = new URL(chrome.runtime.getURL('dist/src/dashboard/index.html'));
  url.searchParams.set('offlineReader', chapterId);
  void chrome.tabs.create({ url: url.toString() });
};

export const OfflineSavePage: React.FC<OfflineSavePageProps> = ({ sourceTabId }) => {
  const [chapter, setChapter] = useState<OfflineChapterInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [chaptersToSave, setChaptersToSave] = useState<OfflineChapterInfo[]>([]);
  const [prepareMessage, setPrepareMessage] = useState('');
  const [savedPages, setSavedPages] = useState(0);
  const [saveProgress, setSaveProgress] = useState('');
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await chrome.tabs.sendMessage(sourceTabId, { type: 'GET_OFFLINE_CHAPTER_INFO' }) as OfflineChapterInfoResponse;
        if (!response?.success || !response.chapter) {
          throw new Error(response?.error || 'Could not read the current chapter. Return to the chapter and try again.');
        }
        if (!response.chapter.pages.length) throw new Error('No chapter images were found. Scroll through the chapter online so lazy-loaded pages appear, then try again.');
        if (!cancelled) setChapter(response.chapter);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sourceTabId]);

  const prepareChapters = async () => {
    if (!chapter || isPreparing || isSaving) return;
    setIsPreparing(true);
    setError('');
    setPrepareMessage('');
    const collected: OfflineChapterInfo[] = [chapter];
    const visitedUrls = new Set([new URL(chapter.sourceUrl).href]);
    let nextUrl = chapter.nextChapterUrl;
    let warning = '';
    const aheadCount = Math.max(0, Math.min(20, chapter.offlineDownloadAhead || 0));

    try {
      const startingOrigin = new URL(chapter.sourceUrl).origin;
      for (let aheadIndex = 0; aheadIndex < aheadCount && nextUrl; aheadIndex += 1) {
        const candidateUrl = new URL(nextUrl, chapter.sourceUrl).href;
        if (visitedUrls.has(candidateUrl)) break;
        if (new URL(candidateUrl).origin !== startingOrigin) {
          warning = 'Stopped at a next-chapter link on another website; only same-site chapters are included.';
          break;
        }
        visitedUrls.add(candidateUrl);

        const tab = await chrome.tabs.create({ url: candidateUrl, active: false });
        if (tab.id === undefined) throw new Error('Chrome could not open a background chapter tab.');
        try {
          const deadline = Date.now() + 30000;
          let nextChapter: OfflineChapterInfo | undefined;
          let lastError: unknown;
          while (Date.now() < deadline && !nextChapter) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_OFFLINE_CHAPTER_INFO' }) as OfflineChapterInfoResponse;
              if (response?.success && response.chapter) nextChapter = response.chapter;
              else if (response?.error) lastError = new Error(response.error);
            } catch (cause) {
              lastError = cause;
            }
            if (!nextChapter) await new Promise(resolve => window.setTimeout(resolve, 500));
          }
          if (!nextChapter) throw new Error(`Could not read ${candidateUrl}. ${lastError instanceof Error ? lastError.message : 'The site may not expose this chapter to MangaVerse.'}`);
          if (nextChapter.seriesId !== chapter.seriesId || new URL(nextChapter.sourceUrl).origin !== startingOrigin) {
            throw new Error('The next link did not resolve to this manga on the same website.');
          }
          if (!nextChapter.pages.length) throw new Error(`${nextChapter.chapterLabel} had no readable page images.`);
          if (collected.some(item => item.chapterId === nextChapter?.chapterId)) break;
          collected.push(nextChapter);
          nextUrl = nextChapter.nextChapterUrl;
        } finally {
          await chrome.tabs.remove(tab.id).catch(() => undefined);
        }
      }

      setChaptersToSave(collected);
      if (!warning && aheadCount > 0 && collected.length === 1) {
        warning = 'This website did not provide a usable next-chapter link. You can still save the current chapter.';
      } else if (!warning && collected.length > 1 && collected.length < aheadCount + 1) {
        warning = `Found ${collected.length - 1} of ${aheadCount} requested next chapters.`;
      }
      setPrepareMessage(warning);
    } catch (cause) {
      setChaptersToSave(collected);
      if (collected.length > 1) setPrepareMessage(`Could only prepare ${collected.length - 1} of ${aheadCount} requested next chapters.`);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsPreparing(false);
    }
  };

  const saveChapters = async () => {
    if (!chaptersToSave.length || isSaving || isPreparing) return;
    setError('');
    setSavedPages(0);
    const origins = Array.from(new Set(chaptersToSave.flatMap(item => item.pages.map(page => `${new URL(page.url).origin}/*`))));
    try {
      // Request all known image-host permissions from this direct button click.
      const granted = await chrome.permissions.request({ origins });
      if (!granted) throw new Error('Image-host access was not granted, so MangaVerse could not download the chapters.');

      setIsSaving(true);
      const failures: string[] = [];
      for (let chapterIndex = 0; chapterIndex < chaptersToSave.length; chapterIndex += 1) {
        const item = chaptersToSave[chapterIndex];
        const existing = await db.offlineChapters.get(item.chapterId);
        if (existing?.status === 'ready') continue;
        setSaveProgress(`${chapterIndex + 1}/${chaptersToSave.length} · ${item.chapterLabel}`);
        const start = await chrome.runtime.sendMessage({
          type: 'OFFLINE_SAVE_START',
          chapter: {
            chapterId: item.chapterId,
            seriesId: item.seriesId,
            seriesTitle: item.seriesTitle,
            chapterNumber: item.chapterNumber,
            chapterLabel: item.chapterLabel,
            sourceUrl: item.sourceUrl,
          },
          pageCount: item.pages.length,
        });
        if (!start?.success) {
          failures.push(`${item.chapterLabel}: ${start?.error || 'could not start saving'}`);
          continue;
        }

        try {
          for (let pageIndex = 0; pageIndex < item.pages.length; pageIndex += 1) {
            const result = await chrome.runtime.sendMessage({
              type: 'OFFLINE_SAVE_PAGE',
              chapterId: item.chapterId,
              pageIndex,
              pageUrl: item.pages[pageIndex].url,
            });
            if (!result?.success) throw new Error(result?.error || `Could not save page ${pageIndex + 1}.`);
            setSavedPages(current => current + 1);
          }
          const finish = await chrome.runtime.sendMessage({ type: 'OFFLINE_SAVE_FINISH', chapterId: item.chapterId, success: true });
          if (!finish?.success) throw new Error(finish?.error || 'The chapter was only partially saved.');
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          await chrome.runtime.sendMessage({ type: 'OFFLINE_SAVE_FINISH', chapterId: item.chapterId, success: false, error: message });
          failures.push(`${item.chapterLabel}: ${message}`);
        }
      }
      const savedChapter = await db.offlineChapters.get(chapter.chapterId);
      setIsReady(savedChapter?.status === 'ready');
      if (failures.length) setError(`Some chapters could not be saved: ${failures.join(' · ')}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSaving(false);
      setSaveProgress('');
    }
  };

  return (
    <main className="min-h-screen bg-darkbg-900 text-gray-100 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <a href={chrome.runtime.getURL('dist/src/dashboard/index.html?tab=offline')} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" /> Offline library
        </a>
        <section className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 md:p-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-4">
            <Download className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white">Save chapters for offline reading</h1>
          <p className="text-sm text-gray-400 mt-2">MangaVerse saves the chapter page images in this browser’s local storage. It does not save the source webpage or send the pages to a server.</p>

          {isLoading ? (
            <div className="mt-8 flex items-center gap-3 text-gray-400 text-sm"><LoaderCircle className="w-4 h-4 animate-spin" /> Reading chapter details…</div>
          ) : chapter ? (
            <div className="mt-6 p-4 bg-darkbg-900 border border-darkbg-700 rounded-2xl">
              <p className="text-white font-bold">{chapter.seriesTitle}</p>
              <p className="text-sm text-gray-400 mt-1">{chapter.chapterLabel}</p>
              <p className="text-xs text-gray-500 mt-3">{chapter.pages.length} page images found · {chapter.offlineDownloadAhead} next chapter{chapter.offlineDownloadAhead === 1 ? '' : 's'} configured</p>
            </div>
          ) : null}

          {prepareMessage && <p className="mt-4 text-xs text-amber-200">{prepareMessage}</p>}
          {chaptersToSave.length > 0 && (
            <div className="mt-4 p-4 bg-darkbg-900 border border-darkbg-700 rounded-2xl">
              <p className="text-xs font-bold text-gray-300 mb-2">Ready to download · {chaptersToSave.length} chapter{chaptersToSave.length === 1 ? '' : 's'}</p>
              <ul className="flex flex-col gap-1.5">
                {chaptersToSave.map((item, index) => (
                  <li key={`${item.chapterId}-${index}`} className="flex justify-between gap-3 text-xs text-gray-400">
                    <span className="truncate">{item.chapterLabel}</span>
                    <span className="shrink-0">{item.pages.length} pages</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p role="alert" className="mt-5 p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-sm text-rose-200">{error}</p>}

          {isSaving && (
            <div className="mt-6" aria-live="polite">
              <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Saving page images… {saveProgress}</span><span>{savedPages} / {chaptersToSave.reduce((total, item) => total + item.pages.length, 0)}</span></div>
              <div className="h-2 bg-darkbg-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, (savedPages / Math.max(1, chaptersToSave.reduce((total, item) => total + item.pages.length, 0))) * 100)}%` }} /></div>
            </div>
          )}

          {isReady ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-emerald-300"><CheckCircle className="w-4 h-4" /> {chaptersToSave.length > 1 ? `${chaptersToSave.length} chapters saved on this device` : 'Chapter saved on this device'}</span>
              <button onClick={() => chapter && openOfflineReader(chapter.chapterId)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">Read offline</button>
            </div>
          ) : (
            <button onClick={chaptersToSave.length ? saveChapters : prepareChapters} disabled={!chapter || isLoading || isSaving || isPreparing} className="mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-3 rounded-xl inline-flex items-center gap-2">
              {isSaving || isPreparing ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isPreparing ? 'Finding next chapters…' : isSaving ? 'Saving chapters…' : chaptersToSave.length ? `Download ${chaptersToSave.length} chapter${chaptersToSave.length === 1 ? '' : 's'}` : chapter?.offlineDownloadAhead ? `Find current + ${chapter.offlineDownloadAhead} ahead` : 'Prepare current chapter'}
            </button>
          )}

          <p className="mt-6 text-[11px] leading-relaxed text-gray-500">Chrome will ask for access to the chapter’s image hosts. MangaVerse uses that access for offline downloads; you can revoke it later in Chrome’s extension settings.</p>
        </section>
      </div>
    </main>
  );
};

interface OfflinePreloadPageProps {
  mappingId: string;
  count: number;
}

export const OfflinePreloadPage: React.FC<OfflinePreloadPageProps> = ({ mappingId, count }) => {
  const [seriesTitle, setSeriesTitle] = useState('');
  const [sourceDomain, setSourceDomain] = useState('');
  const [prepared, setPrepared] = useState<OfflineChapterInfo[]>([]);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [savedPages, setSavedPages] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Looking up this manga on its source website…');
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const prepareAndDownload = async () => {
      let listingTabId: number | undefined;
      try {
        if (!Number.isInteger(count) || count < 1) throw new Error('Choose at least one chapter to download.');
        const mapping = await db.sourceMappings.get(mappingId);
        if (!mapping) throw new Error('This website is no longer linked to the selected manga.');
        const series = await db.series.get(mapping.seriesId);
        if (!series) throw new Error('This manga is no longer in your library.');
        if (cancelled) return;
        setSeriesTitle(series.title);
        setSourceDomain(mapping.sourceDomain);

        const listTab = await chrome.tabs.create({ url: mapping.sourceSeriesUrl, active: false });
        if (listTab.id === undefined) throw new Error('Chrome could not open the manga page in a background tab.');
        listingTabId = listTab.id;
        const listResponse = await waitForTabMessage<SourceChapterLinksResponse>(listTab.id, { type: 'GET_SERIES_CHAPTER_LINKS' });
        if (!listResponse.success || !listResponse.chapters?.length) {
          throw new Error(listResponse.error || 'No chapter links were found on this website’s manga page.');
        }

        const currentProgress = await db.progress.get(series.id);
        const lastRead = Math.max(currentProgress?.lastReadChapterNumber ?? 0, series.lastReadChapterNumber ?? 0);
        const ordered = listResponse.chapters
          .filter(item => Number.isFinite(item.chapterNumber))
          .sort((a, b) => a.chapterNumber - b.chapterNumber);
        const unread = lastRead > 0 ? ordered.filter(item => item.chapterNumber > lastRead) : ordered;
        const targets = (lastRead > 0 ? unread.slice(0, count) : unread.slice(-count));
        if (!targets.length) {
          throw new Error(lastRead > 0
            ? `No chapters newer than your last read chapter (${lastRead}) were found on this website.`
            : 'No chapter links were found to download.');
        }
        if (listingTabId !== undefined) {
          await chrome.tabs.remove(listingTabId).catch(() => undefined);
          listingTabId = undefined;
        }

        const collected: OfflineChapterInfo[] = [];
        for (let index = 0; index < targets.length; index += 1) {
          if (cancelled) return;
          const target = targets[index];
          setProgressLabel(`Preparing chapter ${index + 1} of ${targets.length}: ${target.chapterLabel}`);
          const preloadUrl = new URL(target.url);
          preloadUrl.searchParams.set('mangaverse_offline_preload', '1');
          const tab = await chrome.tabs.create({ url: preloadUrl.toString(), active: false });
          if (tab.id === undefined) throw new Error(`Chrome could not open ${target.chapterLabel}.`);
          try {
            const response = await waitForTabMessage<OfflineChapterInfoResponse>(tab.id, { type: 'GET_OFFLINE_CHAPTER_INFO' });
            const chapter = response?.chapter;
            if (!response?.success || !chapter) throw new Error(response?.error || `Could not read ${target.chapterLabel}.`);
            if (chapter.seriesId !== series.id) throw new Error(`${target.chapterLabel} resolved to a different manga; stopping the download.`);
            if (!chapter.pages.length) throw new Error(`${target.chapterLabel} did not expose any chapter images.`);
            collected.push(chapter);
          } finally {
            await chrome.tabs.remove(tab.id).catch(() => undefined);
          }
        }
        if (!collected.length) throw new Error('No chapters could be prepared for download.');
        if (cancelled) return;
        setPrepared(collected);

        const origins = Array.from(new Set(collected.flatMap(chapter => chapter.pages.map(page => `${new URL(page.url).origin}/*`))));
        const alreadyAllowed = await chrome.permissions.contains({ origins });
        if (alreadyAllowed) {
          setIsSaving(true);
          setProgressLabel('Saving chapters to this browser…');
          const failures = await saveOfflineChapterBatch(collected, (label, pages) => {
            if (!cancelled) {
              setProgressLabel(label);
              setSavedPages(pages);
            }
          });
          if (cancelled) return;
          setResultMessage(failures.length
            ? `Download finished with ${failures.length} chapter error${failures.length === 1 ? '' : 's'}.`
            : `${collected.length} chapter${collected.length === 1 ? '' : 's'} saved. Open Offline to read them.`);
          if (failures.length) setError(failures.join(' · '));
          setIsSaving(false);
        } else {
          setNeedsPermission(true);
          setProgressLabel('Chapters are ready. Grant image access to start saving them.');
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (listingTabId !== undefined) await chrome.tabs.remove(listingTabId).catch(() => undefined);
        if (!cancelled) setIsPreparing(false);
      }
    };
    void prepareAndDownload();
    return () => { cancelled = true; };
  }, [mappingId, count]);

  const grantPermissionAndSave = async () => {
    if (!prepared.length || isSaving) return;
    setError('');
    const origins = Array.from(new Set(prepared.flatMap(chapter => chapter.pages.map(page => `${new URL(page.url).origin}/*`))));
    try {
      const granted = await chrome.permissions.request({ origins });
      if (!granted) throw new Error('Image-host access was not granted, so MangaVerse could not save these chapters.');
      setNeedsPermission(false);
      setIsSaving(true);
      const failures = await saveOfflineChapterBatch(prepared, (label, pages) => {
        setProgressLabel(label);
        setSavedPages(pages);
      });
      setResultMessage(failures.length
        ? `Download finished with ${failures.length} chapter error${failures.length === 1 ? '' : 's'}.`
        : `${prepared.length} chapter${prepared.length === 1 ? '' : 's'} saved. Open Offline to read them.`);
      if (failures.length) setError(failures.join(' · '));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-darkbg-900 text-gray-100 p-6 md:p-10">
      <section className="max-w-2xl mx-auto bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 md:p-8">
        <a href={chrome.runtime.getURL('dist/src/dashboard/index.html?tab=offline')} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" /> Offline library
        </a>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-4"><Download className="w-6 h-6" /></div>
        <h1 className="text-2xl font-black text-white">Download chapters ahead</h1>
        <p className="text-sm text-gray-400 mt-2">{seriesTitle || 'Manga'} · {sourceDomain || 'source website'} · up to {count} unread chapters</p>

        {(isPreparing || isSaving) && <div className="mt-6 flex items-center gap-3 text-sm text-gray-300"><LoaderCircle className="w-4 h-4 animate-spin" /> {progressLabel}</div>}
        {prepared.length > 0 && (
          <div className="mt-5 p-4 bg-darkbg-900 border border-darkbg-700 rounded-2xl">
            <p className="text-xs font-bold text-gray-300 mb-2">{prepared.length} chapter{prepared.length === 1 ? '' : 's'} prepared</p>
            <ul className="flex flex-col gap-1.5">
              {prepared.map((chapter, index) => <li key={`${chapter.chapterId}-${index}`} className="flex justify-between gap-3 text-xs text-gray-400"><span className="truncate">{chapter.chapterLabel}</span><span className="shrink-0">{chapter.pages.length} pages</span></li>)}
            </ul>
          </div>
        )}
        {error && <p role="alert" className="mt-5 p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-sm text-rose-200">{error}</p>}
        {resultMessage && <p className="mt-5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-sm text-emerald-200">{resultMessage}</p>}
        {isSaving && <p className="mt-3 text-xs text-gray-400">{savedPages} page images saved so far.</p>}
        {needsPermission && <button onClick={() => void grantPermissionAndSave()} className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-3 rounded-xl">Allow image access & download</button>}
      </section>
    </main>
  );
};

export const OfflineLibraryPage: React.FC = () => {
  const [chapters, setChapters] = useState<OfflineChapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoadError('');
      setChapters(await db.offlineChapters.orderBy('savedAt').reverse().toArray());
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const refreshTimer = window.setInterval(refreshWhenVisible, 3000);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
  }, [load]);

  const remove = async (chapterId: string) => {
    await db.transaction('rw', db.offlineChapters, db.offlinePages, async () => {
      await db.offlinePages.where('chapterId').equals(chapterId).delete();
      await db.offlineChapters.delete(chapterId);
    });
    await load();
  };

  const savedBytes = chapters.reduce((total, chapter) => total + chapter.totalBytes, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Offline Chapters</h1>
          <p className="text-sm text-gray-400 mt-1">Chapters saved on this browser can be read without visiting their source site.</p>
        </div>
        <button onClick={() => void load()} className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 bg-darkbg-800 border border-darkbg-700 hover:text-white hover:border-purple-500/50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      {loadError && <p role="alert" className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-sm text-rose-200">Could not load saved chapters: {loadError}</p>}

      <div className="bg-darkbg-800 border border-darkbg-700 rounded-2xl p-4 flex items-center gap-3 text-sm text-gray-300">
        <HardDrive className="w-5 h-5 text-emerald-300" />
        {chapters.length} saved {chapters.length === 1 ? 'chapter' : 'chapters'} · {formatBytes(savedBytes)} used
      </div>

      {isLoading ? <p className="text-sm text-gray-400">Loading saved chapters…</p> : chapters.length === 0 ? (
        <div className="text-center py-16 bg-darkbg-800/50 rounded-2xl border border-darkbg-700/60">
          <Download className="w-8 h-8 text-emerald-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-white">No chapters saved yet</h2>
          <p className="text-sm text-gray-400 mt-2">Open a supported chapter, expand the MangaVerse reader HUD, and choose “Save Chapter Offline.”</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {chapters.map((chapter) => (
            <article key={chapter.chapterId} className="bg-darkbg-800 border border-darkbg-700 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{chapter.seriesTitle}</p>
                  <p className="text-sm text-gray-400 mt-1">{chapter.chapterLabel}</p>
                </div>
                <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-full ${chapter.status === 'ready' ? 'bg-emerald-500/10 text-emerald-300' : chapter.status === 'downloading' ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'}`}>
                  {chapter.status === 'ready' ? 'Saved' : chapter.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{chapter.downloadedPages}/{chapter.pageCount} pages · {formatBytes(chapter.totalBytes)}</p>
              {chapter.error && <p className="text-xs text-rose-300">{chapter.error}</p>}
              <div className="mt-auto flex items-center gap-2 border-t border-darkbg-700 pt-4">
                <button onClick={() => openOfflineReader(chapter.chapterId)} disabled={chapter.status !== 'ready'} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center justify-center gap-2">
                  <BookOpen className="w-3.5 h-3.5" /> Read offline
                </button>
                <button onClick={() => void remove(chapter.chapterId)} title="Delete saved chapter" className="p-2 text-gray-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

interface OfflineReaderPageProps {
  chapterId: string;
}

export const OfflineReaderPage: React.FC<OfflineReaderPageProps> = ({ chapterId }) => {
  const [chapter, setChapter] = useState<OfflineChapter | null>(null);
  const [pages, setPages] = useState<Array<{ url: string; page: OfflinePage }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrls: string[] = [];
    let cancelled = false;
    const load = async () => {
      const [savedChapter, savedPages] = await Promise.all([
        db.offlineChapters.get(chapterId),
        db.offlinePages.where('chapterId').equals(chapterId).sortBy('pageIndex'),
      ]);
      if (cancelled) return;
      if (!savedChapter || savedChapter.status !== 'ready') {
        setError('This chapter is not fully saved on this device. Connect to the internet and save it again.');
        return;
      }
      setChapter(savedChapter);
      objectUrls = savedPages.map((page) => URL.createObjectURL(page.image));
      setPages(savedPages.map((page, index) => ({ page, url: objectUrls[index] })));
      document.title = `${savedChapter.seriesTitle} — ${savedChapter.chapterLabel} · MangaVerse Offline`;

      const progress = await db.progress.get(savedChapter.seriesId);
      if (progress?.lastReadChapterId === chapterId && progress.scrollPixelOffset > 0) {
        requestAnimationFrame(() => window.scrollTo(0, progress.scrollPixelOffset));
      }
    };
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [chapterId]);

  useEffect(() => {
    if (!chapter) return;
    let timeout: number | undefined;
    let markedRead = false;
    const saveProgress = () => {
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(async () => {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const scrollPercent = Math.min(1, window.scrollY / maxScroll);
        const isCompleted = scrollPercent >= 0.85;
        const [sourceChapter, existingProgress] = await Promise.all([
          db.chapters.get(chapter.chapterId),
          db.progress.get(chapter.seriesId),
        ]);
        const completedChapterIds = new Set(existingProgress?.completedChapterIds || []);
        if (isCompleted) completedChapterIds.add(chapter.chapterId);
        else completedChapterIds.delete(chapter.chapterId);
        await db.progress.put({
          seriesId: chapter.seriesId,
          lastReadChapterId: chapter.chapterId,
          lastReadChapterNumber: sourceChapter?.chapterNumber ?? chapter.chapterNumber,
          scrollPositionPercent: scrollPercent,
          scrollPixelOffset: window.scrollY,
          activeReadingMode: 'vertical',
          lastReadTimestamp: Date.now(),
          completedChapterIds: Array.from(completedChapterIds),
        });
        if (isCompleted && !markedRead) {
          markedRead = true;
          await db.chapters.update(chapter.chapterId, { isRead: true, readAt: Date.now() });
          const unreadCount = await db.chapters
            .where('seriesId')
            .equals(chapter.seriesId)
            .filter((item) => !item.isRead)
            .count();
          await db.series.update(chapter.seriesId, {
            unreadCount,
            lastReadChapterNumber: chapter.chapterNumber,
            updatedAt: Date.now(),
          });
        }
      }, 400);
    };
    window.addEventListener('scroll', saveProgress, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveProgress);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [chapter]);

  const backToLibrary = () => {
    const url = new URL(chrome.runtime.getURL('dist/src/dashboard/index.html'));
    url.searchParams.set('tab', 'offline');
    window.location.assign(url.toString());
  };

  if (error) return <main className="min-h-screen bg-darkbg-900 text-gray-100 p-8"><button onClick={backToLibrary} className="text-sm text-purple-300 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Offline library</button><p className="mt-8 text-rose-300">{error}</p></main>;
  if (!chapter) return <main className="min-h-screen bg-darkbg-900 text-gray-100 p-8"><p>Loading saved chapter…</p></main>;

  return (
    <main className="min-h-screen bg-black text-gray-100">
      <header className="sticky top-0 z-20 bg-darkbg-900/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between gap-4">
        <button onClick={backToLibrary} className="text-sm text-gray-300 hover:text-white flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Offline library</button>
        <div className="text-center min-w-0">
          <p className="text-xs font-semibold text-white truncate">{chapter.seriesTitle}</p>
          <p className="text-[11px] text-gray-400 truncate">{chapter.chapterLabel} · {pages.length} pages</p>
        </div>
        <span className="text-[10px] text-emerald-300 border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded-full">Offline</span>
      </header>
      <div className="max-w-4xl mx-auto">
        {pages.map(({ page, url }) => (
          <figure key={page.pageIndex} className="m-0">
            <img src={url} alt={`${chapter.chapterLabel}, page ${page.pageIndex + 1}`} className="block w-full h-auto" decoding="async" />
          </figure>
        ))}
      </div>
      <footer className="max-w-4xl mx-auto p-8 text-center text-xs text-gray-500">End of saved chapter</footer>
    </main>
  );
};
