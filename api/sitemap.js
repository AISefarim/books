// sitemap.xml: the Super Daf hub, each masechet, each built daf and each of
// its Gems pages - so search engines find every page Super Daf adds.

const WORKER = 'https://aisefarim-chat.abrahamserouya.workers.dev/daf';
const SITE = 'https://aisefarim.com';
const slug = (b) => encodeURIComponent(b.replace(/ /g, '_'));

async function api(path) {
  const r = await fetch(`${WORKER}/${path}`, { headers: { Origin: SITE } });
  if (!r.ok) throw new Error(`worker ${r.status}`);
  return r.json();
}

function gemsOf(c) {
  const a = c.articles || {};
  return ['iyun', 'remember', 'pasuk', 'halacha', 'rambam', 'tosafot', 'machloket', 'sod', 'words', 'review', 'shas'].filter((g) =>
    g === 'iyun' ? c.iyun : g === 'remember' ? c.takeaways?.length : g === 'words' ? c.words?.length : g === 'review' ? c.review?.chapters?.length : g === 'shas' ? c.shas?.length : a[g]);
}

export default async function handler(req, res) {
  const urls = [{ loc: `${SITE}/`, pri: '0.8' }, { loc: `${SITE}/daf`, pri: '1.0', freq: 'daily' }];
  try {
    const items = (await api('index')).items || [];
    const books = new Set();
    const refs = items.map((i) => i.ref).filter((r) => /^.+\s\d+$/.test(r));
    for (const r of refs) books.add(r.replace(/\s+\d+$/, ''));
    for (const b of books) urls.push({ loc: `${SITE}/daf/${slug(b)}`, pri: '0.7', freq: 'daily' });
    // gems per daf, a few at a time
    for (let i = 0; i < refs.length; i += 6) {
      const batch = refs.slice(i, i + 6);
      const comps = await Promise.all(batch.map((r) => api(`companion?ref=${encodeURIComponent(r)}`).catch(() => null)));
      batch.forEach((r, k) => {
        const [, b, n] = r.match(/^(.+?)\s+(\d+)$/);
        const base = `${SITE}/daf/${slug(b)}/${n}`;
        urls.push({ loc: base, pri: '0.9' });
        const c = comps[k];
        if (c && c.available !== false) for (const g of gemsOf(c)) urls.push({ loc: `${base}/gems/${g}`, pri: '0.6' });
      });
    }
  } catch (e) {
    console.error('sitemap', e);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc.replace(/&/g, '&amp;')}</loc>${u.freq ? `<changefreq>${u.freq}</changefreq>` : ''}<priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
