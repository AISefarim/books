// Device watch and learning tracking helper for AI Sefarim
// Tracks the total number of videos/podcasts, book reads, and downloads on this device

const WATCHED_MEDIA_IDS_KEY = 'ai_sefarim_watched_media_ids';
const WATCHED_COUNT_KEY = 'ai_sefarim_watched_count';
const READ_BOOK_IDS_KEY = 'ai_sefarim_read_book_ids';
const READ_BOOK_COUNT_KEY = 'ai_sefarim_read_book_count';
const DOWNLOADED_BOOK_IDS_KEY = 'ai_sefarim_downloaded_book_ids';
const DOWNLOADED_BOOK_COUNT_KEY = 'ai_sefarim_downloaded_book_count';
const WATCH_EVENTS_KEY = 'ai_sefarim_watch_events';
const MEDIA_REGISTRY_KEY = 'ai_sefarim_media_registry';
const WEBSITE_VISIT_COUNT_KEY = 'ai_sefarim_website_visit_count';
const WEBSITE_SESSION_KEY = 'ai_sefarim_website_session_active';

// XP and Session multipliers:
// - Video / podcast: +1 session, +10 XP (base)
// - Longer podcasts: scale up to 50 XP
// - 2nd+ video/podcast of the day: 1.2x multiplier
// - EPUB reading: +2 sessions, +25 XP
// - Book download: +2 sessions, +35 XP
export const SESSIONS_PER_MEDIA = 1;
export const XP_PER_MEDIA = 10;

export const SESSIONS_PER_EPUB = 2;
export const XP_PER_EPUB = 25;

export const SESSIONS_PER_DOWNLOAD = 2;
export const XP_PER_DOWNLOAD = 35;

export interface WatchEvent {
  mediaId: string;
  timestamp: number;
  dateStr: string; // YYYY-MM-DD
  mediaType: 'video' | 'audio';
  duration?: string;
  durationMinutes: number;
  basePoints: number;
  multiplier: number; // 1.0 for 1st, 1.2 for 2nd+
  points: number;
  sessionCredit: number; // 1.0 for 1st, 1.2 for 2nd+
  isPodcastBonus: boolean;
}

export interface TodayWatchSummary {
  todayCount: number;
  multiplierActive: boolean;
  currentMultiplier: number;
  todayPoints: number;
}

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
  todayWatchCount: number;
  isDailyMultiplierActive: boolean;
  visitCount?: number;
  hasOver25Visits?: boolean;
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
  maxLevel: number;
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

