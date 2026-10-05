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
