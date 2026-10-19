import { describe, it, expect } from 'vitest';
import { hashImageUrl } from '../src/services/translation/cache';

describe('Translation Cache Hashing', () => {
  it('generates deterministic and consistent hashes for identical URLs', () => {
    const url = 'https://uploads.mangadex.org/data/abcd1234efgh5678/1-001.png';
    const hash1 = hashImageUrl(url);
    const hash2 = hashImageUrl(url);

    expect(hash1).toBe(hash2);
    expect(hash1.startsWith('trans_')).toBe(true);
  });

  it('generates distinct hashes for different URLs', () => {
    const urlA = 'https://uploads.mangadex.org/data/page1.png';
    const urlB = 'https://uploads.mangadex.org/data/page2.png';

    const hashA = hashImageUrl(urlA);
    const hashB = hashImageUrl(urlB);

    expect(hashA).not.toBe(hashB);
  });
});
