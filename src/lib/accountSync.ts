// Keeps a signed-in reader's points, level, history and "viewed" marks the same on every device.
// Guests are never asked to sign in: without a Google sign-in everything stays on the device, as before.
// On sign-in the device's progress and the account's are combined (nothing is lost on either side); after that
// every change on any device is saved to the account and shows up on the others.
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

const LIST_KEYS = [
  'ai_sefarim_watched_media_ids',
  'ai_sefarim_read_book_ids',
  'ai_sefarim_downloaded_book_ids',
  'ai_sefarim_read_daf_ids',
] as const;
const COUNT_KEYS: Record<string, string> = {
  ai_sefarim_watched_media_ids: 'ai_sefarim_watched_count',
  ai_sefarim_read_book_ids: 'ai_sefarim_read_book_count',
  ai_sefarim_downloaded_book_ids: 'ai_sefarim_downloaded_book_count',
};
const EVENTS_KEY = 'ai_sefarim_watch_events';
const VISITS_KEY = 'ai_sefarim_website_visit_count';

export interface SyncedStats {
  lists: Record<string, string[]>;
  counts: Record<string, number>;
  events: any[];
  visits: number;
}

const readJson = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

export function readLocalStats(): SyncedStats {
  const lists: Record<string, string[]> = {};
  const counts: Record<string, number> = {};
  for (const k of LIST_KEYS) lists[k] = readJson<string[]>(k, []);
  for (const [lk, ck] of Object.entries(COUNT_KEYS)) counts[ck] = Number(localStorage.getItem(ck)) || lists[lk].length;
  return { lists, counts, events: readJson<any[]>(EVENTS_KEY, []), visits: Number(localStorage.getItem(VISITS_KEY)) || 0 };
}

const evKey = (e: any) => `${e.mediaId}|${e.dateStr}`;

/** Combine two sets of progress without counting anything twice. */
export function mergeStats(a: SyncedStats, b: Partial<SyncedStats> | undefined): SyncedStats {
  if (!b) return a;
  const lists: Record<string, string[]> = {};
  for (const k of LIST_KEYS) lists[k] = Array.from(new Set([...(a.lists[k] || []), ...((b.lists || {})[k] || [])]));
  const counts: Record<string, number> = {};
  for (const [lk, ck] of Object.entries(COUNT_KEYS)) {
    counts[ck] = Math.max(a.counts[ck] || 0, (b.counts || {})[ck] || 0, lists[lk].length);
  }
  const seen = new Map<string, any>();
  for (const e of [...(a.events || []), ...(b.events || [])]) if (e && e.mediaId && !seen.has(evKey(e))) seen.set(evKey(e), e);
  const events = Array.from(seen.values()).sort((x, y) => (x.timestamp || 0) - (y.timestamp || 0));
  return { lists, counts, events, visits: Math.max(a.visits || 0, b.visits || 0) };
}

export function writeLocalStats(s: SyncedStats) {
  try {
    for (const k of LIST_KEYS) localStorage.setItem(k, JSON.stringify(s.lists[k] || []));
    for (const ck of Object.values(COUNT_KEYS)) localStorage.setItem(ck, String(s.counts[ck] || 0));
    localStorage.setItem(EVENTS_KEY, JSON.stringify(s.events || []));
    localStorage.setItem(VISITS_KEY, String(s.visits || 0));
  } catch { /* storage full or blocked: the account copy still has it */ }
  if (typeof window !== 'undefined') {
    // the same events the tracker sends, so the level, points and "viewed" marks redraw
    window.dispatchEvent(new CustomEvent('device-watch-updated'));
    window.dispatchEvent(new CustomEvent('ai-sefarim-stats-updated'));
  }
}

const sig = (s: SyncedStats) => JSON.stringify([s.lists, s.counts, s.events.length, s.visits]);
let lastPushed = '';
let applying = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function userRef() {
  const u = auth.currentUser;
  if (!u || u.isAnonymous) return null;
  return doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'users', u.uid);
}

export function pushStatsNow() {
  const ref = userRef();
  if (!ref) return;
  const s = readLocalStats();
  const k = sig(s);
  if (k === lastPushed) return;
  lastPushed = k;
  setDoc(ref, { stats: s, statsUpdatedAt: Date.now(), updatedAt: Date.now() }, { merge: true }).catch(() => { lastPushed = ''; });
}

/** Called with the account's saved stats each time they arrive (first time on sign-in, then whenever another device saves). */
export function applyRemoteStats(remote: Partial<SyncedStats> | undefined) {
  const local = readLocalStats();
  const merged = mergeStats(local, remote);
  if (sig(merged) !== sig(local)) {
    applying = true;
    writeLocalStats(merged);
    applying = false;
  }
  const remoteFull = remote ? mergeStats({ lists: {}, counts: {}, events: [], visits: 0 } as any, remote) : null;
  if (remoteFull && sig(remoteFull) === sig(merged)) { lastPushed = sig(merged); return; }
  pushStatsNow();   // this device had something the account didn't
}

let listening = false;
/** Save to the account (if signed in) a moment after any change on this device. */
export function startStatsAutoSave() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('ai-sefarim-stats-updated', () => {
    if (applying || !userRef()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(pushStatsNow, 1500);
  });
}

export function resetStatsSync() { lastPushed = ''; }
