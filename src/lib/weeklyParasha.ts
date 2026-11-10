// This week's parasha (Diaspora, from Hebcal), cached for the day. Used to feature the matching AI Parasha series.
const KEY = 'aisefarim:weeklyParasha';

export async function getWeeklyParasha(): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.day === today) return c.name;
  } catch { /* storage may be unavailable */ }
  try {
    const r = await fetch('https://www.hebcal.com/shabbat?cfg=json&geonameid=5128581&M=on');
    const j = await r.json();
    const item = (j.items || []).find((i: { category?: string }) => i.category === 'parashat');
    const name = item ? String(item.title).replace(/^Parashat\s+/i, '') : null;
    try { localStorage.setItem(KEY, JSON.stringify({ day: today, name })); } catch { /* ignore */ }
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
