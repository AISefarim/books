import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, Sun, Moon, Minus, Plus, Search, Check, Scale, Link2, MessageSquareText, Send, Library, BookOpen, ExternalLink, X, Sparkles, ListTree } from 'lucide-react';
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

// ----------------------------------------------------------------------
// Reader

function Reader({ perekRef, onOpen, onBack }: { perekRef: string; onOpen: (r: string) => void; onBack: () => void }) {
  const prefs = useMemo(() => readJson<any>(PREFS_KEY, {}), []);
  const [dark, setDark] = useState<boolean>(!!prefs.dark);
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [scale, setScale] = useState<number>(prefs.scale || 1);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ dark, lang, scale })); } catch { /* private */ } }, [dark, lang, scale]);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const wide = useWide();

  useEffect(() => {
    let alive = true, stepping = false;
    const load = async () => {
      try {
        const d = await (await fetch(`${TANACH_API}/get?ref=${encodeURIComponent(perekRef)}`)).json();
        if (!alive) return;
        if (d.error) { setErr(d.error); return; }
        setData(d);
        if (d.status === 'building' && !stepping && !new URLSearchParams(window.location.search).has('nobuild')) { stepping = true; try { await fetch(`${TANACH_API}/step?ref=${encodeURIComponent(perekRef)}`); } catch { /* next round */ } stepping = false; if (alive) setTimeout(load, 400); }
      } catch { if (alive) setErr('Could not reach Super Tanach. Check your connection and try again.'); }
    };
    load(); return () => { alive = false; };
  }, [perekRef]);
  // open the first built pasuk on a wide screen
  useEffect(() => { if (wide && sel === null && data?.pesukim?.some((p: any) => p.notes)) setSel(data.pesukim.find((p: any) => p.notes).n); }, [wide, data, sel]);

  const [bookName, perekNum] = (() => { const m = perekRef.match(/^(.+) (\d+)$/); return m ? [m[1], Number(m[2])] : [perekRef, 0]; })();
  const selP = data?.pesukim?.find((p: any) => p.n === sel);
  return (
    <div className={`tn ${dark ? 'tn-dark' : 'tn-paper'}`} style={{ ['--sc' as any]: scale }}>
      <style>{READER_CSS}</style>
      <header className="tn-bar">
        <button onClick={onBack} className="tn-icon" aria-label="All sefarim"><ArrowLeft className="w-5 h-5" /></button>
        <div className="tn-bar-title"><b>{bookName} {perekNum}</b>{data?.heRef && <bdi lang="he" dir="rtl">{data.heRef}</bdi>}</div>
        <div className="tn-seg">{(['he', 'both', 'en'] as Lang[]).map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l === 'he' ? 'עב' : l === 'en' ? 'EN' : 'Both'}</button>)}</div>
        <button className="tn-icon" onClick={() => setScale((s) => Math.max(0.85, +(s - 0.08).toFixed(2)))} aria-label="Smaller"><Minus className="w-4 h-4" /></button>
        <button className="tn-icon" onClick={() => setScale((s) => Math.min(1.5, +(s + 0.08).toFixed(2)))} aria-label="Larger"><Plus className="w-4 h-4" /></button>
        <button className="tn-icon" onClick={() => setDark(!dark)} aria-label="Light or dark">{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
      </header>

      {err ? <div className="tn-note">{err}</div> : !data ? <div className="tn-note"><Loader2 className="w-6 h-6 animate-spin" /><p>Opening {perekRef}…</p></div> : data.status === 'unavailable' ? <div className="tn-note">{data.note}</div> : (
        <div className={`tn-layout ${wide ? 'is-wide' : ''}`}>
          <main className="tn-text">
            <div className="tn-title">
              <bdi lang="he" dir="rtl" className="tn-title-he">{(data.heRef || '').replace(/ [^ ]+$/, '')}<span>{heNum(perekNum)}</span></bdi>
              <p>{bookName} · Perek {perekNum}</p>
            </div>
            {data.status === 'building' && <div className="tn-building"><span><b>Preparing this perek</b> · {data.done} of {data.total}. Each pasuk opens as soon as it is ready; afterwards it is instant for everyone.</span><div className="tn-progress"><i style={{ width: `${Math.round((100 * data.done) / Math.max(1, data.total))}%` }} /></div></div>}
            {data.overview && <Overview ov={data.overview} perekRef={perekRef} onPick={setSel} />}
            <ol className="tn-pesukim">
              {data.pesukim.map((p: any) => (
                <li key={p.n} id={`p${p.n}`} className={`tn-pasuk ${sel === p.n ? 'is-sel' : ''} ${p.notes ? '' : 'is-pending'}`}>
                  <button className="tn-pasuk-btn" onClick={() => setSel(sel === p.n && !wide ? null : p.n)} aria-expanded={sel === p.n}>
                    <span className="tn-pnum"><bdi lang="he" dir="rtl">{heNum(p.n)}</bdi><small>{p.n}</small></span>
                    <span className={`tn-ptext tn-ptext-${lang}`}>
                      {lang !== 'en' && <span lang="he" dir="rtl" className="tn-he">{p.he}</span>}
                      {lang !== 'he' && <span className="tn-en">{p.en}</span>}
                      {p.notes?.gist && <span className="tn-gist">{plain(p.notes.gist)}</span>}
                    </span>
                    {p.notes && <span className="tn-dots" title="PARDES layers for this pasuk">{PARDES.map((L) => <i key={L.key} className={`tn-${L.key} ${p.notes.pardes?.[L.key] ? 'on' : ''}`}>{L.he}</i>)}</span>}
                  </button>
                  {!wide && sel === p.n && <div className="tn-inline"><Panel p={p} perekRef={perekRef} onClose={() => setSel(null)} /></div>}
                </li>
              ))}
            </ol>
            {data.overview?.review?.length > 0 && <Review items={data.overview.review} onPick={setSel} />}
            <nav className="tn-pager">
              {data.prev ? <button onClick={() => onOpen(String(data.prev))}><ChevronLeft className="w-4 h-4" /> {data.prev}</button> : <span />}
              {data.next ? <button onClick={() => onOpen(String(data.next))}>{data.next} <ChevronRight className="w-4 h-4" /></button> : <span />}
            </nav>
            <p className="tn-attr">{data.attribution}</p>
          </main>
          {wide && <aside className="tn-side">{selP ? <Panel p={selP} perekRef={perekRef} /> : <p className="tn-muted tn-side-empty">Tap a pasuk to open its Mikraot Gedolot.</p>}</aside>}
        </div>
      )}
    </div>
  );
}

