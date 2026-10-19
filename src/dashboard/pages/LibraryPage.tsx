import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { Series, SeriesSourceMapping, Chapter, UserReadingStatus, ComicFormat } from '../../types/library';
import { detectChapterGapsAndDuplicates, GapAnalysisResult } from '../../services/gapDetector';
import { mergeCrossSourceProgress } from '../../services/progressMerger';
import { Search, Plus, BookOpen, ExternalLink, CheckCircle, Clock, Trash2, X, AlertTriangle, RefreshCw } from 'lucide-react';

export const LibraryPage: React.FC = () => {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [seriesChapters, setSeriesChapters] = useState<Chapter[]>([]);
  const [seriesSources, setSeriesSources] = useState<SeriesSourceMapping[]>([]);
  const [offlineAheadDrafts, setOfflineAheadDrafts] = useState<Record<string, string>>({});
  const [savingOfflineAheadMappingId, setSavingOfflineAheadMappingId] = useState<string | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResult | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // New series form state
  const [newTitle, setNewTitle] = useState('');
  const [newFormat, setNewFormat] = useState<ComicFormat>('manga');
  const [newStatus, setNewStatus] = useState<UserReadingStatus>('reading');
  const [newBingeThreshold, setNewBingeThreshold] = useState(10);
  const [newSourceUrl, setNewSourceUrl] = useState('');

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    const all = await db.series.toArray();
    setSeriesList(all);
  };

  const handleOpenSeriesDetail = async (series: Series) => {
    setSelectedSeries(series);
    const [chs, sources] = await Promise.all([db.chapters
      .where('seriesId')
      .equals(series.id)
      .sortBy('chapterNumber'), db.sourceMappings.where('seriesId').equals(series.id).toArray()]);
    
    // Analyze gaps and duplicates
    const analysis = detectChapterGapsAndDuplicates(chs);
    setGapAnalysis(analysis);
    setSeriesChapters(chs.reverse());
    setSeriesSources(sources);
    setOfflineAheadDrafts(Object.fromEntries(sources.map(source => [source.id, String(source.offlineDownloadAhead ?? 0)])));
  };

  const handleUpdateOfflineDownloadAhead = async (mapping: SeriesSourceMapping) => {
    const rawValue = offlineAheadDrafts[mapping.id] ?? String(mapping.offlineDownloadAhead ?? 0);
    const parsed = Number.parseInt(rawValue, 10);
    const count = Number.isFinite(parsed) ? Math.max(0, Math.min(20, parsed)) : 0;
    setSavingOfflineAheadMappingId(mapping.id);
    try {
      if (count > 0) {
        const sourceOrigin = `${new URL(mapping.sourceSeriesUrl).origin}/*`;
        const hasSourceAccess = await chrome.permissions.contains({ origins: [sourceOrigin] });
        if (!hasSourceAccess) {
          const granted = await chrome.permissions.request({ origins: [sourceOrigin] });
          if (!granted) {
            alert('MangaVerse needs access to this manga website to find and download its chapters. Allow access and confirm again.');
            return;
          }
        }
      }
      await db.sourceMappings.update(mapping.id, { offlineDownloadAhead: count });
      setSeriesSources(current => current.map(source => source.id === mapping.id
        ? { ...source, offlineDownloadAhead: count }
        : source));
      setOfflineAheadDrafts(current => ({ ...current, [mapping.id]: String(count) }));
      if (count > 0) {
        const preloadUrl = new URL(chrome.runtime.getURL('dist/src/dashboard/index.html'));
        preloadUrl.searchParams.set('offlinePreloadMappingId', mapping.id);
        preloadUrl.searchParams.set('offlinePreloadCount', String(count));
        await chrome.tabs.create({ url: preloadUrl.toString() });
      }
    } catch (error) {
      alert(`Could not save the offline download setting: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSavingOfflineAheadMappingId(null);
    }
  };

  const handleReconcileProgress = async (seriesId: string) => {
    setIsReconciling(true);
    const summary = await mergeCrossSourceProgress(seriesId);
    if (summary.hasChanged) {
      alert(`Progress reconciled! Highest read chapter updated to ${summary.newHighestRead}.`);
    } else {
      alert('Progress is already fully synchronized across all sources.');
    }
    await loadSeries();
    if (selectedSeries) {
      const refreshed = await db.series.get(seriesId);
      if (refreshed) setSelectedSeries(refreshed);
      const chs = await db.chapters.where('seriesId').equals(seriesId).sortBy('chapterNumber');
      setSeriesChapters(chs.reverse());
    }
    setIsReconciling(false);
  };

  const handleUpdateStatus = async (seriesId: string, status: UserReadingStatus) => {
    await db.series.update(seriesId, { userStatus: status, updatedAt: Date.now() });
    if (selectedSeries && selectedSeries.id === seriesId) {
      setSelectedSeries({ ...selectedSeries, userStatus: status });
    }
    await loadSeries();
  };

  const handleUpdateBingeThreshold = async (seriesId: string, threshold: number) => {
    await db.series.update(seriesId, { bingeThreshold: threshold, updatedAt: Date.now() });
    if (selectedSeries && selectedSeries.id === seriesId) {
      setSelectedSeries({ ...selectedSeries, bingeThreshold: threshold });
    }
    await loadSeries();
  };

  const handleDeleteSeries = async (seriesId: string) => {
    if (confirm('Are you sure you want to delete this series and its reading history?')) {
      await db.transaction('rw', [db.series, db.sourceMappings, db.chapters, db.progress, db.offlineChapters, db.offlinePages], async () => {
        const offlineChapters = await db.offlineChapters.where('seriesId').equals(seriesId).toArray();
        for (const offlineChapter of offlineChapters) {
          await db.offlinePages.where('chapterId').equals(offlineChapter.chapterId).delete();
          await db.offlineChapters.delete(offlineChapter.chapterId);
        }
        await db.series.delete(seriesId);
        await db.sourceMappings.where('seriesId').equals(seriesId).delete();
        await db.chapters.where('seriesId').equals(seriesId).delete();
        await db.progress.delete(seriesId);
      });
      setSelectedSeries(null);
      await loadSeries();
    }
  };

  const handleToggleChapterRead = async (chapter: Chapter) => {
    const newReadState = !chapter.isRead;
    await db.chapters.update(chapter.id, {
      isRead: newReadState,
      readAt: newReadState ? Date.now() : undefined,
    });

    if (selectedSeries) {
      const unreadCount = await db.chapters
        .where('seriesId')
        .equals(selectedSeries.id)
        .filter(c => !c.isRead)
        .count();

      await db.series.update(selectedSeries.id, {
        unreadCount,
        lastReadChapterNumber: newReadState ? chapter.chapterNumber : selectedSeries.lastReadChapterNumber,
        updatedAt: Date.now(),
      });

      setSelectedSeries({
        ...selectedSeries,
        unreadCount,
        lastReadChapterNumber: newReadState ? chapter.chapterNumber : selectedSeries.lastReadChapterNumber,
      });

      const updatedChs = await db.chapters
        .where('seriesId')
        .equals(selectedSeries.id)
        .sortBy('chapterNumber');
      setSeriesChapters(updatedChs.reverse());
    }

    await loadSeries();
  };

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const seriesId = crypto.randomUUID();
    const slug = newTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').trim();

    const newSeriesObj: Series = {
      id: seriesId,
      title: newTitle.trim(),
      altTitles: [],
      canonicalSlug: slug,
      format: newFormat,
      status: 'ongoing',
      userStatus: newStatus,
      genres: [],
      tags: [],
      bingeThreshold: newBingeThreshold,
      unreadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.series.add(newSeriesObj);

    if (newSourceUrl.trim()) {
      await db.sourceMappings.add({
        id: crypto.randomUUID(),
        seriesId,
        sourceName: newSourceUrl.includes('mangadex') ? 'mangadex' : 'generic',
        sourceDomain: new URL(newSourceUrl).hostname,
        sourceSeriesUrl: newSourceUrl.trim(),
        lastCheckedAt: Date.now(),
        isPrimary: true,
      });
    }

    setNewTitle('');
    setNewSourceUrl('');
    setIsAddModalOpen(false);
    await loadSeries();
  };

  const filteredSeries = seriesList.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.altTitles?.some(alt => alt.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = activeStatus === 'all' || s.userStatus === activeStatus;
    const matchesFormat = selectedFormat === 'all' || s.format === selectedFormat;
    return matchesSearch && matchesStatus && matchesFormat;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Title & Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">My Manga Library</h1>
          <p className="text-sm text-gray-400">Track, cross-merge, and detect missing chapters across all reading websites</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Series
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-darkbg-800 p-3 rounded-2xl border border-darkbg-700">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'reading', label: 'Reading' },
            { id: 'on_hold', label: 'On Hold' },
            { id: 'plan_to_read', label: 'Plan to Read' },
            { id: 'completed', label: 'Completed' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStatus(tab.id)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg whitespace-nowrap transition ${
                activeStatus === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-darkbg-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedFormat}
            onChange={e => setSelectedFormat(e.target.value)}
            className="bg-darkbg-900 border border-darkbg-700 text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Formats</option>
            <option value="manga">Manga</option>
            <option value="manhwa">Manhwa</option>
            <option value="manhua">Manhua</option>
            <option value="webtoon">Webtoon</option>
          </select>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 text-xs text-white rounded-lg pl-9 pr-3 py-1.5 w-full focus:outline-none focus:border-purple-500 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Series Grid */}
      {filteredSeries.length === 0 ? (
        <div className="text-center py-20 bg-darkbg-800/50 rounded-2xl border border-darkbg-700/60 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/10 text-purple-400 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">No series found</h3>
          <p className="text-sm text-gray-400 max-w-sm mb-4">
            {searchQuery
              ? `No titles match "${searchQuery}"`
              : 'Add your favorite series manually or read on any supported site to auto-track.'}
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-darkbg-700 hover:bg-darkbg-600 text-purple-300 text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            Add a Series Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredSeries.map(series => (
            <div
              key={series.id}
              onClick={() => handleOpenSeriesDetail(series)}
              className="bg-darkbg-800 hover:bg-darkbg-700/80 border border-darkbg-700/80 hover:border-purple-500/40 rounded-2xl p-4 transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-lg hover:shadow-purple-950/20"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {series.format}
                  </span>
                  {series.unreadCount ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                      +{series.unreadCount} unread
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Caught up
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition line-clamp-2 mb-1">
                  {series.title}
                </h3>
                <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-3">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  {series.lastReadChapterNumber
                    ? `Last read: Ch. ${series.lastReadChapterNumber}`
                    : 'Not started'}
                </p>
              </div>

              <div className="pt-3 border-t border-darkbg-700/60 flex items-center justify-between text-xs text-gray-400">
                <span className="capitalize">{series.userStatus.replace('_', ' ')}</span>
                {series.bingeThreshold > 0 && (
                  <span className="text-[11px] text-purple-400 font-medium">
                    Binge @ {series.bingeThreshold}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Series Detail Modal */}
      {selectedSeries && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-darkbg-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {selectedSeries.format}
                </span>
                <h2 className="text-xl font-black text-white mt-1">{selectedSeries.title}</h2>
              </div>
              <button
                onClick={() => setSelectedSeries(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-darkbg-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gap Warning Banner if detected */}
            {gapAnalysis?.hasGaps && (
              <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <span className="font-bold">Missing Chapters Detected: </span>
                  {gapAnalysis.gaps.map(g => g.description).join('; ')}
                </div>
              </div>
            )}

            {/* Modal Settings Bar */}
            <div className="p-6 bg-darkbg-900/60 border-b border-darkbg-700 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Status:</label>
                <select
                  value={selectedSeries.userStatus}
                  onChange={e => handleUpdateStatus(selectedSeries.id, e.target.value as UserReadingStatus)}
                  className="bg-darkbg-800 border border-darkbg-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500"
                >
                  <option value="reading">Reading</option>
                  <option value="on_hold">On Hold</option>
                  <option value="plan_to_read">Plan to Read</option>
                  <option value="completed">Completed</option>
                  <option value="dropped">Dropped</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Binge Alert Threshold:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedSeries.bingeThreshold}
                  onChange={e => handleUpdateBingeThreshold(selectedSeries.id, parseInt(e.target.value) || 0)}
                  className="bg-darkbg-800 border border-darkbg-700 text-xs text-white rounded-lg px-2 py-1 w-16 text-center focus:outline-none focus:border-purple-500"
                />
                <span className="text-[11px] text-gray-500">chs</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReconcileProgress(selectedSeries.id)}
                  disabled={isReconciling}
                  title="Cross-reconcile reading progress with other sources"
                  className="text-xs text-purple-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-lg transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} /> Sync Cross-Source
                </button>

                <button
                  onClick={() => handleDeleteSeries(selectedSeries.id)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 px-3 py-1.5 hover:bg-rose-950/30 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Per-source offline download settings */}
            <div className="px-6 py-4 border-b border-darkbg-700">
              <h4 className="text-xs font-bold text-gray-300">Download chapters ahead</h4>
              <p className="text-[11px] text-gray-500 mt-1 mb-3">Choose how many next chapters to save when you start an offline download on each website. Set 0 to save only the current chapter.</p>
              {seriesSources.length === 0 ? (
                <p className="text-xs text-gray-500">No reading websites are linked to this series yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {seriesSources.map(source => (
                    <div key={source.id} className="flex items-center justify-between gap-3 text-xs text-gray-300">
                      <span className="min-w-0 truncate" title={source.sourceSeriesUrl}>{source.sourceDomain}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <input
                          aria-label={`Chapters to download ahead from ${source.sourceDomain}`}
                          type="number"
                          min="0"
                          max="20"
                          value={offlineAheadDrafts[source.id] ?? String(source.offlineDownloadAhead ?? 0)}
                          onChange={event => setOfflineAheadDrafts(current => ({ ...current, [source.id]: event.target.value }))}
                          className="bg-darkbg-900 border border-darkbg-700 text-xs text-white rounded-lg px-2 py-1 w-16 text-center focus:outline-none focus:border-purple-500"
                        />
                        <span className="text-[11px] text-gray-500">chapters</span>
                        <button
                          type="button"
                          onClick={() => void handleUpdateOfflineDownloadAhead(source)}
                          disabled={savingOfflineAheadMappingId === source.id || ((offlineAheadDrafts[source.id] ?? String(source.offlineDownloadAhead ?? 0)) === String(source.offlineDownloadAhead ?? 0) && Number.parseInt(offlineAheadDrafts[source.id] || '0', 10) <= 0)}
                          className="min-w-16 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-600/20 text-purple-200 border border-purple-500/30 hover:bg-purple-600/40 disabled:text-gray-500 disabled:bg-darkbg-900 disabled:border-darkbg-700 disabled:cursor-not-allowed"
                        >
                          {savingOfflineAheadMappingId === source.id
                            ? 'Starting…'
                            : Number.parseInt(offlineAheadDrafts[source.id] || '0', 10) > 0
                              ? 'Confirm & Download'
                              : (offlineAheadDrafts[source.id] ?? String(source.offlineDownloadAhead ?? 0)) === String(source.offlineDownloadAhead ?? 0) ? 'Confirmed' : 'Confirm'}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chapters List */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Tracked Chapters ({seriesChapters.length})
                </h4>
                {gapAnalysis?.duplicates && gapAnalysis.duplicates.length > 0 && (
                  <span className="text-[10px] text-purple-400 bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded-full">
                    {gapAnalysis.duplicates.length} duplicate release(s) aligned
                  </span>
                )}
              </div>

              {seriesChapters.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No chapters tracked yet for this series.</p>
              ) : (
                seriesChapters.map(ch => (
                  <div
                    key={ch.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      ch.isRead
                        ? 'bg-darkbg-900/40 border-darkbg-700/40 text-gray-400'
                        : 'bg-darkbg-700/40 border-darkbg-600/50 text-white font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleChapterRead(ch)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition border ${
                          ch.isRead
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'border-darkbg-600 hover:border-purple-500 text-transparent'
                        }`}
                      >
                        ✓
                      </button>
                      <div>
                        <p className="text-xs">{ch.chapterLabel}</p>
                        {ch.publishTimestamp && (
                          <p className="text-[10px] text-gray-500">
                            {new Date(ch.publishTimestamp).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {ch.sourceUrl && (
                      <a
                        href={ch.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 p-1.5 hover:bg-purple-500/10 rounded-lg flex items-center gap-1 transition"
                      >
                        Read <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Series Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSeries}
            className="bg-darkbg-800 border border-darkbg-700 rounded-3xl max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-darkbg-700">
              <h3 className="text-lg font-bold text-white">Add New Series</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">Series Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Chainsaw Man or Solo Leveling"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">Format</label>
                <select
                  value={newFormat}
                  onChange={e => setNewFormat(e.target.value as ComicFormat)}
                  className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="manga">Manga</option>
                  <option value="manhwa">Manhwa</option>
                  <option value="manhua">Manhua</option>
                  <option value="webtoon">Webtoon</option>
                </select>
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as UserReadingStatus)}
                  className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="reading">Reading</option>
                  <option value="on_hold">On Hold</option>
                  <option value="plan_to_read">Plan to Read</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">Binge Alert Threshold</label>
              <input
                type="number"
                min="0"
                max="50"
                value={newBingeThreshold}
                onChange={e => setNewBingeThreshold(parseInt(e.target.value) || 0)}
                className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-gray-500">
                Receive an alert when on-hold series accumulates this many unread chapters.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">Optional Reading Source Link</label>
              <input
                type="url"
                placeholder="https://mangadex.org/title/..."
                value={newSourceUrl}
                onChange={e => setNewSourceUrl(e.target.value)}
                className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-darkbg-700">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-5 py-2 rounded-xl transition shadow-lg shadow-purple-600/20"
              >
                Save Series
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
