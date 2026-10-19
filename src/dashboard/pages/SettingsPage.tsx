import React, { useState } from 'react';
import { exportLibraryAsJson, importLibraryFromJson, wipeAllUserData } from '../../services/exportImport';
import { Download, Upload, Trash2, Bell, Shield, CheckCircle2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleExport = async () => {
    try {
      const json = await exportLibraryAsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mangaverse-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('Library backup exported successfully!');
    } catch (e) {
      alert('Export failed: ' + String(e));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importLibraryFromJson(text);
        showMessage(`Successfully imported ${res.importedSeriesCount} series into your library!`);
      } catch (err) {
        alert('Import failed: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  const handleWipeData = async () => {
    if (confirm('DANGER: This will permanently delete all your tracked manga, reading progress, and settings from this browser. This action cannot be undone.\n\nAre you sure?')) {
      await wipeAllUserData();
      showMessage('All local data wiped successfully.');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const showMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Settings & Data Management</h1>
        <p className="text-sm text-gray-400">Manage data portability, backup files, and update notification preferences.</p>
      </div>

      {statusMessage && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {statusMessage}
        </div>
      )}

      {/* Backup & Portability */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-purple-400" /> Backup & Portability
        </h3>
        <p className="text-xs text-gray-400">
          Your reading history and library belong to you. Export a standard JSON backup or restore an existing backup on any machine.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExport}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20 transition"
          >
            <Download className="w-4 h-4" /> Export Library (JSON)
          </button>

          <label className="bg-darkbg-700 hover:bg-darkbg-600 text-gray-200 font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition">
            <Upload className="w-4 h-4 text-purple-400" /> Import Library Backup
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Notification Frequency */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-purple-400" /> Update Notification Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Background Check Frequency</label>
            <select
              defaultValue="60"
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 1 hour (Recommended)</option>
              <option value="120">Every 2 hours</option>
              <option value="360">Every 6 hours</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Default Binge Threshold</label>
            <input
              type="number"
              defaultValue="10"
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <span className="text-[10px] text-gray-500">Number of unread chapters before notifying on-hold series.</span>
          </div>
        </div>
      </div>

      {/* Danger Zone: Wipe All Data */}
      <div className="bg-rose-950/20 border border-rose-500/20 rounded-3xl p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-rose-300 flex items-center gap-2">
          <Shield className="w-4 h-4 text-rose-400" /> Privacy & Local Data Erasure
        </h3>
        <p className="text-xs text-gray-400">
          Completely erase all reading records, series mappings, and local preferences from IndexedDB.
        </p>

        <div>
          <button
            onClick={handleWipeData}
            className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition"
          >
            <Trash2 className="w-4 h-4" /> Wipe All Local Data
          </button>
        </div>
      </div>
    </div>
  );
};
