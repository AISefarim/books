import { workName } from '../components/RefText';
import { gistText } from './daf';
// Builds a single self-contained HTML file of a Super Daf page: opens in any
// browser offline, prints cleanly to PDF. Everything is inlined - no network.

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (ref: string, book: string) => String(ref || '').replace(book + ' ', '');

// **bold** -> <b>, [ref] -> small cite
function md(s: unknown) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]{3,120}\d[^\]]*)\]/g, '<span class="cite">$1</span>');
}

// Davidson HTML: keep bold (the Gemara's words) vs plain (elucidation).
function davidson(html: string | undefined, text: string) {
  const src = html && /<b>/i.test(html) ? html : `<b>${text}</b>`;
  return src.replace(/<(?!\/?(b|i|strong|em)\b)[^>]+>/gi, '').replace(/<(\/?)strong>/gi, '<$1b>').replace(/<(\/?)em>/gi, '<$1i>');
}

export function buildDafHtml(daf: any): string {
  const kind: Record<string, string> = { mishnah: 'משנה · Mishnah', gemara: 'גמרא · Gemara', topic: 'סוגיא · New topic', continued: 'המשך · Continued' };
  const parts: string[] = [];
  parts.push(`<header><p class="eyebrow">Super Daf · AI Sefarim</p><h1><span lang="he" dir="rtl">${esc(daf.heRef)}</span> · ${esc(daf.ref)}</h1><p class="ded">Super Daf is dedicated to Carol Serouya, the best mother and wife</p></header>`);
  if (daf.summary?.preview?.length) parts.push(`<section class="box"><h3>On this daf we'll learn</h3><ol>${daf.summary.preview.map((x: string) => `<li>${esc(x)}</li>`).join('')}</ol></section>`);

  daf.sugyot.forEach((sg: any, si: number) => {
    const b = sg.built || {};
    const syn = b.synthesis && !b.synthesis._error ? b.synthesis : null;
    const mes = b.mesivta && !b.mesivta._error ? b.mesivta : null;
    const hal = ((b.halacha?.items || []) as any[]).filter((x) => x.rambam || x.shulchanArukh || x.rema);
    if (si > 0) parts.push(`<div class="divider">❖</div>`);
    parts.push(`<section class="sugya"><p class="kind">${esc(kind[sg.kind] || sg.kind)} · ${esc(short(sg.from, daf.book))}–${esc(short(sg.to, daf.book))}</p>`);
    if (syn?.tldr) parts.push(`<p class="tldr"><b>In brief</b> ${esc(syn.tldr)}</p>`);

    sg.segments.forEach((idx: number) => {
      const s = daf.segments[idx];
      const step = syn?.steps?.find((st: any) => st.refs?.[0] === s.ref);
      const m = mes?.segments?.find((x: any) => x.ref === s.ref);
      const core = (b.core || []).filter((c: any) => c.anchor === s.ref);
      const h = hal.filter((x) => (x.refs || []).includes(s.ref));
      parts.push(`<article>`);
      if (step) parts.push(`<p class="step">${esc(step.headline)}</p>`);
      parts.push(`<p class="ref">${esc(short(s.ref, daf.book))}</p><p class="he" lang="he" dir="rtl">${esc(s.he)}</p>`);
      if (m?.units?.length) {
        parts.push(`<table class="inter">${m.units.map((u: any) => `<tr><td class="he" lang="he" dir="rtl">${esc(u.he)}</td><td>${u.en ? md(u.en).replace(/<b>/g, '<b>') : `<b>${esc(u.literal)}</b> <span class="el">${esc(u.elucidation || '')}</span>`}${(u.notes || []).map((n: number) => `<sup>${n}</sup>`).join('')}</td></tr>`).join('')}</table>`);
      } else {
        parts.push(`<p class="en">${davidson(s.enHtml, esc(s.en))}</p>`);
      }
      core.forEach((c: any) => parts.push(`<p class="comm"><b>${esc(c.title)}</b> — ${esc(gistText(c.title, c.gist))}</p><div class="rashi" lang="he" dir="rtl">${esc(c.he)}</div>${c.en ? `<div class="cen">${md(c.en)}</div>` : ''}`));
      h.forEach((x) => parts.push(`<div class="hal"><b>Halacha · ${esc(x.issue)}</b>${[['Rambam', x.rambam], ['Shulchan Arukh', x.shulchanArukh], ['Rema', x.rema]].filter(([, r]) => r).map(([w, r]: any) => `<p><b>${w}:</b> ${md(r.short || r.ruling)} <span class="cite">${esc(r.ref)}</span></p>`).join('')}</div>`));
      if (m?.notes?.length) parts.push(`<div class="notes">${m.notes.map((n: any) => `<p><sup>${n.n}</sup> <b>${esc(workName(n.source, n.ref))}</b> — ${md(n.point)} <span class="cite">${esc(n.ref)}</span></p>`).join('')}</div>`);
      parts.push(`</article>`);
    });

    if (syn?.rambam) parts.push(`<div class="rambam"><b>The Rambam</b><p>${md(syn.rambam.reading)}</p>${(syn.rambam.commentators || []).map((c: any) => `<p><b>${esc(workName(c.source, c.ref))}:</b> ${md(c.point)} <span class="cite">${esc(c.ref)}</span></p>`).join('')}</div>`);
    if (syn?.bigPicture) parts.push(`<p class="big"><b>Big picture.</b> ${esc(syn.bigPicture)}</p>`);
    const lesson = daf.summary?.sugyaLessons?.[sg.index];
    if (lesson) parts.push(`<p class="lesson"><b>What we learned</b> ${esc(lesson)}</p>`);
    parts.push(`</section>`);
  });

  if (daf.summary?.takeaways?.length) parts.push(`<section class="box take"><h3>Take away from this daf</h3><ul>${daf.summary.takeaways.map((x: string) => `<li>${esc(x)}</li>`).join('')}</ul></section>`);
  parts.push(`<footer>${esc(daf.attribution)}<br>Saved from aisefarim.com/daf on ${new Date().toLocaleDateString()}.</footer>`);

  const body = parts.join('\n').replace(/(<span class="cite">[^<]+<\/span>)\.? ?\1/g, '$1');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(daf.ref)} · Super Daf</title><style>
  body{margin:0;background:#f7f2e7;color:#1c1917;font:17px/1.65 Georgia,'Source Serif 4',serif}
  main{max-width:760px;margin:0 auto;padding:28px 18px 60px}
  header{text-align:center;margin-bottom:18px}.eyebrow{font:800 11px/1 system-ui;letter-spacing:.2em;text-transform:uppercase;color:#4338ca}
  h1{font:800 28px/1.2 system-ui;margin:6px 0}.ded{font-style:italic;color:#78716c;font-size:13px}
  .he{font-family:'Frank Ruhl Libre','David',serif;font-size:24px;line-height:1.8;text-align:right}
  .rashi{font-family:'Noto Rashi Hebrew','David',serif;font-size:17px;text-align:right;background:#efe6d3;padding:4px 10px 6px;border-radius:0 0 10px 10px;margin-top:-10px}
  .box{background:#fff;border:1px solid #e3d8c1;border-radius:14px;padding:12px 16px;margin:14px 0}.box h3{margin:0 0 6px;font:800 11px system-ui;letter-spacing:.18em;text-transform:uppercase;color:#4338ca}
  .take{background:#ecfdf5;border-color:#a7f3d0}.take h3{color:#047857}
  .kind{font:800 12px system-ui;text-transform:uppercase;letter-spacing:.12em;color:#4338ca}.tldr{background:#fff;border:1px solid #e3d8c1;border-radius:12px;padding:8px 12px}
  .divider{text-align:center;color:#a8a29e;margin:28px 0;border-top:2px solid #e3d8c1;line-height:0}.divider{padding-top:0}
  article{margin:18px 0;padding-bottom:10px;border-bottom:1px dashed #e3d8c1}.ref{font:800 11px system-ui;color:#a8a29e;margin:0}
  .step{text-align:center;font:800 14px system-ui;color:#4338ca;margin:4px 0}
  .inter{width:100%;border-collapse:collapse;font-size:15px}.inter td{vertical-align:top;padding:4px 8px;border-top:1px solid #efe6d3}.inter td.he{font-size:18px;width:40%}
  .el,.en span{opacity:.7}.en b,.inter b{font-weight:700}sup{color:#4338ca;font:800 10px system-ui}
  .comm{background:#efe6d3;border-radius:10px 10px 0 0;padding:8px 10px;font-size:14px;margin-bottom:0}.cen{color:#57534e;font-size:14px;background:#efe6d3;padding:0 10px 8px;border-radius:0 0 10px 10px;margin-bottom:10px}
  .hal{border-left:4px solid #d97706;background:#fef3c7;border-radius:8px;padding:8px 12px;font-size:14px;margin:8px 0}.hal p{margin:2px 0}
  .notes{font-size:14px;background:#fff;border:1px solid #e3d8c1;border-radius:10px;padding:6px 12px;margin-top:8px}.notes p{margin:6px 0}
  .rambam{border:2px solid #f59e0b;background:#fffbeb;border-radius:14px;padding:10px 14px;font-size:15px;margin:14px 0}
  .big{font-size:15px}.lesson{background:#4f46e5;color:#fff;border-radius:14px;padding:10px 14px}
  .cite{font:600 11px system-ui;color:#4f46e5}footer{margin-top:30px;font:12px system-ui;color:#a8a29e;text-align:center}
  @page{size:Letter;margin:.6in .6in .7in;@bottom-center{content:"Super Daf · ${esc(daf.ref)} · AI Sefarim  —  " counter(page);font:8pt system-ui;color:#777}}
  @media print{
   *{-webkit-print-color-adjust:economy;print-color-adjust:economy}
   html,body{background:#fff!important;color:#000}
   body{font:10pt/1.38 Georgia,'Source Serif 4',serif}
   main{max-width:none;padding:0}
   header{margin-bottom:8pt}h1{font-size:17pt}.eyebrow{font-size:7.5pt}.ded{font-size:8.5pt}
   .he{font-size:13pt;line-height:1.55;color:#000}
   .inter td.he{font-size:11.5pt;width:38%}
   .inter{font-size:9.5pt}.inter td{padding:1.5pt 5pt;border-top:.5pt solid #ccc}
   .rashi{font-size:10.5pt;background:none;padding:0 0 1pt;margin:0;border-radius:0}
   .box,.tldr,.notes,.hal,.rambam{background:none!important;border-radius:0}
   .box{border:.75pt solid #999;padding:6pt 9pt;margin:8pt 0}
   .box h3,.kind,.step,.eyebrow,.cite,sup{color:#000!important}
   .take{border-color:#999}
   .kind{font-size:8pt;border-bottom:1pt solid #000;padding-bottom:2pt;margin-top:14pt;break-after:avoid}
   .tldr{border:0;border-left:2.5pt solid #000;padding:2pt 8pt;font-size:9.5pt;margin:6pt 0;break-inside:avoid}
   .divider{margin:12pt 0;border-top:.75pt solid #999}
   article{margin:8pt 0;padding-bottom:4pt;border-bottom:.5pt dotted #aaa;break-inside:auto}
   .step{font-size:10pt;margin:2pt 0;break-after:avoid}.ref{font-size:7.5pt;color:#555;break-after:avoid}
   .comm{background:none;border-top:.5pt solid #bbb;border-radius:0;padding:4pt 0 1pt;font-size:9.5pt;margin-top:4pt;break-after:avoid}
   .cen{background:none;color:#222;font-size:9.5pt;padding:0 0 4pt;margin:0 0 4pt;border-radius:0}
   .hal{border-left:2pt solid #000;padding:3pt 8pt;font-size:9.5pt;margin:5pt 0}
   .notes{border:0;border-top:.5pt solid #bbb;padding:3pt 0;font-size:9pt;margin-top:4pt}
   .rambam{border:.75pt solid #000;padding:5pt 9pt;font-size:9.5pt;margin:8pt 0}
   .big{font-size:9.5pt}
   .lesson{background:none;color:#000;border:.75pt solid #000;border-radius:0;padding:4pt 9pt;font-size:9.5pt;break-inside:avoid}
   .cite{font-size:7.5pt;color:#444!important;font-weight:400}
   footer{font-size:7.5pt;margin-top:12pt;color:#555}
   tr,.he,.rashi,.hal,.lesson,.tldr,p{orphans:3;widows:3}tr{break-inside:avoid}
  }
  </style></head><body><main>${body}</main></body></html>`;
}

export function downloadDaf(daf: any) {
  const blob = new Blob([buildDafHtml(daf)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Super Daf - ${daf.ref}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
