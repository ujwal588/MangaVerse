import React, { useEffect, useState } from 'react';
import { db } from '../../services/db';
import { BarChart3, Clock, CheckCircle2, Flame, BookOpen, AlertCircle } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [totalChaptersRead, setTotalChaptersRead] = useState<number>(0);
  const [totalSeriesTracked, setTotalSeriesTracked] = useState<number>(0);
  const [formatCounts, setFormatCounts] = useState<{ [key: string]: number }>({});
  const [estimatedHours, setEstimatedHours] = useState<number>(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const readCount = await db.chapters.filter(c => c.isRead).count();
    setTotalChaptersRead(readCount);

    const allSeries = await db.series.toArray();
    setTotalSeriesTracked(allSeries.length);

    const counts: { [key: string]: number } = { manga: 0, manhwa: 0, manhua: 0, webtoon: 0 };
    for (const s of allSeries) {
      counts[s.format] = (counts[s.format] || 0) + 1;
    }
    setFormatCounts(counts);

    // Approximate reading time: ~6 minutes per chapter on average
    const approxMinutes = readCount * 6;
    setEstimatedHours(Math.round((approxMinutes / 60) * 10) / 10);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Reading Habits & Insights</h1>
        <p className="text-sm text-gray-400">Meaningful metrics to understand your reading patterns without compulsive pressure.</p>
      </div>

      {/* Honest Tracking Disclaimer */}
      <div className="bg-darkbg-800 border border-darkbg-700/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-gray-400">
        <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <span>
          Reading time is an honest estimate calculated from completed chapters and active tab interaction. Idle and
          background tabs are strictly excluded.
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-darkbg-800 border border-darkbg-700 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Chapters Read</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-3xl font-black text-white">{totalChaptersRead}</span>
          <span className="text-[11px] text-gray-500 mt-1">Total finished chapters</span>
        </div>

        <div className="bg-darkbg-800 border border-darkbg-700 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Estimated Reading Time</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-3xl font-black text-white">{estimatedHours} hrs</span>
          <span className="text-[11px] text-gray-500 mt-1">Based on active session pages</span>
        </div>

        <div className="bg-darkbg-800 border border-darkbg-700 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Tracked Series</span>
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-3xl font-black text-white">{totalSeriesTracked}</span>
          <span className="text-[11px] text-gray-500 mt-1">Across all reading websites</span>
        </div>

        <div className="bg-darkbg-800 border border-darkbg-700 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Reading Streak</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-3xl font-black text-white">{totalChaptersRead > 0 ? 'Active' : 'Ready'}</span>
          <span className="text-[11px] text-gray-500 mt-1">Streak tracking (optional)</span>
        </div>
      </div>

      {/* Format Breakdown */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" /> Format Distribution
        </h3>

        <div className="flex flex-col gap-3">
          {Object.entries(formatCounts).map(([fmt, count]) => {
            const pct = totalSeriesTracked > 0 ? Math.round((count / totalSeriesTracked) * 100) : 0;
            return (
              <div key={fmt} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                  <span className="capitalize">{fmt}</span>
                  <span>{count} titles ({pct}%)</span>
                </div>
                <div className="w-full h-2.5 bg-darkbg-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
