import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Sun, Moon, Minus, Plus, BookOpen, Scale, Sparkles, Landmark, Link2, MessageSquareText, Send, ExternalLink, ChevronDown, ChevronUp, Library, ListTree, Check, CalendarDays, Search } from 'lucide-react';
import { RefText, plain, shortRef, workName } from './RefText';
import { MISHNAH_API, mishnahPath, refFromMishnahPath } from '../lib/mishnah';
import { sefariaUrl } from '../lib/daf';

// Super Mishnah: a perek of Mishnah with plain explanation, phrase-by-phrase notes from the
// classic commentators, the machloket, the Rambam (where Sefaria links him) with his nosei kelim,
// where the Gemara and Tosefta take it up, a perek overview and review - all from Sefaria sources.

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const PREFS_KEY = 'super_mishnah_prefs';
type Surface = 'paper' | 'dark';
type Lang = 'both' | 'he' | 'en';
// Each source cited once per paragraph (the notes cite every sentence), and no stray space before punctuation.
const once = (t?: string) => { const seen = new Set<string>(); return String(t || '').replace(/\s*\[([^\[\]]{3,200})\]/g, (m, r) => (seen.has(r) ? '' : (seen.add(r), m))).replace(/\s+([.,;:])/g, '$1'); };
const readJson = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Perek = any;

// ----------------------------------------------------------------------

export function SuperMishnahPage({ initialRef, header, onExit }: { initialRef: string | null; header?: ReactNode; onExit: () => void }) {
  const [ref, setRef] = useState<string | null>(initialRef);
  useEffect(() => setRef(initialRef), [initialRef]);
  useEffect(() => {
    const onPop = () => setRef(refFromMishnahPath(window.location.pathname));
    window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop);
  }, []);
  const open = (r: string | null) => { window.history.pushState({}, '', r ? mishnahPath(r) : '/mishnah'); setRef(r); window.scrollTo(0, 0); };
  return ref ? <Reader key={ref} perekRef={ref} onOpen={open} onBack={() => open(null)} /> : <Hub header={header} onOpen={open} onExit={onExit} />;
}

// ----------------------------------------------------------------------
// Hub: today's Daily Mishnah, and all six sedarim

