// Device watch tracking helper for AI Sefarim
// Tracks the total number of videos/podcasts watched on this device

const WATCHED_MEDIA_IDS_KEY = 'ai_sefarim_watched_media_ids';
const WATCHED_COUNT_KEY = 'ai_sefarim_watched_count';

export interface DeviceWatchStats {
  totalWatchedCount: number;
  watchedIds: string[];
}

export interface MilestoneBadge {
  id: string;
  title: string;
  subtitle: string;
  hebrewTitle: string;
  requiredViews: number;
  icon: string;
  unlocked: boolean;
}

export interface GamificationStats {
  level: number;
  rankTitle: string;
  rankHebrew: string;
  rankIcon: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  minViews: number;
  nextThreshold: number | null;
  progressPercent: number;
  viewsNeededForNext: number;
  nextRankTitle: string | null;
  badges: MilestoneBadge[];
  unlockedBadgesCount: number;
  totalBadgesCount: number;
}

const MILESTONES: Omit<MilestoneBadge, 'unlocked'>[] = [
  {
    id: 'first_step',
    title: 'First Step',
    subtitle: 'Watched 1st video or podcast',
    hebrewTitle: 'צעד ראשון',
    requiredViews: 1,
    icon: '🌱'
  },
  {
    id: 'chazakah',
    title: 'Chazakah',
    subtitle: 'Watched 3 shiurim or episodes',
    hebrewTitle: 'חזקה בלימוד',
    requiredViews: 3,
    icon: '⚡'
  },
  {
    id: 'five_strong',
    title: 'Torah Devotee',
    subtitle: 'Completed 5 learning sessions',
    hebrewTitle: 'חמישה בלימוד',
    requiredViews: 5,
    icon: '🎯'
  },
  {
    id: 'minyan_ten',
    title: 'Minyan Milestone',
    subtitle: 'Completed 10 shiurim or podcasts',
    hebrewTitle: 'מנין שיעורים',
    requiredViews: 10,
    icon: '📜'
  },
  {
    id: 'chai_eighteen',
    title: 'Chai of Wisdom',
    subtitle: 'Completed 18 learning sessions',
    hebrewTitle: 'חי שיעורים',
    requiredViews: 18,
    icon: '✨'
  },
  {
    id: 'scholar_twentyfive',
    title: 'Torah Scholar',
    subtitle: 'Completed 25 shiurim or podcasts',
    hebrewTitle: 'עמל החכמה',
    requiredViews: 25,
    icon: '🏆'
  },
  {
    id: 'luminary_fifty',
    title: 'Torah Luminary',
    subtitle: '50+ learning sessions mastered',
    hebrewTitle: 'יובל שיעורים',
    requiredViews: 50,
    icon: '👑'
  }
];

export function getGamificationStats(totalCount: number): GamificationStats {
  const count = Math.max(0, totalCount);

  let level = 1;
  let rankTitle = 'Torah Explorer';
  let rankHebrew = 'תלמיד מתחיל';
  let rankIcon = '🌱';
  let colorClass = 'text-emerald-400';
  let borderClass = 'border-emerald-500/30';
  let bgClass = 'bg-emerald-500/10';
  let minViews = 0;
  let nextThreshold: number | null = 3;
  let nextRankTitle: string | null = 'Consistent Learner';

  if (count >= 50) {
    level = 6;
    rankTitle = 'Torah Luminary';
    rankHebrew = 'מרביץ תורה';
    rankIcon = '👑';
    colorClass = 'text-amber-300';
    borderClass = 'border-amber-500/40';
    bgClass = 'bg-amber-500/10';
    minViews = 50;
    nextThreshold = null;
    nextRankTitle = null;
  } else if (count >= 20) {
    level = 5;
    rankTitle = 'Avid Scholar';
    rankHebrew = 'עמל בתורה';
    rankIcon = '💎';
    colorClass = 'text-purple-400';
    borderClass = 'border-purple-500/30';
    bgClass = 'bg-purple-500/10';
    minViews = 20;
    nextThreshold = 50;
    nextRankTitle = 'Torah Luminary';
  } else if (count >= 10) {
    level = 4;
    rankTitle = 'Minyan Scholar';
    rankHebrew = 'תלמיד חכם בהתהוות';
    rankIcon = '🏆';
    colorClass = 'text-blue-400';
    borderClass = 'border-blue-500/30';
    bgClass = 'bg-blue-500/10';
    minViews = 10;
    nextThreshold = 20;
    nextRankTitle = 'Avid Scholar';
  } else if (count >= 6) {
    level = 3;
    rankTitle = 'Dedicated Student';
    rankHebrew = 'שוקד בתורה';
    rankIcon = '📚';
    colorClass = 'text-indigo-400';
    borderClass = 'border-indigo-500/30';
    bgClass = 'bg-indigo-500/10';
    minViews = 6;
    nextThreshold = 10;
    nextRankTitle = 'Minyan Scholar';
  } else if (count >= 3) {
    level = 2;
    rankTitle = 'Consistent Learner';
    rankHebrew = 'קובע עתים';
    rankIcon = '⚡';
    colorClass = 'text-emerald-400';
    borderClass = 'border-emerald-500/30';
    bgClass = 'bg-emerald-500/10';
    minViews = 3;
    nextThreshold = 6;
    nextRankTitle = 'Dedicated Student';
  }

  let progressPercent = 100;
  let viewsNeededForNext = 0;

  if (nextThreshold !== null) {
    const range = nextThreshold - minViews;
    const currentInRange = count - minViews;
    progressPercent = Math.min(100, Math.max(0, Math.round((currentInRange / range) * 100)));
    viewsNeededForNext = Math.max(0, nextThreshold - count);
  }

  const badges: MilestoneBadge[] = MILESTONES.map(m => ({
    ...m,
    unlocked: count >= m.requiredViews
  }));

  const unlockedBadgesCount = badges.filter(b => b.unlocked).length;

  return {
    level,
    rankTitle,
    rankHebrew,
    rankIcon,
    colorClass,
    borderClass,
    bgClass,
    minViews,
    nextThreshold,
    progressPercent,
    viewsNeededForNext,
    nextRankTitle,
    badges,
    unlockedBadgesCount,
    totalBadgesCount: badges.length
  };
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
