import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, Sun, Moon, Minus, Plus, Search, Check, Scale, Link2, MessageSquareText, Send, Library, BookOpen, ExternalLink, X, Sparkles, ListTree, Maximize2, Minimize2 } from 'lucide-react';
import { RefText, plain, shortRef, workName } from './RefText';
import { TANACH_API, tanachPath, refFromTanachPath } from '../lib/tanach';
import { sefariaUrl } from '../lib/daf';

// Super Tanach: Mikraot Gedolot on steroids. A perek of Tanach as a real Chumash page; tap a pasuk for
// its PARDES (each layer grounded in a cited source), the voices of the commentators, where they argue,
// key words, connections, the full sources and a chavruta. All from Sefaria's links.

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const PREFS_KEY = 'super_tanach_prefs';
type Lang = 'both' | 'he' | 'en';
const readJson = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
const once = (t?: string) => { const seen = new Set<string>(); return String(t || '').replace(/\s*\[([^\[\]]{3,200})\]/g, (m, r) => (seen.has(r) ? '' : (seen.add(r), m))).replace(/\s+([.,;:])/g, '$1'); };

// 1 -> א, 15 -> טו, 16 -> טז, 23 -> כג
function heNum(n: number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'], tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'], hund = ['', 'ק', 'ר', 'ש', 'ת'];
  let s = hund[Math.floor(n / 100)] || ''; const r = n % 100;
  if (r === 15) return s + 'טו'; if (r === 16) return s + 'טז';
  return s + tens[Math.floor(r / 10)] + ones[r % 10];
}

