# MangaVerse — The Ultimate Manga Reading Companion

> **Version:** 1.0.0 (Phase 1 MVP Release)  
> **Platform:** Chrome Extension Manifest V3 (Chromium: Chrome, Brave, Edge, Opera)  
> **Architecture:** Local-First (IndexedDB + Dexie.js), Shadow-DOM In-Page HUD, Offline Chapter Reading, Manual Local Manga Translation

---

## 🚀 Overview

**MangaVerse** is an open-standard, privacy-first browser companion that unifies your manga, manhwa, and webtoon reading across the websites you already use. Rather than forcing you onto a third-party aggregator, MangaVerse enhances your active reading pages with:
- **Intelligent Chapter & Series Detection:** Deep integration with MangaDex official API + generic horizontal & vertical webtoon DOM heuristics.
- **Sub-Pixel Scroll & Reading Position Recovery:** Remembers exact scroll offsets and marks chapters as read only when $\ge 85\%$ is consumed (never marking a chapter read just because you opened it).
- **Intelligent Binge & Backlog Alerts:** Background alarms that notify you when an on-hold series accumulates enough unread chapters to binge (e.g. $\ge 10$ chapters), with multi-source duplicate suppression.
- **Encapsulated In-Page Reader HUD:** Floating Shadow DOM toolbar that never clashes with host website CSS or leaks user credentials.
- **Offline Chapter Reading:** Save chapter page images locally from supported readers, then read saved chapters without the source website or internet connection.
- **Manual Local Translation:** The reader HUD and dashboard open MangaTranslator locally so you can upload or paste manga page images and read the translated result there. MangaVerse does not translate panels automatically.
- **Creative Panel Studio:** Instant wallpaper and sticker generation with customizable dimensions (Mobile 9:16, Desktop 16:9, Sticker 1:1).
- **100% Local-First & Zero Telemetry:** All library records and reading history reside in your local IndexedDB. Full JSON export/import and one-click data wipe.

---

## 📦 How to Install and Test in Chrome / Chromium

### Step 1: Build the Extension
```bash
cd C:\Users\boosa\.gemini\antigravity\scratch\mangaverse
npm run build
```
*(The production bundle is generated inside the `dist/` directory).*

### Step 2: Load Unpacked into Chrome
1. Open Google Chrome (or Brave, Edge, Opera).
2. Navigate to `chrome://extensions/` in the URL bar.
3. Toggle on **"Developer mode"** in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left corner.
5. Select the build directory:
   `C:\Users\boosa\.gemini\antigravity\scratch\mangaverse\dist`
6. Pin **MangaVerse** to your browser toolbar!

---

## 🧪 Testing the MVP Features

