import { db } from '../services/db';
import { NotificationRecord } from '../types/library';

export async function showChapterNotification(
  seriesId: string,
  seriesTitle: string,
  chapterLabel: string,
  sourceUrl: string,
  type: 'chapter_update' | 'binge_threshold' | 'hiatus_return'
): Promise<void> {
  const notifId = crypto.randomUUID();
  let title = `MangaVerse: New Chapter`;
  let message = `${seriesTitle} - ${chapterLabel}`;

  if (type === 'binge_threshold') {
    title = `[MangaVerse] Ready to Binge!`;
    message = `${seriesTitle} reached your binge threshold (${chapterLabel})`;
  } else if (type === 'hiatus_return') {
    title = `[MangaVerse] Series Returned from Hiatus!`;
    message = `${seriesTitle} has released new chapters!`;
  }

  // Persist record to IndexedDB
  const record: NotificationRecord = {
    id: notifId,
    seriesId,
    seriesTitle,
    chapterLabel,
    message,
    sourceUrl,
    timestamp: Date.now(),
    isRead: false,
    type,
  };
  await db.notifications.add(record);

  // Trigger Chrome native desktop notification
  if (chrome.notifications) {
    chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 2,
    });
  }
}

// Handle notification click to open reading page directly
if (typeof chrome !== 'undefined' && chrome.notifications?.onClicked) {
  chrome.notifications.onClicked.addListener(async (notifId) => {
    const record = await db.notifications.get(notifId);
    if (record && record.sourceUrl) {
      chrome.tabs.create({ url: record.sourceUrl });
    }
  });
}
