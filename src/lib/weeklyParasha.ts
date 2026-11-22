// This week's parasha (Diaspora, from Hebcal), cached for the day. Used to feature the matching AI Parasha series.
const KEY = 'aisefarim:weeklyParasha';

export async function getWeeklyParasha(): Promise<string | null> {
  // Cache for 3 hours only: a value fetched on Shabbat afternoon still names last week's parasha,
  // and a whole-day cache kept showing it all of Sunday.
  const now = Date.now();
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && typeof c.at === 'number' && now - c.at < 3 * 3600 * 1000) return c.name;
  } catch { /* storage may be unavailable */ }
  try {
    const r = await fetch('https://www.hebcal.com/shabbat?cfg=json&geonameid=5128581&M=on');
    const j = await r.json();
    const item = (j.items || []).find((i: { category?: string }) => i.category === 'parashat');
    const name = item ? String(item.title).replace(/^Parashat\s+/i, '') : null;
    try { localStorage.setItem(KEY, JSON.stringify({ at: now, name })); } catch { /* ignore */ }
    return name;
  } catch {
    return null;
  }
}

// Spellings differ (Toldot/Toledot, Korach/Korah, Behar-Bechukotai/Behar-Buchokotai): compare consonant skeletons.
const skel = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/ch/g, 'h').replace(/k/g, 'c').replace(/[aeiouy]/g, '');

export function matchParashaFolder(parasha: string | null, folders: string[]): string | null {
  if (!parasha) return null;
  const want = skel(parasha);
  return folders.find(f => skel(f) === want) || null;
}
