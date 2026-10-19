import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Languages, ShieldCheck } from 'lucide-react';

const MT_PORT = 7676;

export const TranslationPage: React.FC = () => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [openError, setOpenError] = useState('');

  const checkTranslator = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setIsAvailable(false);
      return;
    }

    chrome.runtime.sendMessage({ type: 'MT_CHECK', port: MT_PORT }, (response) => {
      if (chrome.runtime.lastError) {
        setIsAvailable(false);
        return;
      }
      setIsAvailable(response?.available === true);
    });
  }, []);

  useEffect(() => {
    checkTranslator();
  }, [checkTranslator]);

  const openTranslator = () => {
    setOpenError('');
    chrome.runtime.sendMessage({ type: 'OPEN_MANGA_TRANSLATOR', port: MT_PORT }, (response) => {
      if (chrome.runtime.lastError || response?.success !== true) {
        setOpenError('Could not open MangaTranslator. Check that the MangaVerse extension is enabled.');
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Manual Manga Translation</h1>
        <p className="text-sm text-gray-400 mt-1">
          Open MangaTranslator, upload a page image, and read its translated result there.
        </p>
      </div>

      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <Languages className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-white">Use your local MangaTranslator</h2>
            <p className="text-sm text-gray-400 mt-1">
              MangaVerse opens the local translator for you. Upload or paste a manga page in its web UI and view the
              translated image there. MangaVerse does not send images to a translation service automatically.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-darkbg-700 bg-darkbg-900 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            {isAvailable === null ? (
              <span className="w-2 h-2 rounded-full bg-gray-500" />
            ) : isAvailable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={isAvailable ? 'text-emerald-300' : isAvailable === false ? 'text-red-300' : 'text-gray-400'}>
              {isAvailable === null ? 'Checking localhost:7676…' : isAvailable ? 'MangaTranslator is running' : 'MangaTranslator is offline'}
            </span>
            <button onClick={checkTranslator} className="ml-auto text-gray-400 hover:text-white underline">
              Check again
            </button>
          </div>

          {!isAvailable && (
            <p className="text-xs text-gray-400">
              Start MangaTranslator locally with <code className="text-purple-300">python app.py</code> and keep it
              running on port 7676.
            </p>
          )}

          <button
            onClick={openTranslator}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm px-5 py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            Open MangaTranslator <ExternalLink className="w-4 h-4" />
          </button>
          {openError && <p className="text-xs text-red-300">{openError}</p>}
        </div>

        <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
          <li>Open MangaTranslator and upload or paste a manga page image.</li>
          <li>In its Config → Translation page, choose a provider and add your API key.</li>
          <li>Translate the page there and read or download the result.</li>
        </ol>

        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">
            Your API key is configured in MangaTranslator on your machine. MangaVerse does not store or transmit it.
          </p>
        </div>
      </div>
    </div>
  );
};
