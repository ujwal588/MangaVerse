import { describe, it, expect } from 'vitest';
import { MockTranslationProvider, TranslationProviderFactory } from '../src/services/translation/provider';
import { TranslationEngineConfig } from '../src/services/translation/types';

describe('Translation Provider Engine', () => {
  it('mock provider generates speech bubbles with valid bounding box percentages', async () => {
    const provider = new MockTranslationProvider();
    const config: TranslationEngineConfig = {
      provider: 'mock',
      sourceLang: 'ja',
      targetLang: 'en',
      preserveSoundEffects: false,
      confidenceThreshold: 0.65,
    };

    const res = await provider.translateImage('data:image/png;base64,mockImage', config);
    expect(res.regions.length).toBeGreaterThan(0);

    for (const region of res.regions) {
      expect(region.boundingBox.x).toBeGreaterThanOrEqual(0);
      expect(region.boundingBox.x).toBeLessThanOrEqual(100);
      expect(region.boundingBox.y).toBeGreaterThanOrEqual(0);
      expect(region.boundingBox.y).toBeLessThanOrEqual(100);
      expect(region.boundingBox.width).toBeGreaterThan(0);
      expect(region.boundingBox.height).toBeGreaterThan(0);
      expect(region.sourceText.length).toBeGreaterThan(0);
      expect(region.translatedText.length).toBeGreaterThan(0);
      expect(region.confidence).toBeGreaterThan(0.8);
    }
  });

  it('factory instantiates requested provider types correctly', () => {
    const geminiP = TranslationProviderFactory.getProvider('gemini');
    expect(geminiP.id).toBe('gemini');
    expect(geminiP.name).toContain('Gemini');

    const mockP = TranslationProviderFactory.getProvider('mock');
    expect(mockP.id).toBe('mock');

    const openaiP = TranslationProviderFactory.getProvider('openai');
    expect(openaiP.id).toBe('openai');

    const anthropicP = TranslationProviderFactory.getProvider('anthropic');
    expect(anthropicP.id).toBe('anthropic');

    const defaultP = TranslationProviderFactory.getProvider('unknown');
    expect(defaultP.id).toBe('gemini');
  });
});

