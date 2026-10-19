import { describe, it, expect } from 'vitest';
import { SpoilerGuard } from '../src/services/social/spoilerGuard';
import { RoomManager } from '../src/services/social/roomManager';
import { RoomMessage } from '../src/services/social/types';

describe('SpoilerGuard and Social Room Engine', () => {
  it('extracts chapter references accurately from dialogue strings', () => {
    expect(SpoilerGuard.extractReferencedChapter('Did you see ch 45 yet?')).toBe(45);
    expect(SpoilerGuard.extractReferencedChapter('Chapter 102.5 was an amazing bonus story')).toBe(102.5);
    expect(SpoilerGuard.extractReferencedChapter('Check out #19')).toBe(19);
    expect(SpoilerGuard.extractReferencedChapter('Just casual conversation with no numbers')).toBeUndefined();
  });

  it('detects explicit spoiler tags', () => {
    expect(SpoilerGuard.hasExplicitSpoilerTags('Hey [spoiler]Gojo gets sealed[/spoiler]')).toBe(true);
    expect(SpoilerGuard.hasExplicitSpoilerTags('Watch out ||Sukuna takes over||')).toBe(true);
    expect(SpoilerGuard.hasExplicitSpoilerTags('Totally safe message')).toBe(false);
  });

  it('enforces watermark spoiler policy: hides future chapters, permits current/past chapters', () => {
    const userWatermark = 40;

    const futureMessage: RoomMessage = {
      id: 'm1',
      roomId: 'r1',
      senderId: 'alice',
      senderName: 'Alice',
      content: 'Ch 45 had the craziest plot twist ever!',
      targetChapterNumber: 45,
      isExplicitSpoiler: false,
      timestamp: Date.now(),
      reactions: [],
    };

    const pastMessage: RoomMessage = {
      id: 'm2',
      roomId: 'r1',
      senderId: 'ken',
      senderName: 'Ken',
      content: 'Chapter 35 fight scene was drawn so well.',
      targetChapterNumber: 35,
      isExplicitSpoiler: false,
      timestamp: Date.now(),
      reactions: [],
    };

    // User is on ch 40 -> ch 45 is a spoiler!
    const resFuture = SpoilerGuard.evaluateMessage(futureMessage, userWatermark, 'strict');
    expect(resFuture.isSpoilerForUser).toBe(true);
    expect(resFuture.reason).toBe('chapter_ahead');

    // User is on ch 40 -> ch 35 is safe!
    const resPast = SpoilerGuard.evaluateMessage(pastMessage, userWatermark, 'strict');
    expect(resPast.isSpoilerForUser).toBe(false);
  });

  it('defaults to safe-by-default when plot twist keywords are detected in strict mode', () => {
    const ambiguousMsg: RoomMessage = {
      id: 'm3',
      roomId: 'r1',
      senderId: 'alice',
      senderName: 'Alice',
      content: 'Wait until you see the ending betrayal, it changed everything!',
      isExplicitSpoiler: false,
      timestamp: Date.now(),
      reactions: [],
    };

    const res = SpoilerGuard.evaluateMessage(ambiguousMsg, 10, 'strict');
    expect(res.isSpoilerForUser).toBe(true);
    expect(res.reason).toBe('uncertain_reference');
  });

  it('rate limits high frequency spam messages', () => {
    const now = Date.now();
    const timestamps = [now - 1000, now - 800, now - 600, now - 400, now - 200];
    expect(SpoilerGuard.isRateLimited(timestamps, 5, 5000)).toBe(true);

    const sparseTimestamps = [now - 10000, now - 8000];
    expect(SpoilerGuard.isRateLimited(sparseTimestamps, 5, 5000)).toBe(false);
  });

  it('RoomManager creates and initializes a co-reading room with companion peers', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('series-one-piece', 'One Piece', 1080);

    expect(room.id.startsWith('MV-ROOM-')).toBe(true);
    expect(room.seriesTitle).toBe('One Piece');
    expect(room.currentChapterNumber).toBe(1080);
    expect(room.participants.length).toBeGreaterThanOrEqual(3);

    // Update progress
    manager.updateReadingProgress(1081);
    const updated = manager.getActiveRoom();
    const me = updated?.participants.find(p => p.id === manager.getCurrentUserId());
    expect(me?.currentChapterNumber).toBe(1081);
  });
});
