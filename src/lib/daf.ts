// Shared helpers for Super Daf: the worker endpoints, URL <-> ref mapping,
// and matching a daf podcast to its daf by title.

export const DAF_API =
  ((import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev') + '/daf';

export function sefariaUrl(ref: string): string {
  return 'https://www.sefaria.org/' + encodeURIComponent(ref.replace(/ /g, '_')).replace(/%3A/g, '.').replace(/%2C/g, ',');
}

// "Bekhorot 17" -> "/daf/Bekhorot/17"
export function dafPath(ref: string): string {
  const m = ref.trim().match(/^(.+?)\s+(\d+)[ab]?$/);
  return m ? `/daf/${encodeURIComponent(m[1].replace(/ /g, '_'))}/${m[2]}` : '/daf';
}

// "/daf/Bekhorot/17" -> "Bekhorot 17"
export function refFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if ((parts[0] !== 'daf' && parts[0] !== 'superdaf') || !parts[1] || !parts[2]) return null;
  if (parts[3] === 'gems') return null; // a gem page lives on the hub
  return `${decodeURIComponent(parts[1]).replace(/_/g, ' ')} ${parts[2].replace(/[ab]$/, '')}`;
}

// Tractate names are spelled many ways (Bekhorot / Bechoros / Bechorot,
// Shabbat / Shabbos, Bava Kamma / Baba Kama). Reduce both sides to a
// forgiving skeleton before comparing.
export function normalizeTractate(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/kh/g, 'ch')
    .replace(/th/g, 't')
    .replace(/mm/g, 'm')
    .replace(/ss/g, 's')
    .replace(/os$/, 'ot')
    .replace(/oth$/, 'ot')
    .replace(/ah$/, 'a')
    .replace(/in$/, 'im');
}

// Does this podcast title belong to the given daf? ("Bekhorot Daf 17",
// "Bechoros 17a", "Daf Yomi: Bekhorot 17")
export function titleMatchesDaf(title: string, book: string, daf: string | number): boolean {
  const t = title || '';
  const numbers = (t.match(/\d+/g) || []).map(Number);
  if (!numbers.includes(Number(daf))) return false;
  const words = t.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const nb = normalizeTractate(book);
  // allow two-word tractates ("Bava Kamma") by also testing adjacent pairs
  const candidates = words.concat(words.slice(0, -1).map((w, i) => w + words[i + 1]));
  return candidates.some((w) => {
    const nw = normalizeTractate(w);
    return nw.length >= 4 && (nw === nb || nb.startsWith(nw) || nw.startsWith(nb));
  });
}

// Parse "<tractate> ... <number>" out of a podcast title so the Media
// section can send the listener to the right daf. Returns a Sefaria-style
// ref or null when the title doesn't name a daf.
const TRACTATES = [
  'Berakhot', 'Shabbat', 'Eruvin', 'Pesachim', 'Shekalim', 'Yoma', 'Sukkah', 'Beitzah', 'Rosh Hashanah', 'Taanit', 'Megillah',
  'Moed Katan', 'Chagigah', 'Yevamot', 'Ketubot', 'Nedarim', 'Nazir', 'Sotah', 'Gittin', 'Kiddushin', 'Bava Kamma', 'Bava Metzia',
  'Bava Batra', 'Sanhedrin', 'Makkot', 'Shevuot', 'Avodah Zarah', 'Horayot', 'Zevachim', 'Menachot', 'Chullin', 'Bekhorot',
  'Arakhin', 'Temurah', 'Keritot', 'Meilah', 'Tamid', 'Niddah',
];
export function dafFromTitle(title: string): string | null {
  const nums = (title || '').match(/\b(\d{1,3})[ab]?\b/g);
  if (!nums) return null;
  const daf = nums[nums.length - 1].replace(/[ab]$/, '');
  for (const tr of TRACTATES) {
    if (titleMatchesDaf(title, tr, daf)) return `${tr} ${daf}`;
  }
  return null;
}