const PARDES = [
  { key: 'peshat', he: 'פ', name: 'Peshat', sub: 'the plain meaning' },
  { key: 'remez', he: 'ר', name: 'Remez', sub: 'the allusion' },
  { key: 'derash', he: 'ד', name: 'Derash', sub: 'the Midrash' },
  { key: 'sod', he: 'ס', name: 'Sod', sub: 'the inner meaning' },
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */

export function SuperTanachPage({ initialRef, header, onExit }: { initialRef: string | null; header?: ReactNode; onExit: () => void }) {
  const [ref, setRef] = useState<string | null>(initialRef);
  useEffect(() => setRef(initialRef), [initialRef]);
  useEffect(() => { const onPop = () => setRef(refFromTanachPath(window.location.pathname)); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const open = (r: string | null) => { window.history.pushState({}, '', r ? tanachPath(r) : '/tanach'); setRef(r); window.scrollTo(0, 0); };
  return ref ? <Reader key={ref} perekRef={ref} onOpen={open} onBack={() => open(null)} /> : <Hub header={header} onOpen={open} onExit={onExit} />;
}

// ----------------------------------------------------------------------
// Hub

function Hub({ header, onOpen, onExit }: { header?: ReactNode; onOpen: (r: string) => void; onExit: () => void }) {
  const [week, setWeek] = useState<any>(null);
  const [books, setBooks] = useState<any>(null);
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [book, setBook] = useState<any>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    fetch(`${TANACH_API}/current`).then((r) => r.json()).then(setWeek).catch(() => {});
    fetch(`${TANACH_API}/books`).then((r) => r.json()).then(setBooks).catch(() => {});
    fetch(`${TANACH_API}/index`).then((r) => r.json()).then((d) => setReady(new Set((d.items || []).map((i: any) => i.ref)))).catch(() => {});
  }, []);
  const all = useMemo(() => (books?.sections || []).flatMap((s: any) => s.books), [books]);
  const hits = q.trim().length >= 2 ? all.filter((b: any) => (b.title + ' ' + b.heTitle).toLowerCase().includes(q.trim().toLowerCase())) : [];
  return (
    <div className="tn-hub">
      <style>{HUB_CSS}</style>
      {header}
      <section className="tn-hero">
        <button className="tn-exit" onClick={onExit}><ArrowLeft className="w-4 h-4" /> AI Sefarim</button>
        <p className="tn-kicker">AI Sefarim · תנ״ך</p>
        <h1>Super Tanach</h1>
        <p className="tn-lede">Mikraot Gedolot on steroids. Every pasuk with its <b>Peshat, Remez, Derash and Sod</b>, the voices of the commentators side by side, where they argue, and where the pasuk lives on in the Gemara, halacha and tefillah. All from Sefaria’s sources, every point cited.</p>
        <div className="tn-pardes-row">{PARDES.map((p) => <span key={p.key} className={`tn-pl tn-${p.key}`}><bdi>{p.he}</bdi>{p.name}</span>)}</div>
        {week?.parasha && (
          <div className="tn-week">
            <div className="tn-week-head"><small>This week’s parasha</small><b>Parashat {week.parasha.display}</b><bdi lang="he" dir="rtl">{week.parasha.heDisplay}</bdi></div>
            <div className="tn-week-perakim">{week.parasha.perakim.map((r: string) => <button key={r} onClick={() => onOpen(r)}>{r.replace(/^(.+) (\d+)$/, '$1 $2')}{ready.has(r) && <Check className="w-3.5 h-3.5" />}</button>)}</div>
            {week.haftarah && <button className="tn-haf" onClick={() => onOpen(week.haftarah.perakim[0])}><small>Haftarah</small>{week.haftarah.display}<ChevronRight className="w-4 h-4" /></button>}
          </div>
        )}
      </section>
      <section className="tn-browse">
        <div className="tn-search"><Search className="w-4 h-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a sefer: Genesis, Isaiah, Tehillim…" /></div>
        {hits.length > 0 && <div className="tn-books">{hits.map((b: any) => <BookBtn key={b.title} b={b} onClick={() => { setBook(b); setQ(''); }} />)}</div>}
        {book ? (
          <div>
            <button className="tn-back" onClick={() => setBook(null)}><ChevronLeft className="w-4 h-4" /> All sefarim</button>
            <h2 className="tn-bookname">{book.title} <bdi lang="he" dir="rtl">{book.heTitle}</bdi></h2>
            <div className="tn-perakim">{Array.from({ length: book.perakim || 0 }, (_, i) => i + 1).map((n) => { const r = `${book.title} ${n}`; return (
              <button key={n} className={ready.has(r) ? 'is-ready' : ''} onClick={() => onOpen(r)}><bdi lang="he" dir="rtl">{heNum(n)}</bdi><span>{n}</span>{ready.has(r) && <Check className="w-3.5 h-3.5" />}</button>); })}</div>
          </div>
        ) : !books ? <p className="tn-muted"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading…</p> : books.sections.map((s: any) => (
          <div key={s.section} className="tn-section">
            <h3><bdi lang="he" dir="rtl">{s.heSection}</bdi> {s.section}</h3>
            <div className="tn-books">{s.books.map((b: any) => <BookBtn key={b.title} b={b} onClick={() => setBook(b)} />)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
const BookBtn = ({ b, onClick }: { b: any; onClick: () => void }) => <button className="tn-book" onClick={onClick}><bdi lang="he" dir="rtl">{b.heTitle}</bdi><span>{b.title}</span><small>{b.perakim} perakim</small></button>;

// Reader: one pasuk at a time, full screen. The pasuk large in the middle, the commentators around it
// (Mikraot Gedolot), PARDES under it, and below everything Sefaria links to it, in Sefaria's categories.
// Every long source carries a one-line summary and its key line highlighted.

const CAT_HE: Record<string, string> = { Commentary: 'מפרשים', Remez: 'רמז', Targum: 'תרגום', 'Quoting Commentary': 'מפרשים מצטטים', Talmud: 'תלמוד', Midrash: 'מדרש', Halakhah: 'הלכה', Kabbalah: 'קבלה', Chasidut: 'חסידות', Musar: 'מוסר', 'Jewish Thought': 'מחשבת ישראל', Liturgy: 'תפילה', Tanakh: 'תנ״ך', Mishnah: 'משנה', Tosefta: 'תוספתא', Responsa: 'שו״ת', 'Second Temple': 'בית שני', Essay: 'מאמרים' };
const CAT_EN: Record<string, string> = { Commentary: 'Commentators', 'Quoting Commentary': 'Quoting commentaries', Halakhah: 'Halacha', Liturgy: 'Tefillah', Tanakh: 'Tanach', Essay: 'Essays' };
const catName = (c: string) => CAT_EN[c] || c;
const PARDES_CATS: Record<string, string[]> = { peshat: ['Commentary', 'Targum'], remez: ['Remez'], derash: ['Midrash', 'Talmud'], sod: ['Kabbalah', 'Chasidut'] };
const enc = encodeURIComponent;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const firstSentence = (t?: string) => { const s = plain(t).replace(/\s*\[[^\]]+\]/g, ''); const m = s.match(/^.{20,}?[.!?](\s|$)/); return (m ? m[0] : s).trim(); };

// a pasuk's library, one category at a time; summaries for its long sources are fetched (made once) as it is viewed
const libCache = new Map<string, any>();
function useLib(pref: string, cat: string, summarize: boolean) {
  const key = `${pref}|${cat}`;
  const [d, setD] = useState<any>(() => libCache.get(key) || null);
  useEffect(() => {
    let alive = true;
    let cur = libCache.get(key);
    const put = (x: any) => { cur = x; libCache.set(key, x); if (alive) setD(x); };
    setD(cur || null);
    (async () => {
      if (!cur) {
        try { put(await (await fetch(`${TANACH_API}/lib?ref=${enc(pref)}&cat=${enc(cat)}`)).json()); } catch { put({ error: 'Could not load the sources.' }); }
      }
      if (!summarize || !cur?.items || cur.cat !== cat) return;
      const todo = Array.from({ length: cur.chunks || 0 }, (_, k) => k).filter((k) => !cur.have?.[k]);
      const worker = async () => {
        for (let k = todo.shift(); k !== undefined && alive; k = todo.shift()) {
          for (let tries = 0; tries < 8 && alive; tries++) {
            try {
              const r = await (await fetch(`${TANACH_API}/sum?ref=${enc(pref)}&cat=${enc(cat)}&chunk=${k}`)).json();
              if (r.map) { const kk = k; put({ ...cur, have: cur.have.map((h: boolean, i: number) => (i === kk ? true : h)), items: cur.items.map((x: any) => (r.map[x.ref] ? { ...x, sum: r.map[x.ref] } : x)) }); break; }
              if (r.error) break;
            } catch { /* retry */ }
            await sleep(5000);
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    })();
    return () => { alive = false; };
  }, [key, summarize]); // eslint-disable-line react-hooks/exhaustive-deps
  return d;
}

// find a key line in the text, ignoring nikkud, te'amim and spacing
function findMark(text: string, mark: string, he: boolean): [number, number] | null {
  if (!he) { const i = text.indexOf(mark); return i < 0 ? null : [i, i + mark.length]; }
  const skip = (c: string) => /[֑-ׇ]/.test(c);
  let s = ''; const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (skip(c)) continue;
    if (/\s/.test(c)) { if (!s || s.endsWith(' ')) continue; s += ' '; at.push(i); continue; }
    s += c; at.push(i);
  }
  const m = mark.replace(/[֑-ׇ]/g, '').replace(/\s+/g, ' ').trim();
  const i = m ? s.indexOf(m) : -1;
  if (i < 0) return null;
  let end = at[i + m.length - 1] + 1;
  while (end < text.length && skip(text[end])) end++;
  return [at[i], end];
}
function Marked({ text, mark, he }: { text: string; mark?: string | null; he?: boolean }) {
  const r = mark ? findMark(text, mark, !!he) : null;
  if (!r) return <>{text}</>;
  return <>{text.slice(0, r[0])}<mark className="st-mark">{text.slice(r[0], r[1])}</mark>{text.slice(r[1])}</>;
}

function Clamp({ children, lines, className }: { children: ReactNode; lines: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (el && !open) setOver(el.scrollHeight > el.clientHeight + 4); }, [children, lines, open]);
  return (
    <div className={className}>
      <div ref={ref} className={open ? '' : 'st-clamp'} style={open ? undefined : { WebkitLineClamp: lines }}>{children}</div>
      {(over || open) && <button className="st-more" onClick={() => setOpen(!open)}>{open ? 'Less' : 'Read all'}</button>}
    </div>
  );
}

function Entry({ x, lang, voice, pending, lines = 6 }: { x: any; lang: Lang; voice?: string; pending?: boolean; lines?: number }) {
  const s = x.sum?.s || voice;
  const showHe = lang !== 'en' || !x.en, showEn = (lang !== 'he' || !x.he) && !!x.en;
  return (
    <div className="st-entry">
      {s ? <p className="st-sum"><Sparkles className="w-3.5 h-3.5" /><span>{plain(s)}</span></p> : x.long && pending ? <p className="st-sum is-pending"><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Summarizing…</span></p> : null}
      {showHe && x.he && <Clamp lines={lines} className="st-src-he"><p lang="he" dir="rtl"><Marked text={x.he} mark={x.sum?.kHe} he /></p></Clamp>}
      {showEn && <Clamp lines={showHe ? 3 : lines} className="st-src-en"><p><Marked text={x.en} mark={x.sum?.kEn} /></p></Clamp>}
      <a className="st-ref" href={x.url} target="_blank" rel="noopener noreferrer">{shortRef(x.ref)} <ExternalLink className="w-3 h-3" /></a>
    </div>
  );
}

const groupWorks = (items: any[]) => {
  const g: any[] = [];
  for (const x of items || []) { const last = g[g.length - 1]; if (last && last.work === x.work) last.items.push(x); else g.push({ work: x.work, heWork: x.heWork, items: [x] }); }
  return g;
};

function WorkCard({ g, lang, voices, pending, lines }: { g: any; lang: Lang; voices?: Record<string, string>; pending?: boolean; lines?: number }) {
  return (
    <article className="st-card">
      <header className="st-card-head">{g.heWork ? <bdi lang="he" dir="rtl">{g.heWork}</bdi> : <span />}<b>{workName(g.work)}</b></header>
      {g.items.map((x: any) => <Entry key={x.ref} x={x} lang={lang} voice={voices?.[x.ref]} pending={pending} lines={lines} />)}
    </article>
  );
}

function SourceList({ pref, cat, lang, summarize }: { pref: string; cat: string; lang: Lang; summarize: boolean }) {
  const d = useLib(pref, cat, summarize);
  const [shown, setShown] = useState(12);
  useEffect(() => setShown(12), [pref, cat]);
  if (!d) return <div className="st-list"><div className="st-shimmer" /><div className="st-shimmer" /></div>;
  if (d.error) return <p className="st-muted">{d.error}</p>;
  const groups = groupWorks(d.items);
  const pending = summarize && (d.have || []).some((h: boolean) => !h);
  return (
    <div className="st-list">
      {groups.slice(0, shown).map((g, i) => <WorkCard key={g.work + i} g={g} lang={lang} pending={pending} />)}
      {groups.length > shown && <button className="st-showmore" onClick={() => setShown(shown + 24)}>Show {Math.min(24, groups.length - shown)} more · {groups.length - shown} works left</button>}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="st-sheet-wrap" onClick={onClose}>
      <div className="st-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="st-sheet-head"><div className="st-sheet-title">{title}</div><button className="st-icon" onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button></div>
        <div className="st-sheet-body">{children}</div>
      </div>
    </div>
  );
}

type SheetState = null | { k: 'pardes'; layer: string } | { k: 'perek' } | { k: 'ask' };

function Reader({ perekRef, onOpen, onBack }: { perekRef: string; onOpen: (r: string) => void; onBack: () => void }) {
  const prefs = useMemo(() => readJson<any>(PREFS_KEY, {}), []);
  const [dark, setDark] = useState<boolean>(prefs.dark ?? true);
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [scale, setScale] = useState<number>(prefs.scale || 1);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ dark, lang, scale })); } catch { /* private */ } }, [dark, lang, scale]);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState<number>(() => Number(new URLSearchParams(window.location.search).get('p')) || 1);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useWide();

  useEffect(() => {
    let alive = true, stepping = false;
    const load = async () => {
      try {
        const d = await (await fetch(`${TANACH_API}/get?ref=${enc(perekRef)}`)).json();
        if (!alive) return;
        if (d.error) { setErr(d.error); return; }
        setData(d);
        if (d.status === 'building' && !stepping && !new URLSearchParams(window.location.search).has('nobuild')) { stepping = true; try { await fetch(`${TANACH_API}/step?ref=${enc(perekRef)}`); } catch { /* next round */ } stepping = false; if (alive) setTimeout(load, 400); }
      } catch { if (alive) setErr('Could not reach Super Tanach. Check your connection and try again.'); }
    };
    load(); return () => { alive = false; };
  }, [perekRef]);

  const count = data?.pesukim?.length || 0;
  const go = (m: number) => { if (m >= 1 && m <= count) { setN(m); rootRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); } };
  useEffect(() => { const u = new URL(window.location.href); u.searchParams.set('p', String(n)); window.history.replaceState({}, '', u); }, [n]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (sheet || /input|textarea/i.test((e.target as HTMLElement)?.tagName || '')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' && e.altKey) go(n + 1);
      if (e.key === 'ArrowLeft') go(n - 1);
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  });
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  useEffect(() => { document.getElementById(`st-dot-${n}`)?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [n, data]);
  const toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); };

  const [bookName, perekNum] = (() => { const m = perekRef.match(/^(.+) (\d+)$/); return m ? [m[1], Number(m[2])] : [perekRef, 0]; })();
  const p = data?.pesukim?.find((x: any) => x.n === n) || data?.pesukim?.[0];
  return (
    <div ref={rootRef} className={`st ${dark ? 'st-night' : 'st-paper'}`} style={{ ['--sc' as any]: scale }}>
      <style>{READER_CSS}{STUDY_CSS}</style>
      <header className="st-bar">
        <button onClick={onBack} className="st-icon" aria-label="All sefarim"><ArrowLeft className="w-5 h-5" /></button>
        <div className="st-title"><bdi lang="he" dir="rtl">{(data?.heRef || '').replace(/ [^ ]+$/, '')} {heNum(perekNum)}</bdi><small>{bookName} {perekNum}</small></div>
        <nav className="st-dots" aria-label="Pesukim">{(data?.pesukim || []).map((x: any) => (
          <button key={x.n} id={`st-dot-${x.n}`} className={`${x.n === p?.n ? 'on' : ''} ${x.notes ? 'built' : ''}`} onClick={() => go(x.n)} title={`Pasuk ${x.n}`}><bdi lang="he" dir="rtl">{heNum(x.n)}</bdi></button>
        ))}</nav>
        <div className="st-tools">
          {data?.overview && <button className="st-icon" onClick={() => setSheet({ k: 'perek' })} title="The perek: overview and review"><ListTree className="w-4 h-4" /></button>}
          <button className="st-icon" onClick={() => setSheet({ k: 'ask' })} title="Ask"><MessageSquareText className="w-4 h-4" /></button>
          <div className="tn-seg">{(['he', 'both', 'en'] as Lang[]).map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l === 'he' ? 'עב' : l === 'en' ? 'EN' : 'Both'}</button>)}</div>
          <button className="st-icon st-hide-sm" onClick={() => setScale((s) => Math.max(0.85, +(s - 0.08).toFixed(2)))} aria-label="Smaller"><Minus className="w-4 h-4" /></button>
          <button className="st-icon st-hide-sm" onClick={() => setScale((s) => Math.min(1.5, +(s + 0.08).toFixed(2)))} aria-label="Larger"><Plus className="w-4 h-4" /></button>
          <button className="st-icon" onClick={() => setDark(!dark)} aria-label="Light or dark">{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          <button className="st-icon st-hide-sm" onClick={toggleFull} aria-label="Full screen">{full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
        </div>
      </header>

      {err ? <div className="tn-note">{err}</div> : !data ? <div className="tn-note"><Loader2 className="w-6 h-6 animate-spin" /><p>Opening {perekRef}…</p></div> : data.status === 'unavailable' ? <div className="tn-note">{data.note}</div> : p && (
        <Pasuk key={p.ref} p={p} count={count} lang={lang} wide={wide} perekLabel={`${bookName} ${perekNum}`} onGo={go} onLayer={(layer) => setSheet({ k: 'pardes', layer })} />
      )}

      {data?.attribution && <p className="st-attr">{data.attribution}</p>}
      {data && (
        <nav className="st-pager">
          {data.prev ? <button onClick={() => onOpen(String(data.prev))}><ChevronLeft className="w-4 h-4" /> {data.prev}</button> : <span />}
          {data.next ? <button onClick={() => onOpen(String(data.next))}>{data.next} <ChevronRight className="w-4 h-4" /></button> : <span />}
        </nav>
      )}

      {sheet?.k === 'pardes' && p && <PardesSheet p={p} layer={sheet.layer} lang={lang} onClose={() => setSheet(null)} />}
      {sheet?.k === 'perek' && data?.overview && (
        <Sheet title={<><bdi lang="he" dir="rtl" className="st-sheet-he">{data.heRef}</bdi><span>The perek</span></>} onClose={() => setSheet(null)}>
          <Overview ov={data.overview} perekRef={perekRef} onPick={(m) => { setSheet(null); go(m); }} />
          {data.overview.review?.length > 0 && <Review items={data.overview.review} onPick={(m) => { setSheet(null); go(m); }} />}
        </Sheet>
      )}
      {sheet?.k === 'ask' && p && <Sheet title={<span>Ask about pasuk {p.n}</span>} onClose={() => setSheet(null)}><Ask perekRef={perekRef} n={p.n} /></Sheet>}
    </div>
  );
}

