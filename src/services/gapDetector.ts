import { Chapter } from '../types/library';

export interface ChapterGap {
  startChapter: number;
  endChapter: number;
  missingCount: number;
  description: string;
}

export interface DuplicateReleaseGroup {
  chapterNumber: number;
  releases: Chapter[];
  recommendedChapterId: string;
}

export interface GapAnalysisResult {
  hasGaps: boolean;
  gaps: ChapterGap[];
  duplicates: DuplicateReleaseGroup[];
  totalUniqueChapters: number;
  highestChapter: number;
  lowestChapter: number;
}

/**
 * Analyzes a list of chapters for missing gaps (e.g. ch 1 to 5, missing 6, then 7 to 10)
 * and duplicate releases (e.g. multiple scanlations of the same chapter number).
 */
export function detectChapterGapsAndDuplicates(chapters: Chapter[]): GapAnalysisResult {
  if (!chapters || chapters.length === 0) {
    return {
      hasGaps: false,
      gaps: [],
      duplicates: [],
      totalUniqueChapters: 0,
      highestChapter: 0,
      lowestChapter: 0,
    };
  }

  // 1. Group by numerical chapter number
  const groups = new Map<number, Chapter[]>();
  for (const ch of chapters) {
    const list = groups.get(ch.chapterNumber) || [];
    list.push(ch);
    groups.set(ch.chapterNumber, list);
  }

  const duplicates: DuplicateReleaseGroup[] = [];
  for (const [chNum, list] of groups.entries()) {
    if (list.length > 1) {
      // Pick recommended: prefer already read, or earliest detected, or most complete label
      const recommended = list.find(c => c.isRead) || list[0];
      duplicates.push({
        chapterNumber: chNum,
        releases: list,
        recommendedChapterId: recommended.id,
      });
    }
  }

  // 2. Sort unique numbers
  const sortedNumbers = Array.from(groups.keys()).sort((a, b) => a - b);
  const lowestChapter = sortedNumbers[0];
  const highestChapter = sortedNumbers[sortedNumbers.length - 1];

  const gaps: ChapterGap[] = [];

  // Check integer step intervals
  for (let i = 0; i < sortedNumbers.length - 1; i++) {
    const current = sortedNumbers[i];
    const next = sortedNumbers[i + 1];

    // If both are whole numbers and the difference > 1, there is a gap
    if (Number.isInteger(current) && Number.isInteger(next)) {
      const diff = next - current;
      if (diff > 1) {
        const missingCount = diff - 1;
        gaps.push({
          startChapter: current,
          endChapter: next,
          missingCount,
          description: missingCount === 1
            ? `Missing Chapter ${current + 1}`
            : `Missing Chapters ${current + 1} to ${next - 1} (${missingCount} chapters)`,
        });
      }
    }
  }

  return {
    hasGaps: gaps.length > 0,
    gaps,
    duplicates,
    totalUniqueChapters: sortedNumbers.length,
    highestChapter,
    lowestChapter,
  };
}