// The daf an AI Daf episode belongs to ("Bekhorot 14", or folder "Bekhorot" + title "14").
export function dafRefForMedia(v: { title?: string; folder?: string; category?: string }): string | null {
  if (!/\bdaf\b/i.test(v.category || '')) return null;
  return dafFromTitle(v.title || '') || dafFromTitle(`${v.folder || ''} ${v.title || ''}`);
}

// Dafim that have a finished Super Daf. Fetched once per page load and shared.
let readyPromise: Promise<Set<string>> | null = null;
export function loadReadyDafs(): Promise<Set<string>> {
  if (!readyPromise) {
    readyPromise = fetch(`${DAF_API}/ready`).then((r) => r.json()).then((d) => (readySet = new Set<string>(d.refs || []))).catch(() => new Set<string>());
  }
  return readyPromise;
}

// Where a citation lives in Super Daf: a Gemara line ("Bekhorot 19a:4") or a
// commentary on one ("Rashi on Bekhorot 19a:4:1") opens that line - when the
// daf is built. Everything else (Rambam, Shulchan Arukh...) stays on Sefaria.
let readySet: Set<string> | null = null;
export type DafSpot = { ref: string; seg: string; path: string };
export function superDafSpot(ref: string): DafSpot | null {
  if (!readySet) { loadReadyDafs(); return null; }
  const m = String(ref).replace(/^.+? on /, '').match(/^([A-Z][A-Za-z' ]+?) (\d+)([ab]):(\d+)/);
  if (!m) return null;
  const dafRef = `${m[1]} ${m[2]}`;
  if (!readySet.has(dafRef)) return null;
  const seg = `${m[2]}${m[3]}:${m[4]}`;
  return { ref: dafRef, seg, path: `${dafPath(dafRef)}#${seg}` };
}
// Open a spot without reloading the page; the reader (if it's showing) or the
// app handles the "sd-goto" event. Cmd/Ctrl-click still opens a new tab.
export function goToSpot(e: { preventDefault(): void; stopPropagation(): void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number }, spot: DafSpot) {
  e.stopPropagation();
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  window.dispatchEvent(new CustomEvent('sd-goto', { detail: { ref: spot.ref, seg: spot.seg, handled: false } }));
}

// Readership ping (counts people, not page loads - see the worker). Fire and forget.
export function pingDafOpen(ref?: string) {
  try {
    fetch(`${DAF_API}/open`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ ref: ref || '' }) }).catch(() => {});
  } catch { /* ignore */ }
}

// A commentary gist shown under its own label ("רש״י") shouldn't repeat the
// name: "Rashi explains that Rabbi Yochanan..." -> "Rabbi Yochanan...".
const GIST_VERBS = 'explain|note|clarif(?:y|ie)|say|state|point out|observe|comment|add|teach|write|hold|interpret|understand|emphasize|maintain|argue|ask|raise|question|suggest|answer|resolve|infer|derive|read|gloss|define|distinguish|describe|identif(?:y|ie)';
export function gistText(title: string, gist?: string): string {
  const g = String(gist || '').replace(/\*\*/g, '').trim();
  const t = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // "Rashi explains that X" -> "X" (already a full sentence)
  const that = g.match(new RegExp(`^${t}\\s+(?:here\\s+|also\\s+)?(?:${GIST_VERBS})s?\\s+that\\s+(.+)$`, 'i'));
  if (that) return that[1].charAt(0).toUpperCase() + that[1].slice(1);
  // "Rashi explains why X" -> "He explains why X" (keeps the sentence whole)
  const pron = /^Tosafot\b/i.test(title) ? 'They' : 'He';
  const named = g.match(new RegExp(`^${t}\\s+(.+)$`, 'i'));
  if (named && /^[a-z]/.test(named[1])) return `${pron} ${named[1]}`;
  return g;
}
