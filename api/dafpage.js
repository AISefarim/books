// Super Daf pages for search engines and link previews. The site is a
// single-page app, so /daf/... normally arrives as an empty shell; this
// serves the same index.html with the page's own title, description,
// canonical URL, structured data and its text inside #root (React replaces
// it on load). Routes (vercel.json): /daf, /daf/<Masechet>, /daf/<Masechet>/<n>,
// /daf/<Masechet>/<n>/gems/<gem>.

const WORKER = 'https://aisefarim-chat.abrahamserouya.workers.dev/daf';
const SITE = 'https://aisefarim.com';
const GEM_LABEL = { iyun: 'Iyun of the day', prep: 'Daf prep', remember: '3 to remember', pasuk: 'The Passuk', halacha: 'Halachot', rambam: 'The Rambam’s view', tosafot: 'Tosafot', machloket: 'Machloket', sod: 'The inner dimension', words: 'Words to know', review: 'Masechet so far', shas: 'Elsewhere in Shas' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// AI text -> plain prose: no [citations], no ** / * marks
const clean = (s) => String(s ?? '').replace(/\s*\[[^\]]*\d[^\]]*\]/g, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1').replace(/\s+([.,;:])/g, '$1').trim();
const clip = (s, n = 158) => { const t = clean(s); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
const bookSlug = (b) => encodeURIComponent(b.replace(/ /g, '_'));
const dafUrl = (ref) => { const m = ref.match(/^(.+?)\s+(\d+)$/); return m ? `/daf/${bookSlug(m[1])}/${m[2]}` : '/daf'; };

async function api(path) {
  const r = await fetch(`${WORKER}/${path}`, { headers: { Origin: SITE } });
  if (!r.ok) throw new Error(`worker ${r.status}`);
  return r.json();
}

function gemsOf(c) {
  const a = c.articles || {};
  return ['iyun', 'prep', 'remember', 'pasuk', 'halacha', 'rambam', 'tosafot', 'machloket', 'sod', 'words', 'review', 'shas'].filter((g) =>
    g === 'iyun' ? c.iyun : g === 'prep' ? c.prep : g === 'remember' ? c.takeaways?.length : g === 'words' ? c.words?.length : g === 'review' ? c.review?.chapters?.length : g === 'shas' ? c.shas?.length : a[g]);
}
function gemTitle(c, g) {
  const a = c.articles || {};
  if (g === 'iyun') return clean(c.iyun?.title);
  if (a[g]) return clean(a[g].title);
  return { prep: `Before you learn ${c.ref}`, remember: `${c.ref}: three things to remember`, words: `${c.ref}: words to know`, review: 'The masechet so far, chapter by chapter', shas: `${c.ref} elsewhere in Shas` }[g] || GEM_LABEL[g];
}

// ---- page bodies (simple, readable HTML) ----

const wrap = (inner) => `<main style="max-width:720px;margin:0 auto;padding:32px 20px;font-family:Georgia,serif;line-height:1.7;color:#cbd5e1;background:#020617">${inner}</main>`;
const list = (items) => items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '';

function dafBody(c) {
  const gems = gemsOf(c);
  return wrap(`
    <p><a href="/daf">Super Daf</a> › <a href="/daf/${bookSlug(c.ref.replace(/\s+\d+$/, ''))}">${esc(c.ref.replace(/\s+\d+$/, ''))}</a></p>
    <h1>${esc(c.ref)} – ${esc(c.heRef)} | Daf Yomi with Rashi, Tosafot, the Rambam and halacha</h1>
    ${c.takeaways?.length ? `<h2>What ${esc(c.ref)} teaches</h2>${list(c.takeaways.map((t) => esc(clean(t))))}` : ''}
    ${c.sugyot?.length ? `<h2>The sugyot</h2>${list(c.sugyot.filter((s) => s.tldr).map((s) => esc(clean(s.tldr))))}` : ''}
    ${c.halacha?.length ? `<h2>Halachot from the daf</h2>${list(c.halacha.map((h) => esc(clean(h.issue))))}` : ''}
    ${gems.length ? `<h2>Gems from the Daf</h2>${list(gems.map((g) => `<a href="${dafUrl(c.ref)}/gems/${g}">${esc(GEM_LABEL[g])}: ${esc(gemTitle(c, g))}</a>`))}` : ''}
    <p>Learn ${esc(c.ref)} sugya by sugya on Super Daf: the Gemara in Hebrew and English with Rashi, Tosafot, the Rishonim, the Rambam and the Shulchan Arukh woven in. Free.</p>`);
}

function articleHtml(a) {
  return (a.verse ? `<blockquote lang="he" dir="rtl">${esc(a.verse.he)}</blockquote><p><em>${esc(a.verse.en)}</em> (${esc(a.verse.ref)})</p>` : '') +
    (a.sections || []).map((s) => `${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}${(s.paragraphs || []).map((p) => `<p>${esc(clean(p))}</p>`).join('')}${s.source ? `<blockquote lang="he" dir="rtl">${esc(s.source.quote)}</blockquote><p><em>${esc(clean(s.source.translation))}</em> (${esc(s.source.ref)})</p>` : ''}`).join('') +
    (a.takeaway ? `<p><strong>${esc(clean(a.takeaway))}</strong></p>` : '');
}

function gemBody(c, g) {
  const a = c.articles || {};
  let inner = '';
  if (g === 'iyun' && c.iyun) {
    const i = c.iyun;
    inner = `<p lang="he" dir="rtl">${esc(i.heTitle)}</p><p><em>${esc(clean(i.hook))}</em></p>` +
      (i.background || []).map((p) => `<p>${esc(clean(p))}</p>`).join('') +
      `<h2>The question</h2><p>${esc(clean(i.question))}</p><h2>Through the sources</h2>` +
      (i.sources || []).map((s) => `<h3>${esc(s.who)} (${esc(s.stage)})</h3>${s.quote ? `<blockquote lang="he" dir="rtl">${esc(s.quote)}</blockquote>` : ''}<p>${esc(clean(s.point))}</p>`).join('') +
      ((i.approaches || []).length ? `<h2>Ways to understand it</h2>${(i.approaches || []).map((x) => `<h3>${esc(clean(x.name))}</h3><p>${esc(clean(x.sevara))}</p>`).join('')}` : '') +
      (i.conclusion ? `<h2>Where it lands</h2><p>${esc(clean(i.conclusion))}</p>` : '') + (i.takeaway ? `<p><strong>${esc(clean(i.takeaway))}</strong></p>` : '');
  } else if (g === 'prep' && c.prep) {
    const p = c.prep;
    inner = `<h2>Where we left off</h2><p>${esc(clean(p.leftOff))}</p><h2>The question going in</h2><p>${esc(clean(p.question))}</p><h2>Know before you start</h2>${list((p.concepts || []).map((x) => `<span lang="he">${esc(x.he)}</span> (${esc(x.name)}): ${esc(clean(x.explain))}`))}<h2>Who's who</h2>${list((p.people || []).map((x) => `${esc(x.name)} (<span lang="he">${esc(x.he)}</span>, ${esc(x.era)}): ${esc(clean(x.role))}`))}`;
  } else if (a[g]) {
    inner = `<p><em>${esc(clean(a[g].dek))}</em></p>${articleHtml(a[g])}`;
  } else if (g === 'remember') {
    inner = `<ol>${(c.takeaways || []).map((t) => `<li>${esc(clean(t))}</li>`).join('')}</ol>`;
  } else if (g === 'words') {
    inner = list((c.words || []).map((w) => `<span lang="he">${esc(w.he)}</span> (${esc(w.translit)}): ${esc(clean(w.meaning))}. ${esc(clean(w.note))}`));
  } else if (g === 'review' && c.review) {
    inner = `<p>${esc(clean(c.review.overview))}</p>` + c.review.chapters.map((ch) => `<h2>Chapter ${ch.n}${ch.he ? ` – <span lang="he">${esc(ch.he)}</span>` : ''}: ${esc(clean(ch.title))}</h2><p>${esc(clean(ch.summary))}</p>${list((ch.points || []).map((p) => esc(clean(p))))}`).join('');
  } else if (g === 'shas') {
    inner = list((c.shas || []).map((s) => `${esc(s.ref)}: ${esc(clean(s.en || s.he))}`));
  }
  return wrap(`
    <p><a href="/daf">Super Daf</a> › <a href="${dafUrl(c.ref)}">${esc(c.ref)}</a> › Gems from the Daf</p>
    <p>${esc(GEM_LABEL[g])} · ${esc(c.ref)} · <span lang="he">${esc(c.heRef)}</span></p>
    <h1>${esc(gemTitle(c, g))}</h1>${inner}
    <p><a href="${dafUrl(c.ref)}">Learn ${esc(c.ref)} on Super Daf</a></p>`);
}

function hubBody(items, book) {
  const by = {};
  for (const it of items) { const m = it.ref.match(/^(.+?)\s+(\d+)$/); if (m) (by[m[1]] ||= []).push({ ...it, n: Number(m[2]) }); }
  const books = Object.keys(by).filter((b) => !book || b === book);
  return wrap(`
    <h1>${book ? `Masechet ${esc(book)} on Super Daf` : 'Super Daf – Daf Yomi, sugya by sugya'}</h1>
    <p>The daily daf in Hebrew and English, sugya by sugya, with Rashi, Tosafot, the Rishonim, the Rambam and halacha woven in - plus Gems from the Daf: an iyun, the Rambam’s view, Tosafot and more. Free.</p>
    ${books.map((b) => `<h2>${esc(b)}</h2>${list(by[b].sort((x, y) => x.n - y.n).map((d) => `<a href="${dafUrl(d.ref)}">${esc(d.ref)}</a>${d.preview?.[0] ? ` – ${esc(clean(d.preview[0]))}` : ''}`))}`).join('')}`);
}

// ---- head ----

function setHead(html, { title, desc, path, type = 'website', jsonld }) {
  const t = esc(title), d = esc(desc), url = SITE + path;
  html = html.replace(/<title>.*?<\/title>/, `<title>${t}</title>`);
  html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`);
  html = html.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}" />\n    <meta name="twitter:title" content="${t}" />`);
  html = html.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />\n    <meta name="twitter:description" content="${d}" />`);
  html = html.replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${type}" />\n    <meta property="og:url" content="${esc(url)}" />`);
  html = html.replace('</head>', `    <link rel="canonical" href="${esc(url)}" />\n${jsonld ? `    <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>\n` : ''}  </head>`);
  return html;
}