function Pasuk({ p, count, lang, wide, perekLabel, onGo, onLayer }: { p: any; count: number; lang: Lang; wide: boolean; perekLabel: string; onGo: (n: number) => void; onLayer: (l: string) => void }) {
  const notes = p.notes;
  const summarize = !!notes;
  const com = useLib(p.ref, 'Commentary', summarize);
  const cats: any[] = com?.cats || [];
  const catCount = (c: string) => Number(cats.find((x) => x.cat === c)?.count || 0);
  const voices = useMemo(() => Object.fromEntries((notes?.commentators || []).map((c: any) => [c.ref, c.point])), [notes]);
  const groups = groupWorks(com?.items).slice(0, 8);
  const pending = summarize && (com?.have || []).some((h: boolean) => !h);
  const card = (g: any, i: number) => <WorkCard key={g.work + i} g={g} lang={lang} voices={voices} pending={pending} lines={wide ? 9 : 7} />;
  const left = groups.filter((_, i) => i % 2 === 0), right = groups.filter((_, i) => i % 2 === 1);
  const libCats = cats.filter((c) => c.cat !== 'Commentary');
  const [cat, setCat] = useState<string | null>(null);
  const curCat = cat || (libCats.find((c) => c.cat === 'Quoting Commentary') || libCats[0])?.cat || null;
  const total = cats.reduce((a, c) => a + Number(c.count || 0), 0);

  const center = (
    <main className="st-center">
      <div className="st-num"><bdi lang="he" dir="rtl">{heNum(p.n)}</bdi><span>{perekLabel}:{p.n}</span></div>
      {notes?.headline && <p className="st-headline">{plain(notes.headline)}</p>}
      {lang !== 'en' && <p className="st-pasuk-he" lang="he" dir="rtl">{p.he}</p>}
      {lang !== 'he' && <p className="st-pasuk-en">{p.en}</p>}
      {notes?.gist && <p className="st-gist"><b>In short</b>{plain(notes.gist)}</p>}
      <div className="st-pardes">
        {PARDES.map((L) => {
          const v = notes?.pardes?.[L.key];
          const k = PARDES_CATS[L.key].reduce((a, c) => a + catCount(c), 0);
          return (
            <button key={L.key} className={`st-pd tn-${L.key}`} disabled={!v && !k} onClick={() => onLayer(L.key)}>
              <bdi lang="he" dir="rtl">{L.he}</bdi>
              <b>{L.name}</b><small>{L.sub}</small>
              <span>{v ? firstSentence(v.text) : k ? 'Open all the sources of this level.' : 'Nothing on Sefaria for this level here.'}</span>
              {k > 0 && <em>{k} {k === 1 ? 'source' : 'sources'} →</em>}
            </button>
          );
        })}
      </div>
      <div className="st-step">
        <button disabled={p.n <= 1} onClick={() => onGo(p.n - 1)}><ChevronLeft className="w-4 h-4" /> <bdi lang="he" dir="rtl">{p.n > 1 ? heNum(p.n - 1) : ''}</bdi></button>
        <button disabled={p.n >= count} onClick={() => onGo(p.n + 1)}><bdi lang="he" dir="rtl">{p.n < count ? heNum(p.n + 1) : ''}</bdi> <ChevronRight className="w-4 h-4" /></button>
      </div>
    </main>
  );

  return (
    <>
      <div className={`st-stage ${wide ? 'is-wide' : ''}`}>
        {wide && <aside className="st-col">{com ? left.map(card) : <><div className="st-shimmer" /><div className="st-shimmer" /></>}</aside>}
        {center}
        {wide && <aside className="st-col">{com ? right.map(card) : <><div className="st-shimmer" /><div className="st-shimmer" /></>}</aside>}
      </div>
      {!wide && (groups.length > 0 || !com) && (
        <section className="st-band st-band-tight">
          <div className="st-band-title"><h2>The commentators</h2><bdi lang="he" dir="rtl">מפרשים</bdi></div>
          <div className="st-swipe">{com ? groups.map(card) : <div className="st-shimmer" />}</div>
        </section>
      )}

      {notes && (notes.argue?.length > 0 || notes.words?.length > 0 || notes.connections?.length > 0) && (
        <section className="st-band">
          <div className="st-band-title"><h2>Where they meet and differ</h2></div>
          <div className="st-insights">
            {(notes.argue || []).map((a: any, i: number) => (
              <div key={i} className="tn-argue">
                <p className="tn-eyebrow"><Scale className="w-4 h-4" /> Where they argue</p>
                <p className="tn-q">{plain(a.question)}</p>
                <div className="tn-views">{(a.views || []).map((v: any, k: number) => <div key={k}><b>{workName(v.who, v.ref)}</b><p>{plain(v.view)}</p></div>)}</div>
              </div>
            ))}
            {notes.connections?.length > 0 && (
              <div className="st-card">
                <p className="tn-eyebrow"><Link2 className="w-4 h-4" /> Where this pasuk lives on</p>
                <div className="tn-conn">{notes.connections.map((c: any, i: number) => (
                  <a key={i} href={sefariaUrl(c.ref)} target="_blank" rel="noopener noreferrer"><span className={`tn-kind k-${String(c.kind).toLowerCase()}`}>{c.kind}</span><span><b>{shortRef(c.ref)}</b><RefText text={once(c.note)} /></span></a>
                ))}</div>
              </div>
            )}
            {notes.words?.length > 0 && <div className="st-card"><p className="tn-eyebrow">Key words</p><div className="tn-words">{notes.words.map((w: any, i: number) => <span key={i}><bdi lang="he" dir="rtl">{w.he}</bdi>{plain(w.gloss)}</span>)}</div></div>}
          </div>
        </section>
      )}

      {libCats.length > 0 && curCat && (
        <section className="st-band">
          <div className="st-band-title"><h2>Everything on this pasuk</h2><span className="st-total">{total} sources on Sefaria</span></div>
          <div className="st-cats" role="tablist">{cats.map((c) => (
            <button key={c.cat} role="tab" className={(c.cat === 'Commentary' ? cat === 'Commentary' : c.cat === curCat) ? 'on' : ''} onClick={() => setCat(c.cat)}>
              <bdi lang="he" dir="rtl">{CAT_HE[c.cat] || ''}</bdi><span>{catName(c.cat)} · {c.count}</span>
            </button>
          ))}</div>
          <SourceList pref={p.ref} cat={cat === 'Commentary' ? 'Commentary' : curCat} lang={lang} summarize={summarize} />
        </section>
      )}
    </>
  );
}