function useWide() {
  const q = '(min-width: 1080px)';
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

function Panel({ p, perekRef, onClose }: { p: any; perekRef: string; onClose?: () => void }) {
  const n = p.notes;
  const [tab, setTab] = useState<'learn' | 'sources' | 'ask'>('learn');
  const [layer, setLayer] = useState<string | null>(null);
  useEffect(() => { setTab('learn'); setLayer(null); }, [p.ref]);
  if (!n) return <div className="tn-panel"><p className="tn-muted"><Loader2 className="w-4 h-4 animate-spin inline" /> This pasuk is being prepared…</p></div>;
  const total: number = p.counts ? (Object.values(p.counts) as any[]).reduce((a: number, b: any) => a + Number(b || 0), 0) : 0;
  return (
    <div className="tn-panel">
      <div className="tn-panel-head">
        <div><p className="tn-eyebrow">{p.ref}</p><h3>{plain(n.headline || '')}</h3></div>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="tn-icon" title="On Sefaria"><ExternalLink className="w-4 h-4" /></a>
        {onClose && <button className="tn-icon" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>}
      </div>
      <div className="tn-tabs">
        <button className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}><BookOpen className="w-4 h-4" /> Learn</button>
        <button className={tab === 'sources' ? 'on' : ''} onClick={() => setTab('sources')}><Library className="w-4 h-4" /> Sources {total > 0 && <small>{total}</small>}</button>
        <button className={tab === 'ask' ? 'on' : ''} onClick={() => setTab('ask')}><MessageSquareText className="w-4 h-4" /> Ask</button>
      </div>
      {tab === 'learn' && (
        <div className="tn-learn">
          <div className="tn-pardes">
            {PARDES.map((L) => { const v = n.pardes?.[L.key]; return (
              <button key={L.key} className={`tn-tile tn-${L.key} ${v ? '' : 'is-empty'} ${layer === L.key ? 'is-open' : ''}`} disabled={!v} onClick={() => setLayer(layer === L.key ? null : L.key)}>
                <bdi className="tn-tile-he" lang="he" dir="rtl">{L.he}</bdi>
                <span className="tn-tile-name">{L.name}<small>{L.sub}</small></span>
                <span className="tn-tile-text">{v ? (layer === L.key ? <RefText text={once(v.text)} /> : <>{plain(v.text).replace(/\s*\[[^\]]+\]/g, '').slice(0, 150)}{plain(v.text).length > 150 ? '…' : ''}</>) : 'No source on Sefaria for this level here.'}</span>
              </button>); })}
          </div>

          {n.commentators?.length > 0 && (
            <div className="tn-block">
              <p className="tn-eyebrow">The voices <span className="tn-count">{n.commentators.length}</span></p>
              <div className="tn-voices">{n.commentators.map((c: any, i: number) => {
                const src = Object.values(p.sources || {}).flat().find((x: any) => x.ref === c.ref) as any;
                return <div key={i} className="tn-voice"><div className="tn-voice-who"><b>{workName(c.who, c.ref)}</b>{src?.heTitle && <bdi lang="he" dir="rtl">{src.heTitle}</bdi>}</div><p><RefText text={once(c.point)} /></p><a href={sefariaUrl(c.ref)} target="_blank" rel="noopener noreferrer">{shortRef(c.ref)}</a></div>;
              })}</div>
            </div>
          )}

          {n.argue?.length > 0 && n.argue.map((a: any, i: number) => (
            <div key={i} className="tn-block tn-argue">
              <p className="tn-eyebrow"><Scale className="w-4 h-4" /> Where they argue</p>
              <p className="tn-q">{plain(a.question)}</p>
              <div className="tn-views">{(a.views || []).map((v: any, k: number) => <div key={k}><b>{workName(v.who, v.ref)}</b><p>{plain(v.view)}</p></div>)}</div>
            </div>
          ))}

          {n.words?.length > 0 && <div className="tn-words">{n.words.map((w: any, i: number) => <span key={i}><bdi lang="he" dir="rtl">{w.he}</bdi>{plain(w.gloss)}</span>)}</div>}

          {n.connections?.length > 0 && (
            <div className="tn-block">
              <p className="tn-eyebrow"><Link2 className="w-4 h-4" /> Where this pasuk lives on</p>
              <div className="tn-conn">{n.connections.map((c: any, i: number) => (
                <a key={i} href={sefariaUrl(c.ref)} target="_blank" rel="noopener noreferrer"><span className={`tn-kind k-${String(c.kind).toLowerCase()}`}>{c.kind}</span><span><b>{shortRef(c.ref)}</b><RefText text={once(c.note)} /></span></a>
              ))}</div>
            </div>
          )}
        </div>
      )}
      {tab === 'sources' && <Sources p={p} />}
      {tab === 'ask' && <Ask perekRef={perekRef} n={p.n} />}
    </div>
  );
}