// 50 Gates of Torah Wisdom (50 Distinct Levels with steepening progression)
export const LEVELS_50: LevelDefinition[] = [
  // --- Tier 1: The First Steps (Levels 1-5) ---
  {
    level: 1,
    minViews: 0,
    nextThreshold: 5,
    rankTitle: 'Torah Explorer',
    rankHebrew: 'צעד ראשון',
    rankIcon: '🌱',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    bgClass: 'bg-emerald-500/10'
  },
  {
    level: 2,
    minViews: 5,
    nextThreshold: 12,
    rankTitle: 'Consistent Seeker',
    rankHebrew: 'קובע עתים',
    rankIcon: '⚡',
    colorClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/30',
    bgClass: 'bg-emerald-500/10'
  },
  {
    level: 3,
    minViews: 12,
    nextThreshold: 20,
    rankTitle: 'Diligent Student',
    rankHebrew: 'שוקד בלימוד',
    rankIcon: '📚',
    colorClass: 'text-teal-400',
    borderClass: 'border-teal-500/30',
    bgClass: 'bg-teal-500/10'
  },
  {
    level: 4,
    minViews: 20,
    nextThreshold: 30,
    rankTitle: 'Attentive Ear',
    rankHebrew: 'אוזן קשבת',
    rankIcon: '🎧',
    colorClass: 'text-teal-300',
    borderClass: 'border-teal-500/30',
    bgClass: 'bg-teal-500/10'
  },
  {
    level: 5,
    minViews: 30,
    nextThreshold: 42,
    rankTitle: 'Minyan Scholar',
    rankHebrew: 'מנין שיעורים',
    rankIcon: '📜',
    colorClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    bgClass: 'bg-cyan-500/10'
  },

  // --- Tier 2: Building Foundations (Levels 6-10) ---
  {
    level: 6,
    minViews: 42,
    nextThreshold: 56,
    rankTitle: 'Book Devotee',
    rankHebrew: 'אוהב ספר',
    rankIcon: '📖',
    colorClass: 'text-cyan-300',
    borderClass: 'border-cyan-500/30',
    bgClass: 'bg-cyan-500/10'
  },
  {
    level: 7,
    minViews: 56,
    nextThreshold: 72,
    rankTitle: 'Living in Torah',
    rankHebrew: 'חי בתורה',
    rankIcon: '✨',
    colorClass: 'text-sky-400',
    borderClass: 'border-sky-500/30',
    bgClass: 'bg-sky-500/10'
  },
  {
    level: 8,
    minViews: 72,
    nextThreshold: 90,
    rankTitle: 'Toiler in Torah',
    rankHebrew: 'עמל בתורה',
    rankIcon: '🎯',
    colorClass: 'text-sky-300',
    borderClass: 'border-sky-500/30',
    bgClass: 'bg-sky-500/10'
  },
  {
    level: 9,
    minViews: 90,
    nextThreshold: 110,
    rankTitle: 'Deep Thinker',
    rankHebrew: 'מעמיק בחכמה',
    rankIcon: '💡',
    colorClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
    bgClass: 'bg-blue-500/10'
  },
  {
    level: 10,
    minViews: 110,
    nextThreshold: 132,
    rankTitle: 'Pillar of Study',
    rankHebrew: 'עמוד הלימוד',
    rankIcon: '🏛️',
    colorClass: 'text-blue-300',
    borderClass: 'border-blue-500/30',
    bgClass: 'bg-blue-500/10'
  },

  // --- Tier 3: Immersion & Depth (Levels 11-15) ---
  {
    level: 11,
    minViews: 132,
    nextThreshold: 156,
    rankTitle: 'Thirst for Wisdom',
    rankHebrew: 'צמא לדבריהם',
    rankIcon: '💧',
    colorClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30',
    bgClass: 'bg-indigo-500/10'
  },
  {
    level: 12,
    minViews: 156,
    nextThreshold: 182,
    rankTitle: 'Firm Foundation',
    rankHebrew: 'תופס יסוד',
    rankIcon: '🧱',
    colorClass: 'text-indigo-300',
    borderClass: 'border-indigo-500/30',
    bgClass: 'bg-indigo-500/10'
  },
  {
    level: 13,
    minViews: 182,
    nextThreshold: 210,
    rankTitle: 'Dweller in Tents',
    rankHebrew: 'יושב אוהלים',
    rankIcon: '⛺',
    colorClass: 'text-violet-400',
    borderClass: 'border-violet-500/30',
    bgClass: 'bg-violet-500/10'
  },
  {
    level: 14,
    minViews: 210,
    nextThreshold: 240,
    rankTitle: 'Living Wellspring',
    rankHebrew: 'באר מים חיים',
    rankIcon: '🌊',
    colorClass: 'text-violet-300',
    borderClass: 'border-violet-500/30',
    bgClass: 'bg-violet-500/10'
  },
  {
    level: 15,
    minViews: 240,
    nextThreshold: 272,
    rankTitle: 'Jubilee Scholar',
    rankHebrew: 'שער היובל',
    rankIcon: '🏆',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
    bgClass: 'bg-purple-500/10'
  },

  // --- Tier 4: Illumination & Refinement (Levels 16-20) ---
  {
    level: 16,
    minViews: 272,
    nextThreshold: 306,
    rankTitle: 'Light of Wisdom',
    rankHebrew: 'אור התבונה',
    rankIcon: '🕯️',
    colorClass: 'text-purple-300',
    borderClass: 'border-purple-500/30',
    bgClass: 'bg-purple-500/10'
  },
  {
    level: 17,
    minViews: 306,
    nextThreshold: 342,
    rankTitle: 'Faithful Disciple',
    rankHebrew: 'תלמיד נאמן',
    rankIcon: '🕊️',
    colorClass: 'text-fuchsia-400',
    borderClass: 'border-fuchsia-500/30',
    bgClass: 'bg-fuchsia-500/10'
  },
  {
    level: 18,
    minViews: 342,
    nextThreshold: 380,
    rankTitle: 'Pure Heart of Torah',
    rankHebrew: 'לב טהור',
    rankIcon: '💎',
    colorClass: 'text-fuchsia-300',
    borderClass: 'border-fuchsia-500/30',
    bgClass: 'bg-fuchsia-500/10'
  },
  {
    level: 19,
    minViews: 380,
    nextThreshold: 420,
    rankTitle: 'Chai of Deep Study',
    rankHebrew: 'חי עיונים',
    rankIcon: '🔮',
    colorClass: 'text-pink-400',
    borderClass: 'border-pink-500/30',
    bgClass: 'bg-pink-500/10'
  },
  {
    level: 20,
    minViews: 420,
    nextThreshold: 465,
    rankTitle: 'Shield of Heritage',
    rankHebrew: 'מגן מורשת',
    rankIcon: '🛡️',
    colorClass: 'text-pink-300',
    borderClass: 'border-pink-500/30',
    bgClass: 'bg-pink-500/10'
  },

  // --- Tier 5: Mastery & Insight (Levels 21-25) ---
  {
    level: 21,
    minViews: 465,
    nextThreshold: 515,
    rankTitle: 'Century of Insight',
    rankHebrew: 'מאה שערים',
    rankIcon: '🌟',
    colorClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    bgClass: 'bg-rose-500/10'
  },
  {
    level: 22,
    minViews: 515,
    nextThreshold: 570,
    rankTitle: 'Master of Review',
    rankHebrew: 'שונה פרקו',
    rankIcon: '🔄',
    colorClass: 'text-rose-300',
    borderClass: 'border-rose-500/30',
    bgClass: 'bg-rose-500/10'
  },
  {
    level: 23,
    minViews: 570,
    nextThreshold: 630,
    rankTitle: 'Ever-Flowing Spring',
    rankHebrew: 'מעיין המתגבר',
    rankIcon: '⛲',
    colorClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    bgClass: 'bg-amber-500/10'
  },
  {
    level: 24,
    minViews: 630,
    nextThreshold: 695,
    rankTitle: 'Climbing the Heights',
    rankHebrew: 'עולה בהר',
    rankIcon: '⛰️',
    colorClass: 'text-amber-300',
    borderClass: 'border-amber-500/30',
    bgClass: 'bg-amber-500/10'
  },
  {
    level: 25,
    minViews: 695,
    nextThreshold: 765,
    rankTitle: 'Half-Century of Gates',
    rankHebrew: 'מחצית השערים',
    rankIcon: '🚪',
    colorClass: 'text-amber-200',
    borderClass: 'border-amber-500/40',
    bgClass: 'bg-amber-500/15'
  },

  // --- Tier 6: High Scholarship (Levels 26-30) ---
  {
    level: 26,
    minViews: 765,
    nextThreshold: 840,
    rankTitle: 'Keeper of the Word',
    rankHebrew: 'נוצר אמרי שפר',
    rankIcon: '📜',
    colorClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/30',
    bgClass: 'bg-yellow-500/10'
  },
  {
    level: 27,
    minViews: 840,
    nextThreshold: 920,
    rankTitle: 'Seeker of Truth',
    rankHebrew: 'דורש אמת',
    rankIcon: '🔍',
    colorClass: 'text-yellow-300',
    borderClass: 'border-yellow-500/30',
    bgClass: 'bg-yellow-500/10'
  },
  {
    level: 28,
    minViews: 920,
    nextThreshold: 1005,
    rankTitle: 'Crown of Good Name',
    rankHebrew: 'כתר שם טוב',
    rankIcon: '👑',
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
    bgClass: 'bg-orange-500/10'
  },
  {
    level: 29,
    minViews: 1005,
    nextThreshold: 1095,
    rankTitle: 'Foundation Stone',
    rankHebrew: 'אבן שתיה',
    rankIcon: '🏛️',
    colorClass: 'text-orange-300',
    borderClass: 'border-orange-500/30',
    bgClass: 'bg-orange-500/10'
  },
  {
    level: 30,
    minViews: 1095,
    nextThreshold: 1190,
    rankTitle: 'Thirty Virtues',
    rankHebrew: 'שלושים מעלות',
    rankIcon: '💎',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-400/40',
    bgClass: 'bg-emerald-500/15'
  },

  // --- Tier 7: Sacred Wisdom (Levels 31-35) ---
  {
    level: 31,
    minViews: 1190,
    nextThreshold: 1290,
    rankTitle: 'Illuminated Soul',
    rankHebrew: 'נפש מאירה',
    rankIcon: '☀️',
    colorClass: 'text-teal-300',
    borderClass: 'border-teal-400/40',
    bgClass: 'bg-teal-500/15'
  },
  {
    level: 32,
    minViews: 1290,
    nextThreshold: 1395,
    rankTitle: '32 Paths of Wisdom',
    rankHebrew: 'ל״ב נתיבות חכמה',
    rankIcon: '🧭',
    colorClass: 'text-cyan-300',
    borderClass: 'border-cyan-400/40',
    bgClass: 'bg-cyan-500/15'
  },
  {
    level: 33,
    minViews: 1395,
    nextThreshold: 1505,
    rankTitle: 'Tree of Life',
    rankHebrew: 'עץ חיים',
    rankIcon: '🌳',
    colorClass: 'text-sky-300',
    borderClass: 'border-sky-400/40',
    bgClass: 'bg-sky-500/15'
  },
  {
    level: 34,
    minViews: 1505,
    nextThreshold: 1620,
    rankTitle: 'Builder of Worlds',
    rankHebrew: 'בונה עולמות',
    rankIcon: '🏗️',
    colorClass: 'text-blue-300',
    borderClass: 'border-blue-400/40',
    bgClass: 'bg-blue-500/15'
  },
  {
    level: 35,
    minViews: 1620,
    nextThreshold: 1740,
    rankTitle: 'Splendor of Torah',
    rankHebrew: 'הדר התורה',
    rankIcon: '🌅',
    colorClass: 'text-indigo-300',
    borderClass: 'border-indigo-400/40',
    bgClass: 'bg-indigo-500/15'
  },

  // --- Tier 8: Deep Hidden Lights (Levels 36-40) ---
  {
    level: 36,
    minViews: 1740,
    nextThreshold: 1865,
    rankTitle: '36 Hidden Lights',
    rankHebrew: 'ל״ו אורות',
    rankIcon: '🕯️',
    colorClass: 'text-violet-300',
    borderClass: 'border-violet-400/40',
    bgClass: 'bg-violet-500/15'
  },
  {
    level: 37,
    minViews: 1865,
    nextThreshold: 1995,
    rankTitle: 'Vessel of Blessing',
    rankHebrew: 'כלי מחזיק ברכה',
    rankIcon: '🏺',
    colorClass: 'text-purple-300',
    borderClass: 'border-purple-400/40',
    bgClass: 'bg-purple-500/15'
  },
  {
    level: 38,
    minViews: 1995,
    nextThreshold: 2130,
    rankTitle: 'Golden Menorah',
    rankHebrew: 'מנורת זהב',
    rankIcon: '🕎',
    colorClass: 'text-fuchsia-300',
    borderClass: 'border-fuchsia-400/40',
    bgClass: 'bg-fuchsia-500/15'
  },
  {
    level: 39,
    minViews: 2130,
    nextThreshold: 2270,
    rankTitle: 'Spiritual Ascent',
    rankHebrew: 'עליה ברוח',
    rankIcon: '🦅',
    colorClass: 'text-pink-300',
    borderClass: 'border-pink-400/40',
    bgClass: 'bg-pink-500/15'
  },
  {
    level: 40,
    minViews: 2270,
    nextThreshold: 2415,
    rankTitle: '40 Days of Sinai',
    rankHebrew: 'ארבעים יום',
    rankIcon: '⚡',
    colorClass: 'text-rose-300',
    borderClass: 'border-rose-400/40',
    bgClass: 'bg-rose-500/15'
  },

  // --- Tier 9: Luminary of the Sanctuary (Levels 41-45) ---
  {
    level: 41,
    minViews: 2415,
    nextThreshold: 2565,
    rankTitle: 'Pillar of Fire',
    rankHebrew: 'עמוד אש',
    rankIcon: '🔥',
    colorClass: 'text-amber-400',
    borderClass: 'border-amber-400/40',
    bgClass: 'bg-amber-500/15'
  },
  {
    level: 42,
    minViews: 2565,
    nextThreshold: 2720,
    rankTitle: 'Sanctuary of Light',
    rankHebrew: 'מקדש מעט',
    rankIcon: '🏰',
    colorClass: 'text-amber-300',
    borderClass: 'border-amber-400/40',
    bgClass: 'bg-amber-500/15'
  },
  {
    level: 43,
    minViews: 2720,
    nextThreshold: 2880,
    rankTitle: 'Radiance of Zohar',
    rankHebrew: 'זהר החכמה',
    rankIcon: '🌌',
    colorClass: 'text-yellow-300',
    borderClass: 'border-yellow-400/40',
    bgClass: 'bg-yellow-500/15'
  },
  {
    level: 44,
    minViews: 2880,
    nextThreshold: 3045,
    rankTitle: 'Master of Mysteries',
    rankHebrew: 'יודע תעלומות',
    rankIcon: '🗝️',
    colorClass: 'text-violet-200',
    borderClass: 'border-violet-400/50',
    bgClass: 'bg-violet-500/20'
  },
  {
    level: 45,
    minViews: 3045,
    nextThreshold: 3215,
    rankTitle: 'Voice of Understanding',
    rankHebrew: 'קול התבונה',
    rankIcon: '📢',
    colorClass: 'text-indigo-200',
    borderClass: 'border-indigo-400/50',
    bgClass: 'bg-indigo-500/20'
  },

  // --- Tier 10: The Summit • 50th Gate (Levels 46-50) ---
  {
    level: 46,
    minViews: 3215,
    nextThreshold: 3390,
    rankTitle: 'Royal Diadem',
    rankHebrew: 'נזר ועטרה',
    rankIcon: '👑',
    colorClass: 'text-purple-200',
    borderClass: 'border-purple-400/50',
    bgClass: 'bg-purple-500/20'
  },
  {
    level: 47,
    minViews: 3390,
    nextThreshold: 3570,
    rankTitle: 'Chariot of Wisdom',
    rankHebrew: 'מרכבת קודש',
    rankIcon: '🛸',
    colorClass: 'text-fuchsia-200',
    borderClass: 'border-fuchsia-400/50',
    bgClass: 'bg-fuchsia-500/20'
  },
  {
    level: 48,
    minViews: 3570,
    nextThreshold: 3755,
    rankTitle: 'Great Luminary',
    rankHebrew: 'המאור הגדול',
    rankIcon: '🌞',
    colorClass: 'text-amber-200',
    borderClass: 'border-amber-400/50',
    bgClass: 'bg-amber-500/20'
  },
  {
    level: 49,
    minViews: 3755,
    nextThreshold: 4000,
    rankTitle: '49th Gate of Binah',
    rankHebrew: 'שער המ״ט',
    rankIcon: '🌠',
    colorClass: 'text-yellow-200',
    borderClass: 'border-yellow-300/60',
    bgClass: 'bg-yellow-500/25'
  },
  {
    level: 50,
    minViews: 4000,
    nextThreshold: null, // Pinnacle 50th Gate achieved!
    rankTitle: 'The 50th Gate • Prince of Torah',
    rankHebrew: 'שער הנ׳ • שר התורה',
    rankIcon: '👑',
    colorClass: 'text-amber-300 font-black',
    borderClass: 'border-amber-300/70 shadow-lg shadow-amber-500/30',
    bgClass: 'bg-gradient-to-r from-amber-500/25 via-yellow-400/25 to-amber-500/25'
  }
];