function Hub({ header, onOpen, onExit }: { header?: ReactNode; onOpen: (r: string) => void; onExit: () => void }) {
  const [today, setToday] = useState<any>(null);
  const [books, setBooks] = useState<any>(null);
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [openSeder, setOpenSeder] = useState<string | null>(null);
  const [tractate, setTractate] = useState<any>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    fetch(`${MISHNAH_API}/current`).then((r) => r.json()).then(setToday).catch(() => {});
    fetch(`${MISHNAH_API}/books`).then((r) => r.json()).then(setBooks).catch(() => {});
    fetch(`${MISHNAH_API}/index`).then((r) => r.json()).then((d) => setReady(new Set((d.items || []).map((i: any) => i.ref)))).catch(() => {});
  }, []);
  const all = useMemo(() => (books?.sedarim || []).flatMap((s: any) => s.books.map((b: any) => ({ ...b, seder: s.seder }))), [books]);
  const hits = q.trim().length >= 2 ? all.filter((b: any) => (b.title + ' ' + b.heTitle).toLowerCase().includes(q.trim().toLowerCase())) : [];
  const perekRef = (b: any, n: number) => `${b.ref} ${n}`;
  return (
    <div className="sm-hub">
      <style>{HUB_CSS}</style>
      {header}
      <section className="sm-hero">
        <button className="sm-exit" onClick={onExit}><ArrowLeft className="w-4 h-4" /> AI Sefarim</button>
        <div className="sm-hero-in">
          <p className="sm-kicker">AI Sefarim · משנה</p>
          <h1>Super Mishnah</h1>
          <p className="sm-lede">Every perek with a plain explanation, the classic commentators phrase by phrase, the machloket, the Rambam and his nosei kelim, and where the Gemara takes it up. All from Sefaria’s sources, every point cited.</p>
          {today && !today.error && (
            <button className="sm-today" onClick={() => onOpen(today.perakim[0])}>
              <CalendarDays className="w-5 h-5" />
              <span><small>Today’s Daily Mishnah</small><b>{today.display.replace(/^Mishnah /, '')}</b><bdi lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{today.heDisplay}</bdi></span>
              <ChevronRight className="w-5 h-5 ml-auto" />
            </button>
          )}
        </div>
      </section>
      <section className="sm-browse">
        <div className="sm-search"><Search className="w-4 h-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tractate: Berakhot, Shabbat, Avot…" /></div>
        {hits.length > 0 && <div className="sm-books">{hits.map((b: any) => <button key={b.ref} className="sm-book" onClick={() => { setTractate(b); setQ(''); }}><span>{b.title}</span><bdi lang="he" dir="rtl">{b.heTitle}</bdi><small>{b.perakim} perakim</small></button>)}</div>}
        {tractate ? (
          <div className="sm-perakim-wrap">
            <button className="sm-back" onClick={() => setTractate(null)}><ChevronLeft className="w-4 h-4" /> All tractates</button>
            <h2>{tractate.title} <bdi lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{tractate.heTitle}</bdi></h2>
            <div className="sm-perakim">
              {Array.from({ length: tractate.perakim || 0 }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`sm-perek ${ready.has(perekRef(tractate, n)) ? 'is-ready' : ''}`} onClick={() => onOpen(perekRef(tractate, n))} title={ready.has(perekRef(tractate, n)) ? 'Ready' : 'Builds when you open it'}>
                  <span>Perek</span><b>{n}</b>{ready.has(perekRef(tractate, n)) && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        ) : !books ? <p className="sm-muted"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading the sedarim…</p> : (
          <div className="sm-sedarim">
            {books.sedarim.map((s: any) => (
              <div key={s.seder} className={`sm-seder ${openSeder === s.seder ? 'is-open' : ''}`}>
                <button className="sm-seder-head" onClick={() => setOpenSeder(openSeder === s.seder ? null : s.seder)}>
                  <bdi lang="he" dir="rtl" className="sm-seder-he">{s.heSeder.replace(/^סדר /, '')}</bdi>
                  <span><b>Seder {s.seder}</b><small>{s.books.length} tractates</small></span>
                  {openSeder === s.seder ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </button>
                {openSeder === s.seder && <div className="sm-books">{s.books.map((b: any) => <button key={b.ref} className="sm-book" onClick={() => setTractate(b)}><span>{b.title}</span><bdi lang="he" dir="rtl">{b.heTitle}</bdi><small>{b.perakim} perakim</small></button>)}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------
// Reader: one perek

function Reader({ perekRef, onOpen, onBack }: { perekRef: string; onOpen: (r: string) => void; onBack: () => void }) {
  const prefs = useMemo(() => readJson<any>(PREFS_KEY, {}), []);
  const [surface, setSurface] = useState<Surface>(prefs.surface || 'paper');
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [scale, setScale] = useState<number>(prefs.scale || 1);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ surface, lang, scale })); } catch { /* private mode */ } }, [surface, lang, scale]);
  const [data, setData] = useState<Perek | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stepping = useRef(false);

  // load, and while it is building drive the build one step at a time (like Super Daf)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${MISHNAH_API}/get?ref=${encodeURIComponent(perekRef)}`);
        const d = await r.json();
        if (!alive) return;
        if (d.error) { setErr(d.error); return; }
        setData(d);
        if (d.status === 'building' && !stepping.current) {
          stepping.current = true;
          try { await fetch(`${MISHNAH_API}/step?ref=${encodeURIComponent(perekRef)}`); } catch { /* retried next round */ }
          stepping.current = false;
          if (alive) setTimeout(load, 400);
        }
      } catch { if (alive) setErr('Could not reach Super Mishnah. Check your connection and try again.'); }
    };
    load();
    return () => { alive = false; };
  }, [perekRef]);

  const dark = surface === 'dark';
  const title = perekRef.replace(/^Mishnah /, '');
  const goPerek = (r?: string | null) => r && onOpen(r.replace(/ (\d+)$/, ' $1'));
  return (
    <div className={`sm ${dark ? 'sm-dark' : 'sm-paper'}`} style={{ ['--sc' as any]: scale }}>
      <style>{READER_CSS}</style>
      <header className="sm-bar">
        <button onClick={onBack} className="sm-icon" aria-label="All tractates"><ArrowLeft className="w-5 h-5" /></button>
        <div className="sm-bar-title">
          <b>{title.replace(/ (\d+)$/, ' · Perek $1')}</b>
          {data?.heRef && <bdi lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{data.heRef}</bdi>}
        </div>
        <div className="sm-bar-tools">
          <div className="sm-seg">{(['he', 'both', 'en'] as Lang[]).map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l === 'he' ? 'עב' : l === 'en' ? 'EN' : 'Both'}</button>)}</div>
          <button className="sm-icon" onClick={() => setScale((s) => Math.max(0.85, +(s - 0.08).toFixed(2)))} aria-label="Smaller text"><Minus className="w-4 h-4" /></button>
          <button className="sm-icon" onClick={() => setScale((s) => Math.min(1.5, +(s + 0.08).toFixed(2)))} aria-label="Larger text"><Plus className="w-4 h-4" /></button>
          <button className="sm-icon" onClick={() => setSurface(dark ? 'paper' : 'dark')} aria-label="Light or dark">{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
        </div>
      </header>

      {err ? <div className="sm-note">{err}</div> : !data ? (
        <div className="sm-loading"><Loader2 className="w-6 h-6 animate-spin" /><p>Opening {title}…</p></div>
      ) : data.status === 'unavailable' ? <div className="sm-note">{data.note}</div> : (
        <main className="sm-main">
          {data.status === 'building' && (
            <div className="sm-building">
              <div><b>Preparing this perek</b><span>{data.done} of {data.total} steps · the notes appear below as each mishnah is ready. This happens once; afterwards it opens instantly for everyone.</span></div>
              <div className="sm-progress"><i style={{ width: `${Math.round((100 * data.done) / Math.max(1, data.total))}%` }} /></div>
            </div>
          )}
          {data.overview && <Overview ov={data.overview} />}
          {data.mishnayot.map((m: any) => <Mishnah key={m.ref} m={m} perekRef={perekRef} lang={lang} dark={dark} />)}
          {data.overview?.review?.length > 0 && <Review items={data.overview.review} />}
          <nav className="sm-pager">
            {data.prev ? <button onClick={() => goPerek(data.prev)}><ChevronLeft className="w-4 h-4" /> {String(data.prev).replace(/^Mishnah /, '')}</button> : <span />}
            {data.next ? <button onClick={() => goPerek(data.next)}>{String(data.next).replace(/^Mishnah /, '')} <ChevronRight className="w-4 h-4" /></button> : <span />}
          </nav>
          <p className="sm-attr">{data.attribution}</p>
        </main>
      )}
    </div>
  );
}