const SRC_LABEL: [string, string][] = [['peshat', 'Commentators'], ['targum', 'Targum'], ['remez', 'Remez'], ['midrash', 'Midrash'], ['sod', 'Zohar & Kabbalah'], ['chasidut', 'Chasidut'], ['gemara', 'Gemara & Mishnah'], ['halacha', 'Halacha'], ['tefillah', 'Tefillah'], ['tanach', 'Other pesukim'], ['thought', 'Jewish thought & Musar']];
function Sources({ p }: { p: any }) {
  const groups = SRC_LABEL.filter(([k]) => (p.sources?.[k] || []).length);
  const [open, setOpen] = useState<string | null>(null);
  if (!groups.length) return <p className="tn-muted">No sources are linked to this pasuk on Sefaria.</p>;
  return (
    <div className="tn-sources">{groups.map(([k, label]) => (
      <div key={k} className={`tn-sgroup ${open === k ? 'is-open' : ''}`}>
        <button onClick={() => setOpen(open === k ? null : k)}><span>{label}</span><small>{Number(p.counts?.[k] || 0) > p.sources[k].length ? `${p.sources[k].length} of ${Number(p.counts[k])}` : p.sources[k].length}</small>{open === k ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        {open === k && p.sources[k].map((s: any) => (
          <div key={s.ref} className="tn-src"><a href={s.url} target="_blank" rel="noopener noreferrer"><b>{s.title}</b>{s.heTitle && <bdi lang="he" dir="rtl"> {s.heTitle}</bdi>} · {shortRef(s.ref)}</a>{s.he && <p lang="he" dir="rtl" className="tn-src-he">{s.he}</p>}{s.en && <p className="tn-src-en">{s.en}</p>}</div>
        ))}
      </div>
    ))}</div>
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
