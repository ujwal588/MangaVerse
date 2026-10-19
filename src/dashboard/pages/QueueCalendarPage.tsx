import React, { useState, useEffect } from 'react';
import { generateReadingQueue, QueueItem } from '../../services/readingQueue';
import { generateReleaseCalendar, CalendarEvent } from '../../services/releaseCalendar';
import { getAllSourceHealth, SourceHealthRecord } from '../../services/sourceHealth';
import { Clock, Calendar, ExternalLink, Activity, Sparkles, CheckCircle2 } from 'lucide-react';

export const QueueCalendarPage: React.FC = () => {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [totalEstimatedMinutes, setTotalEstimatedMinutes] = useState<number>(0);
  const [selectedBudget, setSelectedBudget] = useState<number>(30); // 30 mins default
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [sourceHealths, setSourceHealths] = useState<SourceHealthRecord[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedBudget]);

  const loadData = async () => {
    const queue = await generateReadingQueue(selectedBudget === 0 ? undefined : selectedBudget);
    setQueueItems(queue.items);
    setTotalEstimatedMinutes(queue.totalEstimatedMinutes);

    const events = await generateReleaseCalendar(21);
    setCalendarEvents(events);

    const health = getAllSourceHealth();
    setSourceHealths(health);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Queue Planner & Release Radar</h1>
        <p className="text-sm text-gray-400">
          Smart backlog reading queue tailored to your available time, upcoming release predictions, and source health.
        </p>
      </div>

      {/* Reading Queue Planner */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-darkbg-700">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" /> Smart Reading Queue
            </h2>
            <p className="text-xs text-gray-400">
              {queueItems.length} chapter(s) queued • {totalEstimatedMinutes} mins estimated
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Time Budget:</span>
            {[
              { label: '15m', value: 15 },
              { label: '30m', value: 30 },
              { label: '45m', value: 45 },
              { label: '60m', value: 60 },
              { label: 'All', value: 0 },
            ].map(b => (
              <button
                key={b.value}
                onClick={() => setSelectedBudget(b.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  selectedBudget === b.value
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-darkbg-900 text-gray-400 hover:text-white border border-darkbg-700'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {queueItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            No unread chapters in your reading queue. Add or follow series to build your playlist.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {queueItems.map(item => (
              <div
                key={item.nextChapter.id}
                className="bg-darkbg-900/60 border border-darkbg-700/80 rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-purple-500/30 transition"
              >
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {item.format}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{item.seriesTitle}</span>
                  </div>
                  <p className="text-xs text-gray-400">{item.nextChapter.chapterLabel}</p>
                  <p className="text-[10px] text-gray-500 mt-1">~{item.estimatedMinutes} mins reading time</p>
                </div>

                {item.nextChapter.sourceUrl && (
                  <a
                    href={item.nextChapter.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition flex-shrink-0"
                  >
                    Read <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Release Calendar Radar */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" /> Release Radar (Next 21 Days)
        </h2>
        <p className="text-xs text-gray-400">
          Cadence-based release predictions calculated from observed publishing history.
        </p>

        {calendarEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            No upcoming releases forecasted yet. As you track chapters, release cadence will be learned automatically.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {calendarEvents.map(evt => (
              <div
                key={evt.id}
                className="bg-darkbg-900 border border-darkbg-700 rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-purple-300 font-bold">{evt.expectedDate}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        evt.confidence === 'high_prediction'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {evt.confidence === 'high_prediction' ? 'Weekly Predicted' : 'Estimated'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{evt.seriesTitle}</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Projected: Chapter {evt.expectedChapterNumber}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source Reliability Monitor */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" /> Source Reliability & Health Monitor
        </h2>
        <p className="text-xs text-gray-400">
          Monitors connected reading sources for Cloudflare blocks, 503 errors, and automatic backoff intervals.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-darkbg-900 text-gray-400 uppercase text-[10px] tracking-wider border-b border-darkbg-700">
              <tr>
                <th className="p-3">Source Domain</th>
                <th className="p-3">Status</th>
                <th className="p-3">Success Rate</th>
                <th className="p-3">Backoff Interval</th>
                <th className="p-3">Last Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkbg-700/60">
              {sourceHealths.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    MangaDex.org is active and healthy. Checks occur automatically during reading sessions.
                  </td>
                </tr>
              ) : (
                sourceHealths.map(sh => (
                  <tr key={sh.domain}>
                    <td className="p-3 font-medium text-white">{sh.domain}</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sh.healthStatus === 'healthy'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : sh.healthStatus === 'degraded'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {sh.healthStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      {sh.totalChecks > 0 ? Math.round((sh.successfulChecks / sh.totalChecks) * 100) : 100}%
                    </td>
                    <td className="p-3 text-purple-300">{sh.recommendedBackoffMinutes} min</td>
                    <td className="p-3 text-gray-400">{new Date(sh.lastCheckedAt).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
