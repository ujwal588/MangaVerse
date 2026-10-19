export interface ReaderHUDProps {
  seriesTitle: string;
  chapterLabel: string;
  initialPercent?: number;
  isInitiallyCompleted?: boolean;
  mtPort?: number;
  onReadingModeChange?: (mode: 'ltr' | 'rtl' | 'vertical') => void;
  onToggleCompleted?: (isCompleted: boolean) => void;
  onOpenTranslator?: () => void;
  onSaveOffline?: () => void;
  onOpenDashboard?: () => void;
}

export class ReaderHUD {
  private hostElement: HTMLElement;
  private shadowRoot: ShadowRoot;
  private isExpanded: boolean = false;
  private isCompleted: boolean = false;
  private progressPercent: number = 0;
  private currentMode: 'ltr' | 'rtl' | 'vertical' = 'vertical';
  private mtPort: number;
  private mtAvailable: boolean | null = null; // null = checking

  private seriesTitle: string;
  private chapterLabel: string;
  private onReadingModeChange?: (mode: 'ltr' | 'rtl' | 'vertical') => void;
  private onToggleCompleted?: (isCompleted: boolean) => void;
  private onOpenTranslator?: () => void;
  private onSaveOffline?: () => void;
  private onOpenDashboard?: () => void;

  constructor(props: ReaderHUDProps) {
    this.seriesTitle = props.seriesTitle;
    this.chapterLabel = props.chapterLabel;
    this.progressPercent = props.initialPercent ?? 0;
    this.isCompleted = props.isInitiallyCompleted ?? false;
    this.mtPort = props.mtPort ?? 7676;
    this.onReadingModeChange = props.onReadingModeChange;
    this.onToggleCompleted = props.onToggleCompleted;
    this.onOpenTranslator = props.onOpenTranslator;
    this.onSaveOffline = props.onSaveOffline;
    this.onOpenDashboard = props.onOpenDashboard;

    this.hostElement = document.createElement('div');
    this.hostElement.id = 'mangaverse-hud-host';
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    this.render();
    // Async server health check
    this.checkMtStatus();
  }

