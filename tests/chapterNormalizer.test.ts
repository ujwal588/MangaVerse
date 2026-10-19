import { describe, it, expect } from 'vitest';
import { normalizeChapter } from '../src/services/chapterNormalizer';

describe('Chapter Normalizer Service', () => {
  it('correctly normalizes standard integer chapters', () => {
    const res = normalizeChapter('Chapter 45');
    expect(res.chapterNumber).toBe(45);
    expect(res.displayLabel).toBe('Chapter 45');
    expect(res.isSpecial).toBe(false);
  });

  it('correctly normalizes decimal sub-chapters (e.g. 12.5)', () => {
    const res = normalizeChapter('Ch. 12.5: Special Omake');
    expect(res.chapterNumber).toBe(12.5);
    expect(res.isSpecial).toBe(true);
    expect(res.specialType).toBe('omake');
  });

  it('handles lettered sub-chapters (e.g. 14a, 14b)', () => {
    const resA = normalizeChapter('Chapter 14a');
    expect(resA.chapterNumber).toBeCloseTo(14.1, 2);

    const resB = normalizeChapter('14b');
    expect(resB.chapterNumber).toBeCloseTo(14.2, 2);
  });

  it('handles prologue and chapter 0', () => {
    const res = normalizeChapter('Prologue');
    expect(res.chapterNumber).toBe(0);
    expect(res.isSpecial).toBe(true);
    expect(res.specialType).toBe('prologue');
  });

  it('extracts season numbers for manhwa/webtoons', () => {
    const res = normalizeChapter('Season 2 Chapter 38');
    expect(res.chapterNumber).toBe(38);
    expect(res.seasonNumber).toBe(2);
  });

  it('handles side stories and extra chapters', () => {
    const res = normalizeChapter('Side Story 3');
    expect(res.isSpecial).toBe(true);
    expect(res.specialType).toBe('side_story');
  });
});
