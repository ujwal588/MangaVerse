import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Series, ReadingProgress } from '../types/library';
import { BookOpen, ExternalLink, RefreshCw, LayoutDashboard, Clock } from 'lucide-react';

export const Popup: React.FC = () => {
  const [recentSeries, setRecentSeries] = useState<Array<{ series: Series; progress?: ReadingProgress }>>([]);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [activeTabInfo, setActiveTabInfo] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    loadRecent();
    checkActiveTab();
    const interval = setInterval(loadRecent, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadRecent = async () => {
    try {
      const allProgress = await db.progress.orderBy('lastReadTimestamp').reverse().limit(5).toArray();
      const list: Array<{ series: Series; progress?: ReadingProgress }> = [];

      for (const p of allProgress) {
        const s = await db.series.get(p.seriesId);
        if (s) {
          list.push({ series: s, progress: p });
        }
      }

      // Fallback: If progress is empty, load directly from db.series
      if (list.length === 0) {
        const allSeries = await db.series.orderBy('updatedAt').reverse().limit(5).toArray();
        for (const s of allSeries) {
          list.push({ series: s });
        }
      }

      setRecentSeries(list);

      const unread = await db.chapters.filter((c) => !c.isRead).count();
      setUnreadTotal(unread);
    } catch (e) {
      console.warn('[MangaVerse Popup] Error loading stats:', e);
    }
  };

  const checkActiveTab = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        setActiveTabInfo({
          title: tabs[0].title || 'Current Webpage',
          url: tabs[0].url,
        });
      }
    }
  };

  const handleOpenDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../dashboard/index.html');
    }
  };

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'TRIGGER_CHECK_UPDATES' });
    }
    await loadRecent();
    setIsChecking(false);
  };

  return (
    <div
      style={{ width: '360px', minHeight: '520px', boxSizing: 'border-box' }}
      className="p-4 flex flex-col gap-4 text-gray-200 bg-darkbg-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darkbg-700 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-md">
            M
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">MangaVerse</h1>
            <p className="text-[11px] text-gray-400">Reading Companion</p>
          </div>
        </div>
        <button
          onClick={handleOpenDashboard}
          title="Open Full Dashboard"
          className="p-1.5 hover:bg-darkbg-700 rounded-md text-gray-400 hover:text-white transition flex items-center gap-1 text-xs"
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>
      </div>

      {/* Active Tab Notice */}
      {activeTabInfo?.url.includes('mangadex.org') && (
        <div className="bg-purple-950/40 border border-purple-500/30 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <BookOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-purple-200 truncate">Companion Active</p>
              <p className="text-[10px] text-gray-400 truncate">Tracking enabled on this reader</p>
            </div>
          </div>
          <span className="text-[10px] bg-purple-500/20 text-purple-300 font-semibold px-2 py-0.5 rounded-full border border-purple-500/30">
            Active
          </span>
        </div>
      )}

      {/* Continue Reading Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Continue Reading
          </h2>
          <span className="text-[11px] text-purple-400 font-medium">
            {unreadTotal} unread
          </span>
        </div>

        {recentSeries.length === 0 ? (
          <div className="text-center py-6 px-4 bg-darkbg-800 rounded-lg border border-darkbg-700/60">
            <p className="text-xs text-gray-400 mb-1">No reading history yet</p>
            <p className="text-[11px] text-gray-500">Visit any supported manga site or open your dashboard to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSeries.map(({ series, progress }) => (
              <div
                key={series.id}
                className="bg-darkbg-800 hover:bg-darkbg-700 border border-darkbg-700/80 rounded-lg p-2.5 transition flex items-center justify-between cursor-pointer"
                onClick={handleOpenDashboard}
              >
                <div className="overflow-hidden pr-2">
                  <h3 className="text-xs font-semibold text-white truncate">{series.title}</h3>
                  <p className="text-[11px] text-gray-400">
                    Ch. {progress?.lastReadChapterNumber ?? 1} • {Math.round((progress?.scrollPositionPercent || 0) * 100)}%
                  </p>
                </div>
                <div className="w-7 h-7 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-darkbg-700">
        <button
          onClick={handleCheckUpdates}
          disabled={isChecking}
          className="flex-1 bg-darkbg-800 hover:bg-darkbg-700 border border-darkbg-700 text-gray-300 text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Check Updates'}
        </button>
        <button
          onClick={handleOpenDashboard}
          className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Full Library
        </button>
      </div>
    </div>
  );
};
