import { db } from '../db';
import { PageTranslationResult } from './types';

/**
 * Creates a fast DJB2 hash of an image URL or data string.
 */
export function hashImageUrl(urlOrData: string): string {
  let hash = 5381;
  const len = Math.min(urlOrData.length, 1024); // hash first 1KB for speed
  for (let i = 0; i < len; i++) {
    hash = (hash * 33) ^ urlOrData.charCodeAt(i);
  }
  return `trans_${(hash >>> 0).toString(16)}`;
}

export async function getCachedTranslation(imageUrl: string): Promise<PageTranslationResult | undefined> {
  const key = hashImageUrl(imageUrl);
  return db.translationCache.get(key);
}

export async function setCachedTranslation(result: PageTranslationResult): Promise<void> {
  await db.translationCache.put(result);
}

export async function clearTranslationCache(): Promise<void> {
  await db.translationCache.clear();
}