export const LEVELS = LEVELS_50;
export const LEVELS_22 = LEVELS_50; // Alias for backwards compatibility
export const MAX_LEVEL = LEVELS_50.length;

export const MILESTONES: Omit<MilestoneBadge, 'unlocked'>[] = [
  {
    id: 'first_step',
    title: 'First Step',
    subtitle: '1st learning session completed',
    hebrewTitle: 'צעד ראשון',
    requiredViews: 1,
    icon: '🌱'
  },
  {
    id: 'chazakah',
    title: 'Chazakah',
    subtitle: '5 learning sessions mastered',
    hebrewTitle: 'חזקה בלימוד',
    requiredViews: 5,
    icon: '⚡'
  },
  {
    id: 'minyan_ten',
    title: 'Minyan Milestone',
    subtitle: '10 learning sessions mastered',
    hebrewTitle: 'מנין שיעורים',
    requiredViews: 10,
    icon: '📜'
  },
  {
    id: 'chai_eighteen',
    title: 'Chai of Wisdom',
    subtitle: '18 sessions completed',
    hebrewTitle: 'חי שיעורים',
    requiredViews: 18,
    icon: '✨'
  },
  {
    id: 'sefer_devotee',
    title: 'Book Devotee',
    subtitle: '35 sessions completed',
    hebrewTitle: 'אוהב ספרים',
    requiredViews: 35,
    icon: '📖'
  },
  {
    id: 'jubilee_fifty',
    title: 'Jubilee Scholar',
    subtitle: '50 sessions mastered',
    hebrewTitle: 'שער היובל',
    requiredViews: 50,
    icon: '🏆'
  },
  {
    id: 'pillar_hundred',
    title: 'Pillar of Study',
    subtitle: '100 sessions completed',
    hebrewTitle: 'עמוד הלימוד',
    requiredViews: 100,
    icon: '🏛️'
  },
  {
    id: 'two_hundred_fifty',
    title: 'Century of Torah',
    subtitle: '250 sessions completed',
    hebrewTitle: 'רב פעלים',
    requiredViews: 250,
    icon: '💎'
  },
  {
    id: 'five_hundred',
    title: 'Crown of Perseverance',
    subtitle: '500 sessions completed',
    hebrewTitle: 'עמל בתורה',
    requiredViews: 500,
    icon: '🌟'
  },
  {
    id: 'one_thousand',
    title: 'Master of Texts',
    subtitle: '1,000 sessions mastered',
    hebrewTitle: 'בקי בספרים',
    requiredViews: 1000,
    icon: '👑'
  },
  {
    id: 'two_thousand_five_hundred',
    title: 'Illuminator of Sefarim',
    subtitle: '2,500 sessions achieved',
    hebrewTitle: 'מאור הגולה',
    requiredViews: 2500,
    icon: '🔥'
  },
  {
    id: 'sar_hatorah',
    title: 'The 50th Gate • Prince of Torah',
    subtitle: '4,000+ sessions pinnacle achieved',
    hebrewTitle: 'שער הנ׳ • שר התורה',
    requiredViews: 4000,
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

export function parseDurationMinutes(duration?: string): number {
  if (!duration) return 0;
  const str = duration.trim().toLowerCase();
  
  // Format hh:mm:ss or mm:ss
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) {
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    } else if (parts.length === 2) {
      return parts[0] + parts[1] / 60;
    }
  }
  
  // Format "1 hr 20 min" or "45 min" or "1.5 hours"
  let totalMin = 0;
  const hrMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|h\b)/);
  if (hrMatch) {
    totalMin += parseFloat(hrMatch[1]) * 60;
  }
  const minMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:min|m\b)(?!s)/);
  if (minMatch) {
    totalMin += parseFloat(minMatch[1]);
  }
  const secMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:sec|s\b)/);
  if (secMatch) {
    totalMin += parseFloat(secMatch[1]) / 60;
  }
  
  if (totalMin > 0) return totalMin;
  
  const plain = parseFloat(str);
  if (!isNaN(plain)) {
    return plain > 180 ? plain / 60 : plain;
  }
  
  return 0;
}

