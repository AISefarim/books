import { Video } from '../types';
import { getFolderHierarchy } from '../components/VideoGrid';

/** The episodes that share a shiur's series (same category, folder and subfolder), in learning order. */
export function seriesEpisodes(video: Video, all: Video[]): Video[] {
  const key = (v: Video) => {
    const h = getFolderHierarchy(v);
    return `${v.category || ''}|${h.folder}|${h.subfolder}`;
  };
  const k = key(video);
  return orderEpisodes(all.filter(v => (v.type === 'audio') === (video.type === 'audio') && key(v) === k));
}

const ALIYOT = ['rishon', 'sheni', 'shelishi', 'revi', 'hamishi', 'chamishi', 'shishi', 'shevi', 'maftir'];
const aliyahRank = (t: string) => {
  const s = t.toLowerCase();
  const i = ALIYOT.findIndex(a => new RegExp(`\\b${a}`).test(s));
  if (i < 0) return -1;
  return ALIYOT[i] === 'chamishi' ? 4 : i > 5 ? i - 1 : i;
};
const firstNumber = (t: string) => {
  const m = t.match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};
const lastNumber = (t: string) => {
  const m = t.match(/\d+(?:\.\d+)?/g);
  return m ? parseFloat(m[m.length - 1]) : NaN;
};

/**
 * Learning order for one series:
 * 1. if every episode has a manual order, use it;
 * 2. else if every title carries a distinct number ("Chulin 35", "Bereshit 3 of 14", "Chapter 9"), sort by it;
 * 3. else if every title names an aliyah, use aliyah order;
 * 4. else oldest first (episodes are published in order).
 */
export function orderEpisodes(items: Video[]): Video[] {
  const list = [...items];
  const byDate = (a: Video, b: Video) => (a.createdAt || 0) - (b.createdAt || 0);
  if (list.length && list.every(v => (v.order || 0) > 0)) return list.sort((a, b) => a.order! - b.order! || byDate(a, b));
  // "Chulin 35" / "Bereshit 3 of 14: ..." number first; "Gate 2 ... Chapter 7" number last
  for (const num of [firstNumber, lastNumber]) {
    const nums = list.map(v => num(v.title || ''));
    if (nums.every(n => !isNaN(n)) && new Set(nums).size === nums.length) {
      return list.sort((a, b) => num(a.title) - num(b.title));
    }
  }
  const ranks = list.map(v => aliyahRank(v.title || ''));
  if (ranks.every(r => r >= 0) && new Set(ranks).size === ranks.length) {
    return list.sort((a, b) => aliyahRank(a.title) - aliyahRank(b.title));
  }
  return list.sort(byDate);
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
/** "Gate 3" -> {prefix "gate", rank 3}; "Shemuel II" -> {prefix "shemuel", rank 2}; no number -> null */
function sectionRank(name: string): { prefix: string; rank: number } | null {
  const s = name.trim().toLowerCase();
  const d = s.match(/^(.*?)(\d+)\s*$/) || s.match(/^(.*?)(\d+)\b/);
  if (d) return { prefix: d[1].replace(/[^a-z]+/g, ' ').trim(), rank: parseInt(d[2], 10) };
  const r = s.match(/^(.*?)\s+([ivx]+)$/);
  if (r && ROMAN[r[2]]) return { prefix: r[1].replace(/[^a-z]+/g, ' ').trim(), rank: ROMAN[r[2]] };
  return null;
}

export interface SeriesNeighbors {
  series: Video[];
  index: number;
  name: string;
  prev?: Video;
  next?: Video;
  /** set when prev/next comes from the neighbouring section (e.g. Gate 2 -> Gate 3) */
  prevSection?: string;
  nextSection?: string;
}

/** Where this shiur sits in its series, and the episodes before and after it (crossing into the next numbered section). */
export function seriesNeighbors(video: Video, all: Video[]): SeriesNeighbors {
  const series = seriesEpisodes(video, all);
  const index = series.findIndex(v => v.id === video.id);
  const h = getFolderHierarchy(video);
  const name = h.subfolder || h.folder || video.category;
  const out: SeriesNeighbors = { series, index, name };
  if (index === -1) return out;
  out.prev = series[index - 1];
  out.next = series[index + 1];
  if (out.prev && out.next) return out;

  // first or last of its section: look for the numbered section before/after it in the same category
  const me = sectionRank(name);
  if (!me) return out;
  const sectionOf = (v: Video) => { const x = getFolderHierarchy(v); return x.subfolder || x.folder; };
  const sameParent = (v: Video) => h.subfolder ? getFolderHierarchy(v).folder === h.folder : true;
  const sections = new Map<string, Video[]>();
  for (const v of all) {
    if ((v.category || '') !== (video.category || '') || (v.type === 'audio') !== (video.type === 'audio') || !sameParent(v)) continue;
    const s = sectionOf(v);
    if (!s || s === name) continue;
    const r = sectionRank(s);
    if (r && r.prefix === me.prefix) (sections.get(s) ?? sections.set(s, []).get(s)!).push(v);
  }
  const pick = (want: number) => [...sections.keys()].find(s => sectionRank(s)!.rank === want);
  if (!out.next) {
    const s = pick(me.rank + 1);
    if (s) { out.next = orderEpisodes(sections.get(s)!)[0]; out.nextSection = s; }
  }
  if (!out.prev) {
    const s = pick(me.rank - 1);
    if (s) { const l = orderEpisodes(sections.get(s)!); out.prev = l[l.length - 1]; out.prevSection = s; }
  }
  return out;
}
