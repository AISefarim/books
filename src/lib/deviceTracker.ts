// Device watch tracking helper for AI Sefarim
// Tracks the total number of videos/podcasts watched on this device

const WATCHED_MEDIA_IDS_KEY = 'ai_sefarim_watched_media_ids';
const WATCHED_COUNT_KEY = 'ai_sefarim_watched_count';

export interface DeviceWatchStats {
  totalWatchedCount: number;
  watchedIds: string[];
}

/**
 * Retrieves the device's watch stats.
 */
export function getDeviceWatchStats(): DeviceWatchStats {
  try {
    const rawIds = localStorage.getItem(WATCHED_MEDIA_IDS_KEY);
    const watchedIds: string[] = rawIds ? JSON.parse(rawIds) : [];
    
    // Also check numeric fallback or initial migration
    const count = watchedIds.length;
    return {
      totalWatchedCount: count,
      watchedIds
    };
  } catch (e) {
    console.error('Error reading device watch stats', e);
    return {
      totalWatchedCount: 0,
      watchedIds: []
    };
  }
}

/**
 * Records a watch event on this device.
 * A video/podcast counts towards this device's watched total.
 * Returns the updated device watch stats.
 */
export function recordDeviceWatch(mediaId: string): DeviceWatchStats {
  try {
    const current = getDeviceWatchStats();
    let updatedIds = current.watchedIds;

    if (!updatedIds.includes(mediaId)) {
      updatedIds = [...updatedIds, mediaId];
      localStorage.setItem(WATCHED_MEDIA_IDS_KEY, JSON.stringify(updatedIds));
      localStorage.setItem(WATCHED_COUNT_KEY, String(updatedIds.length));
      
      // Dispatch a custom event so any open or listening components update immediately
      window.dispatchEvent(new CustomEvent('device-watch-updated', { 
        detail: { totalWatchedCount: updatedIds.length, watchedIds: updatedIds, addedId: mediaId } 
      }));
    }

    return {
      totalWatchedCount: updatedIds.length,
      watchedIds: updatedIds
    };
  } catch (e) {
    console.error('Error recording device watch', e);
    return getDeviceWatchStats();
  }
}

/**
 * Checks if the current media has been watched on this device.
 */
export function hasDeviceWatched(mediaId: string): boolean {
  try {
    const rawIds = localStorage.getItem(WATCHED_MEDIA_IDS_KEY);
    const watchedIds: string[] = rawIds ? JSON.parse(rawIds) : [];
    return watchedIds.includes(mediaId);
  } catch {
    return false;
  }
}
