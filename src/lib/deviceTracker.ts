// Device watch and learning tracking helper for AI Sefarim
// Tracks the total number of videos/podcasts, book reads, and downloads on this device

const WATCHED_MEDIA_IDS_KEY = 'ai_sefarim_watched_media_ids';
const WATCHED_COUNT_KEY = 'ai_sefarim_watched_count';
const READ_BOOK_IDS_KEY = 'ai_sefarim_read_book_ids';
const READ_BOOK_COUNT_KEY = 'ai_sefarim_read_book_count';
const DOWNLOADED_BOOK_IDS_KEY = 'ai_sefarim_downloaded_book_ids';
const DOWNLOADED_BOOK_COUNT_KEY = 'ai_sefarim_downloaded_book_count';

// XP and Session multipliers:
// - Video / podcast: +1 session, +10 XP
// - EPUB reading: +3 sessions, +30 XP (substantially more than video/podcast)
// - Book download: +8 sessions, +80 XP (especially high XP rewards)
export const SESSIONS_PER_MEDIA = 1;
export const XP_PER_MEDIA = 10;

export const SESSIONS_PER_EPUB = 3;
export const XP_PER_EPUB = 30;

export const SESSIONS_PER_DOWNLOAD = 8;
export const XP_PER_DOWNLOAD = 80;

