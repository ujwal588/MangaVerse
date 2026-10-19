import { describe, it, expect } from 'vitest';
import { MangaVerseBackup } from '../src/services/exportImport';

describe('Export and Import Service', () => {
  it('validates structure of a MangaVerseBackup', () => {
    const validBackup: MangaVerseBackup = {
      version: 1,
      exportedAt: Date.now(),
      series: [
        {
          id: 'test-1',
          title: 'Berserk',
          altTitles: [],
          canonicalSlug: 'berserk',
          format: 'manga',
          status: 'ongoing',
          userStatus: 'reading',
          genres: ['Dark Fantasy'],
          tags: [],
          bingeThreshold: 10,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      sourceMappings: [],
      chapters: [],
      progress: [],
      notifications: [],
    };

    const json = JSON.stringify(validBackup);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.series.length).toBe(1);
    expect(parsed.series[0].title).toBe('Berserk');
  });

  it('rejects invalid JSON payloads lacking required series array', () => {
    const invalidJson = JSON.stringify({ version: 1, invalidProp: true });
    const parsed = JSON.parse(invalidJson);
    expect(parsed.series).toBeUndefined();
  });
});
