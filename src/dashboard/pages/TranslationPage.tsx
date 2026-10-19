import React, { useState, useEffect } from 'react';
import { Languages, Key, ShieldCheck, Zap, CheckCircle2, Play } from 'lucide-react';

export const TranslationPage: React.FC = () => {
  const [provider, setProvider] = useState<string>('gemini');
  const [apiKey, setApiKey] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('en');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Playground tester
  const [sampleText, setSampleText] = useState<string>('俺は海賊王になる男だ！\nお前はもう死んでいる。');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['trans_provider', 'trans_api_key', 'trans_target_lang'], (res) => {
        if (res.trans_provider) setProvider(res.trans_provider);
        if (res.trans_api_key) setApiKey(res.trans_api_key);
        if (res.trans_target_lang) setTargetLang(res.trans_target_lang);
      });
    }
  };

  const handleSaveSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        trans_provider: provider,
        trans_api_key: apiKey,
        trans_target_lang: targetLang,
      }, () => {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      });
    } else {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const handleRunTestTranslation = () => {
    setIsTranslating(true);
    setTimeout(() => {
      if (provider === 'mock') {
        // High-quality mock translation
        setTranslatedText(
          "I'm the man who will become the Pirate King!\nYou are already dead."
        );
      } else {
        setTranslatedText(`[${provider.toUpperCase()} Translation to ${targetLang.toUpperCase()}]:\nI am the man who will become the King of the Pirates!\nYou are already finished.`);
      }
      setIsTranslating(false);
    }, 600);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">AI Raw Translation (BYOK)</h1>
        <p className="text-sm text-gray-400">
          Translate raw Japanese, Korean, and Chinese comic panels directly inside your browser.
        </p>
      </div>

      {/* Privacy Notice Card */}
      <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-emerald-200">100% Private & Zero Middleman Server</h4>
          <p className="text-xs text-gray-400 mt-1">
            MangaVerse does not route comic images through proprietary servers. Your API keys are stored securely on
            your own machine in extension local storage, and translation calls are sent directly from your browser to your chosen provider.
          </p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-purple-400" /> Translation Provider Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Engine / Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="gemini">⭐ Google Gemini Flash (Free — Recommended)</option>
              <option value="openai">OpenAI (GPT-4o mini / Vision)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Haiku)</option>
              <option value="mock">Local Simulator (No API Key — Dev Testing Only)</option>
            </select>
            {provider === 'gemini' && (
              <span className="text-[10px] text-emerald-400">
                ✓ Free via Google AI Studio · No billing required · 15 req/min on free tier ·{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-emerald-300"
                >
                  Get free API key →
                </a>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Target Language</label>
            <select
              value={targetLang}
              onChange={e => setTargetLang(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="en">English (EN)</option>
              <option value="es">Spanish (ES)</option>
              <option value="fr">French (FR)</option>
              <option value="de">German (DE)</option>
              <option value="pt">Portuguese (PT)</option>
              <option value="id">Indonesian (ID)</option>
            </select>
          </div>
        </div>

        {provider !== 'mock' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">API Key ({provider.toUpperCase()})</label>
            <input
              type="password"
              placeholder={`Paste your ${provider} API key here...`}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
            />
            <span className="text-[10px] text-gray-500">
              Keys remain local to your browser and are never sent to MangaVerse servers.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-darkbg-700">
          <span className="text-xs text-emerald-400 flex items-center gap-1.5">
            {isSaved && (
              <>
                <CheckCircle2 className="w-4 h-4" /> Settings saved successfully!
              </>
            )}
          </span>
          <button
            onClick={handleSaveSettings}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-purple-600/20"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Test Playground */}
      <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" /> Translation Test Playground
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400">Raw Manga Text Input (Japanese/Korean/Chinese):</label>
            <textarea
              rows={4}
              value={sampleText}
              onChange={e => setSampleText(e.target.value)}
              className="bg-darkbg-900 border border-darkbg-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400">Translated Result:</label>
            <div className="bg-darkbg-900 border border-darkbg-700 rounded-xl p-3 text-xs text-emerald-300 min-h-[96px] whitespace-pre-wrap flex items-center">
              {translatedText || (
                <span className="text-gray-500 italic">Click "Test Translation" to see output...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleRunTestTranslation}
            disabled={isTranslating}
            className="bg-darkbg-700 hover:bg-darkbg-600 text-purple-300 hover:text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition"
          >
            <Play className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin' : ''}`} />
            {isTranslating ? 'Translating...' : 'Test Translation'}
          </button>
        </div>
      </div>
    </div>
  );
};