export default async function handler(req, res) {
  const host = req.headers.host || 'aisefarim.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  let html = '';
  try {
    html = await (await fetch(`${protocol}://${host}/index.html`)).text();
  } catch {
    res.status(500).send('Unavailable');
    return;
  }
  try {
    const book = req.query.book ? decodeURIComponent(String(req.query.book)).replace(/_/g, ' ') : null;
    const n = req.query.n ? String(req.query.n).replace(/[ab]$/, '') : null;
    const gem = req.query.gem ? String(req.query.gem) : null;
    let page = null;

    if (book && n) {
      const ref = `${book} ${n}`;
      const c = await api(`companion?ref=${encodeURIComponent(ref)}`);
      if (c && c.available !== false) {
        if (gem && GEM_LABEL[gem] && gemsOf(c).includes(gem)) {
          const title = `${gemTitle(c, gem)} – ${GEM_LABEL[gem]}, ${c.ref} | Super Daf`;
          const a = (c.articles || {})[gem];
          const desc = clip(gem === 'prep' ? `Before learning ${c.ref}: ${c.prep.question}` : gem === 'iyun' ? `${c.iyun.hook} ${c.iyun.question}` : a ? a.dek : gem === 'remember' ? c.takeaways.join(' ') : gem === 'review' ? c.review.overview : `${GEM_LABEL[gem]} for ${c.ref} (${c.heRef}) on Super Daf.`);
          const path = `${dafUrl(c.ref)}/gems/${gem}`;
          page = { title, desc, path, type: 'article', body: gemBody(c, gem), jsonld: [
            { '@context': 'https://schema.org', '@type': 'Article', headline: gemTitle(c, gem), description: desc, inLanguage: 'en', url: SITE + path, about: `${c.ref} (Talmud Bavli)`, publisher: { '@type': 'Organization', name: 'AI Sefarim', url: SITE } },
            { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Super Daf', item: `${SITE}/daf` }, { '@type': 'ListItem', position: 2, name: c.ref, item: SITE + dafUrl(c.ref) }, { '@type': 'ListItem', position: 3, name: GEM_LABEL[gem], item: SITE + path }] },
          ] };
        } else {
          const path = dafUrl(c.ref);
          const desc = clip(`${c.ref} (${c.heRef}) sugya by sugya: ${(c.takeaways || []).join(' ')}`);
          page = { title: `${c.ref} (${c.heRef}) – Daf Yomi with Rashi, Tosafot & Rambam | Super Daf`, desc, path, body: dafBody(c), jsonld: [
            { '@context': 'https://schema.org', '@type': 'LearningResource', name: `${c.ref} – Super Daf`, description: desc, inLanguage: ['en', 'he'], url: SITE + path, learningResourceType: 'Daf Yomi study page', isAccessibleForFree: true, publisher: { '@type': 'Organization', name: 'AI Sefarim', url: SITE } },
            { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Super Daf', item: `${SITE}/daf` }, { '@type': 'ListItem', position: 2, name: c.ref, item: SITE + path }] },
          ] };
        }
      }
    } else {
      const index = await api('index');
      const items = index.items || [];
      page = book
        ? { title: `Masechet ${book} – Daf Yomi, sugya by sugya | Super Daf`, desc: `Every daf of Masechet ${book} on Super Daf: Gemara in Hebrew and English with Rashi, Tosafot, the Rambam and halacha. Free.`, path: `/daf/${bookSlug(book)}`, body: hubBody(items, book) }
        : { title: 'Super Daf – Daf Yomi, sugya by sugya, with Rashi, Tosafot & the Rambam', desc: 'Learn the daily daf sugya by sugya: Gemara in Hebrew and English with Rashi, Tosafot, the Rishonim, the Rambam and halacha woven in, plus Gems from the Daf. Free.', path: '/daf', body: hubBody(items, null) };
    }

    if (page) {
      html = setHead(html, page);
      html = html.replace('<div id="root"></div>', `<div id="root">${page.body}</div>`);
    }
  } catch (e) {
    console.error('dafpage', e);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