export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateMediaPoints(
  mediaType: 'video' | 'audio',
  durationStr?: string,
  watchIndexToday = 0
): {
  basePoints: number;
  multiplier: number;
  finalPoints: number;
  sessionCredit: number;
  isPodcastBonus: boolean;
  durationMinutes: number;
} {
  const durationMinutes = parseDurationMinutes(durationStr);
  let basePoints = 10;
  let isPodcastBonus = false;

  // Higher scores for longer podcasts
  if (mediaType === 'audio') {
    if (durationMinutes >= 120) {
      basePoints = 50;
      isPodcastBonus = true;
    } else if (durationMinutes >= 90) {
      basePoints = 40;
      isPodcastBonus = true;
    } else if (durationMinutes >= 75) {
      basePoints = 35;
      isPodcastBonus = true;
    } else if (durationMinutes >= 60) {
      basePoints = 30;
      isPodcastBonus = true;
    } else if (durationMinutes >= 45) {
      basePoints = 25;
      isPodcastBonus = true;
    } else if (durationMinutes >= 30) {
      basePoints = 20;
      isPodcastBonus = true;
    } else if (durationMinutes >= 15) {
      basePoints = 15;
      isPodcastBonus = true;
    } else {
      basePoints = 10;
    }
  }

  // 1.2 multiplier for all videos/podcasts watched after the 1st one of the day
  // (aka the 2nd video/podcast of the day is 1.2 credit, same with 3rd, 4th etc)
  const multiplier = watchIndexToday >= 1 ? 1.2 : 1.0;
  const finalPoints = Math.round(basePoints * multiplier);
  const sessionCredit = watchIndexToday >= 1 ? 1.2 : 1.0;

  return {
    basePoints,
    multiplier,
    finalPoints,
    sessionCredit,
    isPodcastBonus,
    durationMinutes
  };
}