function Overview({ ov }: { ov: any }) {
  return (
    <section className="sm-overview">
      <p className="sm-eyebrow">This perek</p>
      <p className="sm-intro">{plain(ov.intro)}</p>
      {ov.preview?.length > 0 && <ul className="sm-preview">{ov.preview.map((p: string, i: number) => <li key={i}><Check className="w-4 h-4" />{plain(p)}</li>)}</ul>}
      {ov.map?.length > 0 && (
        <div className="sm-map">
          {ov.map.map((x: any) => <a key={x.n} href={`#m${x.n}`} onClick={(e) => { e.preventDefault(); document.getElementById(`m${x.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><b>{x.n}</b><span>{plain(x.title)}</span></a>)}
        </div>
      )}
      {ov.arc && <p className="sm-arc"><ListTree className="w-4 h-4" /><span>{plain(ov.arc)}</span></p>}
    </section>
  );
}

function Mishnah({ m, perekRef, lang, dark }: { m: any; perekRef: string; lang: Lang; dark: boolean }) {
  const n = m.notes;
  const [tab, setTab] = useState<'learn' | 'sources' | 'ask'>('learn');
  const [long, setLong] = useState(false);
  const count = (m.commentaries?.length || 0);
  return (
    <article id={`m${m.n}`} className="sm-mishnah">
      <div className="sm-m-head">
        <span className="sm-num">{m.n}</span>
        <div><p className="sm-eyebrow">Mishnah {m.n}</p>{n?.headline && <h2>{plain(n.headline)}</h2>}</div>
        <a className="sm-sefaria" href={m.url} target="_blank" rel="noopener noreferrer" title="Open on Sefaria"><ExternalLink className="w-4 h-4" /></a>
      </div>
      <div className={`sm-text sm-text-${lang}`}>
        {lang !== 'en' && <p lang="he" dir="rtl" className="sm-he">{m.he}</p>}
        {lang !== 'he' && <div className="sm-en-wrap">
          <p className="sm-en">{long || !m.kulp ? m.en : m.kulp}</p>
          {m.kulp && m.en && <button className="sm-elu" onClick={() => setLong(!long)}>{long ? 'Show the translation' : 'Read the elucidation'}</button>}
        </div>}
      </div>
      {n?.plain && tab === 'learn' && <div className="sm-plain sm-plain-top"><p className="sm-eyebrow">In plain words</p><p><RefText text={once(n.plain)} /></p>{n.why && <p className="sm-why"><b>Why: </b><RefText text={once(n.why)} /></p>}</div>}

      <div className="sm-tabs">
        <button className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}><BookOpen className="w-4 h-4" /> Learn</button>
        <button className={tab === 'sources' ? 'on' : ''} onClick={() => setTab('sources')}><Library className="w-4 h-4" /> Commentaries <small>{count}</small></button>
        <button className={tab === 'ask' ? 'on' : ''} onClick={() => setTab('ask')}><MessageSquareText className="w-4 h-4" /> Ask</button>
      </div>

      {tab === 'learn' && (!n ? <p className="sm-pending"><Loader2 className="w-4 h-4 animate-spin" /> The notes for this mishnah are being prepared…</p> : (
        <div className="sm-learn">
          {n.breakdown?.length > 0 && (
            <div className="sm-block">
              <p className="sm-eyebrow">Phrase by phrase</p>
              <ol className="sm-breakdown">
                {n.breakdown.map((b: any, i: number) => (
                  <li key={i}>
                    <p lang="he" dir="rtl" className="sm-phrase">{b.he}</p>
                    <p className="sm-explain"><RefText text={once(b.explain)} /></p>
                    {b.notes?.length > 0 && <ul className="sm-cnotes">{b.notes.map((x: any, k: number) => (
                      <li key={k}><a href={sefariaUrl(x.ref)} target="_blank" rel="noopener noreferrer" className="sm-who">{workName(x.source, x.ref)}</a><RefText text={once(x.note)} /></li>
                    ))}</ul>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {n.terms?.length > 0 && <div className="sm-terms">{n.terms.map((t: any, i: number) => <span key={i}><bdi lang="he" dir="rtl">{t.he}</bdi>{plain(t.gloss)}</span>)}</div>}

          {n.machloket?.length > 0 && n.machloket.map((x: any, i: number) => (
            <div key={i} className="sm-block sm-machloket">
              <p className="sm-eyebrow"><Scale className="w-4 h-4" /> Machloket</p>
              <p className="sm-q">{plain(x.question)}</p>
              <div className="sm-views" style={{ gridTemplateColumns: `repeat(${Math.min(3, x.views?.length || 1)}, minmax(0,1fr))` }}>
                {(x.views || []).map((v: any, k: number) => <div key={k}><b>{plain(v.who)}</b><p>{plain(v.view)}</p></div>)}
              </div>
              {x.core && <p className="sm-core"><b>What it turns on: </b><RefText text={once(x.core)} />{x.ref && <a className="sd-cite" href={sefariaUrl(x.ref)} target="_blank" rel="noopener noreferrer">{shortRef(x.ref)}</a>}</p>}
            </div>
          ))}

          {n.insights?.length > 0 && (
            <div className="sm-block">
              <p className="sm-eyebrow"><Sparkles className="w-4 h-4" /> Don’t miss</p>
              <div className="sm-insights">{n.insights.map((x: any, i: number) => (
                <div key={i}><b>{plain(x.title)}</b><p><RefText text={once(x.text)} /></p><a href={sefariaUrl(x.ref)} target="_blank" rel="noopener noreferrer" className="sm-who">{workName(x.source, x.ref)}</a></div>
              ))}</div>
            </div>
          )}

          {m.rambam?.available && m.rambam.items?.length > 0 && <Rambam r={m.rambam} />}
          <Continues m={m} />
        </div>
      ))}

      {tab === 'sources' && <Sources m={m} dark={dark} />}
      {tab === 'ask' && <Ask perekRef={perekRef} n={m.n} />}
    </article>
  );
}

function Rambam({ r }: { r: any }) {
  return (
    <div className="sm-block sm-rambam">
      <p className="sm-eyebrow"><Landmark className="w-4 h-4" /> The Rambam</p>
      {r.items.map((it: any, i: number) => (
        <div key={i} className="sm-ruling">
          <p className="sm-where"><a href={sefariaUrl(it.ref)} target="_blank" rel="noopener noreferrer">{plain(it.where || shortRef(it.ref))}</a></p>
          <p className="sm-short">{plain(it.short)}</p>
          <p><RefText text={once(it.ruling)} /></p>
          {it.follows && <p className="sm-follows"><b>Following: </b><RefText text={once(it.follows)} /></p>}
          {it.noseiKelim?.length > 0 && (
            <ul className="sm-nk">{it.noseiKelim.map((k: any, j: number) => (
              <li key={j}><a href={sefariaUrl(k.ref)} target="_blank" rel="noopener noreferrer" className="sm-who">{workName(k.who, k.ref)}</a><RefText text={once(k.note)} /></li>
            ))}</ul>
          )}
        </div>
      ))}
      {r.note && <p className="sm-muted">{plain(r.note)}</p>}
    </div>
  );
}

function Continues({ m }: { m: any }) {
  const groups: [string, any[]][] = [['Gemara (Bavli)', m.gemara || []], ['Yerushalmi', m.yerushalmi || []], ['Tosefta', m.tosefta || []], ['Pesukim', m.pesukim || []], ['Other mishnayot', m.mishnayotElsewhere || []], ['Midrash', m.midrash || []]];
  const any = groups.some(([, l]) => l.length);
  if (!any) return null;
  return (
    <div className="sm-block">
      <p className="sm-eyebrow"><Link2 className="w-4 h-4" /> Where it continues</p>
      <div className="sm-cont">
        {groups.filter(([, l]) => l.length).map(([label, list]) => (
          <div key={label}><b>{label}</b><div>{list.slice(0, 12).map((x: any) => (
            <a key={x.ref} href={sefariaUrl(x.ref)} target="_blank" rel="noopener noreferrer" className={x.sugya ? 'is-main' : ''} title={x.sugya ? 'The Gemara on this mishnah' : x.ref}>{x.ref.replace(/^Jerusalem Talmud /, '')}</a>
          ))}</div></div>
        ))}
      </div>
    </div>
  );
}

function Sources({ m, dark }: { m: any; dark: boolean }) {
  const works = useMemo(() => {
    const by = new Map<string, any[]>();
    for (const c of [...(m.commentaries || []), ...(m.rambamSources || [])]) { const k = c.title; by.set(k, [...(by.get(k) || []), c]); }
    return [...by.entries()];
  }, [m]);
  const [open, setOpen] = useState<string | null>(works[0]?.[0] || null);
  if (!works.length) return <p className="sm-muted">Sefaria has no commentaries linked to this mishnah.</p>;
  return (
    <div className={`sm-sources ${dark ? 'is-dark' : ''}`}>
      {works.map(([title, items]) => (
        <div key={title} className={`sm-work ${open === title ? 'is-open' : ''}`}>
          <button onClick={() => setOpen(open === title ? null : title)}><span>{title}</span><small>{items.length}</small>{open === title ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
          {open === title && items.map((c: any) => (
            <div key={c.ref} className="sm-src">
              <a href={c.url || sefariaUrl(c.ref)} target="_blank" rel="noopener noreferrer" className="sm-src-ref">{shortRef(c.ref)} <ExternalLink className="w-3 h-3 inline" /></a>
              {c.he && <p lang="he" dir="rtl" className="sm-src-he">{c.he}</p>}
              {c.en && <p className="sm-src-en">{c.en}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Ask({ perekRef, n }: { perekRef: string; n: number }) {
  const [hist, setHist] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (text?: string) => {
    const question = (text ?? q).trim(); if (!question || busy) return;
    const next = [...hist, { role: 'user' as const, content: question }]; setHist(next); setQ(''); setBusy(true);
    try {
      const r = await fetch(`${MISHNAH_API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: perekRef, mishnah: n, question, history: hist }) });
      const d = await r.json();
      setHist([...next, { role: 'assistant', content: d.answer || d.error || 'No answer.' }]);
    } catch { setHist([...next, { role: 'assistant', content: 'Could not reach Super Mishnah.' }]); }
    setBusy(false);
  };
  return (
    <div className="sm-ask">
      {!hist.length && <div className="sm-suggest">{['Explain this mishnah simply', 'Why do they disagree?', 'What does the Bartenura add?'].map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
      {hist.map((h, i) => <div key={i} className={`sm-msg ${h.role}`}>{h.role === 'assistant' ? h.content.split('\n').filter(Boolean).map((p, k) => <p key={k}><RefText text={once(p.replace(/^[-*]\s+/, '• '))} /></p>) : <p>{h.content}</p>}{h.role === 'assistant' && /Want more detail\?/.test(h.content) && i === hist.length - 1 && <button className="sm-more" onClick={() => send('Yes, more detail please')}>Yes, more detail</button>}</div>)}
      {busy && <p className="sm-muted"><Loader2 className="w-4 h-4 animate-spin inline" /> Thinking…</p>}
      <form onSubmit={(e) => { e.preventDefault(); send(); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask about mishnah ${n}…`} /><button disabled={busy || !q.trim()} aria-label="Send"><Send className="w-4 h-4" /></button></form>
    </div>
  );
}

function Review({ items }: { items: any[] }) {
  const [shown, setShown] = useState<Set<number>>(new Set());
  return (
    <section className="sm-review">
      <p className="sm-eyebrow">Review the perek</p>
      {items.map((x, i) => (
        <div key={i} className="sm-rq">
          <p><b>{i + 1}.</b> {plain(x.q)}</p>
          {shown.has(i) ? <p className="sm-ra">{plain(x.a)}{x.n ? <a href={`#m${x.n}`}> · mishnah {x.n}</a> : null}</p> : <button onClick={() => setShown(new Set([...shown, i]))}>Show answer</button>}
        </div>
      ))}
    </section>
  );
}

// ----------------------------------------------------------------------
// styles

const HUB_CSS = `
.sm-hub { --ink:#1c1917; color:#e7e5e4; }
.sm-hero { position:relative; margin:0 0 1.2rem; padding:1.4rem 1.2rem 1.6rem; border-radius:28px; overflow:hidden; background:radial-gradient(120% 90% at 85% 0%, rgba(217,119,6,.28), transparent 55%), linear-gradient(160deg,#1f1a14,#0f0d0a 70%); border:1px solid rgba(251,191,36,.18); }
.sm-hero::after { content:'משנה'; position:absolute; right:-.1em; bottom:-.32em; font-family:${JSON.stringify(HE_FONT).slice(1, -1)}; font-size:9rem; color:rgba(251,191,36,.07); pointer-events:none; }
.sm-hero-in { position:relative; z-index:1; max-width:720px; }
.sm-exit { display:inline-flex; align-items:center; gap:.35rem; font-size:.78rem; font-weight:700; color:#a8a29e; margin-bottom:1rem; }
.sm-kicker { font-size:.72rem; letter-spacing:.2em; text-transform:uppercase; font-weight:800; color:#fbbf24; }
.sm-hero h1 { font-family:${JSON.stringify(EN_FONT).slice(1, -1)}; font-size:clamp(2.3rem,7vw,3.6rem); font-weight:700; color:#fff7e6; line-height:1.05; margin:.3rem 0 .7rem; }
.sm-lede { color:#d6d3d1; font-size:1rem; line-height:1.6; }
.sm-today { margin-top:1.2rem; display:flex; align-items:center; gap:.9rem; width:100%; max-width:520px; text-align:left; padding:.9rem 1.1rem; border-radius:18px; background:linear-gradient(135deg,#d97706,#b45309); color:#fff; box-shadow:0 18px 40px -20px rgba(217,119,6,.8); }
.sm-today span { display:flex; flex-direction:column; }
.sm-today small { font-size:.7rem; letter-spacing:.12em; text-transform:uppercase; opacity:.85; font-weight:700; }
.sm-today b { font-size:1.15rem; }
.sm-today bdi { font-size:1.05rem; opacity:.9; }
.sm-browse { padding:0 .2rem 3rem; }
.sm-search { display:flex; align-items:center; gap:.5rem; padding:.7rem 1rem; border-radius:14px; background:#1c1917; border:1px solid #292524; color:#a8a29e; margin-bottom:1rem; }
.sm-search input { flex:1; background:transparent; outline:none; color:#fafaf9; font-size:.95rem; }
.sm-sedarim { display:grid; gap:.7rem; }
.sm-seder { border-radius:18px; background:#171512; border:1px solid #292524; overflow:hidden; }
.sm-seder-head { display:flex; align-items:center; gap:1rem; width:100%; padding:.9rem 1.1rem; text-align:left; }
.sm-seder-he { font-family:${JSON.stringify(HE_FONT).slice(1, -1)}; font-size:1.7rem; color:#fbbf24; min-width:3.6rem; text-align:center; }
.sm-seder-head span { display:flex; flex-direction:column; }
.sm-seder-head b { color:#fafaf9; font-size:1.05rem; }
.sm-seder-head small { color:#a8a29e; }
.sm-books { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.55rem; padding:0 1rem 1rem; }
.sm-browse > .sm-books { padding:0 0 1rem; }
.sm-book { display:flex; flex-direction:column; align-items:flex-start; gap:.1rem; padding:.7rem .85rem; border-radius:14px; background:#221e19; border:1px solid #2f2a24; text-align:left; transition:transform .15s, border-color .15s; }
.sm-book:hover { transform:translateY(-1px); border-color:#d97706; }
.sm-book span { color:#fafaf9; font-weight:700; }
.sm-book bdi { font-family:${JSON.stringify(HE_FONT).slice(1, -1)}; color:#fbbf24; font-size:1.05rem; }
.sm-book small { color:#a8a29e; font-size:.72rem; }
.sm-perakim-wrap h2 { color:#fff7e6; font-size:1.6rem; font-weight:800; margin:.4rem 0 1rem; display:flex; gap:.6rem; align-items:baseline; }
.sm-perakim-wrap h2 bdi { color:#fbbf24; }
.sm-back { display:inline-flex; align-items:center; gap:.2rem; color:#fbbf24; font-weight:700; font-size:.85rem; }
.sm-perakim { display:grid; grid-template-columns:repeat(auto-fill,minmax(92px,1fr)); gap:.6rem; }
.sm-perek { position:relative; display:flex; flex-direction:column; align-items:center; padding:.8rem .4rem; border-radius:16px; background:#1c1917; border:1px solid #292524; color:#d6d3d1; }
.sm-perek span { font-size:.68rem; letter-spacing:.12em; text-transform:uppercase; color:#a8a29e; }
.sm-perek b { font-size:1.6rem; color:#fafaf9; font-family:${JSON.stringify(EN_FONT).slice(1, -1)}; }
.sm-perek.is-ready { border-color:rgba(251,191,36,.5); background:linear-gradient(160deg,#2a2016,#1c1917); }
.sm-perek svg { position:absolute; top:.45rem; right:.45rem; color:#fbbf24; }
.sm-muted { color:#a8a29e; font-size:.9rem; }
`;

const READER_CSS = `
.sm { --he:${JSON.stringify(HE_FONT).slice(1, -1)}; --en:${JSON.stringify(EN_FONT).slice(1, -1)}; min-height:100vh; border-radius:24px; overflow:hidden; font-size:calc(16px * var(--sc,1)); }
.sm-paper { --bg:#fbf6ea; --card:#fffdf7; --ink:#1c1917; --soft:#57534e; --mute:#8a817a; --line:rgba(180,83,9,.16); --acc:#b45309; --acc2:#92400e; --chip:rgba(180,83,9,.08); background:var(--bg); color:var(--ink); }
.sm-dark { --bg:#14110d; --card:#1c1814; --ink:#f5efe4; --soft:#d6cfc4; --mute:#a39a8f; --line:rgba(251,191,36,.14); --acc:#fbbf24; --acc2:#fcd34d; --chip:rgba(251,191,36,.10); background:var(--bg); color:var(--ink); }
.sm-bar { position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:.6rem; padding:.6rem .8rem; background:color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
.sm-icon { width:36px; height:36px; display:grid; place-items:center; border-radius:999px; color:var(--soft); }
.sm-icon:hover { background:var(--chip); color:var(--ink); }
.sm-bar-title { display:flex; flex-direction:column; min-width:0; flex:1; line-height:1.15; }
.sm-bar-title b { font-family:var(--en); font-size:1.05rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sm-bar-title bdi { color:var(--acc); font-size:.95rem; }
.sm-bar-tools { display:flex; align-items:center; gap:.15rem; }
.sm-seg { display:flex; padding:2px; border-radius:999px; background:var(--chip); margin-right:.3rem; }
.sm-seg button { padding:.25rem .6rem; border-radius:999px; font-size:.75rem; font-weight:800; color:var(--soft); }
.sm-seg button.on { background:var(--acc); color:var(--bg); }
.sm-main { max-width:880px; margin:0 auto; padding:1.2rem .9rem 3rem; }
.sm-loading, .sm-note { max-width:620px; margin:4rem auto; text-align:center; color:var(--soft); display:flex; flex-direction:column; align-items:center; gap:.8rem; padding:0 1rem; }
.sm-building { display:flex; flex-direction:column; gap:.6rem; padding:.9rem 1rem; border-radius:16px; background:var(--chip); border:1px solid var(--line); margin-bottom:1.2rem; }
.sm-building b { display:block; }
.sm-building span { font-size:.85rem; color:var(--soft); }
.sm-progress { height:6px; border-radius:99px; background:var(--line); overflow:hidden; }
.sm-progress i { display:block; height:100%; background:var(--acc); transition:width .4s; }
.sm-eyebrow { display:flex; align-items:center; gap:.35rem; font-size:.7rem; letter-spacing:.16em; text-transform:uppercase; font-weight:800; color:var(--acc); margin-bottom:.45rem; }
.sm-overview { padding:1.2rem 1.2rem 1rem; border-radius:22px; background:var(--card); border:1px solid var(--line); margin-bottom:1.6rem; box-shadow:0 20px 40px -32px rgba(120,53,15,.5); }
.sm-intro { font-family:var(--en); font-size:1.12em; line-height:1.65; }
.sm-preview { display:grid; gap:.35rem; margin:.9rem 0 0; }
.sm-preview li { display:flex; gap:.5rem; align-items:flex-start; color:var(--soft); }
.sm-preview svg { color:var(--acc); flex:none; margin-top:.2rem; }
.sm-map { display:flex; gap:.5rem; overflow-x:auto; margin:1rem -1.2rem 0; padding:.2rem 1.2rem .4rem; scrollbar-width:none; }
.sm-map a { flex:none; display:flex; align-items:center; gap:.5rem; max-width:240px; padding:.45rem .8rem .45rem .45rem; border-radius:999px; background:var(--chip); color:var(--ink); text-decoration:none; font-size:.85rem; }
.sm-map b { width:26px; height:26px; flex:none; display:grid; place-items:center; border-radius:50%; background:var(--acc); color:var(--bg); font-size:.8rem; }
.sm-map span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sm-arc { display:flex; gap:.5rem; margin-top:.9rem; color:var(--soft); font-size:.92em; line-height:1.55; }
.sm-arc svg { color:var(--acc); flex:none; margin-top:.25rem; }
.sm-mishnah { scroll-margin-top:70px; padding:1.3rem 1.2rem 1.1rem; border-radius:24px; background:var(--card); border:1px solid var(--line); margin-bottom:1.4rem; }
.sm-m-head { display:flex; align-items:flex-start; gap:.8rem; margin-bottom:.8rem; }
.sm-m-head h2 { font-family:var(--en); font-size:1.35em; font-weight:700; line-height:1.2; }
.sm-num { flex:none; width:42px; height:42px; display:grid; place-items:center; border-radius:14px; background:linear-gradient(150deg,var(--acc),var(--acc2)); color:var(--bg); font-family:var(--en); font-size:1.25rem; font-weight:700; }
.sm-sefaria { margin-left:auto; color:var(--mute); padding:.3rem; }
.sm-text { display:grid; gap:1rem; padding:1rem 0 1.1rem; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
@media (min-width: 720px) { .sm-text-both { grid-template-columns:minmax(0,1fr) minmax(0,1.15fr); gap:1.6rem; } }
.sm-he { font-family:var(--he); font-size:1.42em; line-height:1.85; text-align:right; }
.sm-en { font-family:var(--en); font-size:1.02em; line-height:1.7; color:var(--soft); }
.sm-tabs { display:flex; gap:.35rem; margin:1rem 0 .9rem; overflow-x:auto; scrollbar-width:none; }
.sm-tabs button { flex:none; display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .85rem; border-radius:999px; font-size:.85rem; font-weight:700; color:var(--soft); border:1px solid var(--line); }
.sm-tabs button.on { background:var(--ink); color:var(--bg); border-color:transparent; }
.sm-tabs small { opacity:.65; }
.sm-elu { margin-top:.5rem; font-size:.8rem; font-weight:800; color:var(--acc); }
.sm-plain-top { margin-top:1rem; }
.sm-pending { display:flex; gap:.5rem; align-items:center; color:var(--mute); }
.sm-learn { display:grid; gap:1.2rem; }
.sm-plain { padding:1rem 1.1rem; border-radius:18px; background:var(--chip); }
.sm-plain > p:nth-child(2) { font-family:var(--en); font-size:1.08em; line-height:1.65; }
.sm-why { margin-top:.6rem; color:var(--soft); line-height:1.6; }
.sm-block { padding-top:.2rem; }
.sm-breakdown { display:grid; gap:.1rem; counter-reset:ph; }
.sm-breakdown > li { padding:.75rem 0; border-top:1px dashed var(--line); }
.sm-breakdown > li:first-child { border-top:0; }
.sm-phrase { font-family:var(--he); font-size:1.28em; font-weight:700; color:var(--acc2); line-height:1.6; }
.sm-explain { line-height:1.6; margin-top:.15rem; }
.sm-cnotes { display:grid; gap:.35rem; margin-top:.5rem; padding-left:.9rem; border-left:3px solid var(--line); }
.sm-cnotes li { font-size:.92em; color:var(--soft); line-height:1.55; }
.sm-who { display:inline-block; margin-right:.45rem; padding:.05rem .5rem; border-radius:999px; background:var(--chip); color:var(--acc2); font-size:.78em; font-weight:800; text-decoration:none; font-family:system-ui,sans-serif; }
.sm-terms { display:flex; flex-wrap:wrap; gap:.45rem; }
.sm-terms span { display:inline-flex; align-items:baseline; gap:.45rem; padding:.35rem .75rem; border-radius:12px; background:var(--chip); font-size:.88em; color:var(--soft); }
.sm-terms bdi { font-family:var(--he); font-size:1.15em; color:var(--ink); font-weight:700; }
.sm-machloket { padding:1rem 1.1rem; border-radius:18px; border:1px solid var(--line); }
.sm-q { font-family:var(--en); font-size:1.1em; font-weight:700; margin-bottom:.7rem; }
.sm-views { display:grid; gap:.6rem; }
@media (max-width: 560px) { .sm-views { grid-template-columns:1fr !important; } }
.sm-views > div { padding:.7rem .8rem; border-radius:14px; background:var(--chip); }
.sm-views b { color:var(--acc2); }
.sm-views p { margin-top:.2rem; line-height:1.5; font-size:.95em; }
.sm-core { margin-top:.8rem; color:var(--soft); line-height:1.6; }
.sm-insights { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:.7rem; }
.sm-insights > div { display:flex; flex-direction:column; gap:.35rem; padding:.9rem 1rem; border-radius:16px; border:1px solid var(--line); background:linear-gradient(170deg, var(--chip), transparent 70%); }
.sm-insights p { line-height:1.55; font-size:.95em; color:var(--soft); }
.sm-insights a { align-self:flex-start; }
.sm-rambam { padding:1rem 1.1rem; border-radius:18px; background:linear-gradient(160deg, rgba(30,64,175,.08), transparent 70%); border:1px solid rgba(30,64,175,.2); }
.sm-dark .sm-rambam { background:linear-gradient(160deg, rgba(147,197,253,.10), transparent 70%); border-color:rgba(147,197,253,.22); }
.sm-rambam .sm-eyebrow { color:#1d4ed8; }
.sm-dark .sm-rambam .sm-eyebrow { color:#93c5fd; }
.sm-ruling + .sm-ruling { margin-top:1rem; padding-top:1rem; border-top:1px solid var(--line); }
.sm-where a { font-weight:800; color:var(--ink); text-decoration:none; }
.sm-short { font-family:var(--en); font-size:1.08em; font-weight:700; margin:.25rem 0 .4rem; }
.sm-ruling p { line-height:1.6; }
.sm-follows { margin-top:.4rem; color:var(--soft); }
.sm-nk { display:grid; gap:.35rem; margin-top:.6rem; padding-left:.9rem; border-left:3px solid rgba(30,64,175,.25); }
.sm-nk li { font-size:.92em; color:var(--soft); line-height:1.55; }
.sm-cont { display:grid; gap:.6rem; }
.sm-cont > div > b { display:block; font-size:.8rem; color:var(--mute); margin-bottom:.3rem; }
.sm-cont a { display:inline-block; margin:0 .35rem .35rem 0; padding:.25rem .65rem; border-radius:999px; border:1px solid var(--line); font-size:.82rem; color:var(--soft); text-decoration:none; }
.sm-cont a.is-main { background:var(--acc); color:var(--bg); border-color:transparent; font-weight:700; }
.sm-sources { display:grid; gap:.5rem; }
.sm-work { border:1px solid var(--line); border-radius:16px; overflow:hidden; }
.sm-work > button { display:flex; align-items:center; gap:.5rem; width:100%; padding:.7rem .9rem; font-weight:800; text-align:left; }
.sm-work > button small { margin-left:auto; color:var(--mute); font-weight:700; }
.sm-work.is-open > button { background:var(--chip); }
.sm-src { padding:.8rem .95rem; border-top:1px solid var(--line); }
.sm-src-ref { font-size:.78rem; font-weight:800; color:var(--acc2); text-decoration:none; }
.sm-src-he { font-family:var(--he); font-size:1.15em; line-height:1.75; text-align:right; margin-top:.3rem; }
.sm-src-en { font-family:var(--en); line-height:1.65; color:var(--soft); margin-top:.35rem; font-size:.95em; }
.sm-ask { display:grid; gap:.7rem; }
.sm-suggest { display:flex; flex-wrap:wrap; gap:.4rem; }
.sm-suggest button, .sm-more { padding:.4rem .8rem; border-radius:999px; background:var(--chip); font-size:.85rem; font-weight:700; color:var(--acc2); }
.sm-msg { padding:.75rem .95rem; border-radius:16px; line-height:1.6; }
.sm-msg.user { justify-self:end; background:var(--ink); color:var(--bg); max-width:85%; }
.sm-msg.assistant { background:var(--chip); }
.sm-msg p + p { margin-top:.4rem; }
.sm-ask form { display:flex; gap:.4rem; }
.sm-ask input { flex:1; padding:.65rem .9rem; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--ink); outline:none; }
.sm-ask form button { width:42px; border-radius:999px; background:var(--acc); color:var(--bg); display:grid; place-items:center; }
.sm-ask form button:disabled { opacity:.4; }
.sm-review { padding:1.2rem; border-radius:22px; background:var(--card); border:1px solid var(--line); margin-bottom:1.4rem; }
.sm-rq { padding:.7rem 0; border-top:1px dashed var(--line); }
.sm-rq:first-of-type { border-top:0; }
.sm-rq button { margin-top:.35rem; font-size:.82rem; font-weight:800; color:var(--acc); }
.sm-ra { margin-top:.35rem; color:var(--soft); line-height:1.55; }
.sm-ra a { color:var(--acc); }
.sm-pager { display:flex; justify-content:space-between; gap:.6rem; margin:1.6rem 0 .8rem; }
.sm-pager button { display:inline-flex; align-items:center; gap:.3rem; padding:.6rem 1rem; border-radius:999px; border:1px solid var(--line); font-weight:700; color:var(--soft); }
.sm-attr { font-size:.75rem; color:var(--mute); text-align:center; line-height:1.5; }
.sm .sd-cite { display:inline-block; margin-left:.3em; padding:0 .45em; border-radius:9999px; font-family:system-ui,sans-serif; font-size:.68em; font-weight:700; line-height:1.6; vertical-align:.12em; text-decoration:none; white-space:nowrap; color:var(--acc2); background:var(--chip); }
.sm .sd-key { font-weight:700; }
@media (max-width: 560px) { .sm { border-radius:0; } .sm-mishnah, .sm-overview, .sm-review { padding-left:1rem; padding-right:1rem; border-radius:20px; } .sm-seg { display:none; } }
`;
