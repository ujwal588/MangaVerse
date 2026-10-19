# MangaVerse — Manga Reading Companion

MangaVerse is a local-first Chrome extension that adds reading progress, a library, update alerts, offline chapter storage, and companion tools to manga and webtoon sites. It is a browser extension, not a manga hosting service.

## Current features

- **Reader HUD and progress tracking:** Detects series and chapters, tracks scroll position, restores reading position, and marks a chapter complete after 85% progress.
- **Supported readers:** Dedicated adapters for MangaDex, LINE Webtoon, and Rawkuma, plus generic horizontal-page and long-strip detection on the hosts declared in `manifest.json`. Site layouts can change, so generic detection is not guaranteed on every page.
- **Library:** Track series across linked sources, chapters, reading status, and binge thresholds. Library and reading data are stored in this browser using IndexedDB.
- **Chapter updates:** Periodic checks and the Dashboard's **Check Now** action currently query MangaDex feeds. On-hold series can trigger binge alerts when their unread count reaches the chosen threshold.
- **Offline reading:** Save the current chapter from the reader HUD, or configure a per-source chapter count in the Library and choose **Confirm & Download**. MangaVerse opens the source pages, collects chapter images, and stores them in IndexedDB. Use the Dashboard's **Offline** page to read or delete saved chapters.
- **Manual translation:** MangaVerse can open a locally running MangaTranslator. Upload or paste the page there and translate it in that app. MangaVerse does not automatically send page images or translate them in the reader.
- **Reading tools:** The Dashboard includes a reading queue, release cadence estimates, source health display, a local creative studio, reading insights, and a co-reading/spoiler-guard demo.
- **Data portability:** Export or import the library as JSON, or wipe local extension data from Settings.

## Current limitations

- Chapter detection and offline downloads depend on a supported page exposing readable chapter metadata and image URLs. A source or image CDN may block a request (for example, with HTTP 403), preventing some pages from saving.
- Chrome asks for access to a manga site when needed for chapter discovery and download. Image-host access may also be requested before saving images.
- Offline page images are stored only in the current browser profile and are **not** included in JSON library backups.
- Automatic MangaVerse panel translation is currently disabled. MangaTranslator must be installed and run separately.
- Chapter update polling currently supports MangaDex feeds only. The AniList and MyAnimeList controls in Settings are UI/demo controls; account authorization and live sync are not wired into the settings flow.
- Social Rooms currently use an in-browser demo room manager; they do not provide a networked multi-user chat service.

## Requirements

- Node.js and npm to build the extension.
- Chrome or another Chromium browser with Manifest V3 support.
- Optional: [MangaTranslator](https://github.com/meangrinch/MangaTranslator) running locally on port `7676` for manual translation. Start it with `python app.py` from its project directory and configure its provider/API key in its local web UI at `http://localhost:7676`.

## Build and install locally

From the repository root:

```bash
npm install
npm run build
```

The build writes extension assets to `dist/`. To load the unpacked extension:

1. Open `chrome://extensions` and enable **Developer mode**.
2. Select **Load unpacked**.
3. Choose the repository root—the directory containing the root `manifest.json` (not the `dist/` directory).
4. After rebuilding, select **Reload** on the MangaVerse card.

## Use manual translation

1. Start MangaTranslator with `python app.py` and keep it running on port `7676`.
2. In MangaVerse, open **Manual Translation** in the Dashboard or choose **Open MangaTranslator** in the reader HUD.
3. Upload or paste a manga page image into MangaTranslator and run translation there.

MangaVerse only opens the local translator and checks whether it is available. The translator's API key remains configured in MangaTranslator and is not stored by MangaVerse.

## Save and read chapters offline

**Download chapters ahead:** In the Dashboard's **Library**, open a series, set **Download chapters ahead** for a linked source (0–20), then choose **Confirm & Download**. Grant source-site access if Chrome prompts. MangaVerse selects unread chapters after your last-read chapter; if no reading progress is recorded, it selects the latest available chapters. Allow image-host access when prompted to save the prepared pages.

**Save the current chapter:** Open a supported chapter, expand the reader HUD, and choose **Save Chapter Offline**. Some readers lazy-load images; scroll through the chapter first if pages are missing.

Open **Offline** in the Dashboard to see saved chapters. Downloads require the source and its image hosts to allow access; an HTTP error can leave a chapter partially saved. Stored image data remains on this browser and can be removed from the Offline page.

## Tests

Run the project's Vitest suite with:

```bash
npm test
```

The tests cover chapter normalization, series matching, progress/gap logic, update alerts, backup import/export, translation providers and cache, terminology, source health, session tracking, tracker helpers, and social room utilities.

## Project transcript

The project conversation archive is [`docs/transcripts/AI-Transcript.jsonl`](docs/transcripts/AI-Transcript.jsonl). It contains the earlier project transcript and subsequent continuation entries, including a summary of the recent offline-reading debugging session.

## Project layout

```text
mangaverse/
├── manifest.json                 # Root unpacked-extension manifest
├── public/                       # Static assets and manifest copy
├── src/
│   ├── background/               # MV3 service worker, alarms, update checks
│   ├── content/                  # Reader detection, HUD, site adapters
│   ├── dashboard/                # Library and feature pages, including Offline
│   ├── offscreen/                # Offscreen canvas helpers
│   ├── popup/                    # Toolbar popup
│   ├── services/                 # IndexedDB, progress, queue, translation helpers
│   └── types/                    # Shared TypeScript types and messages
├── tests/                        # Vitest suites
└── docs/transcripts/             # Project conversation archive
```
