export interface ScrollTrackerOptions {
  onProgress: (scrollPercent: number, scrollPixel: number, isCompleted: boolean) => void;
  completionThreshold?: number; // default 0.85 (85%)
}

export class ScrollTracker {
  private options: ScrollTrackerOptions;
  private completionThreshold: number;
  private isCompleted: boolean = false;
  private throttleTimeout: number | null = null;
  private boundScrollListener: () => void;

  constructor(options: ScrollTrackerOptions) {
    this.options = options;
    this.completionThreshold = options.completionThreshold ?? 0.85;
    this.boundScrollListener = this.handleScroll.bind(this);
  }

  public start(): void {
    window.addEventListener('scroll', this.boundScrollListener, { passive: true });
    // Run an initial check in case page opened already near bottom
    setTimeout(() => this.handleScroll(), 500);
  }

  public stop(): void {
    window.removeEventListener('scroll', this.boundScrollListener);
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
  }

  public restoreScroll(pixelOffset: number, percent: number): void {
    if (pixelOffset > 100) {
      window.scrollTo({
        top: pixelOffset,
        behavior: 'smooth'
      });
    } else if (percent > 0.05) {
      const targetY = (document.documentElement.scrollHeight - window.innerHeight) * percent;
      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      });
    }
  }

  private handleScroll(): void {
    if (this.throttleTimeout) return;

    this.throttleTimeout = window.setTimeout(() => {
      this.throttleTimeout = null;

      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const totalHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        1
      );
      const scrollHeight = totalHeight - window.innerHeight;
      
      const percent = scrollHeight > 0 ? Math.min(1.0, Math.max(0.0, scrollTop / scrollHeight)) : 1.0;

      if (!this.isCompleted && percent >= this.completionThreshold) {
        this.isCompleted = true;
      }

      this.options.onProgress(percent, scrollTop, this.isCompleted);
    }, 300); // 300ms responsive throttle
  }
}

