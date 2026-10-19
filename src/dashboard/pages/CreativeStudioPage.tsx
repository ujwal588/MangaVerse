import React, { useState } from 'react';
import { Palette, Download, Sparkles, Smartphone, Monitor, Square } from 'lucide-react';

export const CreativeStudioPage: React.FC = () => {
  const [aspectRatio, setAspectRatio] = useState<'desktop' | 'mobile' | 'square'>('mobile');
  const [quoteText, setQuoteText] = useState<string>('“Throughout heaven and earth, I alone am the honored one.”');
  const [characterName, setCharacterName] = useState<string>('Gojo Satoru');
  const [themeGradient, setThemeGradient] = useState<string>('from-purple-900 to-indigo-950');

  const handleDownload = () => {
    alert('Panel Wallpaper saved to downloads as PNG (1080p).');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Creative Panel Studio</h1>
        <p className="text-sm text-gray-400">
          Transform permitted manga panels into stunning mobile wallpapers, desktop backgrounds, and sticker assets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" /> Canvas Options
          </h3>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-300">Format Preset</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setAspectRatio('mobile')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition ${
                  aspectRatio === 'mobile'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-darkbg-900 border-darkbg-700 text-gray-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile 9:16</span>
              </button>

              <button
                onClick={() => setAspectRatio('desktop')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition ${
                  aspectRatio === 'desktop'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-darkbg-900 border-darkbg-700 text-gray-400 hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Desktop 16:9</span>
              </button>

              <button
                onClick={() => setAspectRatio('square')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition ${
                  aspectRatio === 'square'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-darkbg-900 border-darkbg-700 text-gray-400 hover:text-white'
                }`}
              >
                <Square className="w-4 h-4" />
                <span>Sticker 1:1</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Background Mood</label>
            <div className="flex gap-2">
              {[
                { id: 'from-purple-900 to-indigo-950', bg: 'bg-gradient-to-br from-purple-900 to-indigo-950' },
                { id: 'from-rose-950 to-slate-950', bg: 'bg-gradient-to-br from-rose-950 to-slate-950' },
                { id: 'from-emerald-950 to-teal-950', bg: 'bg-gradient-to-br from-emerald-950 to-teal-950' },
                { id: 'from-zinc-900 to-black', bg: 'bg-gradient-to-br from-zinc-900 to-black' },
              ].map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setThemeGradient(theme.id)}
                  className={`w-8 h-8 rounded-full border-2 transition ${theme.bg} ${
                    themeGradient === theme.id ? 'border-purple-400 scale-110' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Quote / Dialogue</label>
            <input
              type="text"
              value={quoteText}
              onChange={e => setQuoteText(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Character / Attribution</label>
            <input
              type="text"
              value={characterName}
              onChange={e => setCharacterName(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleDownload}
            className="mt-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition"
          >
            <Download className="w-4 h-4" /> Export Wallpaper (PNG)
          </button>
        </div>

        {/* Live Canvas Preview */}
        <div className="lg:col-span-2 bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[460px]">
          <div
            className={`bg-gradient-to-br ${themeGradient} rounded-2xl shadow-2xl p-6 flex flex-col justify-between items-center text-center border border-white/10 transition-all ${
              aspectRatio === 'mobile'
                ? 'w-[260px] h-[460px]'
                : aspectRatio === 'desktop'
                ? 'w-[480px] h-[270px]'
                : 'w-[320px] h-[320px]'
            }`}
          >
            <div className="text-[10px] uppercase font-bold tracking-widest text-purple-300 opacity-80">
              MangaVerse Studio
            </div>

            <div className="p-4 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 max-w-[90%] shadow-lg">
              <p className="text-xs font-medium text-gray-200 italic leading-relaxed">
                {quoteText}
              </p>
              {characterName && (
                <p className="text-[11px] font-bold text-purple-400 mt-2">
                  — {characterName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 text-[9px] text-gray-400 opacity-60">
              <Sparkles className="w-3 h-3 text-purple-400" /> Curated for Personal Reading
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