export interface DeviceWatchStats {
  totalWatchedCount: number; // Combined total sessions
  totalSessions: number;
  totalXp: number;
  totalScore: number;
  watchedIds: string[];
  readBookIds: string[];
  downloadedBookIds: string[];
  watchedMediaCount: number;
  readBooksCount: number;
  downloadedBooksCount: number;
  totalBooksRead: number;
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

export interface LevelDefinition {
  level: number;
  minViews: number;
  nextThreshold: number | null;
  rankTitle: string;
  rankHebrew: string;
  rankIcon: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
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
  nextRankHebrew: string | null;
  totalXp: number;
  totalScore: number;
  badges: MilestoneBadge[];
  unlockedBadgesCount: number;
  totalBadgesCount: number;
}

// 22 Distinct Levels capping out at 250 sessions
export const LEVELS_22: LevelDefinition[] = [
  {
    level: 1,
    minViews: 0,
    nextThreshold: 3,
    rankTitle: 'Torah Explorer',
    rankHebrew: 'צעד ראשון',
    rankIcon: '🌱',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    bgClass: 'bg-emerald-500/10'
  },
  {
    level: 2,
    minViews: 3,
    nextThreshold: 6,
    rankTitle: 'Consistent Seeker',
    rankHebrew: 'קובע עתים',
    rankIcon: '⚡',
    colorClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/30',
    bgClass: 'bg-emerald-500/10'
  },
  {
    level: 3,
    minViews: 6,
    nextThreshold: 10,
    rankTitle: 'Diligent Student',
    rankHebrew: 'שוקד בלימוד',
    rankIcon: '📚',
    colorClass: 'text-teal-400',
    borderClass: 'border-teal-500/30',
    bgClass: 'bg-teal-500/10'
  },
  {
    level: 4,
    minViews: 10,
    nextThreshold: 15,
    rankTitle: 'Minyan Scholar',
    rankHebrew: 'מנין שיעורים',
    rankIcon: '📜',
    colorClass: 'text-teal-300',
    borderClass: 'border-teal-500/30',
    bgClass: 'bg-teal-500/10'
  },
  {
    level: 5,
    minViews: 15,
    nextThreshold: 22,
    rankTitle: 'Book Devotee',
    rankHebrew: 'אוהב ספר',
    rankIcon: '📖',
    colorClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    bgClass: 'bg-cyan-500/10'
  },
  {
    level: 6,
    minViews: 22,
    nextThreshold: 30,
    rankTitle: 'Living Wisdom',
    rankHebrew: 'חי בתורה',
    rankIcon: '✨',
    colorClass: 'text-sky-400',
    borderClass: 'border-sky-500/30',
    bgClass: 'bg-sky-500/10'
  },
  {
    level: 7,
    minViews: 30,
    nextThreshold: 40,
    rankTitle: 'Toiler in Torah',
    rankHebrew: 'עמל בתורה',
    rankIcon: '🎯',
    colorClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
    bgClass: 'bg-blue-500/10'
  },
  {
    level: 8,
    minViews: 40,
    nextThreshold: 50,
    rankTitle: 'Deep Thinker',
    rankHebrew: 'מעמיק בחכמה',
    rankIcon: '💡',
    colorClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30',
    bgClass: 'bg-indigo-500/10'
  },
  {
    level: 9,
    minViews: 50,
    nextThreshold: 65,
    rankTitle: 'Jubilee Scholar',
    rankHebrew: 'שער היובל',
    rankIcon: '🏆',
    colorClass: 'text-indigo-300',
    borderClass: 'border-indigo-500/40',
    bgClass: 'bg-indigo-500/15'
  },
  {
    level: 10,
    minViews: 65,
    nextThreshold: 80,
    rankTitle: 'Pillar of Study',
    rankHebrew: 'עמוד הלימוד',
    rankIcon: '🏛️',
    colorClass: 'text-violet-400',
    borderClass: 'border-violet-500/30',
    bgClass: 'bg-violet-500/10'
  },
  {
    level: 11,
    minViews: 80,
    nextThreshold: 100,
    rankTitle: 'Master of Texts',
    rankHebrew: 'בקי בספרים',
    rankIcon: '💎',
    colorClass: 'text-violet-300',
    borderClass: 'border-violet-500/30',
    bgClass: 'bg-violet-500/10'
  },
  {
    level: 12,
    minViews: 100,
    nextThreshold: 120,
    rankTitle: 'Century Scholar',
    rankHebrew: 'מאה שערים',
    rankIcon: '🌟',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-500/40',
    bgClass: 'bg-purple-500/15'
  },
  {
    level: 13,
    minViews: 120,
    nextThreshold: 140,
    rankTitle: 'Ever-Flowing Spring',
    rankHebrew: 'מעיין המתגבר',
    rankIcon: '🌊',
    colorClass: 'text-purple-300',
    borderClass: 'border-purple-500/30',
    bgClass: 'bg-purple-500/10'
  },
  {
    level: 14,
    minViews: 140,
    nextThreshold: 160,
    rankTitle: 'Mountain of Torah',
    rankHebrew: 'הררי תורה',
    rankIcon: '⛰️',
    colorClass: 'text-fuchsia-400',
    borderClass: 'border-fuchsia-500/30',
    bgClass: 'bg-fuchsia-500/10'
  },
  {
    level: 15,
    minViews: 160,
    nextThreshold: 180,
    rankTitle: 'Light of Wisdom',
    rankHebrew: 'אור החכמה',
    rankIcon: '🕯️',
    colorClass: 'text-pink-400',
    borderClass: 'border-pink-500/30',
    bgClass: 'bg-pink-500/10'
  },
  {
    level: 16,
    minViews: 180,
    nextThreshold: 200,
    rankTitle: 'Crown of Study',
    rankHebrew: 'כתר תורה',
    rankIcon: '👑',
    colorClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    bgClass: 'bg-rose-500/10'
  },
  {
    level: 17,
    minViews: 200,
    nextThreshold: 215,
    rankTitle: 'Eminent Scholar',
    rankHebrew: 'תלמיד חכם מופלג',
    rankIcon: '🔮',
    colorClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    bgClass: 'bg-amber-500/10'
  },
  {
    level: 18,
    minViews: 215,
    nextThreshold: 230,
    rankTitle: 'Sage of the Book',
    rankHebrew: 'חכם הספר',
    rankIcon: '🔥',
    colorClass: 'text-amber-300',
    borderClass: 'border-amber-500/30',
    bgClass: 'bg-amber-500/10'
  },
  {
    level: 19,
    minViews: 230,
    nextThreshold: 240,
    rankTitle: 'Guardian of Heritage',
    rankHebrew: 'נוצר מורשת',
    rankIcon: '🛡️',
    colorClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/40',
    bgClass: 'bg-yellow-500/10'
  },
  {
    level: 20,
    minViews: 240,
    nextThreshold: 245,
    rankTitle: 'Luminary of Sefarim',
    rankHebrew: 'מאור הספרים',
    rankIcon: '☀️',
    colorClass: 'text-yellow-300',
    borderClass: 'border-yellow-500/40',
    bgClass: 'bg-yellow-500/15'
  },
  {
    level: 21,
    minViews: 245,
    nextThreshold: 250,
    rankTitle: 'Master of Masters',
    rankHebrew: 'גאון בלימוד',
    rankIcon: '⚡',
    colorClass: 'text-amber-200',
    borderClass: 'border-amber-400/50',
    bgClass: 'bg-amber-500/20'
  },
  {
    level: 22,
    minViews: 250,
    nextThreshold: null, // Capped at 250 sessions!
    rankTitle: 'Prince of Torah',
    rankHebrew: 'שר התורה',
    rankIcon: '👑',
    colorClass: 'text-amber-300 font-black',
    borderClass: 'border-amber-400/60 shadow-lg shadow-amber-500/20',
    bgClass: 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20'
  }
];

export const MILESTONES: Omit<MilestoneBadge, 'unlocked'>[] = [
  {
    id: 'first_step',
    title: 'First Step',
    subtitle: 'Completed 1st learning session',
    hebrewTitle: 'צעד ראשון',
    requiredViews: 1,
    icon: '🌱'
  },
  {
    id: 'chazakah',
    title: 'Chazakah',
    subtitle: 'Completed 3 learning sessions',
    hebrewTitle: 'חזקה בלימוד',
    requiredViews: 3,
    icon: '⚡'
  },
  {
    id: 'minyan_ten',
    title: 'Minyan Milestone',
    subtitle: 'Completed 10 learning sessions',
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
    id: 'sefer_devotee',
    title: 'Sefer Devotee',
    subtitle: 'Completed 30 learning sessions',
    hebrewTitle: 'אוהב ספרים',
    requiredViews: 30,
    icon: '📖'
  },
  {
    id: 'jubilee_fifty',
    title: 'Jubilee Scholar',
    subtitle: 'Completed 50 sessions',
    hebrewTitle: 'שער היובל',
    requiredViews: 50,
    icon: '🏆'
  },
  {
    id: 'pillar_seventyfive',
    title: 'Pillar of Study',
    subtitle: 'Completed 75 sessions',
    hebrewTitle: 'עמוד הלימוד',
    requiredViews: 75,
    icon: '🏛️'
  },
  {
    id: 'century_hundred',
    title: 'Century of Torah',
    subtitle: '100 sessions mastered',
    hebrewTitle: 'מאה שערים',
    requiredViews: 100,
    icon: '🌟'
  },
  {
    id: 'eminent_sage',
    title: 'Eminent Sage',
    subtitle: '180 sessions mastered',
    hebrewTitle: 'עטרת חכמים',
    requiredViews: 180,
    icon: '👑'
  },
  {
    id: 'sar_hatorah',
    title: 'Prince of Torah',
    subtitle: '250 sessions pinnacle achieved',
    hebrewTitle: 'שר התורה',
    requiredViews: 250,
    icon: '☀️'
  }
];

function notifyStatsUpdated() {
  if (typeof window !== 'undefined') {
    const stats = getDeviceWatchStats();
    window.dispatchEvent(new CustomEvent('device-watch-updated', { detail: stats }));
    window.dispatchEvent(new CustomEvent('ai-sefarim-stats-updated', { detail: stats }));
  }
}

/**
 * Retrieves the device's comprehensive watch and reading stats.
 */
export function getDeviceWatchStats(): DeviceWatchStats {
  try {
    const rawIds = localStorage.getItem(WATCHED_MEDIA_IDS_KEY);
    const watchedIds: string[] = rawIds ? JSON.parse(rawIds) : [];
    const watchedMediaCount = Number(localStorage.getItem(WATCHED_COUNT_KEY)) || watchedIds.length;

    const rawReadIds = localStorage.getItem(READ_BOOK_IDS_KEY);
    const readBookIds: string[] = rawReadIds ? JSON.parse(rawReadIds) : [];
    const readBooksCount = Number(localStorage.getItem(READ_BOOK_COUNT_KEY)) || readBookIds.length;

    const rawDownloadIds = localStorage.getItem(DOWNLOADED_BOOK_IDS_KEY);
    const downloadedBookIds: string[] = rawDownloadIds ? JSON.parse(rawDownloadIds) : [];
    const downloadedBooksCount = Number(localStorage.getItem(DOWNLOADED_BOOK_COUNT_KEY)) || downloadedBookIds.length;

    // Calculate total sessions and total XP
    const totalSessions =
      watchedMediaCount * SESSIONS_PER_MEDIA +
      readBooksCount * SESSIONS_PER_EPUB +
      downloadedBooksCount * SESSIONS_PER_DOWNLOAD;

    const totalXp =
      watchedMediaCount * XP_PER_MEDIA +
      readBooksCount * XP_PER_EPUB +
      downloadedBooksCount * XP_PER_DOWNLOAD;

    const totalBooksRead = Math.max(
      readBooksCount + downloadedBooksCount,
      new Set([...readBookIds, ...downloadedBookIds]).size
    );

    return {
      totalWatchedCount: totalSessions,
      totalSessions,
      totalXp,
      totalScore: totalXp,
      watchedIds,
      readBookIds,
      downloadedBookIds,
      watchedMediaCount,
      readBooksCount,
      downloadedBooksCount,
      totalBooksRead
    };
  } catch (err) {
    console.error('Failed to read device stats from localStorage', err);
    return {
      totalWatchedCount: 0,
      totalSessions: 0,
      totalXp: 0,
      totalScore: 0,
      watchedIds: [],
      readBookIds: [],
      downloadedBookIds: [],
      watchedMediaCount: 0,
      readBooksCount: 0,
      downloadedBooksCount: 0,
      totalBooksRead: 0
    };
  }
}

export function getGamificationStats(totalCount: number, optionalXp?: number): GamificationStats {
  const count = Math.max(0, totalCount);

  // Find the highest level achieved
  let activeLevelDef = LEVELS_22[0];
  let nextLevelDef: LevelDefinition | null = LEVELS_22[1] || null;

  for (let i = LEVELS_22.length - 1; i >= 0; i--) {
    if (count >= LEVELS_22[i].minViews) {
      activeLevelDef = LEVELS_22[i];
      nextLevelDef = LEVELS_22[i + 1] || null;
      break;
    }
  }

  const { level, rankTitle, rankHebrew, rankIcon, colorClass, borderClass, bgClass, minViews, nextThreshold } = activeLevelDef;

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
  const calculatedXp = optionalXp !== undefined ? optionalXp : count * 10;

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
    nextRankTitle: nextLevelDef ? nextLevelDef.rankTitle : null,
    nextRankHebrew: nextLevelDef ? nextLevelDef.rankHebrew : null,
    totalXp: calculatedXp,
    totalScore: calculatedXp,
    badges,
    unlockedBadgesCount,
    totalBadgesCount: badges.length
  };
}