function PardesSheet({ p, layer, lang, onClose }: { p: any; layer: string; lang: Lang; onClose: () => void }) {
  const L = PARDES.find((x) => x.key === layer)!;
  const v = p.notes?.pardes?.[layer];
  const com = useLib(p.ref, 'Commentary', false);
  const present = PARDES_CATS[layer].filter((c) => (com?.cats || []).some((x: any) => x.cat === c));
  return (
    <Sheet onClose={onClose} title={<span className={`st-pd-title tn-${layer}`}><bdi lang="he" dir="rtl">{L.he}</bdi><span><b>{L.name}</b><small>{L.sub} · {p.ref}</small></span></span>}>
      {v ? <div className={`st-layer-ai tn-${layer}`}><RefText text={once(v.text)} /></div> : <p className="st-muted">No summary for this level on this pasuk; here is everything Sefaria links at this level.</p>}
      {!com ? <div className="st-shimmer" /> : present.map((c) => (
        <div key={c}>
          <p className="st-subhead"><bdi lang="he" dir="rtl">{CAT_HE[c]}</bdi> All the {catName(c).toLowerCase()} · {com.cats.find((x: any) => x.cat === c)?.count}</p>
          <SourceList pref={p.ref} cat={c} lang={lang} summarize={!!p.notes} />
        </div>
      ))}
    </Sheet>
  );
}

function useWide() {
  const q = '(min-width: 1100px)';
  const [w, setW] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return w;
}


