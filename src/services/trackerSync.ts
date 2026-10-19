export interface TrackerAccount {
  service: 'anilist' | 'myanimelist';
  username?: string;
  accessToken?: string;
  tokenExpiresAt?: number;
  isEnabled: boolean;
}

export interface SyncResult {
  service: string;
  success: boolean;
  syncedChapter: number;
  message?: string;
}

/**
 * Syncs chapter progress with AniList GraphQL API.
 */
export async function syncAniListProgress(
  mediaId: number,
  chapterNumber: number,
  accessToken: string
): Promise<SyncResult> {
  const query = `
    mutation ($mediaId: Int, $progress: Int) {
      SaveMediaListEntry (mediaId: $mediaId, progress: $progress) {
        id
        status
        progress
      }
    }
  `;

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          mediaId,
          progress: Math.floor(chapterNumber),
        },
      }),
    });

    if (response.ok) {
      return { service: 'AniList', success: true, syncedChapter: Math.floor(chapterNumber) };
    } else {
      const err = await response.text();
      return { service: 'AniList', success: false, syncedChapter: chapterNumber, message: err };
    }
  } catch (e) {
    return { service: 'AniList', success: false, syncedChapter: chapterNumber, message: String(e) };
  }
}

/**
 * Syncs chapter progress with MyAnimeList v2 REST API.
 */
export async function syncMyAnimeListProgress(
  mangaId: number,
  chapterNumber: number,
  accessToken: string
): Promise<SyncResult> {
  try {
    const response = await fetch(
      `https://api.myanimelist.net/v2/manga/${mangaId}/my_list_status`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          num_chapters_read: String(Math.floor(chapterNumber)),
        }),
      }
    );

    if (response.ok) {
      return { service: 'MyAnimeList', success: true, syncedChapter: Math.floor(chapterNumber) };
    } else {
      const err = await response.text();
      return { service: 'MyAnimeList', success: false, syncedChapter: chapterNumber, message: err };
    }
  } catch (e) {
    return { service: 'MyAnimeList', success: false, syncedChapter: chapterNumber, message: String(e) };
  }
}

/**
 * Mock simulator for local testing without requiring external credentials.
 */
export function simulateTrackerSync(
  service: 'anilist' | 'myanimelist',
  chapterNumber: number
): SyncResult {
  return {
    service: service === 'anilist' ? 'AniList (Simulated)' : 'MyAnimeList (Simulated)',
    success: true,
    syncedChapter: Math.floor(chapterNumber),
    message: `Synchronized chapter ${Math.floor(chapterNumber)} to ${service}`,
  };
}