/**
 * Records a video/podcast watch (+1 session, +10 XP).
 */
export function recordDeviceWatch(mediaId: string): DeviceWatchStats {
  try {
    const current = getDeviceWatchStats();
    let newCount = current.watchedMediaCount;
    let newIds = [...current.watchedIds];

    if (!newIds.includes(mediaId)) {
      newIds.push(mediaId);
      newCount += 1;
      localStorage.setItem(WATCHED_MEDIA_IDS_KEY, JSON.stringify(newIds));
      localStorage.setItem(WATCHED_COUNT_KEY, String(newCount));
    }

    notifyStatsUpdated();
    return getDeviceWatchStats();
  } catch (err) {
    console.error('Failed to save watch count to localStorage', err);
    return getDeviceWatchStats();
  }
}

/**
 * Records an EPUB book read (+3 sessions, +30 XP).
 */
export function recordDeviceBookRead(bookId: string): DeviceWatchStats {
  try {
    const current = getDeviceWatchStats();
    let newCount = current.readBooksCount;
    let newIds = [...current.readBookIds];

    if (!newIds.includes(bookId)) {
      newIds.push(bookId);
      newCount += 1;
      localStorage.setItem(READ_BOOK_IDS_KEY, JSON.stringify(newIds));
      localStorage.setItem(READ_BOOK_COUNT_KEY, String(newCount));
    }

    notifyStatsUpdated();
    return getDeviceWatchStats();
  } catch (err) {
    console.error('Failed to save read count to localStorage', err);
    return getDeviceWatchStats();
  }
}

