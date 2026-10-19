export interface RoomParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  currentChapterNumber: number;
  readingStatus: 'reading' | 'idle' | 'caught_up';
  lastSeenAt: number;
  isBlocked?: boolean;
}

export interface RoomReaction {
  emoji: string;
  count: number;
  senderIds: string[];
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  targetChapterNumber?: number; // Chapter this message discusses
  isExplicitSpoiler: boolean;
  timestamp: number;
  reactions: RoomReaction[];
  deleted?: boolean;
}

export interface CoReadingRoom {
  id: string; // e.g. "MV-ROOM-7492"
  name: string;
  seriesId: string;
  seriesTitle: string;
  currentChapterNumber: number;
  hostId: string;
  passcode?: string;
  createdAt: number;
  participants: RoomParticipant[];
  spoilerPolicy: 'strict' | 'relaxed' | 'warn_only';
  syncProgressConsent: boolean;
}

export interface SpoilerEvaluationResult {
  isSpoilerForUser: boolean;
  reason?: 'chapter_ahead' | 'explicit_tag' | 'uncertain_reference';
  messageChapter?: number;
  userChapter: number;
}
