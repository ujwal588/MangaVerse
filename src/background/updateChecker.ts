import { db } from '../services/db';
import { Chapter } from '../types/library';
import { showChapterNotification } from './notifications';
import { normalizeChapter } from '../services/chapterNormalizer';

export async function performUpdateCheck(): Promise<{ newChaptersCount: number }> {
  console.log('[MangaVerse] Starting periodic chapter update check...');
  let totalNew = 0;

  // Retrieve tracked series
  const trackedSeries = await db.series
    .filter(s => s.userStatus === 'reading' || s.userStatus === 'on_hold')
    .toArray();

  for (const series of trackedSeries) {
    const mappings = await db.sourceMappings
      .where('seriesId')
      .equals(series.id)
      .toArray();

    for (const mapping of mappings) {
      if (mapping.sourceName === 'mangadex') {
        const mangaIdMatch = mapping.sourceSeriesUrl.match(/\/title\/([a-f0-9-]+)/i);
        if (!mangaIdMatch) continue;

        const mangaId = mangaIdMatch[1];
        try {
          const resp = await fetch(
            `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=15`
          );
          if (!resp.ok) continue;

          const feed = await resp.json();
          const items = feed.data || [];

          for (const item of items) {
            const rawChapter = item.attributes?.chapter;
            if (!rawChapter) continue;

            const normalized = normalizeChapter(rawChapter);
            const chapterNum = normalized.chapterNumber;
            const chapterId = item.id;
            const chapterUrl = `https://mangadex.org/chapter/${chapterId}`;

            // Check if chapter already exists in database for this series
            const existing = await db.chapters
              .where('[seriesId+chapterNumber]')
              .equals([series.id, chapterNum])
              .first();

            if (!existing) {
              const newChapter: Chapter = {
                id: crypto.randomUUID(),
                seriesId: series.id,
                sourceMappingId: mapping.id,
                chapterNumber: chapterNum,
                chapterLabel: `Chapter ${rawChapter}${item.attributes?.title ? `: ${item.attributes.title}` : ''}`,
                sourceUrl: chapterUrl,
                publishTimestamp: new Date(item.attributes?.publishAt || Date.now()).getTime(),
                detectedAt: Date.now(),
                isRead: false,
              };

              await db.chapters.add(newChapter);
              totalNew++;

              // Recalculate unread count for series
              const unreadChapters = await db.chapters
                .where('seriesId')
                .equals(series.id)
                .filter(c => !c.isRead)
                .count();

              await db.series.update(series.id, {
                unreadCount: unreadChapters,
                updatedAt: Date.now(),
              });

              // Check Binge Threshold Notification
              if (series.userStatus === 'on_hold' && series.bingeThreshold > 0 && unreadChapters >= series.bingeThreshold) {
                await showChapterNotification(
                  series.id,
                  series.title,
                  `Reached ${unreadChapters} unread chapters!`,
                  chapterUrl,
                  'binge_threshold'
                );
              } else if (series.userStatus === 'reading') {
                await showChapterNotification(
                  series.id,
                  series.title,
                  newChapter.chapterLabel,
                  chapterUrl,
                  'chapter_update'
                );
              }
            }
          }
        } catch (err) {
          console.warn(`[MangaVerse] Failed to fetch updates for ${series.title}:`, err);
        }
      }
    }
  }

  console.log(`[MangaVerse] Update check complete. Found ${totalNew} new chapter(s).`);
  return { newChaptersCount: totalNew };
}