/**
 * Records an EPUB book download (+8 sessions, +80 XP).
 */
export function recordDeviceBookDownload(bookId: string): DeviceWatchStats {
  try {
    const current = getDeviceWatchStats();
    let newCount = current.downloadedBooksCount;
    let newIds = [...current.downloadedBookIds];

    if (!newIds.includes(bookId)) {
      newIds.push(bookId);
      newCount += 1;
      localStorage.setItem(DOWNLOADED_BOOK_IDS_KEY, JSON.stringify(newIds));
      localStorage.setItem(DOWNLOADED_BOOK_COUNT_KEY, String(newCount));
    }

    notifyStatsUpdated();
    return getDeviceWatchStats();
  } catch (err) {
    console.error('Failed to save download count to localStorage', err);
    return getDeviceWatchStats();
  }
}

export function hasDeviceWatched(mediaId: string): boolean {
  try {
    const rawIds = localStorage.getItem(WATCHED_MEDIA_IDS_KEY);
    if (!rawIds) return false;
    const watchedIds: string[] = JSON.parse(rawIds);
    return watchedIds.includes(mediaId);
  } catch {
    return false;
  }
}

export function hasDeviceReadBook(bookId: string): boolean {
  try {
    const rawIds = localStorage.getItem(READ_BOOK_IDS_KEY);
    if (!rawIds) return false;
    const readIds: string[] = JSON.parse(rawIds);
    return readIds.includes(bookId);
  } catch {
    return false;
  }
}

export function hasDeviceDownloadedBook(bookId: string): boolean {
  try {
    const rawIds = localStorage.getItem(DOWNLOADED_BOOK_IDS_KEY);
    if (!rawIds) return false;
    const downloadedIds: string[] = JSON.parse(rawIds);
    return downloadedIds.includes(bookId);
  } catch {
    return false;
  }
}
