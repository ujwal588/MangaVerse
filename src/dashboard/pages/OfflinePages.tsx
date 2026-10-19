import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle, Download, HardDrive, LoaderCircle, Trash2 } from 'lucide-react';
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const openOfflineReader = (chapterId: string) => {
  const url = new URL(chrome.runtime.getURL('src/dashboard/index.html'));
  url.searchParams.set('offlineReader', chapterId);
  void chrome.tabs.create({ url: url.toString() });
};

export const OfflineSavePage: React.FC<OfflineSavePageProps> = ({ sourceTabId }) => {
  const [chapter, setChapter] = useState<OfflineChapterInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPages, setSavedPages] = useState(0);
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
        if (!response.chapter.pages.length) {
          throw new Error('No chapter images were found. Scroll through the chapter online so lazy-loaded pages appear, then try again.');
        }
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

  const saveChapter = async () => {
    if (!chapter || isSaving) return;
    setError('');
    setSavedPages(0);

    const origins = Array.from(new Set(chapter.pages.map((page) => `${new URL(page.url).origin}/*`)));
    try {
      // This is called directly from the Save button click so Chrome can show
      // the optional host permission prompt as a user-initiated request.
      const granted = await chrome.permissions.request({ origins });
      if (!granted) {
        setError('Image-host access was not granted, so MangaVerse could not download the chapter.');
        return;
      }

      setIsSaving(true);
      const start = await chrome.runtime.sendMessage({
        type: 'OFFLINE_SAVE_START',
        chapter: {
          chapterId: chapter.chapterId,
          seriesId: chapter.seriesId,
          seriesTitle: chapter.seriesTitle,
          chapterNumber: chapter.chapterNumber,
          chapterLabel: chapter.chapterLabel,
          sourceUrl: chapter.sourceUrl,
        },
        pageCount: chapter.pages.length,
      });
      if (!start?.success) throw new Error(start?.error || 'Could not start saving this chapter.');

      try {
        for (let pageIndex = 0; pageIndex < chapter.pages.length; pageIndex += 1) {
          const result = await chrome.runtime.sendMessage({
            type: 'OFFLINE_SAVE_PAGE',
            chapterId: chapter.chapterId,
            pageIndex,
            pageUrl: chapter.pages[pageIndex].url,
          });
          if (!result?.success) {
            throw new Error(result?.error || `Could not save page ${pageIndex + 1}.`);
          }
          setSavedPages(pageIndex + 1);
        }
        const finish = await chrome.runtime.sendMessage({
          type: 'OFFLINE_SAVE_FINISH',
          chapterId: chapter.chapterId,
          success: true,
        });
        if (!finish?.success) throw new Error(finish?.error || 'The chapter was only partially saved.');
        setIsReady(true);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        await chrome.runtime.sendMessage({
          type: 'OFFLINE_SAVE_FINISH',
          chapterId: chapter.chapterId,
          success: false,
          error: message,
        });
        throw cause;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-darkbg-900 text-gray-100 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <a href={chrome.runtime.getURL('src/dashboard/index.html?tab=offline')} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" /> Offline library
        </a>
        <section className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 md:p-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-4">
            <Download className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white">Save chapter for offline reading</h1>
          <p className="text-sm text-gray-400 mt-2">MangaVerse saves the chapter page images in this browser’s local storage. It does not save the source webpage or send the pages to a server.</p>

          {isLoading ? (
            <div className="mt-8 flex items-center gap-3 text-gray-400 text-sm"><LoaderCircle className="w-4 h-4 animate-spin" /> Reading chapter details…</div>
          ) : chapter ? (
            <div className="mt-6 p-4 bg-darkbg-900 border border-darkbg-700 rounded-2xl">
              <p className="text-white font-bold">{chapter.seriesTitle}</p>
              <p className="text-sm text-gray-400 mt-1">{chapter.chapterLabel}</p>
              <p className="text-xs text-gray-500 mt-3">{chapter.pages.length} page images found</p>
            </div>
          ) : null}

          {error && <p role="alert" className="mt-5 p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-sm text-rose-200">{error}</p>}

          {isSaving && (
            <div className="mt-6" aria-live="polite">
              <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Saving page images…</span><span>{savedPages} / {chapter?.pages.length}</span></div>
              <div className="h-2 bg-darkbg-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${chapter ? (savedPages / chapter.pages.length) * 100 : 0}%` }} /></div>
            </div>
          )}

          {isReady ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-emerald-300"><CheckCircle className="w-4 h-4" /> Chapter saved on this device</span>
              <button onClick={() => chapter && openOfflineReader(chapter.chapterId)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">Read offline</button>
            </div>
          ) : (
            <button onClick={saveChapter} disabled={!chapter || isLoading || isSaving} className="mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-3 rounded-xl inline-flex items-center gap-2">
              {isSaving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isSaving ? 'Saving chapter…' : 'Download chapter'}
            </button>
          )}

          <p className="mt-6 text-[11px] leading-relaxed text-gray-500">Chrome will ask for access to the chapter’s image hosts. MangaVerse uses that access for offline downloads; you can revoke it later in Chrome’s extension settings.</p>
        </section>
      </div>
    </main>
  );
};

export const OfflineLibraryPage: React.FC = () => {
  const [chapters, setChapters] = useState<OfflineChapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setChapters(await db.offlineChapters.orderBy('savedAt').reverse().toArray());
    setIsLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      <header>
        <h1 className="text-2xl font-black text-white">Offline Chapters</h1>
        <p className="text-sm text-gray-400 mt-1">Chapters saved on this browser can be read without visiting their source site.</p>
      </header>

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
    const url = new URL(chrome.runtime.getURL('src/dashboard/index.html'));
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
