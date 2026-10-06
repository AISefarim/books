import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Search, X, ScrollText, Loader2, BookOpen, Monitor, Tablet, Smartphone, ChevronLeft, ChevronRight, Lock, Share2, Check } from 'lucide-react';
import { DAF_API, pingDafOpen, normalizeTractate, dafPath } from '../lib/daf';

// The Daf tab's front page: today's daf (huge), yesterday and tomorrow
// beside it, then every finished daf by masechet, with a forgiving search
// across names, daf numbers (English or Hebrew) and what each daf teaches.

type DafMeta = { ref: string; heRef: string; sugyot: number | null; preview: string[]; takeaways: string[] };
type Day = { ref: string; heRef?: string; date: string };

const HE_FONT = "'Frank Ruhl Libre', 'David', serif";
const SHAS = ['Berakhot', 'Shabbat', 'Eruvin', 'Pesachim', 'Shekalim', 'Yoma', 'Sukkah', 'Beitzah', 'Rosh Hashanah', 'Taanit', 'Megillah', 'Moed Katan', 'Chagigah', 'Yevamot', 'Ketubot', 'Nedarim', 'Nazir', 'Sotah', 'Gittin', 'Kiddushin', 'Bava Kamma', 'Bava Metzia', 'Bava Batra', 'Sanhedrin', 'Makkot', 'Shevuot', 'Avodah Zarah', 'Horayot', 'Zevachim', 'Menachot', 'Chullin', 'Bekhorot', 'Arakhin', 'Temurah', 'Keritot', 'Meilah', 'Tamid', 'Niddah'];
const STOP = new Set(['daf', 'the', 'of', 'a', 'and', 'in', 'on', 'masechet', 'masechta', 'tractate', 'page']);

const split = (ref: string) => { const m = ref.match(/^(.+?)\s+(\d+)$/); return m ? { book: m[1], n: Number(m[2]) } : { book: ref, n: 0 }; };
const heBook = (heRef: string) => heRef.replace(/\s+\S+$/, '');
const heDaf = (heRef: string) => heRef.split(' ').pop() || '';
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[֑-ׇ]/g, '').replace(/[^a-z0-9א-ת ]/g, ' ').replace(/\s+/g, ' ').trim();
const fmtDate = (d?: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, opts) : '');
const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SITE = 'https://aisefarim.com';
const bookPath = (name: string) => `/daf/${encodeURIComponent(name.replace(/ /g, '_'))}`;
// "/daf/Bava_Metzia" -> "Bava Metzia" (a masechet link opens the page on that masechet)
const bookFromPath = (p: string) => { const m = p.match(/^\/(?:super)?daf\/([^/]+)\/?$/); return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null; };

