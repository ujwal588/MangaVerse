import React, { useState } from 'react';
import { LibraryPage } from './pages/LibraryPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { TranslationPage } from './pages/TranslationPage';
import { CreativeStudioPage } from './pages/CreativeStudioPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BookOpen, Bell, Languages, Palette, BarChart3, Settings } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'library' | 'updates' | 'translation' | 'studio' | 'analytics' | 'settings'>('library');

  return (
    <div className="min-h-screen flex flex-col bg-darkbg-900 text-gray-100">
      {/* Top Navigation Bar */}
      <header className="bg-darkbg-800/80 backdrop-blur-md border-b border-darkbg-700/80 sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-purple-600/30">
              M
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">MangaVerse</h1>
              <p className="text-[10px] text-purple-400 font-semibold tracking-wider uppercase">Reading Companion</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-darkbg-900/80 p-1 rounded-2xl border border-darkbg-700/60 overflow-x-auto">
            {[
              { id: 'library', label: 'Library', icon: BookOpen },
              { id: 'updates', label: 'Updates', icon: Bell },
              { id: 'translation', label: 'Translation (BYOK)', icon: Languages },
              { id: 'studio', label: 'Creative Studio', icon: Palette },
              { id: 'analytics', label: 'Insights', icon: BarChart3 },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl transition whitespace-nowrap ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                      : 'text-gray-400 hover:text-white hover:bg-darkbg-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">
        {activeTab === 'library' && <LibraryPage />}
        {activeTab === 'updates' && <UpdatesPage />}
        {activeTab === 'translation' && <TranslationPage />}
        {activeTab === 'studio' && <CreativeStudioPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
};
