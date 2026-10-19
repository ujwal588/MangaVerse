import { RoomMessage, SpoilerEvaluationResult } from './types';

export class SpoilerGuard {
  // Regex to detect chapter numbers inside casual text: "ch 45", "chapter 102.5", "ch. 12", "ep 8"
  private static CHAPTER_REGEX = /(?:ch(?:apter)?\.?\s*|ep(?:isode)?\.?\s*|#\s*)(\d+(?:\.\d+)?)/i;

  // Regex to detect explicit markdown or tag-based spoilers: [spoiler]...[/spoiler] or ||...||
  private static EXPLICIT_SPOILER_REGEX = /(?:\[spoiler\][\s\S]*?\[\/spoiler\])|(?:\|\|[\s\S]*?\|\|)/i;

  /**
   * Automatically extracts chapter references mentioned in text if not explicitly tagged.
   */
  public static extractReferencedChapter(text: string): number | undefined {
    const match = text.match(this.CHAPTER_REGEX);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  /**
   * Checks if message contains explicit spoiler markers.
   */
  public static hasExplicitSpoilerTags(text: string): boolean {
    return this.EXPLICIT_SPOILER_REGEX.test(text);
  }

  /**
   * Sanitizes markdown spoiler syntax for display.
   */
  public static stripSpoilerTags(text: string): string {
    return text
      .replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, '$1')
      .replace(/\|\|([\s\S]*?)\|\|/gi, '$1');
  }

  /**
   * Core evaluation algorithm:
   * A user must NEVER see a future-chapter spoiler merely because another participant has advanced further.
   */
  public static evaluateMessage(
    message: RoomMessage,
    userWatermarkChapter: number,
    policy: 'strict' | 'relaxed' | 'warn_only' = 'strict'
  ): SpoilerEvaluationResult {
    // 1. Explicit spoiler check
    if (message.isExplicitSpoiler || this.hasExplicitSpoilerTags(message.content)) {
      return {
        isSpoilerForUser: true,
        reason: 'explicit_tag',
        messageChapter: message.targetChapterNumber,
        userChapter: userWatermarkChapter,
      };
    }

    // 2. Target chapter check (from metadata or auto-extracted regex)
    const referencedChapter =
      message.targetChapterNumber !== undefined
        ? message.targetChapterNumber
        : this.extractReferencedChapter(message.content);

    if (referencedChapter !== undefined) {
      if (referencedChapter > userWatermarkChapter) {
        return {
          isSpoilerForUser: true,
          reason: 'chapter_ahead',
          messageChapter: referencedChapter,
          userChapter: userWatermarkChapter,
        };
      }
    } else if (policy === 'strict') {
      // Conservative fallback: When chapter matching is uncertain in strict mode,
      // check if message contains keywords like "dies", "ending", "betrayal", "plot twist"
      const sensitiveKeywords = ['ending', 'dies', 'betrayal', 'villain', 'plot twist', 'final form', 'kills'];
      const hasSensitiveKeyword = sensitiveKeywords.some(kw =>
        message.content.toLowerCase().includes(kw)
      );

      if (hasSensitiveKeyword) {
        return {
          isSpoilerForUser: true,
          reason: 'uncertain_reference',
          userChapter: userWatermarkChapter,
        };
      }
    }

    return {
      isSpoilerForUser: false,
      messageChapter: referencedChapter,
      userChapter: userWatermarkChapter,
    };
  }

  /**
   * Rate limiting helper: anti-spam protection (max N messages in sliding window)
   */
  public static isRateLimited(timestamps: number[], limit = 5, windowMs = 5000): boolean {
    const now = Date.now();
    const recent = timestamps.filter(t => now - t < windowMs);
    return recent.length >= limit;
  }
}
