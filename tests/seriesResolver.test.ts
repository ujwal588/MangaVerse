import { describe, it, expect } from 'vitest';
import { createCanonicalSlug, calculateTitleSimilarity } from '../src/services/seriesResolver';

describe('Series Resolver Service', () => {
  it('creates clean canonical slugs removing diacritics and special characters', () => {
    expect(createCanonicalSlug('Chainsaw Man!')).toBe('chainsaw-man');
    expect(createCanonicalSlug('Sousou no Frieren (Official)')).toBe('sousou-no-frieren-official');
    expect(createCanonicalSlug('Pokémon Adventures')).toBe('pokemon-adventures');
  });

  it('calculates high string similarity for identical or near-identical titles', () => {
    const sim1 = calculateTitleSimilarity('Solo Leveling', 'Solo Leveling');
    expect(sim1).toBe(1.0);

    const sim2 = calculateTitleSimilarity('Solo Leveling', 'Solo Leveling (Official)');
    expect(sim2).toBeGreaterThan(0.7);
  });

  it('rejects unrelated titles with low similarity', () => {
    const sim = calculateTitleSimilarity('One Piece', 'Bleach');
    expect(sim).toBeLessThan(0.3);
  });
});