function Overview({ ov, perekRef, onPick }: { ov: any; perekRef: string; onPick: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (n: number) => { onPick(n); document.getElementById(`p${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  return (
    <section className="tn-overview">
      <p className="tn-eyebrow">This perek</p>
      <p className="tn-intro">{plain(ov.intro)}</p>
      {ov.preview?.length > 0 && <ul className="tn-preview">{ov.preview.map((x: string, i: number) => <li key={i}><Check className="w-4 h-4" />{plain(x)}</li>)}</ul>}
      {open && (
        <>
          {ov.arc && <p className="tn-arc"><ListTree className="w-4 h-4" /><span><RefText text={once(ov.arc)} /></span></p>}
          {ov.threads?.length > 0 && <div className="tn-threads"><p className="tn-eyebrow"><Sparkles className="w-4 h-4" /> Threads through the perek</p>{ov.threads.map((t: any, i: number) => (
            <div key={i} className="tn-thread"><b>{plain(t.title)}</b><p><RefText text={once(t.text)} /></p>{t.pesukim?.length > 0 && <div className="tn-thread-p">{t.pesukim.map((n: number) => <button key={n} onClick={() => pick(n)}>{perekRef.replace(/^.+ (\d+)$/, '$1')}:{n}</button>)}</div>}</div>))}</div>}
          {ov.bigQuestions?.length > 0 && <div className="tn-bigq"><p className="tn-eyebrow"><Scale className="w-4 h-4" /> The big questions</p>{ov.bigQuestions.map((b: any, i: number) => <div key={i}><b>{plain(b.q)}</b><p><RefText text={once(b.how)} /></p></div>)}</div>}
          {ov.takeaways?.length > 0 && <ul className="tn-take">{ov.takeaways.map((t: string, i: number) => <li key={i}>{plain(t)}</li>)}</ul>}
        </>
      )}
      <button className="tn-more" onClick={() => setOpen(!open)}>{open ? 'Less' : 'The arc, threads and big questions'} {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
    </section>
  );
}

function Ask({ perekRef, n }: { perekRef: string; n: number }) {
  const [hist, setHist] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const send = async (text?: string) => {
    const question = (text ?? q).trim(); if (!question || busy) return;
    const next = [...hist, { role: 'user' as const, content: question }]; setHist(next); setQ(''); setBusy(true);
    try { const d = await (await fetch(`${TANACH_API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: perekRef, pasuk: n, question, history: hist }) })).json(); setHist([...next, { role: 'assistant', content: d.answer || d.error || 'No answer.' }]); }
    catch { setHist([...next, { role: 'assistant', content: 'Could not reach Super Tanach.' }]); }
    setBusy(false);
  };
  return (
    <div className="tn-ask">
      {!hist.length && <div className="tn-suggest">{['What is the main question here?', 'Explain the Sod simply', 'How do Rashi and Ramban differ?'].map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
      {hist.map((h, i) => <div key={i} className={`tn-msg ${h.role}`}>{h.role === 'assistant' ? h.content.split('\n').filter(Boolean).map((x, k) => <p key={k}><RefText text={once(x.replace(/^[-*]\s+/, '• '))} /></p>) : <p>{h.content}</p>}{h.role === 'assistant' && /Want more detail\?/.test(h.content) && i === hist.length - 1 && <button className="tn-moreq" onClick={() => send('Yes, more detail please')}>Yes, more detail</button>}</div>)}
      {busy && <p className="tn-muted"><Loader2 className="w-4 h-4 animate-spin inline" /> Thinking…</p>}
      <form onSubmit={(e) => { e.preventDefault(); send(); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask about pasuk ${n}…`} /><button disabled={busy || !q.trim()} aria-label="Send"><Send className="w-4 h-4" /></button></form>
    </div>
  );
}

function Review({ items, onPick }: { items: any[]; onPick: (n: number) => void }) {
  const [shown, setShown] = useState<Set<number>>(new Set());
  return (
    <section className="tn-review"><p className="tn-eyebrow">Review the perek</p>
      {items.map((x, i) => <div key={i} className="tn-rq"><p><b>{i + 1}.</b> {plain(x.q)}</p>{shown.has(i) ? <p className="tn-ra">{plain(x.a)}{x.n ? <button onClick={() => onPick(x.n)}> · pasuk {x.n}</button> : null}</p> : <button onClick={() => setShown(new Set([...shown, i]))}>Show answer</button>}</div>)}
    </section>
  );
}

// ----------------------------------------------------------------------
// styles

const HEF = HE_FONT, ENF = EN_FONT;
const HUB_CSS = `
.tn-hub { color:#e7e5e4; }
.tn-hero { position:relative; overflow:hidden; margin-bottom:1.2rem; padding:1.4rem 1.2rem 1.5rem; border-radius:28px; background:radial-gradient(110% 80% at 90% 0%, rgba(99,102,241,.35), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(217,119,6,.22), transparent 60%), linear-gradient(160deg,#141325,#0b0a14 75%); border:1px solid rgba(165,180,252,.18); }
.tn-hero::after { content:'תנ״ך'; position:absolute; right:-.05em; bottom:-.3em; font-family:${HEF}; font-size:9.5rem; color:rgba(199,210,254,.06); pointer-events:none; }
.tn-hero > * { position:relative; z-index:1; }
.tn-exit { display:inline-flex; align-items:center; gap:.35rem; font-size:.78rem; font-weight:700; color:#a5b4fc; margin-bottom:1rem; }
.tn-kicker { font-size:.72rem; letter-spacing:.2em; text-transform:uppercase; font-weight:800; color:#fbbf24; }
.tn-hero h1 { font-family:${ENF}; font-size:clamp(2.3rem,7vw,3.6rem); font-weight:700; color:#f5f3ff; line-height:1.05; margin:.3rem 0 .7rem; }
.tn-lede { color:#d4d4e8; line-height:1.6; max-width:720px; }
.tn-lede b { color:#fff; }
.tn-pardes-row { display:flex; flex-wrap:wrap; gap:.4rem; margin:1rem 0 0; }
.tn-pl { display:inline-flex; align-items:center; gap:.4rem; padding:.3rem .75rem .3rem .35rem; border-radius:999px; font-size:.8rem; font-weight:800; color:#fff; }
.tn-pl bdi { width:24px; height:24px; display:grid; place-items:center; border-radius:50%; background:rgba(255,255,255,.18); font-family:${HEF}; font-size:1rem; }
.tn-pl.tn-peshat { background:#3f3f46; } .tn-pl.tn-remez { background:#0f766e; } .tn-pl.tn-derash { background:#b45309; } .tn-pl.tn-sod { background:#4338ca; }
.tn-week { margin-top:1.3rem; padding:1rem; border-radius:20px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); max-width:620px; }
.tn-week-head { display:flex; flex-wrap:wrap; align-items:baseline; gap:.2rem .7rem; }
.tn-week-head small { width:100%; font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; color:#fbbf24; font-weight:800; }
.tn-week-head b { font-family:${ENF}; font-size:1.5rem; color:#fff; }
.tn-week-head bdi { font-family:${HEF}; font-size:1.4rem; color:#c7d2fe; }
.tn-week-perakim { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.7rem; }
.tn-week-perakim button { display:inline-flex; align-items:center; gap:.3rem; padding:.45rem .8rem; border-radius:999px; background:#4f46e5; color:#fff; font-weight:700; font-size:.85rem; }
.tn-haf { margin-top:.7rem; display:flex; align-items:center; gap:.5rem; width:100%; padding:.6rem .8rem; border-radius:14px; background:rgba(251,191,36,.12); color:#fde68a; font-weight:700; text-align:left; }
.tn-haf small { font-size:.68rem; letter-spacing:.12em; text-transform:uppercase; opacity:.8; }
.tn-haf svg { margin-left:auto; }
.tn-browse { padding:0 .2rem 3rem; }
.tn-search { display:flex; align-items:center; gap:.5rem; padding:.7rem 1rem; border-radius:14px; background:#16151f; border:1px solid #26243a; color:#a5a3c4; margin-bottom:1rem; }
.tn-search input { flex:1; background:transparent; outline:none; color:#fafaff; }
.tn-section h3 { display:flex; align-items:baseline; gap:.6rem; color:#e0e7ff; font-weight:800; font-size:1.1rem; margin:1.2rem 0 .6rem; }
.tn-section h3 bdi { font-family:${HEF}; font-size:1.5rem; color:#fbbf24; }
.tn-books { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:.55rem; }
.tn-book { display:flex; flex-direction:column; align-items:flex-start; padding:.75rem .85rem; border-radius:16px; background:#17161f; border:1px solid #26243a; text-align:left; transition:transform .15s,border-color .15s; }
.tn-book:hover { transform:translateY(-1px); border-color:#6366f1; }
.tn-book bdi { font-family:${HEF}; font-size:1.35rem; color:#c7d2fe; }
.tn-book span { color:#fafaff; font-weight:700; font-size:.9rem; }
.tn-book small { color:#8f8db0; font-size:.72rem; }
.tn-back { display:inline-flex; align-items:center; gap:.2rem; color:#a5b4fc; font-weight:700; font-size:.85rem; }
.tn-bookname { color:#f5f3ff; font-size:1.6rem; font-weight:800; margin:.4rem 0 1rem; display:flex; gap:.6rem; align-items:baseline; }
.tn-bookname bdi { font-family:${HEF}; color:#fbbf24; }
.tn-perakim { display:grid; grid-template-columns:repeat(auto-fill,minmax(68px,1fr)); gap:.5rem; }
.tn-perakim button { position:relative; display:flex; flex-direction:column; align-items:center; padding:.6rem .3rem; border-radius:14px; background:#17161f; border:1px solid #26243a; }
.tn-perakim bdi { font-family:${HEF}; font-size:1.45rem; color:#f5f3ff; line-height:1.1; }
.tn-perakim span { font-size:.7rem; color:#8f8db0; }
.tn-perakim .is-ready { border-color:rgba(165,180,252,.6); background:linear-gradient(160deg,#211f3a,#17161f); }
.tn-perakim svg { position:absolute; top:.35rem; right:.35rem; color:#a5b4fc; }
.tn-muted { color:#8f8db0; font-size:.9rem; }
`;

const READER_CSS = `
.tn { --he:${HEF}; --en:${ENF}; min-height:100vh; border-radius:24px; font-size:calc(16px * var(--sc,1)); }
.tn-paper { --bg:#fbf7ee; --card:#fffdf8; --ink:#1c1917; --soft:#57534e; --mute:#8a817a; --line:rgba(87,83,78,.14); --acc:#4338ca; --chip:rgba(67,56,202,.07); background:var(--bg); color:var(--ink); }
.tn-dark { --bg:#0f0e17; --card:#17161f; --ink:#f1f0fb; --soft:#cfcde3; --mute:#9895b8; --line:rgba(199,210,254,.12); --acc:#a5b4fc; --chip:rgba(165,180,252,.10); background:var(--bg); color:var(--ink); }
.tn-bar { position:sticky; top:0; z-index:30; display:flex; align-items:center; gap:.35rem; padding:.55rem .8rem; background:color-mix(in srgb, var(--bg) 90%, transparent); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); border-radius:24px 24px 0 0; }
.tn-icon { width:36px; height:36px; flex:none; display:grid; place-items:center; border-radius:999px; color:var(--soft); }
.tn-icon:hover { background:var(--chip); color:var(--ink); }
.tn-bar-title { flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.15; }
.tn-bar-title b { font-family:var(--en); font-size:1.05rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tn-bar-title bdi { font-family:var(--he); color:var(--acc); font-size:.95rem; }
.tn-seg { display:flex; padding:2px; border-radius:999px; background:var(--chip); }
.tn-seg button { padding:.25rem .6rem; border-radius:999px; font-size:.75rem; font-weight:800; color:var(--soft); }
.tn-seg button.on { background:var(--acc); color:var(--bg); }
.tn-note { max-width:620px; margin:4rem auto; padding:0 1rem; text-align:center; color:var(--soft); display:flex; flex-direction:column; align-items:center; gap:.8rem; }
.tn-layout { max-width:880px; margin:0 auto; padding:1rem .9rem 3rem; }
.tn-layout.is-wide { max-width:1380px; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,520px); gap:1.6rem; align-items:start; }
.tn-side { position:sticky; top:64px; max-height:calc(100vh - 80px); overflow-y:auto; scrollbar-width:thin; padding-bottom:1rem; }
.tn-side-empty { margin-top:3rem; text-align:center; }
.tn-title { text-align:center; margin:1rem 0 1.4rem; }
.tn-title-he { display:block; font-family:var(--he); font-size:2.6em; line-height:1.1; }
.tn-title-he span { display:inline-block; margin-right:.35em; color:var(--acc); }
.tn-title p { margin-top:.3rem; font-size:.78rem; letter-spacing:.18em; text-transform:uppercase; font-weight:800; color:var(--mute); }
.tn-building { display:flex; flex-direction:column; gap:.5rem; padding:.8rem 1rem; border-radius:16px; background:var(--chip); margin-bottom:1rem; font-size:.88rem; color:var(--soft); }
.tn-progress { height:5px; border-radius:99px; background:var(--line); overflow:hidden; }
.tn-progress i { display:block; height:100%; background:var(--acc); transition:width .4s; }
.tn-eyebrow { display:flex; align-items:center; gap:.35rem; font-size:.68rem; letter-spacing:.16em; text-transform:uppercase; font-weight:800; color:var(--acc); margin-bottom:.45rem; }
.tn-overview { padding:1.1rem 1.2rem; border-radius:22px; background:var(--card); border:1px solid var(--line); margin-bottom:1.4rem; }
.tn-intro { font-family:var(--en); font-size:1.08em; line-height:1.65; }
.tn-preview { display:grid; gap:.3rem; margin-top:.8rem; }
.tn-preview li { display:flex; gap:.5rem; color:var(--soft); }
.tn-preview svg { color:var(--acc); flex:none; margin-top:.2rem; }
.tn-arc { display:flex; gap:.5rem; margin-top:1rem; color:var(--soft); line-height:1.6; }
.tn-arc svg { color:var(--acc); flex:none; margin-top:.25rem; }
.tn-threads, .tn-bigq { margin-top:1.1rem; display:grid; gap:.6rem; }
.tn-thread, .tn-bigq > div { padding:.8rem .95rem; border-radius:16px; background:var(--chip); }
.tn-thread p, .tn-bigq p { margin-top:.25rem; line-height:1.55; color:var(--soft); font-size:.95em; }
.tn-thread-p { display:flex; flex-wrap:wrap; gap:.3rem; margin-top:.5rem; }
.tn-thread-p button { padding:.1rem .55rem; border-radius:999px; border:1px solid var(--line); font-size:.75rem; font-weight:700; color:var(--acc); }
.tn-take { margin-top:1rem; display:grid; gap:.3rem; padding-left:1.1rem; list-style:disc; color:var(--soft); }
.tn-more { margin-top:.9rem; display:inline-flex; align-items:center; gap:.3rem; font-size:.82rem; font-weight:800; color:var(--acc); }
.tn-pesukim { display:grid; gap:.2rem; }
.tn-pasuk { scroll-margin-top:80px; border-radius:18px; transition:background .2s; }
.tn-pasuk-btn { width:100%; display:grid; grid-template-columns:2.4rem minmax(0,1fr) auto; gap:.7rem; align-items:start; padding:.85rem .7rem; text-align:left; border-radius:18px; }
.tn-pasuk-btn:hover { background:var(--chip); }
.tn-pasuk.is-sel > .tn-pasuk-btn { background:var(--card); box-shadow:0 0 0 1px var(--line), 0 14px 30px -24px rgba(67,56,202,.6); }
.tn-pasuk.is-pending { opacity:.85; }
.tn-pnum { display:flex; flex-direction:column; align-items:center; padding-top:.3rem; }
.tn-pnum bdi { font-family:var(--he); font-size:1.15em; color:var(--acc); font-weight:700; }
.tn-pnum small { font-size:.65rem; color:var(--mute); }
.tn-ptext { display:grid; gap:.45rem; min-width:0; }
.tn-he { font-family:var(--he); font-size:1.55em; line-height:1.9; text-align:right; }
.tn-en { font-family:var(--en); font-size:1em; line-height:1.65; color:var(--soft); }
.tn-gist { font-size:.84em; color:var(--mute); line-height:1.5; border-left:2px solid var(--line); padding-left:.6rem; }
.tn-dots { display:flex; flex-direction:column; gap:.2rem; padding-top:.4rem; }
.tn-dots i { width:20px; height:20px; display:grid; place-items:center; border-radius:6px; font-style:normal; font-family:var(--he); font-size:.75rem; color:var(--mute); background:var(--chip); opacity:.45; }
.tn-dots i.on { opacity:1; color:#fff; }
.tn-dots i.on.tn-peshat { background:#52525b; } .tn-dots i.on.tn-remez { background:#0f766e; } .tn-dots i.on.tn-derash { background:#b45309; } .tn-dots i.on.tn-sod { background:#4338ca; }
.tn-inline { padding:0 .3rem .8rem; }
.tn-panel { padding:1rem 1.05rem 1.1rem; border-radius:22px; background:var(--card); border:1px solid var(--line); box-shadow:0 24px 50px -36px rgba(30,27,75,.6); }
.tn-panel-head { display:flex; align-items:flex-start; gap:.3rem; }
.tn-panel-head > div { flex:1; min-width:0; }
.tn-panel-head h3 { font-family:var(--en); font-size:1.3em; font-weight:700; line-height:1.2; }
.tn-tabs { display:flex; gap:.35rem; margin:.8rem 0 1rem; overflow-x:auto; scrollbar-width:none; }
.tn-tabs button { flex:none; display:inline-flex; align-items:center; gap:.35rem; padding:.4rem .8rem; border-radius:999px; font-size:.83rem; font-weight:700; color:var(--soft); border:1px solid var(--line); }
.tn-tabs button.on { background:var(--ink); color:var(--bg); border-color:transparent; }
.tn-tabs small { opacity:.6; }
.tn-learn { display:grid; grid-template-columns:minmax(0,1fr); gap:1.2rem; }
.tn-learn > *, .tn-panel, .tn-inline, .tn-text, .tn-side { min-width:0; }
.tn-pardes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.55rem; }
.tn-tile { position:relative; overflow:hidden; display:flex; flex-direction:column; gap:.35rem; min-height:132px; padding:.8rem .85rem; border-radius:18px; text-align:left; color:#fff; transition:transform .15s; }
.tn-tile:not(:disabled):hover { transform:translateY(-1px); }
.tn-tile.is-open { grid-column:1 / -1; min-height:0; }
.tn-tile-he { position:absolute; right:.15em; top:-.18em; font-family:var(--he); font-size:4.6rem; line-height:1; opacity:.16; pointer-events:none; }
.tn-tile-name { font-weight:800; font-size:.95rem; display:flex; flex-direction:column; }
.tn-tile-name small { font-weight:600; font-size:.7rem; opacity:.75; letter-spacing:.04em; }
.tn-tile-text { font-size:.88em; line-height:1.5; opacity:.95; font-family:var(--en); }
.tn-tile.is-open .tn-tile-text { font-size:.98em; line-height:1.65; }
.tn-tile.tn-peshat { background:linear-gradient(150deg,#52525b,#27272a); }
.tn-tile.tn-remez { background:linear-gradient(150deg,#0f766e,#134e4a); }
.tn-tile.tn-derash { background:linear-gradient(150deg,#b45309,#7c2d12); }
.tn-tile.tn-sod { background:radial-gradient(120% 90% at 100% 0%, rgba(167,139,250,.55), transparent 60%), linear-gradient(150deg,#4338ca,#1e1b4b); }
.tn-tile.is-empty { background:var(--chip); color:var(--mute); }
.tn-tile .sd-cite { background:rgba(255,255,255,.18) !important; color:#fff !important; }
.tn-voices { display:grid; gap:.55rem; }
.tn-count { padding:0 .45rem; border-radius:999px; background:var(--chip); color:var(--acc); letter-spacing:0; }
.tn-voice { padding:.75rem .85rem; border-radius:16px; border:1px solid var(--line); }
.tn-voice-who { display:flex; align-items:baseline; gap:.5rem; }
.tn-voice-who b { color:var(--ink); }
.tn-voice-who bdi { font-family:var(--he); color:var(--acc); font-size:1.05rem; }
.tn-voice p { margin-top:.25rem; line-height:1.55; color:var(--soft); font-size:.95em; }
.tn-voice a { display:inline-block; margin-top:.35rem; font-size:.72rem; font-weight:700; color:var(--mute); text-decoration:none; }
.tn-argue { padding:.9rem 1rem; border-radius:18px; background:var(--chip); }
.tn-q { font-family:var(--en); font-weight:700; font-size:1.05em; margin-bottom:.6rem; }
.tn-views { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:.5rem; }
.tn-views > div { padding:.65rem .75rem; border-radius:14px; background:var(--card); }
.tn-views b { color:var(--acc); }
.tn-views p { margin-top:.2rem; font-size:.93em; line-height:1.5; }
.tn-words { display:flex; flex-wrap:wrap; gap:.4rem; }
.tn-words span { display:inline-flex; align-items:baseline; gap:.45rem; padding:.35rem .7rem; border-radius:12px; background:var(--chip); font-size:.86em; color:var(--soft); }
.tn-words bdi { font-family:var(--he); font-size:1.15em; font-weight:700; color:var(--ink); }
.tn-conn { display:grid; gap:.45rem; }
.tn-conn a { display:flex; gap:.6rem; align-items:flex-start; padding:.6rem .7rem; border-radius:14px; border:1px solid var(--line); text-decoration:none; color:var(--soft); font-size:.92em; line-height:1.5; }
.tn-conn b { display:block; color:var(--ink); font-size:.85em; }
.tn-kind { flex:none; padding:.1rem .5rem; border-radius:999px; font-size:.68rem; font-weight:800; color:#fff; background:#6b7280; margin-top:.15rem; }
.k-gemara { background:#7c3aed; } .k-halacha { background:#1d4ed8; } .k-tefillah { background:#0e7490; } .k-pasuk { background:#4338ca; } .k-midrash { background:#b45309; } .k-chasidut { background:#be185d; } .k-musar { background:#15803d; }
.tn-sources { display:grid; gap:.45rem; }
.tn-sgroup { border:1px solid var(--line); border-radius:16px; overflow:hidden; }
.tn-sgroup > button { display:flex; align-items:center; gap:.5rem; width:100%; padding:.65rem .85rem; font-weight:800; text-align:left; }
.tn-sgroup > button small { margin-left:auto; color:var(--mute); }
.tn-sgroup.is-open > button { background:var(--chip); }
.tn-src { padding:.75rem .9rem; border-top:1px solid var(--line); }
.tn-src a { font-size:.8rem; color:var(--acc); text-decoration:none; }
.tn-src a bdi { font-family:var(--he); }
.tn-src-he { font-family:var(--he); font-size:1.12em; line-height:1.75; text-align:right; margin-top:.3rem; }
.tn-src-en { font-family:var(--en); line-height:1.6; color:var(--soft); margin-top:.3rem; font-size:.93em; }
.tn-ask { display:grid; gap:.65rem; }
.tn-suggest { display:flex; flex-wrap:wrap; gap:.4rem; }
.tn-suggest button, .tn-moreq { padding:.4rem .8rem; border-radius:999px; background:var(--chip); font-size:.84rem; font-weight:700; color:var(--acc); }
.tn-msg { padding:.75rem .9rem; border-radius:16px; line-height:1.6; }
.tn-msg.user { justify-self:end; max-width:85%; background:var(--ink); color:var(--bg); }
.tn-msg.assistant { background:var(--chip); }
.tn-msg p + p { margin-top:.4rem; }
.tn-ask form { display:flex; gap:.4rem; }
.tn-ask input { flex:1; padding:.6rem .9rem; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--ink); outline:none; }
.tn-ask form button { width:42px; border-radius:999px; background:var(--acc); color:var(--bg); display:grid; place-items:center; }
.tn-ask form button:disabled { opacity:.4; }
.tn-review { margin-top:1.4rem; padding:1.1rem 1.2rem; border-radius:22px; background:var(--card); border:1px solid var(--line); }
.tn-rq { padding:.65rem 0; border-top:1px dashed var(--line); }
.tn-rq:first-of-type { border-top:0; }
.tn-rq > button, .tn-ra button { font-size:.82rem; font-weight:800; color:var(--acc); }
.tn-ra { margin-top:.3rem; color:var(--soft); line-height:1.55; }
.tn-pager { display:flex; justify-content:space-between; gap:.6rem; margin:1.6rem 0 .8rem; }
.tn-pager button { display:inline-flex; align-items:center; gap:.3rem; padding:.55rem 1rem; border-radius:999px; border:1px solid var(--line); font-weight:700; color:var(--soft); }
.tn-attr { font-size:.74rem; color:var(--mute); text-align:center; line-height:1.5; }
.tn-muted { color:var(--mute); }
.tn .sd-cite { display:inline-block; margin-left:.3em; padding:0 .45em; border-radius:9999px; font-family:system-ui,sans-serif; font-size:.68em; font-weight:700; line-height:1.6; vertical-align:.12em; text-decoration:none; white-space:nowrap; color:var(--acc); background:var(--chip); }
@media (max-width: 760px) {
  .tn-voices { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:.6rem; margin:0 -1.05rem; padding:0 1.05rem .3rem; scrollbar-width:none; }
  .tn-voices::-webkit-scrollbar { display:none; }
  .tn-voice { flex:0 0 82%; scroll-snap-align:start; background:var(--card); }
}
@media (max-width: 560px) { .tn { border-radius:0; } .tn-bar { border-radius:0; } .tn-seg { display:none; } .tn-pasuk-btn { grid-template-columns:1.9rem minmax(0,1fr) auto; gap:.5rem; padding:.75rem .35rem; } .tn-he { font-size:1.45em; } .tn-tile { min-height:118px; } }
`;

const STUDY_CSS = `
.st { --he:${HEF}; --en:${ENF}; position:fixed; inset:0; z-index:80; overflow-y:auto; overflow-x:hidden; font-size:calc(16px * var(--sc,1)); color:var(--ink); scrollbar-width:thin; padding-bottom:2rem; }
.st-night { --bg:#0c0b12; --card:#15131e; --chip:rgba(232,194,122,.08); --ink:#f3ede0; --soft:#d2cbbb; --mute:#938b7c; --acc:#e8c27a; --gold:#e8c27a; --line:rgba(232,194,122,.14); --mark:rgba(232,194,122,.28); --markink:#fff6df;
  background:radial-gradient(1100px 620px at 50% -12%, rgba(232,194,122,.11), transparent 62%), radial-gradient(900px 700px at 105% 105%, rgba(79,70,229,.12), transparent 60%), #0c0b12; }
.st-paper { --bg:#f6f0e1; --card:#fffcf3; --chip:rgba(138,90,11,.07); --ink:#1d1812; --soft:#463d30; --mute:#857860; --acc:#8a5a0b; --gold:#8a5a0b; --line:rgba(120,90,40,.17); --mark:rgba(250,204,21,.45); --markink:inherit;
  background:radial-gradient(1100px 620px at 50% -12%, rgba(255,255,255,.8), transparent 62%), #f3ecdb; }
.st-bar { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:.5rem; padding:.5rem 1rem; background:color-mix(in srgb, var(--bg) 80%, transparent); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
.st-title { display:flex; flex-direction:column; align-items:flex-start; line-height:1.1; flex:none; }
.st-title bdi { font-family:var(--he); font-size:1.3rem; color:var(--gold); }
.st-title small { font-size:.66rem; letter-spacing:.16em; text-transform:uppercase; color:var(--mute); font-weight:800; }
.st-dots { flex:1; min-width:0; display:flex; gap:.3rem; overflow-x:auto; scrollbar-width:none; padding:.15rem .4rem; justify-content:safe center; }
.st-dots::-webkit-scrollbar { display:none; }
.st-dots button { flex:none; width:32px; height:32px; border-radius:50%; font-family:var(--he); font-size:.9rem; color:var(--mute); border:1px solid var(--line); transition:all .15s; }
.st-dots button.built { color:var(--ink); border-color:color-mix(in srgb, var(--gold) 50%, transparent); }
.st-dots button.on { background:var(--gold); color:var(--bg); border-color:transparent; font-weight:700; box-shadow:0 0 0 4px color-mix(in srgb, var(--gold) 22%, transparent); }
.st-tools { display:flex; align-items:center; gap:.1rem; flex:none; }
.st-icon { width:36px; height:36px; flex:none; display:grid; place-items:center; border-radius:999px; color:var(--soft); }
.st-icon:hover { background:var(--chip); color:var(--ink); }
.st .tn-seg { display:flex; }
.st .tn-seg button.on { background:var(--gold); color:var(--bg); }

.st-stage { max-width:1680px; margin:0 auto; padding:2.4rem 1.6rem 1rem; display:grid; grid-template-columns:minmax(0,1fr); gap:1.8rem; }
.st-stage.is-wide { grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr); align-items:start; }
.st-stage.is-wide .st-center { position:sticky; top:84px; }
.st-center { text-align:center; min-width:0; }
.st-num { display:flex; flex-direction:column; align-items:center; gap:.3rem; margin-bottom:.8rem; }
.st-num bdi { font-family:var(--he); font-size:3.4rem; line-height:1; color:var(--gold); text-shadow:0 0 44px color-mix(in srgb, var(--gold) 45%, transparent); }
.st-num span { font-size:.7rem; letter-spacing:.22em; text-transform:uppercase; color:var(--mute); font-weight:800; }
.st-headline { font-family:var(--en); font-style:italic; color:var(--soft); font-size:1.08em; margin-bottom:1.1rem; }
.st-pasuk-he { font-family:var(--he); font-size:clamp(1.85rem, 2.75vw, 3.25rem); line-height:1.8; font-weight:500; color:var(--ink); text-wrap:balance; }
.st-pasuk-en { font-family:var(--en); font-size:clamp(1.02rem, 1.25vw, 1.25rem); line-height:1.65; color:var(--soft); margin:1rem auto 0; max-width:38em; text-wrap:pretty; }
.st-gist { margin:1.3rem auto 0; max-width:36em; padding:.75rem 1rem; border-radius:16px; background:var(--chip); border:1px solid var(--line); color:var(--soft); font-size:.92em; line-height:1.55; }
.st-gist b { display:block; color:var(--gold); font-size:.64rem; letter-spacing:.2em; text-transform:uppercase; margin-bottom:.15rem; }
.st-pardes { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.55rem; margin-top:1.5rem; text-align:left; }
.st-pd { position:relative; overflow:hidden; display:flex; flex-direction:column; min-width:0; padding:.75rem .8rem .75rem; min-height:150px; border-radius:18px; color:#fff; transition:transform .18s, box-shadow .18s; box-shadow:inset 0 1px 0 rgba(255,255,255,.12); }
.st-pd:not(:disabled):hover { transform:translateY(-3px); box-shadow:0 22px 34px -20px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.12); }
.st-pd:disabled { opacity:.3; cursor:default; }
.st-pd > bdi { position:absolute; right:.08em; bottom:-.28em; font-family:var(--he); font-size:5.2rem; line-height:1; opacity:.2; pointer-events:none; }
.st-pd b { font-size:1rem; position:relative; }
.st-pd small { font-size:.66rem; opacity:.78; letter-spacing:.04em; position:relative; }
.st-pd span { position:relative; margin-top:.45rem; font-family:var(--en); font-size:.8rem; line-height:1.42; opacity:.94; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
.st-pd em { position:relative; margin-top:auto; padding-top:.5rem; font-style:normal; font-size:.66rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; opacity:.9; }
.tn-peshat.st-pd, .st-layer-ai.tn-peshat { background:linear-gradient(150deg,#5b5b66,#26262c); }
.tn-remez.st-pd, .st-layer-ai.tn-remez { background:linear-gradient(150deg,#0f8a80,#123f3c); }
.tn-derash.st-pd, .st-layer-ai.tn-derash { background:linear-gradient(150deg,#c2620e,#6b240d); }
.tn-sod.st-pd, .st-layer-ai.tn-sod { background:radial-gradient(120% 90% at 100% 0%, rgba(167,139,250,.55), transparent 60%), linear-gradient(150deg,#4a3fd6,#1b1846); }
.st-step { display:flex; justify-content:space-between; margin-top:1.3rem; }
.st-step button { display:inline-flex; align-items:center; gap:.35rem; min-width:64px; justify-content:center; padding:.45rem .9rem; border-radius:999px; border:1px solid var(--line); color:var(--soft); font-family:var(--he); font-size:1rem; }
.st-step button:not(:disabled):hover { background:var(--chip); color:var(--ink); }
.st-step button:disabled { opacity:.25; }

.st-col { display:grid; gap:.9rem; min-width:0; }
.st-card { min-width:0; padding:1rem 1.1rem; border-radius:20px; background:var(--card); border:1px solid var(--line); text-align:left; box-shadow:0 22px 44px -36px rgba(0,0,0,.75); }
.st-card-head { display:flex; align-items:baseline; justify-content:space-between; gap:.5rem; margin-bottom:.6rem; padding-bottom:.45rem; border-bottom:1px solid var(--line); }
.st-card-head bdi { font-family:var(--he); font-size:1.4rem; color:var(--gold); font-weight:700; line-height:1.2; }
.st-card-head b { font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; color:var(--mute); text-align:right; }
.st-entry + .st-entry { margin-top:.85rem; padding-top:.85rem; border-top:1px dashed var(--line); }
.st-sum { display:flex; gap:.45rem; align-items:flex-start; font-family:var(--en); font-size:.93em; line-height:1.5; color:var(--ink); font-weight:600; margin-bottom:.55rem; padding:.5rem .65rem; border-radius:12px; background:var(--chip); }
.st-sum svg { flex:none; margin-top:.25rem; color:var(--gold); }
.st-sum.is-pending { color:var(--mute); font-weight:500; font-style:italic; background:transparent; padding:0; }
.st-src-he p { font-family:var(--he); font-size:1.13em; line-height:1.8; color:var(--soft); text-align:justify; }
.st-src-en p { font-family:var(--en); font-size:.9em; line-height:1.6; color:var(--mute); margin-top:.4rem; }
.st-clamp { display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; }
.st-more { font-size:.72rem; font-weight:800; color:var(--gold); margin-top:.25rem; letter-spacing:.04em; }
.st-mark { background:linear-gradient(transparent 8%, var(--mark) 8%, var(--mark) 94%, transparent 94%); color:var(--markink); border-radius:3px; padding:0 .08em; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
.st-ref { display:inline-flex; align-items:center; gap:.25rem; margin-top:.45rem; font-size:.68rem; font-weight:700; color:var(--mute); text-decoration:none; }
.st-ref:hover { color:var(--gold); }

.st-band { max-width:1240px; margin:2.4rem auto 0; padding:0 1.3rem; }
.st-band-tight { margin-top:1.4rem; padding:0; }
.st-band-tight .st-band-title { padding:0 1rem; }
.st-band-title { display:flex; align-items:baseline; flex-wrap:wrap; gap:.4rem .8rem; margin-bottom:1rem; }
.st-band-title h2 { font-family:var(--en); font-size:1.55rem; font-weight:600; color:var(--ink); }
.st-band-title bdi { font-family:var(--he); font-size:1.4rem; color:var(--gold); }
.st-total { font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; font-weight:800; color:var(--mute); }
.st-swipe { display:flex; gap:.7rem; overflow-x:auto; scroll-snap-type:x mandatory; padding:0 1rem .5rem; scrollbar-width:none; align-items:flex-start; }
.st-swipe::-webkit-scrollbar { display:none; }
.st-swipe > .st-card, .st-swipe > .st-shimmer { flex:0 0 86%; max-width:440px; scroll-snap-align:center; }
.st-insights { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr)); gap:.9rem; align-items:start; }
.st .tn-argue { background:var(--card); border:1px solid var(--line); }
.st .tn-views > div { background:var(--chip); }
.st-cats { display:flex; gap:.45rem; overflow-x:auto; scrollbar-width:none; padding-bottom:.3rem; margin-bottom:1.1rem; }
.st-cats::-webkit-scrollbar { display:none; }
.st-cats button { flex:none; display:flex; flex-direction:column; align-items:flex-start; gap:.05rem; padding:.5rem .85rem; border-radius:14px; border:1px solid var(--line); background:var(--card); color:var(--soft); text-align:left; transition:all .15s; }
.st-cats button:hover { border-color:var(--gold); }
.st-cats bdi { font-family:var(--he); font-size:1.1rem; color:var(--gold); line-height:1.2; }
.st-cats span { font-size:.72rem; font-weight:700; white-space:nowrap; }
.st-cats button.on { background:var(--gold); border-color:transparent; }
.st-cats button.on bdi, .st-cats button.on span { color:var(--bg); }
.st-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr)); gap:.9rem; align-items:start; }
.st-showmore { grid-column:1 / -1; justify-self:center; padding:.6rem 1.2rem; border-radius:999px; border:1px solid var(--line); color:var(--gold); font-weight:800; font-size:.85rem; }
.st-shimmer { min-height:150px; border-radius:20px; background:linear-gradient(100deg, var(--chip) 30%, var(--line) 50%, var(--chip) 70%); background-size:220% 100%; animation:stsh 1.5s linear infinite; }
@keyframes stsh { from { background-position:120% 0; } to { background-position:-120% 0; } }
.st-muted { color:var(--mute); font-size:.92rem; }
.st-attr { max-width:900px; margin:3rem auto 0; padding:0 1.2rem; text-align:center; font-size:.72rem; color:var(--mute); line-height:1.5; }
.st-pager { max-width:900px; margin:1rem auto 0; padding:0 1.2rem; display:flex; justify-content:space-between; }
.st-pager button { display:inline-flex; align-items:center; gap:.3rem; padding:.5rem .9rem; border-radius:999px; border:1px solid var(--line); color:var(--soft); font-weight:700; font-size:.85rem; }

.st-sheet-wrap { position:fixed; inset:0; z-index:90; display:flex; justify-content:flex-end; background:rgba(6,5,12,.55); backdrop-filter:blur(3px); animation:stfade .2s ease-out; }
.st-sheet { width:min(680px,100%); height:100%; overflow-y:auto; background:var(--bg); border-left:1px solid var(--line); animation:stin .26s cubic-bezier(.2,.8,.2,1); scrollbar-width:thin; }
.st-night .st-sheet { background:#100f17; }
.st-sheet-head { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:.6rem; padding:.9rem 1rem .9rem 1.2rem; background:color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); }
.st-sheet-title { flex:1; min-width:0; display:flex; align-items:center; gap:.7rem; font-weight:800; }
.st-sheet-he { font-family:var(--he); font-size:1.4rem; color:var(--gold); }
.st-sheet-body { padding:1.1rem 1.2rem 3rem; display:grid; gap:1.1rem; }
.st-sheet .st-list { grid-template-columns:minmax(0,1fr); }
.st-sheet .tn-overview { background:var(--card); }
.st-pd-title { display:flex; align-items:center; gap:.7rem; background:none !important; }
.st-pd-title > bdi { width:46px; height:46px; display:grid; place-items:center; border-radius:14px; font-family:var(--he); font-size:1.8rem; color:#fff; }
.st-pd-title.tn-peshat > bdi { background:linear-gradient(150deg,#5b5b66,#26262c); } .st-pd-title.tn-remez > bdi { background:linear-gradient(150deg,#0f8a80,#123f3c); }
.st-pd-title.tn-derash > bdi { background:linear-gradient(150deg,#c2620e,#6b240d); } .st-pd-title.tn-sod > bdi { background:linear-gradient(150deg,#4a3fd6,#1b1846); }
.st-pd-title > span { display:flex; flex-direction:column; line-height:1.2; }
.st-pd-title b { font-family:var(--en); font-size:1.3rem; color:var(--ink); }
.st-pd-title small { font-size:.72rem; font-weight:600; color:var(--mute); }
.st-layer-ai { padding:1.1rem 1.2rem; border-radius:20px; color:#fff; font-family:var(--en); font-size:1.02em; line-height:1.7; }
.st-layer-ai .sd-cite { background:rgba(255,255,255,.18) !important; color:#fff !important; }
.st-subhead { display:flex; align-items:baseline; gap:.5rem; margin:.4rem 0 .7rem; font-weight:800; font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:var(--mute); }
.st-subhead bdi { font-family:var(--he); font-size:1.25rem; letter-spacing:0; color:var(--gold); text-transform:none; }
@keyframes stfade { from { opacity:0; } }
@keyframes stin { from { transform:translateX(40px); opacity:.4; } }
@keyframes stup { from { transform:translateY(60px); opacity:.4; } }

@media (max-width: 760px) {
  .st-bar { flex-wrap:wrap; padding:.45rem .55rem .35rem; gap:.25rem .35rem; }
  .st-title { flex:1; }
  .st-dots { order:3; flex:0 0 100%; justify-content:flex-start; padding:.1rem 0 .15rem; }
  .st-hide-sm { display:none; }
  .st-stage { padding:1.5rem 1.05rem .5rem; gap:1rem; }
  .st-num bdi { font-size:2.8rem; }
  .st-pasuk-he { font-size:calc(1.85rem * var(--sc,1)); line-height:1.75; }
  .st-pardes { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .st-pd { min-height:136px; }
  .st-band { padding:0 1rem; margin-top:1.8rem; }
  .st-band-tight { padding:0; }
  .st-band-title h2 { font-size:1.3rem; }
  .st-sheet-wrap { align-items:flex-end; }
  .st-sheet { height:92vh; border-left:0; border-radius:24px 24px 0 0; animation:stup .26s cubic-bezier(.2,.8,.2,1); }
}
`;
