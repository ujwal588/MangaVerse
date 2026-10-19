import React, { useState, useRef } from 'react';
import { Palette, Download, Sparkles, Smartphone, Monitor, Square, Upload, Type, Eye } from 'lucide-react';

export const CreativeStudioPage: React.FC = () => {
  const [aspectRatio, setAspectRatio] = useState<'desktop' | 'mobile' | 'square'>('mobile');
  const [quoteText, setQuoteText] = useState<string>('“Throughout heaven and earth, I alone am the honored one.”');
  const [characterName, setCharacterName] = useState<string>('Gojo Satoru');
  const [themeGradient, setThemeGradient] = useState<string>('from-purple-900 to-indigo-950');
  const [fontSize, setFontSize] = useState<number>(18);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportPNG = () => {
    // Generate real high-res canvas export
    const canvas = document.createElement('canvas');
    let width = 1080;
    let height = 1920;

    if (aspectRatio === 'desktop') {
      width = 1920;
      height = 1080;
    } else if (aspectRatio === 'square') {
      width = 1080;
      height = 1080;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (themeGradient.includes('purple')) {
      grad.addColorStop(0, '#3b0764');
      grad.addColorStop(1, '#0f172a');
    } else if (themeGradient.includes('rose')) {
      grad.addColorStop(0, '#4c0519');
      grad.addColorStop(1, '#020617');
    } else if (themeGradient.includes('emerald')) {
      grad.addColorStop(0, '#022c22');
      grad.addColorStop(1, '#042f2e');
    } else {
      grad.addColorStop(0, '#18181b');
      grad.addColorStop(1, '#000000');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // If panel image is uploaded, draw it into canvas
    if (uploadedImage) {
      const img = new Image();
      img.onload = () => {
        const hRatio = (width * 0.85) / img.width;
        const vRatio = (height * 0.45) / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const centerShiftX = (width - img.width * ratio) / 2;
        const centerShiftY = height * 0.15;

        ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
        renderOverlayTextsAndDownload(canvas, ctx, width, height);
      };
      img.src = uploadedImage;
    } else {
      renderOverlayTextsAndDownload(canvas, ctx, width, height);
    }
  };

  const renderOverlayTextsAndDownload = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    // Top Brand Badge
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#a855f7';
    ctx.textAlign = 'center';
    ctx.fillText('MANGAVERSE CREATIVE STUDIO', width / 2, 70);

    // Quote Container Box
    const boxY = height * 0.65;
    const boxHeight = height * 0.22;
    const boxWidth = width * 0.85;
    const boxX = (width - boxWidth) / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 20) : ctx.rect(boxX, boxY, boxWidth, boxHeight);
    ctx.fill();

    // Render Quote text
    ctx.font = `italic 32px serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';

    // Basic word wrap
    const words = quoteText.split(' ');
    let line = '';
    let curY = boxY + 60;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > boxWidth - 60 && n > 0) {
        ctx.fillText(line, width / 2, curY);
        line = words[n] + ' ';
        curY += 45;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, width / 2, curY);

    // Render Character Name
    if (characterName) {
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#c084fc';
      ctx.fillText(`— ${characterName}`, width / 2, curY + 55);
    }

    // Trigger instant browser download
    const link = document.createElement('a');
    link.download = `MangaVerse-Wallpaper-${aspectRatio}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Creative Panel Studio</h1>
        <p className="text-sm text-gray-400">
          Transform permitted manga panels into stunning mobile wallpapers, desktop backgrounds, and sticker assets with native canvas rendering.
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
            <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
              <span>Panel Image</span>
              {uploadedImage && (
                <button
                  onClick={() => setUploadedImage(null)}
                  className="text-[10px] text-red-400 hover:underline"
                >
                  Clear Image
                </button>
              )}
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-darkbg-900 hover:bg-darkbg-700 border border-dashed border-darkbg-700 rounded-xl py-3 px-4 text-xs text-gray-300 flex items-center justify-center gap-2 transition"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              {uploadedImage ? 'Replace Manga Panel...' : 'Import Panel / Snippet...'}
            </button>
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
            <label className="text-xs font-semibold text-gray-300">Character Attribution</label>
            <input
              type="text"
              value={characterName}
              onChange={e => setCharacterName(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleExportPNG}
            className="mt-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition active:scale-[0.98]"
          >
            <Download className="w-4 h-4" /> Download High-Res PNG
          </button>
        </div>

        {/* Live Canvas Preview */}
        <div className="lg:col-span-2 bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[460px] overflow-hidden">
          <div
            className={`bg-gradient-to-br ${themeGradient} rounded-2xl shadow-2xl p-6 flex flex-col justify-between items-center text-center border border-white/10 transition-all overflow-hidden relative ${
              aspectRatio === 'mobile'
                ? 'w-[260px] h-[460px]'
                : aspectRatio === 'desktop'
                ? 'w-[480px] h-[270px]'
                : 'w-[320px] h-[320px]'
            }`}
          >
            <div className="text-[10px] uppercase font-bold tracking-widest text-purple-300 opacity-80 z-10">
              MangaVerse Studio
            </div>

            {uploadedImage && (
              <div className="absolute inset-0 flex items-center justify-center p-6 opacity-85">
                <img
                  src={uploadedImage}
                  alt="Panel Preview"
                  className="max-h-[60%] max-w-[85%] object-contain rounded-lg shadow-2xl"
                />
              </div>
            )}

            <div className="p-4 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 max-w-[90%] shadow-lg z-10 my-auto">
              <p className="text-xs font-medium text-gray-200 italic leading-relaxed">
                {quoteText}
              </p>
              {characterName && (
                <p className="text-[11px] font-bold text-purple-400 mt-2">
                  — {characterName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 text-[9px] text-gray-400 opacity-60 z-10">
              <Sparkles className="w-3 h-3 text-purple-400" /> Curated for Personal Reading
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
