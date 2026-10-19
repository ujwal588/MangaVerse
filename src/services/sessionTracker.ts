import { db } from './db';
import { ReadingSession } from '../types/library';

export class SessionTracker {
  private activeSessionId: string | null = null;
  private currentSeriesId: string | null = null;
  private currentChapterId: string | null = null;
  private sessionStartTime: number = 0;
  private lastActivityTime: number = 0;
  private accumulatedActiveSeconds: number = 0;
  private idleThresholdMs: number = 60000; // 60s idle threshold
  private checkInterval: any = null;

  constructor() {
    this.handleUserActivity = this.handleUserActivity.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  public startSession(seriesId: string, chapterId: string): string {
    // If previous session is running, close it first
    if (this.activeSessionId) {
      this.endSession();
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.activeSessionId = sessionId;
    this.currentSeriesId = seriesId;
    this.currentChapterId = chapterId;
    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.accumulatedActiveSeconds = 0;

    this.attachListeners();
    return sessionId;
  }

  private handleUserActivity(): void {
    const now = Date.now();
    const elapsedSinceLast = now - this.lastActivityTime;

    // Only count active reading if within idle threshold
    if (elapsedSinceLast < this.idleThresholdMs) {
      this.accumulatedActiveSeconds += Math.floor(elapsedSinceLast / 1000);
    }
    this.lastActivityTime = now;
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      // User switched tabs or minimized browser — record time up to now
      this.handleUserActivity();
    } else {
      // User returned
      this.lastActivityTime = Date.now();
    }
  }

  private attachListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('scroll', this.handleUserActivity, { passive: true });
    window.addEventListener('keydown', this.handleUserActivity, { passive: true });
    window.addEventListener('click', this.handleUserActivity, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private detachListeners(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('scroll', this.handleUserActivity);
    window.removeEventListener('keydown', this.handleUserActivity);
    window.removeEventListener('click', this.handleUserActivity);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public async endSession(): Promise<ReadingSession | null> {
    if (!this.activeSessionId || !this.currentSeriesId || !this.currentChapterId) {
      return null;
    }

    // Capture any trailing activity
    this.handleUserActivity();

    // Enforce reasonable boundaries: minimum 5s to count as session, max 4 hours safeguard
    const finalDuration = Math.min(Math.max(this.accumulatedActiveSeconds, 5), 14400);

    const session: ReadingSession = {
      id: this.activeSessionId,
      seriesId: this.currentSeriesId,
      chapterId: this.currentChapterId,
      startedAt: this.sessionStartTime,
      endedAt: Date.now(),
      durationSeconds: finalDuration,
    };

    try {
      await db.sessions.put(session);
    } catch (err) {
      console.warn('[MangaVerse] Could not persist session to IndexedDB:', err);
    }

    this.detachListeners();
    this.activeSessionId = null;
    this.currentSeriesId = null;
    this.currentChapterId = null;

    return session;
  }

  public getActiveDurationSeconds(): number {
    return this.accumulatedActiveSeconds;
  }
}

export const sessionTracker = new SessionTracker();
