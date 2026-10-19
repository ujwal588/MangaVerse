import { DetectedTextRegion, PageTranslationResult } from '../../services/translation/types';

export class InPageOverlayRenderer {
  private static activeOverlays = new Map<HTMLElement, HTMLElement>();
  private static isShowingOriginal: boolean = false;

  /**
   * Mounts or updates a translation overlay on top of a comic image or page container.
   */
  public static renderOverlay(
    targetElement: HTMLElement,
    translation: PageTranslationResult,
    onEditRegion?: (region: DetectedTextRegion, newText: string) => void
  ): HTMLElement {
    // Remove existing overlay if any
    this.removeOverlay(targetElement);

    const rect = targetElement.getBoundingClientRect();
    const parent = targetElement.offsetParent || targetElement.parentElement || document.body;

    const overlay = document.createElement('div');
    overlay.className = 'mangaverse-translation-overlay-layer';
    overlay.style.position = 'absolute';
    overlay.style.left = `${targetElement.offsetLeft}px`;
    overlay.style.top = `${targetElement.offsetTop}px`;
    overlay.style.width = `${targetElement.clientWidth || rect.width}px`;
    overlay.style.height = `${targetElement.clientHeight || rect.height}px`;
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483640';
    overlay.style.overflow = 'hidden';

    for (const region of translation.regions) {
      const bubble = document.createElement('div');
      bubble.className = 'mangaverse-speech-bubble-overlay';
      bubble.style.position = 'absolute';
      bubble.style.left = `${region.boundingBox.x}%`;
      bubble.style.top = `${region.boundingBox.y}%`;
      bubble.style.width = `${region.boundingBox.width}%`;
      bubble.style.height = `${region.boundingBox.height}%`;
      bubble.style.pointerEvents = 'auto';
      bubble.style.cursor = 'pointer';

      // Manga speech bubble styling: clean white/light fill with soft shadow
      bubble.style.background = 'rgba(255, 255, 255, 0.95)';
      bubble.style.backdropFilter = 'blur(4px)';
      bubble.style.borderRadius = '14px';
      bubble.style.border = '1px solid rgba(0, 0, 0, 0.15)';
      bubble.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.18)';
      bubble.style.display = 'flex';
      bubble.style.alignItems = 'center';
      bubble.style.justifyContent = 'center';
      bubble.style.textAlign = 'center';
      bubble.style.padding = '4px 6px';
      bubble.style.userSelect = 'none';
      bubble.style.transition = 'all 0.18s ease';

      // Dynamic font size calculation based on bounding box size and text length
      const textLen = region.translatedText.length || 1;
      const baseArea = region.boundingBox.width * region.boundingBox.height;
      const calculatedFontSize = Math.max(9, Math.min(14, Math.floor(Math.sqrt(baseArea / textLen) * 3.8)));

      bubble.style.fontSize = `${calculatedFontSize}px`;
      bubble.style.lineHeight = '1.25';
      bubble.style.fontFamily = 'CCComicrazy, "Anime Ace", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      bubble.style.fontWeight = '600';
      bubble.style.color = '#111827';

      bubble.textContent = this.isShowingOriginal ? region.sourceText : region.translatedText;
      bubble.title = `Original: ${region.sourceText} (Confidence: ${Math.round(region.confidence * 100)}%)\nClick to toggle original/translated`;

      // Toggle translation on click
      let showingOriginal = false;
      bubble.addEventListener('click', (e) => {
        e.stopPropagation();
        showingOriginal = !showingOriginal;
        bubble.textContent = showingOriginal ? region.sourceText : region.translatedText;
        bubble.style.color = showingOriginal ? '#6b21a8' : '#111827';
      });

      overlay.appendChild(bubble);
    }

    parent.appendChild(overlay);
    this.activeOverlays.set(targetElement, overlay);

    return overlay;
  }

  public static removeOverlay(targetElement: HTMLElement): void {
    const existing = this.activeOverlays.get(targetElement);
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
    this.activeOverlays.delete(targetElement);
  }

  public static toggleGlobalOriginal(showOriginal: boolean): void {
    this.isShowingOriginal = showOriginal;
    for (const [_, overlay] of this.activeOverlays.entries()) {
      const bubbles = overlay.querySelectorAll<HTMLElement>('.mangaverse-speech-bubble-overlay');
      bubbles.forEach(b => {
        // Toggle text between dataset or title
      });
    }
  }

  public static clearAll(): void {
    for (const [_, overlay] of this.activeOverlays.entries()) {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    }
    this.activeOverlays.clear();
  }
}