  private async checkMtStatus(): Promise<void> {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'MT_CHECK', port: this.mtPort });
      this.mtAvailable = resp?.available === true;
    } catch {
      this.mtAvailable = false;
    }
    this.updateMtStatusDot();
  }

  private updateMtStatusDot(): void {
    const dot = this.shadowRoot.querySelector<HTMLElement>('.mv-mt-dot');
    const label = this.shadowRoot.querySelector<HTMLElement>('.mv-mt-label');
    if (!dot || !label) return;

    if (this.mtAvailable === null) {
      dot.style.background = '#9ca3af';
      label.textContent = 'Checking MT...';
    } else if (this.mtAvailable) {
      dot.style.background = '#34d399';
      label.textContent = 'MT Ready';
    } else {
      dot.style.background = '#f87171';
      label.textContent = 'MT Offline';
    }
  }

  public mount(): void {
    if (!document.body.contains(this.hostElement)) {
      document.body.appendChild(this.hostElement);
    }
  }

  public unmount(): void {
    if (document.body.contains(this.hostElement)) {
      document.body.removeChild(this.hostElement);
    }
  }

  public updateProgress(percent: number, isCompleted: boolean): void {
    this.progressPercent = Math.round(percent * 100);
    this.isCompleted = isCompleted;

    const fillEl = this.shadowRoot.querySelector<HTMLElement>('.mangaverse-progress-fill');
    if (fillEl) {
      fillEl.style.width = `${this.progressPercent}%`;
    }

    const badgeEl = this.shadowRoot.querySelector<HTMLElement>('.mangaverse-pill-badge');
    if (badgeEl) {
      badgeEl.textContent = `${this.progressPercent}%`;
    }

    const completedEl = this.shadowRoot.querySelector<HTMLElement>('.mangaverse-completed-tag');
    if (completedEl) {
      completedEl.style.display = this.isCompleted ? 'inline-flex' : 'none';
    }
  }

  private render(): void {
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('src/content/hud/ReaderHUD.css');

    const container = document.createElement('div');
    container.className = 'mangaverse-hud-container';

    // Header Pill (always visible)
    const pill = document.createElement('div');
    pill.className = 'mangaverse-hud-pill';
    pill.innerHTML = `
      <div class="mangaverse-logo">M</div>
      <div class="mangaverse-pill-text" title="${this.seriesTitle} - ${this.chapterLabel}">
        ${this.seriesTitle}
      </div>
      <div class="mangaverse-pill-badge">${this.progressPercent}%</div>
      <div class="mangaverse-completed-tag" style="display: ${this.isCompleted ? 'inline-flex' : 'none'};">
        &#10003;
      </div>
    `;

    pill.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      expandedSection.style.display = this.isExpanded ? 'block' : 'none';
    });

    // Expanded details section
    const expandedSection = document.createElement('div');
    expandedSection.className = 'mangaverse-hud-expanded';
    expandedSection.style.display = this.isExpanded ? 'block' : 'none';

    expandedSection.innerHTML = `
      <div class="mangaverse-header-title">${this.seriesTitle}</div>
      <div class="mangaverse-header-chapter">${this.chapterLabel}</div>
      <div class="mangaverse-progress-bar-wrap">
        <div class="mangaverse-progress-fill" style="width: ${this.progressPercent}%"></div>
      </div>
      <div class="mangaverse-controls-row">
        <button class="mangaverse-btn" id="btn-toggle-read">
          ${this.isCompleted ? 'Mark Unread' : 'Mark as Read'}
        </button>
        <button class="mangaverse-btn" id="btn-reading-mode">
          ${this.currentMode.toUpperCase()}
        </button>
        <button class="mangaverse-btn mangaverse-btn-primary" id="btn-dashboard">
          Library
        </button>
      </div>
      <button class="mangaverse-btn mangaverse-offline-link" id="btn-save-offline" title="Save this chapter's page images for offline reading">
        Save Chapter Offline
      </button>
      <button class="mangaverse-btn mangaverse-translator-link" id="btn-open-translator" title="Open MangaTranslator to upload a page image manually">
        Open MangaTranslator
      </button>
      <div class="mangaverse-mt-status">
        <span class="mv-mt-dot"></span>
        <span class="mv-mt-label">Checking MT...</span>
        <button class="mangaverse-btn mangaverse-btn-sm" id="btn-mt-recheck">&#8635;</button>
      </div>
    `;

    // Hook events inside expanded section
    expandedSection.querySelector('#btn-toggle-read')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isCompleted = !this.isCompleted;
      this.onToggleCompleted?.(this.isCompleted);
      const btn = expandedSection.querySelector('#btn-toggle-read');
      if (btn) btn.textContent = this.isCompleted ? 'Mark Unread' : 'Mark as Read';
      const tag = this.shadowRoot.querySelector<HTMLElement>('.mangaverse-completed-tag');
      if (tag) tag.style.display = this.isCompleted ? 'inline-flex' : 'none';
    });

    expandedSection.querySelector('#btn-open-translator')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onOpenTranslator?.();
    });

    expandedSection.querySelector('#btn-save-offline')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSaveOffline?.();
    });

    expandedSection.querySelector('#btn-reading-mode')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const modes: Array<'vertical' | 'rtl' | 'ltr'> = ['vertical', 'rtl', 'ltr'];
      const nextIdx = (modes.indexOf(this.currentMode) + 1) % modes.length;
      this.currentMode = modes[nextIdx];
      const btn = expandedSection.querySelector('#btn-reading-mode');
      if (btn) btn.textContent = this.currentMode.toUpperCase();
      this.onReadingModeChange?.(this.currentMode);
    });

    expandedSection.querySelector('#btn-dashboard')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onOpenDashboard?.();
    });

    expandedSection.querySelector('#btn-mt-recheck')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.mtAvailable = null;
      this.updateMtStatusDot();
      this.checkMtStatus();
    });

    container.appendChild(pill);
    container.appendChild(expandedSection);

    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(styleLink);
    this.shadowRoot.appendChild(container);

    // Run the MT dot update after DOM is ready
    setTimeout(() => this.updateMtStatusDot(), 0);
  }
}
