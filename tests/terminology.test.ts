import { describe, it, expect } from 'vitest';
import { applyGlossaryOverrides } from '../src/services/translation/terminology';
import { TerminologyGlossaryEntry } from '../src/services/translation/types';

describe('Terminology Glossary & Translation Memory', () => {
  it('correctly substitutes user preferred character names and abilities', () => {
    const entries: TerminologyGlossaryEntry[] = [
      { id: '1', sourceTerm: 'Sukuna', targetTerm: 'Ryomen Sukuna', createdAt: 1 },
      { id: '2', sourceTerm: 'Rasengan', targetTerm: 'Spiral Sphere', createdAt: 2 },
    ];

    const rawTranslation = 'Sukuna used his ultimate Rasengan against the curse.';
    const result = applyGlossaryOverrides(rawTranslation, entries);

    expect(result).toBe('Ryomen Sukuna used his ultimate Spiral Sphere against the curse.');
  });

  it('handles case-insensitivity while matching words', () => {
    const entries: TerminologyGlossaryEntry[] = [
      { id: '1', sourceTerm: 'itadori', targetTerm: 'Yuji Itadori', createdAt: 1 },
    ];

    const rawTranslation = 'ITADORI was ready to fight.';
    const result = applyGlossaryOverrides(rawTranslation, entries);

    expect(result).toBe('Yuji Itadori was ready to fight.');
  });

  it('leaves text unchanged when no glossary entries match', () => {
    const entries: TerminologyGlossaryEntry[] = [
      { id: '1', sourceTerm: 'Gojo', targetTerm: 'Satoru Gojo', createdAt: 1 },
    ];

    const rawTranslation = 'Luffy stretched his arm.';
    const result = applyGlossaryOverrides(rawTranslation, entries);

    expect(result).toBe('Luffy stretched his arm.');
  });
});
