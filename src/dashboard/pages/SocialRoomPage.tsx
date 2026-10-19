import React, { useState, useEffect, useRef } from 'react';
import { roomManager } from '../../services/social/roomManager';
import { SpoilerGuard } from '../../services/social/spoilerGuard';
import { CoReadingRoom, RoomMessage, RoomParticipant } from '../../services/social/types';
import {
  Users,
  ShieldAlert,
  Send,
  Eye,
  EyeOff,
  Copy,
  Check,
  PlusCircle,
  LogIn,
  Sliders,
  Trash2,
  Sparkles,
  Smile,
  ShieldCheck,
  Flame,
} from 'lucide-react';

export const SocialRoomPage: React.FC = () => {
  const [room, setRoom] = useState<CoReadingRoom | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [inputChapter, setInputChapter] = useState<string>('');
  const [isExplicitSpoiler, setIsExplicitSpoiler] = useState<boolean>(false);
  const [userWatermark, setUserWatermark] = useState<number>(40);
  const [revealedMessageIds, setRevealedMessageIds] = useState<Set<string>>(new Set());
  const [joinCode, setJoinCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [newRoomSeriesTitle, setNewRoomSeriesTitle] = useState<string>('Chainsaw Man');
  const [newRoomChapter, setNewRoomChapter] = useState<number>(40);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If no room is active, initialize a default demo room
    if (!roomManager.getActiveRoom()) {
      initDefaultDemoRoom();
    } else {
      setRoom(roomManager.getActiveRoom());
    }

    const unsubMsg = roomManager.onMessage((msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    const unsubRoom = roomManager.onRoomUpdate((updated) => {
      setRoom({ ...updated });
    });

    return () => {
      unsubMsg();
      unsubRoom();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, revealedMessageIds]);

  const initDefaultDemoRoom = () => {
    const defaultRoom = roomManager.createRoom('series-csm', 'Chainsaw Man', 40);
    setRoom(defaultRoom);

    // Seed realistic conversation demonstrating spoiler watermarking
    const initialMessages: RoomMessage[] = [
      {
        id: 'msg-seed-1',
        roomId: defaultRoom.id,
        senderId: 'peer-ken',
        senderName: 'Ken (Bingeing)',
        content: 'Hey everyone! Finally catching up to chapter 35. That fight scene in the alley was masterclass art!',
        targetChapterNumber: 35,
        isExplicitSpoiler: false,
        timestamp: Date.now() - 3600000,
        reactions: [{ emoji: '🔥', count: 2, senderIds: ['peer-alice'] }],
      },
      {
        id: 'msg-seed-2',
        roomId: defaultRoom.id,
        senderId: 'peer-alice',
        senderName: 'Alice (Scanlator)',
        content: 'Wait until you get to Chapter 45! The devil contract twist completely flipped everything we thought we knew.',
        targetChapterNumber: 45, // Future chapter spoiler! (User watermark is 40)
        isExplicitSpoiler: false,
        timestamp: Date.now() - 1800000,
        reactions: [{ emoji: '😱', count: 1, senderIds: ['user-local-me'] }],
      },
      {
        id: 'msg-seed-3',
        roomId: defaultRoom.id,
        senderId: 'peer-alice',
        senderName: 'Alice (Scanlator)',
        content: 'Also, [spoiler]be prepared for what happens to the mentor character[/spoiler]. It was devastating.',
        isExplicitSpoiler: true,
        timestamp: Date.now() - 600000,
        reactions: [],
      },
    ];
    setMessages(initialMessages);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    try {
      const parsedCh = inputChapter ? parseFloat(inputChapter) : undefined;
      const newMsg = roomManager.sendMessage(inputText.trim(), parsedCh, isExplicitSpoiler);
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setInputChapter('');
      setIsExplicitSpoiler(false);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send message');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const handleCopyInvite = () => {
    if (!room) return;
    navigator.clipboard.writeText(`https://mangaverse.app/join/${room.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReveal = (msgId: string) => {
    setRevealedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleAddReaction = (msgId: string, emoji: string) => {
    const updated = roomManager.addReaction(msgId, emoji, messages);
    setMessages([...updated]);
  };

  const handleDeleteMessage = (msgId: string) => {
    const updated = roomManager.deleteMessage(msgId, messages);
    setMessages([...updated]);
  };

  const handleCreateNewRoom = () => {
    const newRoom = roomManager.createRoom(
      `series-${Date.now()}`,
      newRoomSeriesTitle || 'Custom Manga Session',
      newRoomChapter
    );
    setUserWatermark(newRoomChapter);
    setRoom(newRoom);
    setMessages([]);
    setRevealedMessageIds(new Set());
  };

  const handleJoinByCode = () => {
    if (!joinCode.trim()) return;
    const joined = roomManager.joinRoom(joinCode.trim(), userWatermark);
    setRoom(joined);
    setMessages([]);
    setRevealedMessageIds(new Set());
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-purple-400" /> Co-Reading Rooms & Spoiler Guard
          </h1>
          <p className="text-sm text-gray-400">
            Read and discuss chapters in real time. Future-chapter spoilers are automatically obscured based on your personal reading progress.
          </p>
        </div>

        {room && (
          <div className="flex items-center gap-3">
            <div className="bg-darkbg-800 border border-darkbg-700 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
              <span className="text-gray-400">Room Code:</span>
              <span className="font-mono font-bold text-purple-300">{room.id}</span>
            </div>
            <button
              onClick={handleCopyInvite}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-md shadow-purple-600/20"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Link Copied!' : 'Copy Invite'}
            </button>
          </div>
        )}
      </div>

      {/* Main Room Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Room Controls & Participants */}
        <div className="flex flex-col gap-5">
          {/* Your Watermark Control */}
          <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Your Reading Watermark
            </h3>
            <p className="text-[11px] text-gray-400 leading-snug">
              Messages mentioning chapters beyond this number will be automatically blurred.
            </p>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-gray-300">Chapter:</span>
              <input
                type="number"
                min={1}
                value={userWatermark}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setUserWatermark(val);
                  roomManager.updateReadingProgress(val);
                }}
                className="w-20 bg-darkbg-900 border border-darkbg-700 rounded-xl px-2.5 py-1.5 text-center text-xs font-bold text-white focus:outline-none focus:border-purple-500"
              />
              <span className="text-[11px] text-emerald-400 font-semibold">Active Guard</span>
            </div>

            <div className="pt-2 border-t border-darkbg-700/60 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Sync with Room</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={room?.syncProgressConsent ?? true}
                  onChange={(e) => roomManager.toggleProgressSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-darkbg-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Participants Card */}
          <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>Participants ({room?.participants.length || 0})</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>

            <div className="flex flex-col gap-2.5 mt-1">
              {room?.participants.map((p) => {
                const isMe = p.id === roomManager.getCurrentUserId();
                const isAhead = p.currentChapterNumber > userWatermark;

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 bg-darkbg-900 rounded-xl border border-darkbg-700/60"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                        {p.displayName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white flex items-center gap-1">
                          {p.displayName}
                          {isMe && <span className="text-[9px] text-purple-400">(You)</span>}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {p.isHost ? 'Host' : 'Reader'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isAhead
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        }`}
                      >
                        Ch. {p.currentChapterNumber}
                      </span>
                      {isAhead && (
                        <span className="text-[9px] text-amber-400/80 font-medium mt-0.5">Ahead</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room Switcher / Creator */}
          <div className="bg-darkbg-800 border border-darkbg-700 rounded-3xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Room Controls</h3>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Enter Room Code (e.g. 7492)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleJoinByCode}
                className="bg-darkbg-700 hover:bg-darkbg-600 text-purple-300 hover:text-white font-semibold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <LogIn className="w-3.5 h-3.5" /> Join Room
              </button>
            </div>

            <div className="pt-2 border-t border-darkbg-700/60 flex flex-col gap-2">
              <input
                type="text"
                placeholder="New Room Series Title..."
                value={newRoomSeriesTitle}
                onChange={(e) => setNewRoomSeriesTitle(e.target.value)}
                className="bg-darkbg-900 border border-darkbg-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleCreateNewRoom}
                className="bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white font-semibold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition border border-purple-500/30"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Create New Room
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Spoiler-Protected Chat Stream */}
        <div className="lg:col-span-3 bg-darkbg-800 border border-darkbg-700 rounded-3xl flex flex-col h-[650px] overflow-hidden shadow-xl">
          {/* Chat Stream Header */}
          <div className="px-6 py-4 bg-darkbg-850 border-b border-darkbg-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-white">{room?.name || 'Reading Room'}</h2>
                <span className="text-[11px] text-gray-400">
                  Target: {room?.seriesTitle} · Room Watermark Ch. {room?.currentChapterNumber}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Policy:</span>
              <select
                value={room?.spoilerPolicy || 'strict'}
                onChange={(e) => roomManager.setSpoilerPolicy(e.target.value as any)}
                className="bg-darkbg-900 border border-darkbg-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="strict">Strict (Auto-blur all ahead)</option>
                <option value="warn_only">Warning Badges Only</option>
                <option value="relaxed">Relaxed</option>
              </select>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {messages.map((msg) => {
              const isMe = msg.senderId === roomManager.getCurrentUserId();
              const evalResult = SpoilerGuard.evaluateMessage(
                msg,
                userWatermark,
                room?.spoilerPolicy || 'strict'
              );
              const isRevealed = revealedMessageIds.has(msg.id) || isMe;
              const shouldBlur = evalResult.isSpoilerForUser && !isRevealed;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-bold text-gray-300">{msg.senderName}</span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.targetChapterNumber && (
                      <span className="text-[10px] bg-darkbg-900 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-semibold">
                        Ch. {msg.targetChapterNumber}
                      </span>
                    )}
                  </div>

                  {/* Message Bubble Body */}
                  <div
                    className={`p-4 rounded-2xl relative transition-all ${
                      shouldBlur
                        ? 'bg-rose-950/40 border border-rose-500/30 text-rose-200'
                        : isMe
                        ? 'bg-purple-600 text-white rounded-br-xs'
                        : 'bg-darkbg-900 border border-darkbg-700/80 text-gray-200 rounded-bl-xs'
                    }`}
                  >
                    {shouldBlur ? (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                          <span>
                            {evalResult.reason === 'chapter_ahead'
                              ? `Spoiler Alert: Discusses Chapter ${evalResult.messageChapter} (You are on Ch. ${userWatermark})`
                              : 'Spoiler Alert: Tagged Content'}
                          </span>
                        </div>

                        {/* Obfuscated placeholder text */}
                        <div className="select-none filter blur-sm opacity-40 font-mono text-xs">
                          {msg.content}
                        </div>

                        <button
                          onClick={() => handleToggleReveal(msg.id)}
                          className="self-start mt-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Reveal Spoiler
                        </button>
                      </div>
                    ) : (
                      <div>
                        {evalResult.isSpoilerForUser && (
                          <div className="flex items-center justify-between gap-4 text-[10px] text-amber-300 mb-1.5 font-semibold pb-1.5 border-b border-white/10">
                            <span>⚠️ Spoiler unblurred for Chapter {evalResult.messageChapter}</span>
                            <button
                              onClick={() => handleToggleReveal(msg.id)}
                              className="text-gray-400 hover:text-white flex items-center gap-1 text-[9px]"
                            >
                              <EyeOff className="w-3 h-3" /> Re-hide
                            </button>
                          </div>
                        )}
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">
                          {SpoilerGuard.stripSpoilerTags(msg.content)}
                        </p>
                      </div>
                    )}

                    {/* Reactions Bar */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {msg.reactions.map((rx) => (
                        <button
                          key={rx.emoji}
                          onClick={() => handleAddReaction(msg.id, rx.emoji)}
                          className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 border transition ${
                            rx.senderIds.includes(roomManager.getCurrentUserId())
                              ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                              : 'bg-black/30 border-white/10 text-gray-300 hover:bg-black/50'
                          }`}
                        >
                          <span>{rx.emoji}</span>
                          <span className="font-bold text-[10px]">{rx.count}</span>
                        </button>
                      ))}

                      {/* Quick reaction trigger */}
                      <div className="flex items-center gap-1 ml-1 opacity-70 hover:opacity-100 transition">
                        {['🔥', '😱', '❤️', '👏'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(msg.id, emoji)}
                            className="text-xs hover:scale-125 transition px-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="ml-auto text-gray-400 hover:text-red-400 text-[10px] opacity-60 hover:opacity-100 transition"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="px-6 py-2 bg-red-950/80 border-t border-red-500/40 text-red-200 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-4 bg-darkbg-850 border-t border-darkbg-700/80 flex flex-col gap-2.5"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Share your thoughts on this chapter (auto spoiler-protected)..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-darkbg-900 border border-darkbg-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />

              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-md shadow-purple-600/20"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>

            {/* Input Attributes: Chapter Reference & Explicit Tag */}
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isExplicitSpoiler}
                    onChange={(e) => setIsExplicitSpoiler(e.target.checked)}
                    className="rounded border-darkbg-700 text-purple-600 focus:ring-0"
                  />
                  <span>Tag as Explicit Spoiler</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <span>Mentions Ch #:</span>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={inputChapter}
                    onChange={(e) => setInputChapter(e.target.value)}
                    className="w-16 bg-darkbg-900 border border-darkbg-700 rounded-lg px-2 py-0.5 text-center text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <span className="text-[10px] text-gray-500">
                Anti-spoiler watermark active · 100% Client-side Encrypted
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