export function saveMediaMeta(id: string, meta: { type?: 'video' | 'audio'; duration?: string }) {
  try {
    const raw = localStorage.getItem(MEDIA_REGISTRY_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = {
      type: meta.type || 'video',
      duration: meta.duration || ''
    };
    localStorage.setItem(MEDIA_REGISTRY_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getMediaMeta(id: string): { type?: 'video' | 'audio'; duration?: string } | null {
  try {
    const raw = localStorage.getItem(MEDIA_REGISTRY_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[id] || null;
  } catch {
    return null;
  }
}

export function registerMediaList(mediaList: Array<{ id: string; type?: 'video' | 'audio'; duration?: string }>) {
  try {
    const raw = localStorage.getItem(MEDIA_REGISTRY_KEY);
    const map = raw ? JSON.parse(raw) : {};
    for (const item of mediaList) {
      if (item && item.id) {
        map[item.id] = {
          type: item.type || 'video',
          duration: item.duration || ''
        };
      }
    }
    localStorage.setItem(MEDIA_REGISTRY_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getTodayWatchSummary(): TodayWatchSummary {
  try {
    const todayStr = getTodayDateStr();
    const rawEvents = localStorage.getItem(WATCH_EVENTS_KEY);
    const events: WatchEvent[] = rawEvents ? JSON.parse(rawEvents) : [];
    const todayEvents = events.filter(e => e.dateStr === todayStr);
    const todayPoints = todayEvents.reduce((sum, e) => sum + e.points, 0);

    return {
      todayCount: todayEvents.length,
      multiplierActive: todayEvents.length >= 1,
      currentMultiplier: todayEvents.length >= 1 ? 1.2 : 1.0,
      todayPoints
    };
  } catch {
    return {
      todayCount: 0,
      multiplierActive: false,
      currentMultiplier: 1.0,
      todayPoints: 0
    };
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

    const rawEvents = localStorage.getItem(WATCH_EVENTS_KEY);
    const events: WatchEvent[] = rawEvents ? JSON.parse(rawEvents) : [];
    const todayStr = getTodayDateStr();
    const todayEvents = events.filter(e => e.dateStr === todayStr);
    const todayWatchCount = todayEvents.length;
    const isDailyMultiplierActive = todayWatchCount >= 1;

    let mediaPoints = 0;
    let mediaSessions = 0;
    const countedMediaIds = new Set<string>();

    for (const ev of events) {
      mediaPoints += ev.points || 10;
      mediaSessions += ev.sessionCredit || 1;
      countedMediaIds.add(ev.mediaId);
    }

    // For any media in watchedIds not covered by events (e.g. legacy history):
    for (const id of watchedIds) {
      if (!countedMediaIds.has(id)) {
        const meta = getMediaMeta(id);
        const calc = calculateMediaPoints(meta?.type || 'video', meta?.duration, 0);
        mediaPoints += calc.finalPoints;
        mediaSessions += 1;
        countedMediaIds.add(id);
      }
    }

    // Baseline fallback
    if (mediaPoints < watchedMediaCount * 10) {
      mediaPoints = watchedMediaCount * 10;
    }
    if (mediaSessions < watchedMediaCount) {
      mediaSessions = watchedMediaCount;
    }

    const totalSessions = Math.round(
      mediaSessions +
      readBooksCount * SESSIONS_PER_EPUB +
      downloadedBooksCount * SESSIONS_PER_DOWNLOAD
    );

    const totalScore = Math.round(
      mediaPoints +
      readBooksCount * XP_PER_EPUB +
      downloadedBooksCount * XP_PER_DOWNLOAD
    );

    const totalBooksRead = Math.max(
      readBooksCount + downloadedBooksCount,
      new Set([...readBookIds, ...downloadedBookIds]).size
    );

    const rawVisits = Number(localStorage.getItem(WEBSITE_VISIT_COUNT_KEY)) || 0;
    const visitCount = Math.max(rawVisits, totalSessions);
    const hasOver25Visits = visitCount > 25;

    return {
      totalWatchedCount: totalSessions,
      totalSessions,
      totalXp: totalScore,
      totalScore,
      watchedIds,
      readBookIds,
      downloadedBookIds,
      watchedMediaCount,
      readBooksCount,
      downloadedBooksCount,
      totalBooksRead,
      todayWatchCount,
      isDailyMultiplierActive,
      visitCount,
      hasOver25Visits
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
      totalBooksRead: 0,
      todayWatchCount: 0,
      isDailyMultiplierActive: false,
      visitCount: 0,
      hasOver25Visits: false
    };
  }
}

export function getGamificationStats(totalCount: number, optionalXp?: number): GamificationStats {
  const count = Math.max(0, totalCount);

  // Find the highest level achieved
  let activeLevelDef = LEVELS_50[0];
  let nextLevelDef: LevelDefinition | null = LEVELS_50[1] || null;

  for (let i = LEVELS_50.length - 1; i >= 0; i--) {
    if (count >= LEVELS_50[i].minViews) {
      activeLevelDef = LEVELS_50[i];
      nextLevelDef = LEVELS_50[i + 1] || null;
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
    maxLevel: LEVELS_50.length,
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
 * Records a video/podcast watch (+1 session, +10 XP base, bonus for longer podcasts, 1.2x for 2nd+ of the day).
 */
export function recordDeviceWatch(
  mediaId: string,
  meta?: { type?: 'video' | 'audio'; duration?: string } | any
): DeviceWatchStats {
  try {
    const todayStr = getTodayDateStr();
    const rawEvents = localStorage.getItem(WATCH_EVENTS_KEY);
    let events: WatchEvent[] = rawEvents ? JSON.parse(rawEvents) : [];

    let mediaType: 'video' | 'audio' = 'video';
    let duration = '';
    if (meta) {
      if (meta.type === 'audio' || meta.type === 'video') {
        mediaType = meta.type;
      }
      if (typeof meta.duration === 'string') {
        duration = meta.duration;
      }
      saveMediaMeta(mediaId, { type: mediaType, duration });
    } else {
      const cached = getMediaMeta(mediaId);
      if (cached) {
        mediaType = cached.type || 'video';
        duration = cached.duration || '';
      }
    }

    // Check how many videos/podcasts watched today
    const todayEvents = events.filter(e => e.dateStr === todayStr);
    const existingToday = todayEvents.find(e => e.mediaId === mediaId);

    // If not yet watched today, record the watch event
    if (!existingToday) {
      const watchIndexToday = todayEvents.length; // 0 for 1st, 1 for 2nd (1.2x), etc.
      const calc = calculateMediaPoints(mediaType, duration, watchIndexToday);

      const newEvent: WatchEvent = {
        mediaId,
        timestamp: Date.now(),
        dateStr: todayStr,
        mediaType,
        duration,
        durationMinutes: calc.durationMinutes,
        basePoints: calc.basePoints,
        multiplier: calc.multiplier,
        points: calc.finalPoints,
        sessionCredit: calc.sessionCredit,
        isPodcastBonus: calc.isPodcastBonus
      };

      events.push(newEvent);
      localStorage.setItem(WATCH_EVENTS_KEY, JSON.stringify(events));
    }

    // Also maintain unique watched IDs
    const rawIds = localStorage.getItem(WATCHED_MEDIA_IDS_KEY);
    let watchedIds: string[] = rawIds ? JSON.parse(rawIds) : [];
    let count = Number(localStorage.getItem(WATCHED_COUNT_KEY)) || watchedIds.length;

    if (!watchedIds.includes(mediaId)) {
      watchedIds.push(mediaId);
      count += 1;
      localStorage.setItem(WATCHED_MEDIA_IDS_KEY, JSON.stringify(watchedIds));
      localStorage.setItem(WATCHED_COUNT_KEY, String(count));
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

/**
 * Records a website visit on this device.
 * Increments the visit count if this is a new browser visit/session.
 */
export function recordWebsiteVisit(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const rawCount = Number(localStorage.getItem(WEBSITE_VISIT_COUNT_KEY)) || 0;
    const sessionActive = sessionStorage.getItem(WEBSITE_SESSION_KEY);

    if (!sessionActive) {
      sessionStorage.setItem(WEBSITE_SESSION_KEY, 'true');
      const currentStats = getDeviceWatchStats();
      const baseline = Math.max(rawCount, currentStats.totalWatchedCount, currentStats.totalSessions);
      const newCount = baseline + 1;
      localStorage.setItem(WEBSITE_VISIT_COUNT_KEY, String(newCount));
      notifyStatsUpdated();
      return newCount;
    }

    const currentStats = getDeviceWatchStats();
    return Math.max(rawCount, currentStats.totalWatchedCount, currentStats.totalSessions);
  } catch {
    return 1;
  }
}

/**
 * Returns total number of times the user has visited the website on this device.
 */
export function getWebsiteVisitCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const rawCount = Number(localStorage.getItem(WEBSITE_VISIT_COUNT_KEY)) || 0;
    const currentStats = getDeviceWatchStats();
    return Math.max(rawCount, currentStats.totalWatchedCount, currentStats.totalSessions);
  } catch {
    return 0;
  }
}

/**
 * Checks if the user has been on our website over 25 times (> 25 visits/sessions).
 */
export function hasOver25Visits(): boolean {
  return getWebsiteVisitCount() > 25;
}

/**
 * Helper for testing / administration to reset visit counter on this device.
 */
export function resetWebsiteVisits(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(WEBSITE_VISIT_COUNT_KEY);
    sessionStorage.removeItem(WEBSITE_SESSION_KEY);
    notifyStatsUpdated();
  } catch {
    // ignore
  }
}