### 1. Test In-Page Detection & Reader HUD
1. Navigate to any chapter on [MangaDex](https://mangadex.org), for example any popular chapter (e.g. Chainsaw Man or Frieren).
2. Notice the purple **MangaVerse HUD pill** appearing in the bottom-right corner.
3. Click the pill to expand it:
   - Notice the detected Series Title and Chapter Number.
   - Scroll down the chapter: watch the live progress bar and percentage update.
   - Scroll past 85%: the chapter is automatically marked as completed (`✓`).
   - Reload the page: MangaVerse smoothly restores your reading position.

### 2. Test Unified Library & Dashboard
1. Click the MangaVerse icon in the Chrome toolbar.
2. Click **"Full Library"** or open the extension options page (`chrome-extension://<id>/src/dashboard/index.html`).
3. Explore the **Library tab**:
   - Filter by Reading, On Hold, Plan to Read, Completed.
   - Click any series card to open the **Series Detail Modal**: view all tracked chapters, mark individual chapters as read/unread, and customize the **Binge Alert Threshold**.

### 3. Test Binge Backlog & Chapter Updates
1. Navigate to the **Updates tab** in the Dashboard.
2. Click **"Check Now"** to trigger an immediate background check across tracked MangaDex feeds.
3. If an on-hold series reaches its threshold, a high-priority **"Ready to Binge!"** notification will appear.

### 4. Use Manual Manga Translation
1. Start MangaTranslator from its project folder on port 7676:
   ```powershell
   .\.venv\Scripts\python.exe app.py --port 7676
   ```
2. Open a manga chapter and expand the MangaVerse HUD, then click **Open MangaTranslator**. You can also open the Dashboard's **Manual Translation** page.
3. In MangaTranslator, upload or paste a page image. Configure your provider and API key under **Config → Translation**, then translate the page there.
4. The HUD shows whether MangaTranslator is online. MangaVerse currently opens the local app; it does not send pages or translate them automatically.

### 5. Save a Chapter for Offline Reading
1. Open a supported manga chapter while online. For lazy-loaded readers, scroll through the chapter once so every page is present.
2. Expand the MangaVerse HUD and click **Save Chapter Offline**.
3. Review the chapter and click **Download chapter**. Chrome asks for access to the image hosts used by that chapter; MangaVerse requests only those hosts for the download.
4. Open the Dashboard's **Offline** tab and choose **Read offline**. Saved page images stay in this browser's local IndexedDB and can be deleted from the Offline tab.

MangaVerse stores page images and chapter metadata rather than the original website HTML. Offline downloads are not included in JSON library backups, so save them again on another device.

### 6. Test Backup, Portability & Privacy Wipe
1. Navigate to the **Settings tab**.
2. Click **"Export Library (JSON)"**: verify that a valid `.json` backup file is downloaded containing your series, chapters, and progress.
3. Click **"Import Library Backup"** to restore state.
4. Click **"Wipe All Local Data"** to verify GDPR/Privacy compliant data erasure.

---

## 🛠️ Automated Unit & Integration Tests

Run the test suite with:
```bash
npm test
```

### Verified Test Suites:
- `tests/chapterNormalizer.test.ts`: Verifies parsing of decimals (`12.5`), season prefixes (`Season 2 Ch 38`), letter suffixes (`14a`), and prologues (`Ch 0`).
- `tests/seriesResolver.test.ts`: Verifies canonical slug generation and string similarity dice coefficients.
- `tests/updateChecker.test.ts`: Verifies binge threshold rules and unread backlog logic.
- `tests/exportImport.test.ts`: Verifies JSON schema serialization, backup validation, and corrupt payload rejection.

---

## 📂 Project Structure

```
mangaverse/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── background/
│   │   ├── index.ts           # Service worker & message routing
│   │   ├── alarms.ts          # Chrome alarms (60 min periodic updates)
│   │   ├── notifications.ts   # Desktop alerts & click handlers
│   │   └── updateChecker.ts   # MangaDex API feed & binge evaluator
│   ├── content/
│   │   ├── index.ts           # Content script entry point
│   │   ├── scrollTracker.ts   # Sub-pixel scroll & 85% completion threshold
│   │   ├── hud/
│   │   │   ├── ReaderHUD.ts   # Isolated Shadow DOM component
│   │   │   └── ReaderHUD.css  # Scoped HUD stylesheet
│   │   └── adapters/
│   │       ├── base.ts
│   │       ├── mangadex.ts    # Official MangaDex API & DOM adapter
│   │       ├── genericHorizontal.ts
│   │       ├── genericLongstrip.ts
│   │       └── registry.ts    # Adapter router
│   ├── dashboard/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── Dashboard.tsx      # Main layout & navigation
│   │   └── pages/
│   │       ├── LibraryPage.tsx
│   │       ├── UpdatesPage.tsx
│   │       ├── TranslationPage.tsx
│   │       ├── CreativeStudioPage.tsx
│   │       ├── AnalyticsPage.tsx
│   │       └── SettingsPage.tsx
│   ├── popup/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── Popup.tsx          # Compact quick-access popup
│   ├── offscreen/
│   │   ├── index.html
│   │   └── offscreen.ts       # Canvas image crop & CORS worker
│   ├── services/
│   │   ├── db.ts              # Dexie.js IndexedDB relational schema
│   │   ├── chapterNormalizer.ts
│   │   ├── seriesResolver.ts  # Canonical slugs & title matching
│   │   └── exportImport.ts    # Backup, restore & data wipe
│   └── types/
│       ├── library.ts
│       ├── adapter.ts
│       └── messages.ts
└── tests/
    ├── chapterNormalizer.test.ts
    ├── seriesResolver.test.ts
    ├── updateChecker.test.ts
    └── exportImport.test.ts
```
