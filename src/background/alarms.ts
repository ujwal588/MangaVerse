import { performUpdateCheck } from './updateChecker';

export const UPDATE_ALARM_NAME = 'MANGA_UPDATE_CHECK';

export function setupAlarms(): void {
  chrome.alarms.get(UPDATE_ALARM_NAME, (alarm) => {
    if (!alarm) {
      // Create alarm to run every 60 minutes
      chrome.alarms.create(UPDATE_ALARM_NAME, {
        delayInMinutes: 1, // First run 1 minute after extension loads
        periodInMinutes: 60,
      });
      console.log('[MangaVerse] Registered periodic update alarm (60 min)');
    }
  });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === UPDATE_ALARM_NAME) {
      console.log('[MangaVerse] Alarm triggered:', alarm.name);
      await performUpdateCheck();
    }
  });
}
