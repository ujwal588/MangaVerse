import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { NotificationRecord } from '../../types/library';
import { Bell, RefreshCw, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react';

export const UpdatesPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const list = await db.notifications.orderBy('timestamp').reverse().toArray();
    setNotifications(list);
  };

  const handleCheckNow = async () => {
    setIsChecking(true);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'TRIGGER_CHECK_UPDATES' });
    }
    await loadNotifications();
    setIsChecking(false);
  };

  const handleMarkAllRead = async () => {
    await db.notifications.toCollection().modify({ isRead: true });
    await loadNotifications();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Chapter Releases & Alerts</h1>
          <p className="text-sm text-gray-400">Intelligent chapter updates, binge notifications, and hiatus alerts</p>
        </div>

        <div className="flex items-center gap-3">
          {notifications.some(n => !n.isRead) && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl border border-darkbg-700 bg-darkbg-800 hover:bg-darkbg-700 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark All Read
            </button>
          )}

          <button
            onClick={handleCheckNow}
            disabled={isChecking}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking Sources...' : 'Check Now'}
          </button>
        </div>
      </div>

      {/* Notifications Feed */}
      {notifications.length === 0 ? (
        <div className="text-center py-20 bg-darkbg-800/50 rounded-2xl border border-darkbg-700/60 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/10 text-purple-400 flex items-center justify-center mb-3">
            <Bell className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">No updates yet</h3>
          <p className="text-sm text-gray-400 max-w-sm mb-4">
            Follow series in your library to receive chapter update notifications and binge backlog alerts.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${
                n.isRead
                  ? 'bg-darkbg-800/40 border-darkbg-700/50 text-gray-400'
                  : 'bg-darkbg-800 border-purple-500/30 text-white shadow-md shadow-purple-950/10'
              }`}
            >
              <div className="flex items-center gap-3.5 overflow-hidden">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    n.type === 'binge_threshold'
                      ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}
                >
                  {n.type === 'binge_threshold' ? <Sparkles className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>

                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{n.seriesTitle}</h3>
                    {n.type === 'binge_threshold' && (
                      <span className="text-[10px] bg-pink-500/20 text-pink-300 font-bold px-2 py-0.5 rounded-md border border-pink-500/30">
                        Binge Alert
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {new Date(n.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {n.sourceUrl && (
                <a
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-purple-600/10 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/20 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition flex-shrink-0"
                >
                  Read Now <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
