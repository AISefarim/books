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
  const nums = list.map(v => firstNumber(v.title || ''));
  if (nums.every(n => !isNaN(n)) && new Set(nums).size === nums.length) {
    return list.sort((a, b) => firstNumber(a.title) - firstNumber(b.title));
  }
  const ranks = list.map(v => aliyahRank(v.title || ''));
  if (ranks.every(r => r >= 0) && new Set(ranks).size === ranks.length) {
    return list.sort((a, b) => aliyahRank(a.title) - aliyahRank(b.title));
  }
  return list.sort(byDate);
}
