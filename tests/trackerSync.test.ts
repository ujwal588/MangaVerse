import { describe, it, expect } from 'vitest';
import { simulateTrackerSync } from '../src/services/trackerSync';

describe('External Tracker Sync Service', () => {
  it('correctly simulates synchronization with AniList', () => {
    const res = simulateTrackerSync('anilist', 45.5);
    expect(res.service).toContain('AniList');
    expect(res.success).toBe(true);
    expect(res.syncedChapter).toBe(45); // Floored integer for AniList
  });

  it('correctly simulates synchronization with MyAnimeList', () => {
    const res = simulateTrackerSync('myanimelist', 120);
    expect(res.service).toContain('MyAnimeList');
    expect(res.success).toBe(true);
    expect(res.syncedChapter).toBe(120);
  });
});
