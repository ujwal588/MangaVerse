import { describe, it, expect } from 'vitest';
import { detectChapterGapsAndDuplicates } from '../src/services/gapDetector';
import { Chapter } from '../src/types/library';

describe('Chapter Gap & Duplicate Release Detector', () => {
  it('detects missing single chapter gaps in numbering', () => {
    const chapters: Chapter[] = [
      { id: '1', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 1, chapterLabel: 'Ch 1', sourceUrl: '', detectedAt: 1, isRead: true },
      { id: '2', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 2, chapterLabel: 'Ch 2', sourceUrl: '', detectedAt: 2, isRead: true },
      { id: '4', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 4, chapterLabel: 'Ch 4', sourceUrl: '', detectedAt: 4, isRead: false },
      { id: '5', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 5, chapterLabel: 'Ch 5', sourceUrl: '', detectedAt: 5, isRead: false },
    ];

    const result = detectChapterGapsAndDuplicates(chapters);
    expect(result.hasGaps).toBe(true);
    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0].missingCount).toBe(1);
    expect(result.gaps[0].description).toBe('Missing Chapter 3');
  });

  it('detects multi-chapter gaps correctly', () => {
    const chapters: Chapter[] = [
      { id: '10', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 10, chapterLabel: 'Ch 10', sourceUrl: '', detectedAt: 1, isRead: true },
      { id: '15', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 15, chapterLabel: 'Ch 15', sourceUrl: '', detectedAt: 2, isRead: false },
    ];

    const result = detectChapterGapsAndDuplicates(chapters);
    expect(result.hasGaps).toBe(true);
    expect(result.gaps[0].missingCount).toBe(4);
    expect(result.gaps[0].description).toContain('Missing Chapters 11 to 14 (4 chapters)');
  });

  it('identifies duplicate chapter releases across scanlation groups', () => {
    const chapters: Chapter[] = [
      { id: 'ch50-a', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 50, chapterLabel: 'Ch 50 (Group A)', sourceUrl: '', detectedAt: 1, isRead: true },
      { id: 'ch50-b', seriesId: 's1', sourceMappingId: 'm2', chapterNumber: 50, chapterLabel: 'Ch 50 (Group B)', sourceUrl: '', detectedAt: 2, isRead: false },
    ];

    const result = detectChapterGapsAndDuplicates(chapters);
    expect(result.duplicates.length).toBe(1);
    expect(result.duplicates[0].chapterNumber).toBe(50);
    expect(result.duplicates[0].releases.length).toBe(2);
    expect(result.duplicates[0].recommendedChapterId).toBe('ch50-a'); // Read chapter preferred
  });

  it('handles empty or clean sequential chapter lists with zero gaps', () => {
    const chapters: Chapter[] = [
      { id: '1', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 1, chapterLabel: 'Ch 1', sourceUrl: '', detectedAt: 1, isRead: true },
      { id: '2', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 2, chapterLabel: 'Ch 2', sourceUrl: '', detectedAt: 2, isRead: true },
      { id: '3', seriesId: 's1', sourceMappingId: 'm1', chapterNumber: 3, chapterLabel: 'Ch 3', sourceUrl: '', detectedAt: 3, isRead: true },
    ];

    const result = detectChapterGapsAndDuplicates(chapters);
    expect(result.hasGaps).toBe(false);
    expect(result.gaps.length).toBe(0);
    expect(result.duplicates.length).toBe(0);
  });
});
