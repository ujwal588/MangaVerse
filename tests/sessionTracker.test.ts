import { describe, it, expect, beforeEach } from 'vitest';
import { SessionTracker } from '../src/services/sessionTracker';

describe('SessionTracker Unit Tests', () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    tracker = new SessionTracker();
  });

  it('starts a new session with valid parameters and generated session ID', () => {
    const sessionId = tracker.startSession('series-123', 'ch-456');
    expect(sessionId).toBeDefined();
    expect(sessionId.startsWith('session-')).toBe(true);
  });

  it('accumulates active duration and closes session with minimum duration safeguard', async () => {
    tracker.startSession('series-abc', 'ch-xyz');
    const closedSession = await tracker.endSession();

    expect(closedSession).not.toBeNull();
    expect(closedSession?.seriesId).toBe('series-abc');
    expect(closedSession?.chapterId).toBe('ch-xyz');
    expect(closedSession?.durationSeconds).toBeGreaterThanOrEqual(5); // Minimum duration safeguard
  });

  it('returns null when ending session without an active session', async () => {
    const closed = await tracker.endSession();
    expect(closed).toBeNull();
  });
});
