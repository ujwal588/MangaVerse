import { InPageOverlayRenderer } from './overlayRenderer';
import { TranslationProviderFactory } from '../../services/translation/provider';
import { getCachedTranslation, setCachedTranslation } from '../../services/translation/cache';
import { getGlossaryEntries, applyGlossaryOverrides } from '../../services/translation/terminology';
import { TranslationEngineConfig, PageTranslationResult } from '../../services/translation/types';

export class InPageTranslationController {
  private isEnabled: boolean = false;
  private observer: IntersectionObserver | null = null;
  private processedElements = new Set<HTMLElement>();
  private config: TranslationEngineConfig;
  private seriesId?: string;

  constructor(config?: Partial<TranslationEngineConfig>, seriesId?: string) {
    this.seriesId = seriesId;
    this.config = {
      provider: config?.provider || 'mock',
      apiKey: config?.apiKey,
      sourceLang: config?.sourceLang || 'auto',
      targetLang: config?.targetLang || 'en',
      preserveSoundEffects: config?.preserveSoundEffects ?? false,
      confidenceThreshold: config?.confidenceThreshold ?? 0.65,
    };
  }

  public setEnabled(enabled: boolean, imageElements: HTMLElement[]): void {
    this.isEnabled = enabled;
    if (this.isEnabled) {
      this.startObserving(imageElements);
    } else {
      this.stop();
      InPageOverlayRenderer.clearAll();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  private startObserving(elements: HTMLElement[]): void {
    if (this.observer) this.observer.disconnect();

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.processedElements.has(entry.target as HTMLElement)) {
            this.translateElement(entry.target as HTMLElement);
          }
        }
      },
      { rootMargin: '300px 0px' } // Pre-translate images slightly before they scroll into view
    );

    for (const el of elements) {
      this.observer.observe(el);
    }
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.processedElements.clear();
  }

  public async translateElement(el: HTMLElement): Promise<void> {
    if (this.processedElements.has(el)) return;
    this.processedElements.add(el);

    const imgUrl = (el as HTMLImageElement).src || el.getAttribute('data-src') || '';
    if (!imgUrl) return;

    try {
      // 1. Check local cache first
      let translation = await getCachedTranslation(imgUrl);

      // 2. If not cached, execute translation
      if (!translation) {
        const provider = TranslationProviderFactory.getProvider(this.config.provider);
        translation = await provider.translateImage(imgUrl, this.config);

        // Apply Glossary Terminology overrides if any exist
        const glossary = await getGlossaryEntries(this.seriesId);
        if (glossary.length > 0) {
          for (const region of translation.regions) {
            region.translatedText = applyGlossaryOverrides(region.translatedText, glossary);
          }
        }

        // Cache result in IndexedDB
        await setCachedTranslation(translation);
      }

      // 3. Render In-Page Speech Bubble Overlay
      InPageOverlayRenderer.renderOverlay(el, translation);
    } catch (err) {
      console.warn('[MangaVerse Translation] Error translating page panel:', err);
    }
  }
}