// Highlight the query words inside a matching point.
function Highlight({ text, words }: { text: string; words: string[] }) {
  const latin = words.filter((w) => /[a-z]/.test(w));
  if (!latin.length) return <>{text}</>;
  const re = new RegExp(`(${latin.map(escapeRe).join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="bg-indigo-500/30 text-white rounded px-0.5">{part}</mark> : <Fragment key={i}>{part}</Fragment>))}</>;
}

export function DafHub({ onOpen, onExit, whatsappUrl, header }: { onOpen: (ref: string) => void; onExit: () => void; whatsappUrl?: string; header?: ReactNode }) {
  const [items, setItems] = useState<DafMeta[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [today, setToday] = useState<Day | null>(null);
  const [yesterday, setYesterday] = useState<Day | null>(null);
  const [tomorrow, setTomorrow] = useState<Day | null>(null);
  const [q, setQ] = useState('');
  const [book, setBook] = useState<string | null>(() => bookFromPath(window.location.pathname));
  const [toast, setToast] = useState<string | null>(null);
  // Share sheet on phones/tablets; copy the link elsewhere.
  const share = async (title: string, path: string) => {
    const url = SITE + path;
    const text = `${title} on Super Daf - the daf, sugya by sugya. Free.`;
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); setToast('Link copied'); } catch { setToast(url); }
    window.setTimeout(() => setToast(null), 2200);
  };
  // a masechet link (/daf/Bava_Metzia) scrolls to that masechet once the library loads
  const [scrolledToBook, setScrolledToBook] = useState(false);
  const [hideTip, setHideTip] = useState(() => { try { return localStorage.getItem('sd_device_tip') === '1'; } catch { return false; } });
  const searchRef = useRef<HTMLInputElement>(null);
  const dafimRef = useRef<HTMLDivElement>(null);

  useEffect(() => { pingDafOpen(); }, []);
  const [frame, setFrame] = useState<{ rashiHe?: string; tosafotHe?: string } | null>(null);
  useEffect(() => {
    if (!today?.ref) return;
    fetch(`${DAF_API}/teaser?ref=${encodeURIComponent(today.ref)}`).then((r) => r.json()).then((t) => { if (t && t.available !== false) setFrame(t); }).catch(() => {});
    const href = 'https://fonts.googleapis.com/css2?family=Noto+Rashi+Hebrew&display=swap';
    if (!document.querySelector(`link[href="${href}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
  }, [today?.ref]);
  useEffect(() => {
    fetch(`${DAF_API}/index`).then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => { setItems([]); setFailed(true); });
    const day = (o: number, set: (d: Day) => void) => fetch(`${DAF_API}/current?offset=${o}`).then((r) => r.json()).then((d) => { if (d && d.ref) set(d); }).catch(() => {});
    day(0, setToday); day(-1, setYesterday); day(1, setTomorrow);
  }, []);
  // "/" jumps to the search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const byRef = useMemo(() => new Map((items || []).map((i) => [i.ref, i])), [items]);
  const todayMeta = today ? byRef.get(today.ref) : undefined;
  const todayHe = today?.heRef || todayMeta?.heRef || '';
  const dateLabel = fmtDate(today?.date);

  // ---- masechtot ----
  const books = useMemo(() => {
    const by: Record<string, DafMeta[]> = {};
    for (const it of items || []) (by[split(it.ref).book] ||= []).push(it);
    const order = (b: string) => { const i = SHAS.findIndex((s) => normalizeTractate(s) === normalizeTractate(b)); return i < 0 ? 999 : i; };
    return Object.entries(by)
      .map(([name, ds]) => ({ name, he: heBook(ds[0].heRef || ''), dafim: ds.sort((a, b) => split(a.ref).n - split(b.ref).n) }))
      .sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name));
  }, [items]);
  const todayBook = today ? split(today.ref).book : null;
  const openBook = book || todayBook || books[0]?.name || null;
  const shownBook = books.find((b) => b.name === openBook) || books[0];
  useEffect(() => {
    if (scrolledToBook || !book || !books.some((b) => b.name === book)) return;
    setScrolledToBook(true);
    window.setTimeout(() => dafimRef.current?.scrollIntoView({ block: 'start' }), 300);
  }, [book, books, scrolledToBook]);

  // ---- search: masechet (any spelling, English or Hebrew), daf (17, 17a, יז), or topic ----
  const words = useMemo(() => norm(q).split(' ').filter((w) => w && !STOP.has(w)), [q]);
  const results = useMemo(() => {
    if (!items || !words.length) return [];
    const out: { it: DafMeta; hit: string | null; score: number }[] = [];
    for (const it of items) {
      const { book: b, n } = split(it.ref);
      const nb = normalizeTractate(b);
      const name = norm(`${it.ref} ${it.heRef}`);
      const points = [...it.preview, ...it.takeaways];
      const pointsNorm = norm(points.join(' '));
      let nameHits = 0, ok = true;
      for (const w of words) {
        const num = w.match(/^(\d+)[ab]?$/);
        if (num) { if (Number(num[1]) === n) { nameHits++; continue; } ok = false; break; }
        if (/^[a-z]+$/.test(w) && w.length >= 3) { const nw = normalizeTractate(w); if (nw.length >= 3 && (nb.startsWith(nw) || nw.startsWith(nb))) { nameHits++; continue; } }
        if (name.split(' ').includes(w) || (w.length >= 3 && name.includes(w))) { nameHits++; continue; }
        if (!pointsNorm.includes(w)) { ok = false; break; }
      }
      if (!ok) continue;
      const topicWords = words.filter((w) => !name.includes(w) && !/^\d/.test(w));
      const hit = topicWords.length ? points.find((pt) => topicWords.every((w) => norm(pt).includes(w))) || points.find((pt) => topicWords.some((w) => norm(pt).includes(w))) || null : null;
      out.push({ it, hit, score: nameHits });
    }
    return out.sort((a, b) => b.score - a.score || split(a.it.ref).n - split(b.it.ref).n);
  }, [items, words]);

  const DafCard = ({ it, hit }: { it: DafMeta; hit?: string | null }) => {
    const isToday = it.ref === today?.ref;
    return (
      <div className="relative">
      <button onClick={() => share(it.ref, dafPath(it.ref))} className="absolute top-2.5 right-2.5 z-10 p-2 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/70" aria-label={`Share ${it.ref}`} title={`Share ${it.ref}`}><Share2 className="w-4 h-4" /></button>
      <button onClick={() => onOpen(it.ref)} className={`group w-full text-left rounded-2xl border p-4 pr-11 transition-all hover:-translate-y-0.5 ${isToday ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-slate-800 group-hover:bg-indigo-600 transition-colors flex flex-col items-center justify-center">
            <span className="text-lg font-black leading-none" lang="he" style={{ fontFamily: HE_FONT }}>{heDaf(it.heRef)}</span>
            <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-100 mt-0.5">daf {split(it.ref).n}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-black text-slate-100">{it.ref}</p>
              {isToday && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Today</span>}
            </div>
            <p className="mt-1 text-sm text-slate-400 leading-snug line-clamp-3"><Highlight text={hit || it.preview[0] || ''} words={hit ? words : []} /></p>
            {it.sugyot ? <p className="mt-2 text-[11px] font-bold text-slate-500 flex items-center gap-1"><BookOpen className="w-3 h-3" /> {it.sugyot} sugyot</p> : null}
          </div>
        </div>
      </button>
      </div>
    );
  };

  // Yesterday / tomorrow: open when built; otherwise say when they will be.
  const SideDay = ({ label, day, dir }: { label: string; day: Day | null; dir: 'prev' | 'next' }) => {
    const meta = day ? byRef.get(day.ref) : undefined;
    const ready = !!(meta && day);
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
    const arrow = (
      <span className={`shrink-0 flex w-11 h-11 sm:w-14 sm:h-14 rounded-full items-center justify-center transition-transform ${ready ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 group-hover:scale-110' : 'bg-slate-800 text-slate-500'}`}>
        {ready ? <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} /> : <Lock className="w-4 h-4 sm:w-5 sm:h-5" />}
      </span>
    );
    const text = (
      <div className={`min-w-0 flex-1 ${dir === 'next' ? 'text-right' : ''}`}>
        <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.16em] text-indigo-300">{label}{day?.date ? <span className="text-slate-500"> · {fmtDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span> : null}</p>
        <p className="mt-1 text-lg sm:text-2xl font-black text-slate-100 leading-tight">{day ? day.ref : <Loader2 className="inline w-5 h-5 animate-spin" />}</p>
        {(meta?.heRef || day?.heRef) ? <p className="text-base sm:text-lg text-indigo-200 font-bold leading-tight" lang="he" style={{ fontFamily: HE_FONT }}>{meta?.heRef || day?.heRef}</p> : null}
        {day && !meta && <p className="mt-1 text-xs sm:text-sm text-slate-500">{dir === 'next' ? 'Being prepared' : 'Not in Super Daf yet'}</p>}
      </div>
    );
    const inner = dir === 'prev' ? <>{arrow}{text}</> : <>{text}{arrow}</>;
    const cls = 'group w-full flex items-center gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-5 text-left transition-all';
    return ready
      ? <button onClick={() => onOpen(day!.ref)} aria-label={`${label}: ${day!.ref}`} className={`${cls} border-indigo-400/30 bg-indigo-500/[0.07] hover:bg-indigo-500/[0.14] hover:border-indigo-400/60 hover:-translate-y-0.5`}>{inner}</button>
      : <div className={`${cls} border-slate-800 bg-slate-900/50`}>{inner}</div>;
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-slate-950 text-slate-100 pb-24">
      {/* the AI Sefarim header, as on every other page (scrolls away so the search can stick) */}
      {header && <div>{header}</div>}
      <div className="max-w-5xl mx-auto px-4 sm:px-8">
        {/* title + dedication */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 pt-5 pb-4">
          <div className="flex items-center gap-2">
            {!header && <button onClick={onExit} className="p-2 -ml-2 rounded-full hover:bg-slate-800 text-slate-300" aria-label="Back to AI Sefarim"><ArrowLeft className="w-5 h-5" /></button>}
            <ScrollText className="w-6 h-6 text-indigo-300" />
            <h1 className="text-2xl font-black tracking-tight">Super Daf</h1>
          </div>
          <p className="sm:ml-auto sm:text-right text-sm sm:text-[15px] leading-snug text-slate-300 sm:border-l sm:border-slate-700 sm:pl-4">
            Dedicated to <span className="font-black text-slate-100">Carol Serouya</span>, the best mother and wife
          </p>
        </div>

        {/* device tip */}
        {!hideTip && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/[0.08] px-4 py-2.5 text-sm text-sky-100">
            <span className="flex shrink-0 items-center gap-1 text-sky-300" aria-hidden="true"><Tablet className="w-4 h-4" /><Monitor className="w-4 h-4" /></span>
            <p className="min-w-0 flex-1"><b>Best on a tablet or computer</b>, with the Gemara and the notes side by side. <span className="text-sky-200/80">Works great on your phone too <Smartphone className="inline w-3.5 h-3.5 -mt-0.5" /></span></p>
            <button onClick={() => { setHideTip(true); try { localStorage.setItem('sd_device_tip', '1'); } catch { /* ignore */ } }} className="shrink-0 p-1 rounded-full text-sky-300/80 hover:text-white hover:bg-white/10" aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ===== today's daf: composed like a page of Gemara - the title in the
             center, today's real Rashi and Tosafot in faint columns around it ===== */}
        <div className="relative">
        {today && <button onClick={() => share(today.ref, dafPath(today.ref))} className="absolute bottom-6 right-6 sm:bottom-7 sm:right-8 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-black text-slate-200 backdrop-blur" aria-label={`Share ${today.ref}`}><Share2 className="w-3.5 h-3.5" /> Share</button>}
        <button onClick={() => today && onOpen(today.ref)} disabled={!today} className="group relative w-full overflow-hidden rounded-[28px] border border-white/10 px-6 sm:px-10 pt-6 sm:pt-7 pb-9 sm:pb-11 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] transition-transform hover:-translate-y-0.5"
          style={{ background: 'radial-gradient(120% 90% at 50% 0%, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.04) 45%, transparent 70%), linear-gradient(180deg, #121527 0%, #0d0f1c 100%)' }}>
          {/* a printed page's double rule */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[20px] border border-[#d9ccad]/15" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-[18px] rounded-[16px] border border-[#d9ccad]/[0.07]" />
          {/* running head */}
          <div dir="rtl" className="relative flex items-baseline justify-between gap-4 px-2 text-[#d9ccad]/60" style={{ fontFamily: HE_FONT }}>
            <span className="text-base sm:text-lg">{todayHe ? `מסכת ${todayHe.replace(/\s+\S+$/, '')}` : ''}</span>
            <span className="text-base sm:text-lg">{todayHe ? `דף ${todayHe.split(' ').pop()}` : ''}</span>
          </div>
          <div className="relative mx-2 mt-2 h-px bg-gradient-to-r from-transparent via-[#d9ccad]/25 to-transparent" />

          <div className="relative mt-5 md:grid md:grid-cols-[1fr_1.7fr_1fr] md:gap-7 md:items-stretch">
            {/* Tosafot - outer column */}
            <Column label="תוספות" text={frame?.tosafotHe} />
            {/* the Gemara's place: the title */}
            <div className="md:py-2">
              <p className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-indigo-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Today’s Daf Yomi{today?.date ? ` · ${fmtDate(today.date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
              </p>
              {today ? (
                <>
                  <p lang="he" dir="rtl" className="mt-4 text-[60px] sm:text-[92px] leading-none text-[#f1e9d6]" style={{ fontFamily: HE_FONT, fontWeight: 700 }}>{todayHe || today.ref}</p>
                  <p className="mt-3 text-lg sm:text-2xl font-semibold tracking-[0.08em] text-slate-300">{today.ref}</p>
                  <div className="mx-auto mt-6 flex w-40 items-center gap-3 text-[#d9ccad]/50" aria-hidden="true">
                    <span className="h-px flex-1 bg-current" /><span className="text-[10px]">◆</span><span className="h-px flex-1 bg-current" />
                  </div>
                  <span className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 text-white px-7 py-3.5 text-base sm:text-lg font-black shadow-xl shadow-indigo-600/30 group-hover:gap-3 group-hover:bg-indigo-500 transition-all">
                    Start learning <ArrowRight className="w-5 h-5" />
                  </span>
                  {todayMeta?.sugyot ? <p className="mt-3 text-xs font-semibold text-slate-500">{todayMeta.sugyot} sugyot</p> : null}
                </>
              ) : (
                <div className="mt-8 flex justify-center items-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Finding today’s daf…</div>
              )}
            </div>
            {/* Rashi - inner column */}
            <Column label="רש״י" text={frame?.rashiHe} />
          </div>
        </button>
        </div>

        {/* ===== yesterday & tomorrow ===== */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SideDay label="Yesterday" day={yesterday} dir="prev" />
          <SideDay label="Tomorrow" day={tomorrow} dir="next" />
        </div>

        {/* ===== WhatsApp community ===== */}
        {whatsappUrl && (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <span className="hidden sm:flex shrink-0 w-11 h-11 rounded-xl bg-emerald-600 items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.49-8.41" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-100">Join the AI Sefarim WhatsApp community</p>
              <p className="text-sm text-slate-400">New sefarim, daily video shiurim and podcast episodes, straight to your phone. Free.</p>
            </div>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 text-sm font-black">Join on WhatsApp</a>
          </div>
        )}

        {/* ===== search ===== */}
        <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 pt-6 pb-3 bg-slate-950/90 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a masechet, a daf or a topic: “Bechoros 17”, “בכורות יז”, “twins”…" aria-label="Search the dapim"
              className="w-full rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 outline-none pl-12 pr-14 py-3.5 text-base text-slate-100 placeholder:text-slate-500" />
            {q ? <button onClick={() => { setQ(''); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Clear search"><X className="w-4 h-4" /></button>
              : <kbd className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-slate-700 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">/</kbd>}
          </div>
        </div>

        {!items ? (
          <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : words.length ? (
          <div className="mt-3">
            <p className="text-sm text-slate-400 mb-3">{results.length ? `${results.length} ${results.length === 1 ? 'daf' : 'dapim'} found` : <>Nothing matches “{q}”. Try a masechet, a daf number, or a word like “firstborn”.</>}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.map(({ it, hit }) => <DafCard key={it.ref} it={it} hit={hit} />)}
            </div>
          </div>
        ) : books.length === 0 ? (
          <div className="py-16 text-center text-slate-400">{failed ? 'Could not load the library right now.' : 'No dapim yet.'}</div>
        ) : (
          <>
            {/* ===== masechtot ===== */}
            <h2 className="mt-4 mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Browse by masechet</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {books.map((b) => {
                const on = b.name === shownBook?.name;
                const first = split(b.dafim[0].ref).n, last = split(b.dafim[b.dafim.length - 1].ref).n;
                return (
                  <button key={b.name} onClick={() => { setBook(b.name); try { window.history.replaceState({}, '', bookPath(b.name)); } catch { /* ignore */ } setTimeout(() => dafimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                    className={`relative overflow-hidden text-left rounded-2xl border p-4 pr-6 transition-all hover:-translate-y-0.5 ${on ? 'border-[#c9a24a] ring-2 ring-[#c9a24a]/40' : 'border-[#5a3a22] hover:border-[#c9a24a]/70'}`}
                    style={{ background: 'radial-gradient(120% 120% at 20% 0%, #52261b 0%, #33160f 60%, #22100a 100%)' }}>
                    <span aria-hidden="true" className="absolute inset-y-0 right-0 w-2.5 bg-gradient-to-l from-black/40 to-transparent" />
                    <span aria-hidden="true" className="absolute inset-2 rounded-xl border border-[#c9a24a]/25 pointer-events-none" />
                    {b.he && <p className="relative text-2xl leading-none" lang="he" style={{ fontFamily: HE_FONT, color: '#e2c071' }}>{b.he}</p>}
                    <p className="relative mt-2 font-black text-[#f3e6c8]">{b.name}</p>
                    <p className="relative text-xs text-[#d9c39a]/80">{b.dafim.length} {b.dafim.length === 1 ? 'daf' : 'dapim'} · {first === last ? `daf ${first}` : `dapim ${first}–${last}`}{b.name === todayBook ? ' · learning now' : ''}</p>
                  </button>
                );
              })}
            </div>

            {/* ===== dafim of the chosen masechet ===== */}
            {shownBook && (
              <section ref={dafimRef} className="mt-8 scroll-mt-28">
                <div className="flex items-baseline gap-3 mb-4 border-b border-slate-800 pb-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">{shownBook.name}</h2>
                  {shownBook.he && <span className="text-xl text-slate-400" lang="he" style={{ fontFamily: HE_FONT }}>{shownBook.he}</span>}
                  <span className="ml-auto text-xs font-bold text-slate-500">{shownBook.dafim.length} {shownBook.dafim.length === 1 ? 'daf' : 'dapim'}</span>
                  <button onClick={() => share(`Masechet ${shownBook.name}`, bookPath(shownBook.name))} className="self-center inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-200"><Share2 className="w-3.5 h-3.5" /> Share masechet</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shownBook.dafim.map((it) => <DafCard key={it.ref} it={it} />)}
                </div>
              </section>
            )}
          </>
        )}
        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-900 px-4 py-2 text-sm font-black shadow-2xl"><Check className="w-4 h-4 text-emerald-600" /> {toast}</div>}
        <p className="mt-12 text-center text-xs text-slate-600">Each new daf is prepared about a day and a half before it is learned, and then stays here for everyone.</p>
      </div>
    </div>
  );
}

// A faint column of real commentary in Rashi script, fading at its edges -
// texture around the title, the way Rashi and Tosafot frame a daf.
function Column({ label, text }: { label: string; text?: string }) {
  return (
    <div aria-hidden="true" className="hidden md:flex flex-col select-none" dir="rtl">
      <span className="mb-2 text-sm font-bold text-[#d9ccad]/45" style={{ fontFamily: HE_FONT }}>{label}</span>
      <p className="flex-1 overflow-hidden text-justify text-[12.5px] leading-[1.6] text-[#d9ccad]/[0.22]"
        style={{ fontFamily: "'Noto Rashi Hebrew', 'Frank Ruhl Libre', serif", maskImage: 'linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)', maxHeight: 300 }}>
        {text || ''}
      </p>
    </div>
  );
}
