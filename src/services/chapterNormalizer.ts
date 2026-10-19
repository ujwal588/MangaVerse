export interface NormalizedChapterInfo {
  chapterNumber: number; // Float representation, e.g. 12.5
  displayLabel: string;
  seasonNumber?: number;
  isSpecial: boolean;
  specialType?: 'prologue' | 'epilogue' | 'omake' | 'side_story' | 'extra';
}

/**
 * Parses raw chapter strings and URL fragments into normalized numerical chapter values and labels.
 * Handles patterns such as:
 * - "Chapter 12" -> 12
 * - "Ch. 12.5" -> 12.5
 * - "12a" -> 12.1
 * - "Prologue" -> 0.0
 * - "Season 2 Chapter 14" -> season 2, chapter 14
 * - "Side Story 3" -> special
 */
export function normalizeChapter(rawInput: string): NormalizedChapterInfo {
  const clean = rawInput.trim();
  let remaining = clean.toLowerCase();

  // Handle Prologue
  if (remaining.includes('prologue') || remaining.includes('chapter 0') || remaining === 'ch 0' || remaining === 'ch. 0') {
    return {
      chapterNumber: 0,
      displayLabel: clean || 'Prologue',
      isSpecial: true,
      specialType: 'prologue'
    };
  }

  // Handle Season prefix: e.g. "Season 2 Chapter 15" or "S2 - Ch 15"
  let seasonNumber: number | undefined;
  const seasonMatch = remaining.match(/(?:season|s)\s*(\d+)/i);
  if (seasonMatch) {
    seasonNumber = parseInt(seasonMatch[1], 10);
    remaining = remaining.replace(seasonMatch[0], '').trim();
  }

  // Handle explicit chapter keyword: e.g. "chapter 124.5", "ch. 124.5", "ep. 45"
  const explicitMatch = remaining.match(/(?:chapter|ch\.?|ep\.?|episode)\s*(\d+(?:\.\d+)?)/i);
  if (explicitMatch) {
    const num = parseFloat(explicitMatch[1]);
    const letterSuffixMatch = remaining.match(new RegExp(explicitMatch[1] + '([a-z])', 'i'));
    let finalNum = num;
    if (letterSuffixMatch) {
      const charCode = letterSuffixMatch[1].toLowerCase().charCodeAt(0) - 96;
      finalNum = num + (charCode * 0.1);
    }

    const isSpecial = clean.toLowerCase().includes('extra') || clean.toLowerCase().includes('side') || clean.toLowerCase().includes('omake');
    let specialType: NormalizedChapterInfo['specialType'];
    if (clean.toLowerCase().includes('side')) specialType = 'side_story';
    else if (clean.toLowerCase().includes('omake')) specialType = 'omake';
    else if (clean.toLowerCase().includes('extra')) specialType = 'extra';

    return {
      chapterNumber: finalNum,
      displayLabel: clean.startsWith('Chapter') || clean.startsWith('Ch') ? clean : `Chapter ${clean}`,
      seasonNumber,
      isSpecial,
      specialType
    };
  }

  // Handle any remaining number
  const numFallback = remaining.match(/(\d+(?:\.\d+)?)/);
  if (numFallback) {
    const num = parseFloat(numFallback[1]);
    const letterSuffixMatch = remaining.match(new RegExp(numFallback[1] + '([a-z])', 'i'));
    let finalNum = num;
    if (letterSuffixMatch) {
      const charCode = letterSuffixMatch[1].toLowerCase().charCodeAt(0) - 96;
      finalNum = num + (charCode * 0.1);
    }

    const isSpecial = clean.toLowerCase().includes('extra') || clean.toLowerCase().includes('side') || clean.toLowerCase().includes('omake');
    let specialType: NormalizedChapterInfo['specialType'];
    if (clean.toLowerCase().includes('side')) specialType = 'side_story';
    else if (clean.toLowerCase().includes('omake')) specialType = 'omake';
    else if (clean.toLowerCase().includes('extra')) specialType = 'extra';

    return {
      chapterNumber: finalNum,
      displayLabel: clean.startsWith('Chapter') || clean.startsWith('Ch') ? clean : `Chapter ${clean}`,
      seasonNumber,
      isSpecial,
      specialType
    };
  }

  return {
    chapterNumber: 1,
    displayLabel: clean || 'Chapter 1',
    isSpecial: false
  };
}
