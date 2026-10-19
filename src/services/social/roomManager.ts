import { CoReadingRoom, RoomParticipant, RoomMessage } from './types';
import { SpoilerGuard } from './spoilerGuard';

export class RoomManager {
  private activeRoom: CoReadingRoom | null = null;
  private currentUserId: string = 'user-local-me';
  private currentUserName: string = 'You (Reader)';
  private broadcastChannel: BroadcastChannel | null = null;
  private messageListeners: ((msg: RoomMessage) => void)[] = [];
  private roomUpdateListeners: ((room: CoReadingRoom) => void)[] = [];
  private sentTimestamps: number[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('mangaverse_social_room');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastEvent(event.data);
        };
      } catch (e) {
        console.warn('[MangaVerse] BroadcastChannel unavailable:', e);
      }
    }
  }

  public createRoom(seriesId: string, seriesTitle: string, currentChapter = 1): CoReadingRoom {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const roomId = `MV-ROOM-${randomCode}`;

    const hostParticipant: RoomParticipant = {
      id: this.currentUserId,
      displayName: this.currentUserName,
      isHost: true,
      currentChapterNumber: currentChapter,
      readingStatus: 'reading',
      lastSeenAt: Date.now(),
    };

    // Realistic companion peers for delightful out-of-the-box co-reading experience
    const mockCompanion1: RoomParticipant = {
      id: 'peer-alice',
      displayName: 'Alice (Scanlator)',
      isHost: false,
      currentChapterNumber: currentChapter + 3, // Further ahead! Will trigger spoiler protection
      readingStatus: 'reading',
      lastSeenAt: Date.now() - 30000,
    };

    const mockCompanion2: RoomParticipant = {
      id: 'peer-ken',
      displayName: 'Ken (Bingeing)',
      isHost: false,
      currentChapterNumber: Math.max(1, currentChapter - 2), // Behind user
      readingStatus: 'reading',
      lastSeenAt: Date.now() - 120000,
    };

    const room: CoReadingRoom = {
      id: roomId,
      name: `${seriesTitle} Co-Reading Group`,
      seriesId,
      seriesTitle,
      currentChapterNumber: currentChapter,
      hostId: this.currentUserId,
      createdAt: Date.now(),
      participants: [hostParticipant, mockCompanion1, mockCompanion2],
      spoilerPolicy: 'strict',
      syncProgressConsent: true,
    };

    this.activeRoom = room;
    this.broadcastEvent({ type: 'ROOM_UPDATED', room });
    this.notifyRoomUpdated();

    return room;
  }

  public joinRoom(roomCode: string, userChapter = 1): CoReadingRoom {
    // Normalizes room code format
    const formattedCode = roomCode.toUpperCase().startsWith('MV-ROOM-')
      ? roomCode.toUpperCase()
      : `MV-ROOM-${roomCode.trim()}`;

    // If already in a room with this ID, return it
    if (this.activeRoom && this.activeRoom.id === formattedCode) {
      return this.activeRoom;
    }

    // Default room scaffold for joining
    const room: CoReadingRoom = {
      id: formattedCode,
      name: `Joined Reading Group (${formattedCode})`,
      seriesId: 'series-shared',
      seriesTitle: 'Shared Manga Session',
      currentChapterNumber: userChapter,
      hostId: 'peer-alice',
      createdAt: Date.now() - 600000,
      participants: [
        {
          id: this.currentUserId,
          displayName: this.currentUserName,
          isHost: false,
          currentChapterNumber: userChapter,
          readingStatus: 'reading',
          lastSeenAt: Date.now(),
        },
        {
          id: 'peer-alice',
          displayName: 'Alice (Host)',
          isHost: true,
          currentChapterNumber: userChapter + 4,
          readingStatus: 'reading',
          lastSeenAt: Date.now(),
        },
      ],
      spoilerPolicy: 'strict',
      syncProgressConsent: true,
    };

    this.activeRoom = room;
    this.broadcastEvent({ type: 'ROOM_UPDATED', room });
    this.notifyRoomUpdated();
    return room;
  }

  public sendMessage(content: string, targetChapter?: number, isExplicitSpoiler = false): RoomMessage {
    if (!this.activeRoom) {
      throw new Error('Cannot send message: no active room.');
    }

    // Anti-spam check
    if (SpoilerGuard.isRateLimited(this.sentTimestamps)) {
      throw new Error('Rate limit reached: Please slow down before sending more messages.');
    }
    this.sentTimestamps.push(Date.now());

    const message: RoomMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId: this.activeRoom.id,
      senderId: this.currentUserId,
      senderName: this.currentUserName,
      content,
      targetChapterNumber: targetChapter,
      isExplicitSpoiler,
      timestamp: Date.now(),
      reactions: [],
    };

    this.broadcastEvent({ type: 'NEW_MESSAGE', message });
    this.notifyMessageReceived(message);

    return message;
  }

  public updateReadingProgress(chapterNumber: number): void {
    if (!this.activeRoom) return;

    this.activeRoom.participants = this.activeRoom.participants.map((p) => {
      if (p.id === this.currentUserId) {
        return {
          ...p,
          currentChapterNumber: chapterNumber,
          lastSeenAt: Date.now(),
        };
      }
      return p;
    });

    this.broadcastEvent({ type: 'ROOM_UPDATED', room: this.activeRoom });
    this.notifyRoomUpdated();
  }

  public toggleProgressSync(enabled: boolean): void {
    if (!this.activeRoom) return;
    this.activeRoom.syncProgressConsent = enabled;
    this.notifyRoomUpdated();
  }

  public setSpoilerPolicy(policy: 'strict' | 'relaxed' | 'warn_only'): void {
    if (!this.activeRoom) return;
    this.activeRoom.spoilerPolicy = policy;
    this.broadcastEvent({ type: 'ROOM_UPDATED', room: this.activeRoom });
    this.notifyRoomUpdated();
  }

  public addReaction(messageId: string, emoji: string, messages: RoomMessage[]): RoomMessage[] {
    return messages.map((m) => {
      if (m.id === messageId) {
        const existingRx = m.reactions.find((r) => r.emoji === emoji);
        if (existingRx) {
          if (!existingRx.senderIds.includes(this.currentUserId)) {
            existingRx.count += 1;
            existingRx.senderIds.push(this.currentUserId);
          }
        } else {
          m.reactions.push({ emoji, count: 1, senderIds: [this.currentUserId] });
        }
      }
      return m;
    });
  }

  public deleteMessage(messageId: string, messages: RoomMessage[]): RoomMessage[] {
    return messages.map((m) => {
      if (m.id === messageId) {
        return { ...m, deleted: true, content: 'This message was removed by moderator.' };
      }
      return m;
    });
  }

  public getActiveRoom(): CoReadingRoom | null {
    return this.activeRoom;
  }

  public getCurrentUserId(): string {
    return this.currentUserId;
  }

  public onMessage(cb: (msg: RoomMessage) => void): () => void {
    this.messageListeners.push(cb);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== cb);
    };
  }

  public onRoomUpdate(cb: (room: CoReadingRoom) => void): () => void {
    this.roomUpdateListeners.push(cb);
    return () => {
      this.roomUpdateListeners = this.roomUpdateListeners.filter((l) => l !== cb);
    };
  }

  private notifyMessageReceived(msg: RoomMessage) {
    for (const listener of this.messageListeners) {
      listener(msg);
    }
  }

  private notifyRoomUpdated() {
    if (this.activeRoom) {
      for (const listener of this.roomUpdateListeners) {
        listener(this.activeRoom);
      }
    }
  }

  private broadcastEvent(event: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event);
      } catch (e) {
        // BroadcastChannel send failed
      }
    }
  }

  private handleBroadcastEvent(event: any) {
    if (!event) return;
    if (event.type === 'NEW_MESSAGE' && event.message) {
      this.notifyMessageReceived(event.message);
    } else if (event.type === 'ROOM_UPDATED' && event.room) {
      this.activeRoom = event.room;
      this.notifyRoomUpdated();
    }
  }
}

export const roomManager = new RoomManager();
