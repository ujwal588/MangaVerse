import { db } from './db';
import { Series, SeriesSourceMapping } from '../types/library';
import { DetectedSeriesMetadata } from '../types/adapter';

/**
 * Creates a clean URL-friendly canonical slug from a series title.
 */
export function createCanonicalSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // remove special characters
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Calculates string similarity using dice coefficient (0.0 to 1.0).
 */
export function calculateTitleSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = b.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;

  for (const item of b1) {
    if (b2.has(item)) intersection++;
  }

  return (2.0 * intersection) / (b1.size + b2.size);
}

/**
 * Finds an existing series by canonical slug or title similarity,
 * or creates a new Series and links the source mapping.
 */
export async function resolveOrCreateSeries(
  detected: DetectedSeriesMetadata,
  sourceName: string,
  sourceDomain: string
): Promise<{ series: Series; mapping: SeriesSourceMapping; isNew: boolean }> {
  const canonicalSlug = detected.canonicalSlug || createCanonicalSlug(detected.title);

  // 1. Check if mapping already exists for this exact source series URL
  const existingMapping = await db.sourceMappings
    .where('sourceSeriesUrl')
    .equals(detected.sourceSeriesUrl)
    .first();

  if (existingMapping) {
    const existingSeries = await db.series.get(existingMapping.seriesId);
    if (existingSeries) {
      return { series: existingSeries, mapping: existingMapping, isNew: false };
    }
  }

  // 2. Check if a series exists with the same canonical slug
  let matchedSeries = await db.series.where('canonicalSlug').equals(canonicalSlug).first();

  // 3. Heuristic matching against altTitles or high title similarity
  if (!matchedSeries) {
    const allSeries = await db.series.toArray();
    for (const s of allSeries) {
      if (calculateTitleSimilarity(s.title, detected.title) >= 0.88) {
        matchedSeries = s;
        break;
      }
      if (detected.altTitles && detected.altTitles.some(alt => calculateTitleSimilarity(s.title, alt) >= 0.88)) {
        matchedSeries = s;
        break;
      }
      if (s.altTitles && s.altTitles.some(alt => calculateTitleSimilarity(alt, detected.title) >= 0.88)) {
        matchedSeries = s;
        break;
      }
    }
  }

  const now = Date.now();

  // If found existing series, link new source mapping to it
  if (matchedSeries) {
    const newMapping: SeriesSourceMapping = {
      id: crypto.randomUUID(),
      seriesId: matchedSeries.id,
      sourceName,
      sourceDomain,
      sourceSeriesUrl: detected.sourceSeriesUrl,
      lastCheckedAt: now,
      isPrimary: false,
    };
    await db.sourceMappings.add(newMapping);
    return { series: matchedSeries, mapping: newMapping, isNew: false };
  }

  // Create brand new series
  const newSeriesId = crypto.randomUUID();
  const newSeries: Series = {
    id: newSeriesId,
    title: detected.title,
    altTitles: detected.altTitles || [],
    canonicalSlug,
    author: detected.author,
    artist: detected.artist,
    coverUrl: detected.coverUrl,
    format: detected.format || 'manga',
    status: 'ongoing',
    userStatus: 'reading',
    genres: [],
    tags: [],
    bingeThreshold: 10, // Default 10 chapters
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const newMapping: SeriesSourceMapping = {
    id: crypto.randomUUID(),
    seriesId: newSeriesId,
    sourceName,
    sourceDomain,
    sourceSeriesUrl: detected.sourceSeriesUrl,
    lastCheckedAt: now,
    isPrimary: true,
  };

  await db.transaction('rw', db.series, db.sourceMappings, async () => {
    await db.series.add(newSeries);
    await db.sourceMappings.add(newMapping);
  });

  return { series: newSeries, mapping: newMapping, isNew: true };
}
