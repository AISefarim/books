import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Headphones, X, ExternalLink, Clock, Loader2, Scale, Landmark,
  Send, MessageSquareText, Minus, Plus, Lock, Bookmark, BookmarkCheck, Maximize2, Minimize2, Type, Sun, Moon,
  Map as MapIcon, ListTree, Check, Library, Quote, Sparkles,
} from 'lucide-react';
import type { Video as MediaItem } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { DAF_API, dafPath, sefariaUrl, titleMatchesDaf } from '../lib/daf';

// ----------------------------------------------------------------------
// Types mirroring the worker's /daf/get response

interface Seg { ref: string; amud: string; n: number; he: string; en: string; enHtml?: string; isMishnah?: boolean; startsMishnah?: boolean; startsGemara?: boolean; startsTopic?: boolean }
interface Comm { ref: string; title: string; heTitle: string; layer: string; he: string; en: string; url: string; anchor: string; enSource?: string; gist?: string }
interface Layer { title: string; body: string; refs?: string[] }
interface Step { refs: string[]; headline: string; explanation: string; layers?: Layer[]; deeper?: string | null }
interface Synthesis {
  tldr?: string; bigPicture?: string; continuesOn?: string | null; steps?: Step[];
  rambam?: { reading: string; rulings?: { ref: string; ruling: string }[]; commentators?: { source: string; ref: string; point: string }[] } | null;
  machlokes?: { issue: string; positions: { who: string; view: string; refs?: string[] }[] }[];
  questions?: { question: string; answer: string; refs?: string[] }[];
  sourcesUsed?: string[]; _error?: string;
}
interface HalachaItem { issue: string; refs?: string[]; rambam?: { ref: string; ruling: string } | null; shulchanArukh?: { ref: string; ruling: string } | null; rema?: { ref: string; ruling: string } | null; note?: string }
interface Halacha { available?: boolean; note?: string; items?: HalachaItem[]; caveat?: string; _error?: string }
interface Built { partial?: boolean; core: Comm[]; rishonim: Comm[]; acharonim: Comm[]; other: Comm[]; rambamSources: Comm[]; halachaSources: Comm[]; synthesis: Synthesis | null; halacha: Halacha | null }
interface Sugya {
  index: number; kind: 'mishnah' | 'gemara' | 'topic' | 'continued'; heading: string; from: string; to: string; segments: number[];
  prelude?: { from: string; to: string; segments: Seg[] }; continuation?: { from: string; to: string; segments: Seg[] }; continuesOn?: string;
  built: Built | null;
}
interface Daf {
  ref: string; heRef: string; book: string; daf: string; title: string; heTitle: string; next: string | null; prev: string | null;
  segments: Seg[]; sugyot: Sugya[]; status: 'ready' | 'building'; done: number; total: number; attribution: string;
  versions: { he: { title: string; license: string }; en: { title: string; license: string } };
}
interface TldrSoFar { upto: string; sofar: string; nowWeAre: string; keepInMind: string[] }
interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface BookmarkItem { ref: string; segRef: string; heRef: string; snippet: string; at: number }

type View = 'study' | 'daf';
type Level = 'basic' | 'intensive';
type Surface = 'paper' | 'dark';
type Lang = 'both' | 'he' | 'en';
type Sheet =
  | { kind: 'sugyot' } | { kind: 'catchup' } | { kind: 'bookmarks' } | { kind: 'ask' } | { kind: 'listen' } | { kind: 'settings' }
  | { kind: 'bigpicture'; sugya: number } | { kind: 'sources'; sugya: number; work?: string } | { kind: 'rambam'; sugya: number }
  | { kind: 'disputes'; sugya: number } | { kind: 'halacha'; sugya: number } | { kind: 'words'; sugya: number; segRef: string } | null;

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const RASHI_FONT = "'Noto Rashi Hebrew', 'Frank Ruhl Libre', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Rashi+Hebrew&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';

const PREFS_KEY = 'super_daf_prefs';
const BOOKMARKS_KEY = 'super_daf_bookmarks';
const LAST_KEY = 'super_daf_last';

function readJson<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function writeJson(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }

const KIND_LABEL: Record<Sugya['kind'], { he: string; en: string }> = {
  mishnah: { he: 'משנה', en: 'Mishnah' }, gemara: { he: 'גמרא', en: 'Gemara' }, topic: { he: 'סוגיא', en: 'New topic' }, continued: { he: 'המשך', en: 'Continued' },
};
const short = (ref: string, book: string) => ref.replace(book + ' ', '');

// ----------------------------------------------------------------------
// Text helpers

function RefText({ text, className }: { text: string; className?: string }) {
  const parts = String(text || '').split(/(\[[^\]]{3,120}\])/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]$/);
        if (m && /\d/.test(m[1])) return <a key={i} href={sefariaUrl(m[1])} target="_blank" rel="noopener noreferrer" className="sd-ref" title={m[1]} onClick={(e) => e.stopPropagation()}>{m[1]}</a>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}
function SourceLink({ r }: { r: string }) {
  return <a href={sefariaUrl(r)} target="_blank" rel="noopener noreferrer" className="sd-ref inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>{r} <ExternalLink className="w-3 h-3 opacity-60" /></a>;
}
function Rich({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  const clean = String(text || '').replace(/<\/?(?:i|em|br)\s*\/?>/gi, '').replace(/<(?!\/?b>)[^>]+>/g, '');
  const parts = clean.split(/(\*\*[^*]+\*\*|<b>[^<]*<\/b>)/g);
  return (
    <p className={className} style={style}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="sd-dh">{p.slice(2, -2)}</strong>;
        if (p.startsWith('<b>') && p.endsWith('</b>')) return <strong key={i} className="sd-dh">{p.slice(3, -4)}</strong>;
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}
// Davidson English keeps its typography: bold = the Gemara's words, regular = elucidation.
function Davidson({ html, text, literal, className, style, dir }: { html?: string; text: string; literal: boolean; className?: string; style?: CSSProperties; dir?: 'ltr' | 'rtl' }) {
  const src = html && /<b>/i.test(html) ? html : `<b>${text}</b>`;
  const tokens = src.replace(/<br\s*\/?>/gi, ' ').split(/(<\/?b>|<\/?i>|<\/?strong>|<\/?em>)/gi);
  const nodes: ReactNode[] = [];
  let bold = false, ital = false, key = 0;
  for (const tk of tokens) {
    const low = tk.toLowerCase();
    if (low === '<b>' || low === '<strong>') { bold = true; continue; }
    if (low === '</b>' || low === '</strong>') { bold = false; continue; }
    if (low === '<i>' || low === '<em>') { ital = true; continue; }
    if (low === '</i>' || low === '</em>') { ital = false; continue; }
    const t = tk.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (!t) continue;
    if (literal && !bold) continue;
    nodes.push(bold ? <strong key={key++} className={ital ? 'italic' : ''}>{t}</strong> : <span key={key++} className={`sd-eluc ${ital ? 'italic' : ''}`}>{t}</span>);
  }
  return <p className={className} style={style} dir={dir}>{nodes}</p>;
}

// A row that opens. The whole page is built from these, so "what happens
// when I tap" always has the same answer: it opens.
function Row({ title, hint, open, onToggle, children, t, accent, icon: Icon }: { title: ReactNode; hint?: ReactNode; open: boolean; onToggle: () => void; children?: ReactNode; t: any; accent?: boolean; icon?: any }) {
  return (
    <div className={`rounded-xl border ${open ? t.card : 'border-transparent'} transition-colors`}>
      <button onClick={onToggle} className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-xl ${t.hover}`}>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? '' : '-rotate-90'} ${accent ? t.accent : t.faint}`} />
        {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${t.accent}`} />}
        <span className={`min-w-0 flex-1 text-sm ${accent ? 'font-bold' : 'font-semibold'}`}>{title}</span>
        {hint && <span className={`shrink-0 text-[11px] ${t.faint}`}>{hint}</span>}
      </button>
      {open && <div className="px-3 pb-3 pt-0.5 animate-in fade-in duration-200">{children}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------

export function SuperDafPage({ initialRef, pinnedPodcastId, media, onExit }: { initialRef?: string | null; pinnedPodcastId?: string | null; media: MediaItem[]; onExit: () => void }) {
  const prefs = useMemo(() => readJson<any>(PREFS_KEY, {}), []);
  const [view, setView] = useState<View>(prefs.view === 'daf' ? 'daf' : 'study');
  const [level, setLevel] = useState<Level>(prefs.level === 'intensive' ? 'intensive' : 'basic');
  const [surface, setSurface] = useState<Surface>(prefs.surface || 'paper');
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [literal, setLiteral] = useState<boolean>(!!prefs.literal);
  const [fontScale, setFontScale] = useState<number>(prefs.fontScale || 1);
  const [current, setCurrent] = useState<{ ref: string; date: string } | null>(null);
  const [ref, setRef] = useState<string | null>(initialRef || null);
  const [daf, setDaf] = useState<Daf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sofar, setSofar] = useState<Record<string, TldrSoFar | 'loading' | { error: string }>>({});
  const [chats, setChats] = useState<Record<number, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => readJson<BookmarkItem[]>(BOOKMARKS_KEY, []));
  const [resume, setResume] = useState<{ segRef: string } | null>(null);
  const [isFull, setIsFull] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !(id in o ? o[id] : false) }));
  const toggleFrom = (id: string, dflt: boolean) => setOpen((o) => ({ ...o, [id]: !(id in o ? o[id] : dflt) }));

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_HREF; document.head.appendChild(l); }
  }, []);
  useEffect(() => { writeJson(PREFS_KEY, { view, level, surface, lang, literal, fontScale }); }, [view, level, surface, lang, literal, fontScale]);
  useEffect(() => { writeJson(BOOKMARKS_KEY, bookmarks); }, [bookmarks]);

  // Own the viewport: no document scroll, no overscroll escaping the reader.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { bo: body.style.overflow, ho: html.style.overflow, bos: body.style.overscrollBehavior, hos: html.style.overscrollBehavior };
    body.style.overflow = 'hidden'; html.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none'; html.style.overscrollBehavior = 'none';
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => { body.style.overflow = prev.bo; html.style.overflow = prev.ho; body.style.overscrollBehavior = prev.bos; html.style.overscrollBehavior = prev.hos; document.removeEventListener('fullscreenchange', onFs); };
  }, []);

  useEffect(() => {
    fetch(`${DAF_API}/current`).then((r) => r.json()).then((d) => {
      if (d && d.ref) { setCurrent({ ref: d.ref, date: d.date }); if (!initialRef) setRef(d.ref); }
      else if (!initialRef) setError('Could not determine today’s daf.');
    }).catch(() => { if (!initialRef) setError('Could not reach Super Daf.'); });
  }, [initialRef]);

  const load = useCallback(async (r: string) => {
    const res = await fetch(`${DAF_API}/get?ref=${encodeURIComponent(r)}`);
    const d = await res.json();
    if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
    if (d.status === 'unavailable') throw new Error(d.note || 'This daf is not available yet.');
    return d as Daf;
  }, []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setError(null); setDaf(null); setSheet(null); setSofar({}); setOpen({});
    window.history.replaceState({}, '', dafPath(ref) + window.location.search);
    const last = readJson<{ ref: string; segRef: string } | null>(LAST_KEY, null);
    setResume(last && last.ref === ref ? { segRef: last.segRef } : null);
    const tick = async () => {
      try {
        const d = await load(ref);
        if (cancelled) return;
        setDaf(d);
        if (d.status !== 'ready') {
          let delay = 7000;
          try { const r = await fetch(`${DAF_API}/step?ref=${encodeURIComponent(ref)}`).then((x) => x.json()); if (r && !r.locked) delay = 300; } catch { /* poll */ }
          if (!cancelled) pollRef.current = window.setTimeout(tick, delay);
        }
      } catch (e: any) { if (!cancelled) setError(e.message || 'Could not load this daf.'); }
    };
    tick();
    return () => { cancelled = true; if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [ref, load]);

  useEffect(() => {
    if (!daf) return;
    const root = scrollRef.current; if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-seg]'));
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting); if (!vis.length) return;
      const mid = root.getBoundingClientRect().top + root.clientHeight / 2;
      let best = vis[0], bestD = Infinity;
      for (const e of vis) { const d = Math.abs(e.boundingClientRect.top + e.boundingClientRect.height / 2 - mid); if (d < bestD) { bestD = d; best = e; } }
      const idx = Number((best.target as HTMLElement).dataset.seg);
      setFocusIdx(idx);
      writeJson(LAST_KEY, { ref: daf.ref, segRef: daf.segments[idx]?.ref, at: Date.now() });
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [daf, view]);

  const isCurrent = !!(daf && current && daf.ref === current.ref);
  const podcasts = useMemo(() => {
    if (!daf) return [] as MediaItem[];
    const pinned = media.filter((m) => m.id === pinnedPodcastId);
    return [...pinned, ...media.filter((m) => m.type === 'audio' && m.id !== pinnedPodcastId && titleMatchesDaf(m.title, daf.book, daf.daf))];
  }, [media, daf, pinnedPodcastId]);
  const sugyaOf = useCallback((segIdx: number) => daf ? daf.sugyot.find((s) => s.segments.includes(segIdx)) || daf.sugyot[0] : null, [daf]);
  const focusSugya = sugyaOf(focusIdx);

  const scrollToSeg = (idx: number) => scrollRef.current?.querySelector<HTMLElement>(`[data-seg="${idx}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const requestSofar = async (segIdx: number) => {
    if (!daf) return;
    const segRef = daf.segments[segIdx].ref; const sg = sugyaOf(segIdx);
    if (!sg || sofar[segRef]) return;
    setSofar((s) => ({ ...s, [segRef]: 'loading' }));
    try {
      const res = await fetch(`${DAF_API}/tldr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: daf.ref, sugya: sg.index, upto: segRef }) });
      const d = await res.json();
      setSofar((s) => ({ ...s, [segRef]: d.error ? { error: d.error } : d }));
    } catch { setSofar((s) => ({ ...s, [segRef]: { error: 'Could not reach Super Daf.' } })); }
  };
  const catchUp = (segIdx: number) => { setFocusIdx(segIdx); requestSofar(segIdx); setSheet({ kind: 'catchup' }); };

  const ask = async () => {
    if (!daf || !chatInput.trim() || chatBusy) return;
    const sg = focusSugya; if (!sg) return;
    const q = chatInput.trim(); const history = chats[sg.index] || [];
    setChats((c) => ({ ...c, [sg.index]: [...history, { role: 'user', content: q }] })); setChatInput(''); setChatBusy(true);
    try {
      const res = await fetch(`${DAF_API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: daf.ref, sugya: sg.index, question: q, history }) });
      const d = await res.json();
      setChats((c) => ({ ...c, [sg.index]: [...(c[sg.index] || []), { role: 'assistant', content: d.error ? `Sorry - ${d.error}` : d.answer }] }));
    } catch { setChats((c) => ({ ...c, [sg.index]: [...(c[sg.index] || []), { role: 'assistant', content: 'Sorry - could not reach Super Daf.' }] })); }
    finally { setChatBusy(false); }
  };

  const isBookmarked = (segRef: string) => bookmarks.some((b) => b.segRef === segRef);
  const toggleBookmark = (segIdx: number) => {
    if (!daf) return; const s = daf.segments[segIdx];
    setBookmarks((bs) => isBookmarked(s.ref) ? bs.filter((b) => b.segRef !== s.ref) : [{ ref: daf.ref, segRef: s.ref, heRef: daf.heRef, snippet: s.he.slice(0, 90), at: Date.now() }, ...bs].slice(0, 200));
  };
  const toggleFullscreen = () => {
    const el: any = rootRef.current;
    if (!document.fullscreenElement && el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  };

  const t = surface === 'paper'
    ? { shell: 'bg-[#efe7d6]', page: 'bg-[#f7f2e7] text-stone-900', card: 'bg-white/70 border-[#e3d8c1]', soft: 'bg-[#efe6d3]', muted: 'text-stone-500', faint: 'text-stone-400', rule: 'border-[#e3d8c1]', accent: 'text-indigo-700', chip: 'bg-white/80 border-[#e3d8c1] text-stone-700', hover: 'hover:bg-white/60' }
    : { shell: 'bg-slate-950', page: 'bg-slate-900 text-slate-100', card: 'bg-slate-800/60 border-slate-700/60', soft: 'bg-slate-800/60', muted: 'text-slate-400', faint: 'text-slate-500', rule: 'border-slate-800', accent: 'text-indigo-300', chip: 'bg-slate-800 border-slate-700 text-slate-200', hover: 'hover:bg-slate-800/60' };
  const showHe = lang !== 'en', showEn = lang !== 'he';
  const heStyle: CSSProperties = { fontFamily: HE_FONT, fontSize: `${1.5 * fontScale}rem`, lineHeight: 1.85 };
  const enStyle: CSSProperties = { fontFamily: EN_FONT, fontSize: `${1.04 * fontScale}rem`, lineHeight: 1.7 };
  const dateLabel = current?.date ? new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';

  const sheetTitle = (s: Exclude<Sheet, null>) => {
    if (!daf) return '';
    const sg = 'sugya' in s ? daf.sugyot[s.sugya] : null;
    const tag = sg ? `${KIND_LABEL[sg.kind].en} · ${short(sg.from, daf.book)}–${short(sg.to, daf.book)}` : '';
    switch (s.kind) {
      case 'sugyot': return 'Sugyot on this daf';
      case 'catchup': return `Catch me up · through ${short(daf.segments[focusIdx].ref, daf.book)}`;
      case 'bookmarks': return 'Bookmarks';
      case 'ask': return `Ask · ${focusSugya ? KIND_LABEL[focusSugya.kind].en + ' ' + short(focusSugya.from, daf.book) : 'this sugya'}`;
      case 'listen': return 'Listen to the daf';
      case 'settings': return 'Reading settings';
      case 'bigpicture': return `Big picture · ${tag}`;
      case 'sources': return s.work ? `${s.work} on this sugya` : `Sources · ${tag}`;
      case 'rambam': return `The Rambam · ${tag}`;
      case 'disputes': return `Disputes & questions · ${tag}`;
      case 'halacha': return `Halacha in practice · ${tag}`;
      case 'words': return `Commentaries on ${short(s.segRef, daf.book)}`;
    }
  };

  return (
    <div ref={rootRef} className={`sd fixed inset-0 z-[60] flex flex-col ${t.shell} ${surface === 'dark' ? 'sd-dark' : ''}`} style={{ overscrollBehavior: 'none' }}>
      <style>{`
        .sd .sd-ref { color: #4f46e5; text-decoration: none; border-bottom: 1px dotted rgba(79,70,229,.5); font-size: .78em; font-weight: 600; }
        .sd .sd-ref:hover { border-bottom-style: solid; }
        .sd-dark .sd-ref { color: #a5b4fc; border-bottom-color: rgba(165,180,252,.5); }
        .sd .sd-eluc { opacity: .72; font-weight: 400; }
        .sd .sd-dh { font-weight: 700; }
        .sd .sd-scroll { scrollbar-width: thin; overscroll-behavior: contain; }
        .sd .sd-para { scroll-margin-top: 5rem; }
        .sd .sd-rashi { font-family: ${RASHI_FONT}; }
        .sd .sd-hl { background: rgba(99,102,241,.14); border-radius: .35rem; }
      `}</style>

      {/* ============ top bar ============ */}
      <header className="shrink-0 h-12 sm:h-14 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 bg-slate-950 text-slate-100 border-b border-slate-800">
        <button onClick={onExit} className="p-2 rounded-full hover:bg-slate-800 text-slate-300" aria-label="Back to AI Sefarim"><ArrowLeft className="w-5 h-5" /></button>
        <button disabled={!daf?.prev} onClick={() => daf?.prev && setRef(daf.prev)} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label="Previous daf"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div className="truncate font-black text-[15px] sm:text-lg">{daf ? <><span lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{daf.heRef}</span><span className="text-slate-600 mx-2">·</span>{daf.ref}</> : ref || 'Super Daf'}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate">
            {isCurrent && dateLabel ? `Daf Yomi · ${dateLabel}` : 'Super Daf'}
            {daf && <> · {daf.segments[focusIdx]?.amud}{focusSugya ? ` · ${KIND_LABEL[focusSugya.kind].en} ${focusSugya.index + 1}/${daf.sugyot.length}` : ''}</>}
            {daf && daf.status !== 'ready' && <span className="ml-2 inline-flex items-center gap-1 text-indigo-300"><Loader2 className="w-3 h-3 animate-spin" /> preparing {daf.done}/{daf.total}</span>}
          </div>
        </div>
        <button disabled={!daf?.next || isCurrent} onClick={() => daf?.next && !isCurrent && setRef(daf.next)} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label="Next daf" title={isCurrent ? 'Tomorrow’s daf opens tonight' : 'Next daf'}>{isCurrent ? <Lock className="w-4 h-4" /> : <ChevronRight className="w-5 h-5" />}</button>
        <div className="hidden sm:flex rounded-full bg-slate-800 p-0.5 border border-slate-700 ml-1" title="Basic: the Gemara with one line per step. Intensive: the full understanding opens under each paragraph.">
          {(['basic', 'intensive'] as Level[]).map((l) => <button key={l} onClick={() => { setLevel(l); setOpen({}); }} className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${level === l ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>)}
        </div>
        <button onClick={() => setSheet(sheet?.kind === 'settings' ? null : { kind: 'settings' })} className={`p-2 rounded-full border ${sheet?.kind === 'settings' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'}`} aria-label="Reading settings" title="Reading settings"><Type className="w-4 h-4" /></button>
        <button onClick={toggleFullscreen} className="hidden sm:inline-flex p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:text-white" aria-label="Full screen" title={isFull ? 'Exit full screen' : 'Full screen'}>{isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
      </header>

      {/* ============ body ============ */}
      <div className="flex-1 min-h-0 flex">
        {daf && <Minimap daf={daf} focusIdx={focusIdx} onJump={scrollToSeg} bookmarks={bookmarks} surface={surface} />}
        <div ref={scrollRef} className="sd-scroll flex-1 min-w-0 overflow-y-auto">
          {error && (
            <div className="max-w-xl mx-auto mt-16 px-4 text-center">
              <div className={`rounded-2xl border ${t.card} p-6`}>
                <p className="text-sm font-semibold">{error}</p>
                {current && ref !== current.ref && <button onClick={() => setRef(current.ref)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 text-xs font-black">Open today’s daf · {current.ref}</button>}
              </div>
            </div>
          )}
          {!daf && !error && <div className="mt-20 flex flex-col items-center gap-3 text-slate-500"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /><p className="text-sm font-medium">Opening the daf…</p></div>}
          {daf && resume && (
            <div className="sticky top-2 z-20 mx-auto w-fit max-w-[92%]">
              <button onClick={() => { const i = daf.segments.findIndex((s) => s.ref === resume.segRef); if (i >= 0) scrollToSeg(i); setResume(null); }} className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-slate-100 border border-slate-700 shadow-xl px-4 py-2 text-xs font-bold">
                <Bookmark className="w-3.5 h-3.5 text-indigo-300" /> Continue from {short(resume.segRef, daf.book)}
                <span onClick={(e) => { e.stopPropagation(); setResume(null); }} className="ml-1 text-slate-500 hover:text-slate-200"><X className="w-3.5 h-3.5" /></span>
              </button>
            </div>
          )}
          {daf && view === 'study' && (
            <StudyView daf={daf} t={t} level={level} showHe={showHe} showEn={showEn} literal={literal} heStyle={heStyle} enStyle={enStyle} fontScale={fontScale}
              open={open} toggle={toggle} toggleFrom={toggleFrom} isBookmarked={isBookmarked} toggleBookmark={toggleBookmark} onCatchUp={catchUp} openSheet={setSheet} />
          )}
          {daf && view === 'daf' && <DafView daf={daf} t={t} showEn={showEn} literal={literal} fontScale={fontScale} onSelect={(i) => { setView('study'); setTimeout(() => scrollToSeg(i), 60); }} />}
          {daf && <footer className={`px-6 py-8 text-[11px] ${t.faint} leading-relaxed max-w-3xl mx-auto`}>{daf.attribution} · <a className="sd-ref" href={sefariaUrl(daf.ref)} target="_blank" rel="noopener noreferrer">open on Sefaria</a></footer>}
        </div>
      </div>

      {/* ============ dock ============ */}
      {daf && (
        <nav className="shrink-0 bg-slate-950 border-t border-slate-800 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
          <div className="max-w-xl mx-auto grid grid-cols-5 gap-1">
            {([
              { id: 'sugyot', label: 'Sugyot', icon: ListTree }, { id: 'catchup', label: 'Catch me up', icon: Clock }, { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
              { id: 'ask', label: 'Ask', icon: MessageSquareText }, { id: 'listen', label: 'Listen', icon: Headphones },
            ] as { id: 'sugyot' | 'catchup' | 'bookmarks' | 'ask' | 'listen'; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => {
              const disabled = id === 'listen' && podcasts.length === 0;
              const active = sheet?.kind === id;
              return (
                <button key={id} disabled={disabled} onClick={() => { if (id === 'catchup') requestSofar(focusIdx); setSheet(active ? null : { kind: id }); }} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition-colors disabled:opacity-30 ${active ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-100'}`}>
                  <Icon className="w-5 h-5" />{label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ============ sheets ============ */}
      {daf && sheet && (
        <SheetFrame onClose={() => setSheet(null)} title={sheetTitle(sheet)} tall={sheet.kind === 'ask' || sheet.kind === 'sugyot' || sheet.kind === 'sources'} back={('work' in sheet && sheet.work) ? () => setSheet({ kind: 'sources', sugya: (sheet as any).sugya }) : undefined}>
          {sheet.kind === 'sugyot' && (
            <div className="space-y-2">
              {daf.sugyot.map((s) => (
                <button key={s.index} onClick={() => { scrollToSeg(s.segments[0]); setSheet(null); }} className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${focusSugya?.index === s.index ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800'}`}>
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-indigo-300"><span lang="he" style={{ fontFamily: HE_FONT, fontSize: '0.95rem' }}>{KIND_LABEL[s.kind].he}</span> {KIND_LABEL[s.kind].en}<span className="text-slate-500 normal-case tracking-normal font-semibold ml-auto">{short(s.from, daf.book)} – {short(s.to, daf.book)}</span></div>
                  <p className="mt-1 text-sm text-slate-200 line-clamp-3" style={{ fontFamily: EN_FONT }}>{s.built?.synthesis?.tldr || daf.segments[s.segments[0]].en.slice(0, 180) + '…'}</p>
                </button>
              ))}
            </div>
          )}
          {sheet.kind === 'catchup' && <CatchUp data={sofar[daf.segments[focusIdx].ref]} segRef={short(daf.segments[focusIdx].ref, daf.book)} />}
          {sheet.kind === 'bookmarks' && (bookmarks.length === 0 ? <p className="text-sm text-slate-400">No bookmarks yet. Tap the bookmark icon beside any paragraph to save your place.</p> : (
            <div className="space-y-2">
              {bookmarks.map((b) => (
                <div key={b.segRef} className="flex items-start gap-2 rounded-2xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5">
                  <button onClick={() => { if (b.ref === daf.ref) { const i = daf.segments.findIndex((s) => s.ref === b.segRef); if (i >= 0) scrollToSeg(i); } else setRef(b.ref); setSheet(null); }} className="min-w-0 flex-1 text-left">
                    <p className="text-[11px] font-black text-indigo-300">{b.segRef}</p>
                    <p lang="he" dir="rtl" className="text-sm text-slate-200 line-clamp-2" style={{ fontFamily: HE_FONT }}>{b.snippet}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(b.at).toLocaleDateString()}</p>
                  </button>
                  <button onClick={() => setBookmarks((bs) => bs.filter((x) => x.segRef !== b.segRef))} className="p-1.5 text-slate-500 hover:text-rose-300" aria-label="Remove bookmark"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          ))}
          {sheet.kind === 'ask' && focusSugya && <AskThread messages={chats[focusSugya.index] || []} busy={chatBusy} input={chatInput} setInput={setChatInput} onSend={ask} />}
          {sheet.kind === 'listen' && <div className="space-y-3">{podcasts.map((p) => <div key={p.id} className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-3"><p className="text-sm font-black text-slate-100 mb-2">{p.title}</p><AudioPlayer url={p.url} title={p.title} /></div>)}</div>}
          {sheet.kind === 'settings' && (
            <div className="space-y-5">
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Level</p><Segmented value={level} onChange={(v) => { setLevel(v as Level); setOpen({}); }} options={[{ v: 'basic', l: 'Basic' }, { v: 'intensive', l: 'Intensive' }]} /><p className="text-[11px] text-slate-500 mt-1.5">Basic: the Gemara with one line per step; everything else a tap away. Intensive: the full understanding opens under each paragraph.</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">View</p><Segmented value={view} onChange={(v) => setView(v as View)} options={[{ v: 'study', l: 'Study' }, { v: 'daf', l: 'Page (tzurat hadaf)' }]} /></div>
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Language</p><Segmented value={lang} onChange={(v) => setLang(v as Lang)} options={[{ v: 'both', l: 'Hebrew + English' }, { v: 'he', l: 'Hebrew' }, { v: 'en', l: 'English' }]} /></div>
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Translation</p><Segmented value={literal ? 'literal' : 'full'} onChange={(v) => setLiteral(v === 'literal')} options={[{ v: 'full', l: 'Full (with elucidation)' }, { v: 'literal', l: 'Literal words only' }]} /><p className="text-[11px] text-slate-500 mt-1.5"><strong className="text-slate-300">Bold</strong> is the Gemara’s own words; lighter text is the Davidson elucidation.</p></div>
              <div className="flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Text size</p><div className="flex items-center rounded-full bg-slate-800 border border-slate-700"><button onClick={() => setFontScale((f) => Math.max(0.8, +(f - 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Smaller"><Minus className="w-4 h-4" /></button><span className="text-xs font-black text-slate-200 w-10 text-center tabular-nums">{Math.round(fontScale * 100)}%</span><button onClick={() => setFontScale((f) => Math.min(1.7, +(f + 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Larger"><Plus className="w-4 h-4" /></button></div></div>
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Page</p><Segmented value={surface} onChange={(v) => setSurface(v as Surface)} options={[{ v: 'paper', l: 'Paper', icon: Sun }, { v: 'dark', l: 'Dark', icon: Moon }]} /></div>
            </div>
          )}
          {'sugya' in sheet && <SugyaSheet sheet={sheet} daf={daf} sugya={daf.sugyot[sheet.sugya]} openSheet={setSheet} />}
        </SheetFrame>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Study view (Daf HQ): calm by default, everything one tap away.

function StudyView({ daf, t, level, showHe, showEn, literal, heStyle, enStyle, fontScale, open, toggle, toggleFrom, isBookmarked, toggleBookmark, onCatchUp, openSheet }: {
  daf: Daf; t: any; level: Level; showHe: boolean; showEn: boolean; literal: boolean; heStyle: CSSProperties; enStyle: CSSProperties; fontScale: number;
  open: Record<string, boolean>; toggle: (id: string) => void; toggleFrom: (id: string, dflt: boolean) => void; isBookmarked: (r: string) => boolean; toggleBookmark: (i: number) => void; onCatchUp: (i: number) => void; openSheet: (s: Sheet) => void;
}) {
  const isOpen = (id: string, dflt = false) => (id in open ? open[id] : dflt);
  return (
    <div className={`${t.page} min-h-full`}>
      <div className="max-w-3xl mx-auto px-3 sm:px-8 pt-4 pb-10">
        <p className={`text-[11px] ${t.faint} mb-4 text-center`}>Every <ChevronDown className="inline w-3 h-3 -rotate-90" /> row opens. Nothing here is more than two taps deep.</p>
        {daf.sugyot.map((sugya) => {
          const built = sugya.built;
          const syn = built?.synthesis && !built.synthesis._error ? built.synthesis : null;
          const steps = syn?.steps || [];
          const stepFor = (ref: string) => steps.find((st) => (st.refs || []).includes(ref));
          const allComm = built ? [...built.core, ...built.rishonim, ...built.acharonim, ...built.other] : [];
          const works = Array.from(new Set(allComm.map((c) => c.title)));
          const halItems = (built?.halacha?.items || []) as HalachaItem[];
          const hasRambam = !!syn?.rambam;
          const hasDisputes = !!(syn && ((syn.machlokes && syn.machlokes.length) || (syn.questions && syn.questions.length)));
          const hasHalacha = !!(built?.halacha?.available && halItems.length);
          const chip = (label: ReactNode, onClick: () => void, icon: any, dim = false) => {
            const Icon = icon;
            return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${t.chip} ${t.hover} ${dim ? 'opacity-50' : ''}`}><Icon className={`w-3.5 h-3.5 ${t.accent}`} />{label}</button>;
          };
          return (
            <section key={sugya.index} className="mb-10">
              {/* ---- sugya HQ card ---- */}
              <div className={`rounded-2xl border ${t.card} px-4 py-3 mb-3 shadow-sm`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${sugya.kind === 'mishnah' ? 'bg-amber-500/15 text-amber-800 border border-amber-500/30' : 'bg-indigo-500/10 border border-indigo-500/30 ' + t.accent}`}>
                    <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '1rem' }}>{KIND_LABEL[sugya.kind].he}</span><span className="uppercase tracking-wider">{KIND_LABEL[sugya.kind].en}</span>
                  </span>
                  <span className={`text-xs font-bold ${t.muted}`}>{short(sugya.from, daf.book)} – {short(sugya.to, daf.book)}</span>
                  {sugya.prelude && <button onClick={() => toggle(`pre-${sugya.index}`)} className={`text-[11px] font-bold ${t.accent}`}>began on {short(sugya.prelude.from, daf.book)} · {isOpen(`pre-${sugya.index}`) ? 'hide' : 'read'}</button>}
                  {!built && <span className={`ml-auto text-[11px] ${t.faint} inline-flex items-center gap-1`}><Loader2 className="w-3 h-3 animate-spin" /> preparing</span>}
                </div>
                {isOpen(`pre-${sugya.index}`) && sugya.prelude && (
                  <div className={`mt-3 rounded-xl border border-dashed ${t.rule} ${t.soft} px-3 py-3`}>
                    {sugya.prelude.segments.map((s) => (<div key={s.ref} className="mb-2.5">{showHe && <p lang="he" dir="rtl" style={{ fontFamily: HE_FONT, fontSize: `${1.1 * fontScale}rem`, lineHeight: 1.75 }}>{s.he}</p>}{showEn && <Davidson text={s.en} html={s.enHtml} literal={literal} style={{ fontFamily: EN_FONT, fontSize: `${0.92 * fontScale}rem`, lineHeight: 1.6 }} className={t.muted} />}</div>))}
                  </div>
                )}
                {syn?.tldr && <p className="mt-2.5" style={{ ...enStyle, fontSize: `${0.98 * fontScale}rem` }}><span className={`font-black text-[10px] uppercase tracking-wider mr-2 ${t.accent}`}>TL;DR</span>{syn.tldr}</p>}
                {built && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {syn?.bigPicture && chip('Big picture', () => openSheet({ kind: 'bigpicture', sugya: sugya.index }), Sparkles)}
                    {works.length > 0 && chip(<>Sources <span className={t.faint}>{works.length}</span></>, () => openSheet({ kind: 'sources', sugya: sugya.index }), Library)}
                    {chip('Rambam', () => openSheet({ kind: 'rambam', sugya: sugya.index }), Landmark, !hasRambam)}
                    {chip('Disputes & questions', () => openSheet({ kind: 'disputes', sugya: sugya.index }), Quote, !hasDisputes)}
                    {chip('Halacha', () => openSheet({ kind: 'halacha', sugya: sugya.index }), Scale, !hasHalacha)}
                  </div>
                )}
              </div>

              {/* ---- paragraphs ---- */}
              {sugya.segments.map((idx) => {
                const s = daf.segments[idx];
                const step = stepFor(s.ref);
                const stepId = step ? `step-${sugya.index}-${steps.indexOf(step)}` : `step-${s.ref}`;
                const first = !step || step.refs[0] === s.ref;
                const comm = allComm.filter((c) => c.anchor === s.ref);
                const hal = halItems.filter((h) => (h.refs || []).includes(s.ref));
                const stepHal = step ? halItems.filter((h) => step.refs.some((r) => (h.refs || []).includes(r))) : hal;
                const stepOpen = isOpen(stepId, level === 'intensive');
                return (
                  <article key={s.ref} data-seg={idx} className="sd-para rounded-2xl px-2 sm:px-3 py-3 mb-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {s.startsMishnah && <p className={`text-[10px] font-black uppercase tracking-widest ${t.accent} mb-1`}>Mishnah</p>}
                        {s.startsGemara && <p className={`text-[10px] font-black uppercase tracking-widest ${t.accent} mb-1`}>Gemara</p>}
                        {showHe && <p lang="he" dir="rtl" style={heStyle}>{s.he}</p>}
                        {showEn && <Davidson text={s.en} html={s.enHtml} literal={literal} style={enStyle} className={showHe ? 'mt-2' : ''} />}
                      </div>
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <span className={`text-[10px] ${t.faint} font-bold tabular-nums`}>{s.amud}:{s.n}</span>
                        <button onClick={() => toggleBookmark(idx)} className={`p-1 rounded-md ${isBookmarked(s.ref) ? 'text-amber-500' : t.faint + ' hover:text-amber-500'}`} aria-label="Bookmark this paragraph">{isBookmarked(s.ref) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}</button>
                      </div>
                    </div>

                    {/* ---- the understanding: one row, layered ---- */}
                    <div className="mt-2">
                      {!built ? (
                        <p className={`px-2.5 text-[11px] ${t.faint} inline-flex items-center gap-1.5`}><Loader2 className="w-3 h-3 animate-spin" /> understanding on its way</p>
                      ) : step && first ? (
                        <Row t={t} accent open={stepOpen} onToggle={() => toggleFrom(stepId, level === 'intensive')} title={step.headline} hint={step.refs.length > 1 ? `${step.refs.length} paragraphs` : undefined}>
                          <p className="text-sm leading-relaxed" style={{ fontFamily: EN_FONT, fontSize: `${0.98 * fontScale}rem` }}><RefText text={step.explanation} /></p>
                          <div className="mt-2 space-y-1">
                            {(step.layers || []).map((ly, li) => (
                              <Row key={li} t={t} open={isOpen(`${stepId}-l${li}`)} onToggle={() => toggle(`${stepId}-l${li}`)} title={ly.title}>
                                <p className="text-sm leading-relaxed"><RefText text={ly.body} /></p>
                                {ly.refs?.length ? <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">{ly.refs.map((r) => <SourceLink key={r} r={r} />)}</p> : null}
                              </Row>
                            ))}
                            {step.refs.map((r) => {
                              const cs = allComm.filter((c) => c.anchor === r);
                              if (!cs.length) return null;
                              return (
                                <Row key={r} t={t} open={isOpen(`${stepId}-w-${r}`)} onToggle={() => toggle(`${stepId}-w-${r}`)} title={<>The commentaries{step.refs.length > 1 ? ` on ${short(r, daf.book)}` : ''}</>} hint={`${cs.length}`}>
                                  <Words comms={cs} t={t} showHe={showHe} showEn={showEn} fontScale={fontScale} open={open} toggle={toggle} />
                                </Row>
                              );
                            })}
                            {stepHal.length > 0 && (
                              <Row t={t} icon={Scale} open={isOpen(`${stepId}-hal`)} onToggle={() => toggle(`${stepId}-hal`)} title="Halacha here · Rambam, Shulchan Arukh, Rema">
                                <HalachaItems items={stepHal} t={t} />
                              </Row>
                            )}
                            {step.deeper && (
                              <Row t={t} open={isOpen(`${stepId}-deep`)} onToggle={() => toggle(`${stepId}-deep`)} title="Go deeper">
                                <p className="text-sm leading-relaxed"><RefText text={step.deeper} /></p>
                              </Row>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button onClick={() => onCatchUp(idx)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}><Clock className="w-3 h-3" /> Catch me up to here</button>
                            <button onClick={() => openSheet({ kind: 'ask' })} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}><MessageSquareText className="w-3 h-3" /> Ask</button>
                          </div>
                        </Row>
                      ) : step ? (
                        <p className={`px-2.5 text-[11px] ${t.faint}`}>↑ part of “{step.headline}”{comm.length ? <> · <button onClick={() => openSheet({ kind: 'words', sugya: sugya.index, segRef: s.ref })} className={`font-bold ${t.accent}`}>{comm.length} commentar{comm.length === 1 ? 'y' : 'ies'} here</button></> : null}{hal.length ? <> · <button onClick={() => openSheet({ kind: 'halacha', sugya: sugya.index })} className={`font-bold ${t.accent}`}>halacha here</button></> : null}</p>
                      ) : (
                        comm.length ? <button onClick={() => openSheet({ kind: 'words', sugya: sugya.index, segRef: s.ref })} className={`px-2.5 text-[11px] font-bold ${t.accent}`}>{comm.length} commentar{comm.length === 1 ? 'y' : 'ies'} on this paragraph</button> : null
                      )}
                    </div>
                  </article>
                );
              })}
              {sugya.continuesOn && <p className={`mt-2 px-3 text-xs ${t.muted} italic`}>This sugya continues on {short(sugya.continuesOn, daf.book)} — tomorrow’s daf.{syn?.continuesOn ? ` ${syn.continuesOn}` : ''}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Each commentary as a one-line gist; the words open underneath it.
function Words({ comms, t, showHe, showEn, fontScale, open, toggle }: { comms: Comm[]; t: any; showHe: boolean; showEn: boolean; fontScale: number; open: Record<string, boolean>; toggle: (id: string) => void }) {
  return (
    <div className="space-y-1.5">
      {comms.map((c) => {
        const id = `w-${c.ref}`;
        return (
          <div key={c.ref} className={`rounded-xl ${t.soft} px-3 py-2`}>
            <p className="text-sm"><span className={`font-black ${t.accent}`}>{c.title}</span>{c.gist ? <> — {c.gist}</> : null}</p>
            <button onClick={() => toggle(id)} className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${t.accent}`}><ChevronDown className={`w-3 h-3 transition-transform ${open[id] ? '' : '-rotate-90'}`} /> {open[id] ? 'Hide the words' : 'Read the words'}</button>
            {open[id] && (
              <div className="mt-1.5 animate-in fade-in duration-200">
                {showHe && <p lang="he" dir="rtl" className="sd-rashi" style={{ fontSize: `${1.12 * fontScale}rem`, lineHeight: 1.7 }}>{c.he}</p>}
                {showEn && (c.en ? <Rich text={c.en} style={{ fontFamily: EN_FONT, fontSize: `${0.9 * fontScale}rem`, lineHeight: 1.6 }} className={`${t.muted} mt-1`} /> : <p className={`text-xs italic ${t.faint} mt-1`}>No translation yet.</p>)}
                <p className={`text-[10px] ${t.faint} mt-1`}><SourceLink r={c.ref} />{c.enSource === 'ai' && showEn && <span className="ml-1.5 italic">AI translation</span>}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HalachaItems({ items, t }: { items: HalachaItem[]; t: any }) {
  const cell = (x: any, label: string) => (
    <div className={`rounded-xl ${t.soft} px-3 py-2 min-w-0`}>
      <p className={`text-[10px] font-black uppercase tracking-wider ${t.faint}`}>{label}</p>
      {x ? <><p className="text-sm mt-0.5"><RefText text={x.ruling} /></p><p className="mt-1"><SourceLink r={x.ref} /></p></> : <p className={`text-xs mt-0.5 ${t.faint} italic`}>not linked here</p>}
    </div>
  );
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <p className="text-sm font-bold mb-1.5"><RefText text={it.issue} /></p>
          <div className="grid gap-2 sm:grid-cols-3">{cell(it.rambam, 'Rambam')}{cell(it.shulchanArukh, 'Shulchan Arukh')}{cell(it.rema, 'Rema')}</div>
          {it.note && <p className={`mt-1.5 text-xs ${t.muted} italic`}><RefText text={it.note} /></p>}
        </div>
      ))}
      <p className={`text-[11px] ${t.faint}`}>For practice, confirm with your rav.</p>
    </div>
  );
}

// Sheets that belong to one sugya: big picture, sources, Rambam, disputes, halacha, words on a paragraph.
function SugyaSheet({ sheet, daf, sugya, openSheet }: { sheet: Exclude<Sheet, null> & { sugya: number }; daf: Daf; sugya: Sugya; openSheet: (s: Sheet) => void }) {
  const dark = { card: 'bg-slate-800/60 border-slate-700/60', soft: 'bg-slate-800/60', muted: 'text-slate-400', faint: 'text-slate-500', accent: 'text-indigo-300', chip: 'bg-slate-800 border-slate-700 text-slate-200', hover: 'hover:bg-slate-800' };
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const built = sugya.built; const syn = built?.synthesis && !built.synthesis._error ? built.synthesis : null;
  const all = built ? [...built.core, ...built.rishonim, ...built.acharonim, ...built.other] : [];
  if (!built) return <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Still preparing this sugya.</p>;
  if (sheet.kind === 'bigpicture') return (
    <div className="space-y-3 text-sm leading-relaxed" style={{ fontFamily: EN_FONT, fontSize: '1rem' }}>
      <RefText text={syn?.bigPicture || 'Not available yet.'} className="block" />
      {syn?.continuesOn && <p className="text-slate-400 italic">{syn.continuesOn}</p>}
      {syn?.sourcesUsed?.length ? <p className="text-[11px] text-slate-500">Drawn from: {syn.sourcesUsed.join(', ')}.</p> : null}
    </div>
  );
  if (sheet.kind === 'sources') {
    if (sheet.work) return <Words comms={all.filter((c) => c.title === sheet.work)} t={dark} showHe showEn fontScale={1} open={open} toggle={toggle} />;
    const works = Array.from(new Set(all.map((c) => c.title))).map((w) => ({ w, n: all.filter((c) => c.title === w).length, layer: all.find((c) => c.title === w)!.layer }));
    const order = ['core', 'rishonim', 'acharonim', 'other'];
    works.sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer) || b.n - a.n);
    const label: Record<string, string> = { core: 'Rashi & Tosafot', rishonim: 'Rishonim', acharonim: 'Acharonim', other: 'Other commentaries' };
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500">Everything Sefaria links to this sugya. A work missing here (Rashba, Ritva, Meiri on some tractates) is not available on Sefaria for this passage; nothing is reconstructed from memory.</p>
        {order.filter((l) => works.some((w) => w.layer === l)).map((l) => (
          <div key={l}>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{label[l]}</p>
            <div className="flex flex-wrap gap-1.5">{works.filter((w) => w.layer === l).map((w) => <button key={w.w} onClick={() => openSheet({ kind: 'sources', sugya: sheet.sugya, work: w.w })} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700">{w.w} <span className="text-slate-500">{w.n}</span></button>)}</div>
          </div>
        ))}
        {built.rambamSources.length > 0 && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Rambam & his commentators</p><div className="flex flex-wrap gap-1.5">{Array.from(new Set(built.rambamSources.map((c) => c.title))).map((w) => <button key={w} onClick={() => openSheet({ kind: 'rambam', sugya: sheet.sugya })} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700">{w}</button>)}</div></div>}
      </div>
    );
  }
  if (sheet.kind === 'rambam') {
    const r = syn?.rambam;
    return (
      <div className="space-y-3 text-sm">
        {!r ? <p className="text-slate-400">Sefaria links no Mishneh Torah or Rambam commentary to this sugya, so there is no sourced Rambam section here.</p> : (
          <>
            <p className="leading-relaxed" style={{ fontFamily: EN_FONT, fontSize: '1rem' }}><RefText text={r.reading} /></p>
            {r.rulings?.length ? <div className="space-y-2">{r.rulings.map((x, i) => <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2"><p className="text-[11px] font-black"><SourceLink r={x.ref} /></p><p className="mt-0.5"><RefText text={x.ruling} /></p></div>)}</div> : null}
            {r.commentators?.length ? <ul className="space-y-1.5">{r.commentators.map((c, i) => <li key={i} className="flex gap-2"><span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border border-slate-700 bg-slate-800">{c.source}</span><span><RefText text={c.point} /> <SourceLink r={c.ref} /></span></li>)}</ul> : null}
          </>
        )}
        {built.rambamSources.length > 0 && <Row t={dark} open={!!open.rsrc} onToggle={() => toggle('rsrc')} title="Read the Rambam texts" hint={`${built.rambamSources.length}`}><Words comms={built.rambamSources} t={dark} showHe showEn fontScale={1} open={open} toggle={toggle} /></Row>}
      </div>
    );
  }
  if (sheet.kind === 'disputes') return (
    <div className="space-y-4 text-sm">
      {syn?.machlokes?.length ? <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Where the commentaries part ways</p><div className="space-y-3">{syn.machlokes.map((m, i) => <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5"><p className="font-bold"><RefText text={m.issue} /></p><ul className="mt-1.5 space-y-1">{m.positions.map((p, j) => <li key={j} className="flex gap-2"><span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border border-slate-700 bg-slate-800">{p.who}</span><span><RefText text={p.view} /> {p.refs?.map((r) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</span></li>)}</ul></div>)}</div></div> : null}
      {syn?.questions?.length ? <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Questions the commentaries ask</p><div className="space-y-3">{syn.questions.map((q, i) => <div key={i}><p className="font-bold"><RefText text={q.question} /></p><p className="mt-0.5 text-slate-300"><RefText text={q.answer} /> {q.refs?.map((r) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</p></div>)}</div></div> : null}
      {!syn?.machlokes?.length && !syn?.questions?.length && <p className="text-slate-400">No disputes or classic questions were found in the sources linked to this sugya.</p>}
    </div>
  );
  if (sheet.kind === 'halacha') {
    const h = built.halacha;
    return !h || !h.available ? <p className="text-sm text-slate-400">{h?.note || 'No halachic codes are linked to this sugya on Sefaria.'}</p> : <div className="space-y-3"><HalachaItems items={h.items || []} t={dark} />{h.caveat && <p className="text-[11px] text-slate-500">{h.caveat}</p>}</div>;
  }
  if (sheet.kind === 'words') {
    const cs = all.filter((c) => c.anchor === sheet.segRef);
    return cs.length ? <Words comms={cs} t={dark} showHe showEn fontScale={1} open={open} toggle={toggle} /> : <p className="text-sm text-slate-400">No commentary on Sefaria is anchored to this paragraph.</p>;
  }
  return null;
}

// ----------------------------------------------------------------------
// Minimap: the daf drawn as pages, one per amud.

function Minimap({ daf, focusIdx, onJump, bookmarks, surface }: { daf: Daf; focusIdx: number; onJump: (i: number) => void; bookmarks: BookmarkItem[]; surface: Surface }) {
  const W = 104, PAD = 6, COL = 20, GAP = 4, GEM = W - PAD * 2 - (COL + GAP) * 2;
  const amudim = useMemo(() => { const g: Record<string, number[]> = {}; daf.segments.forEach((s, i) => { (g[s.amud] = g[s.amud] || []).push(i); }); return Object.entries(g); }, [daf]);
  const core = daf.sugyot.flatMap((s) => s.built?.core || []);
  const count = (segRef: string, title: string) => core.filter((c) => c.anchor === segRef && c.title === title).length;
  const marked = new Set(bookmarks.filter((b) => b.ref === daf.ref).map((b) => b.segRef));
  const fill = surface === 'paper' ? { page: '#fbf7ee', stroke: '#d9cdb3', block: '#cfc3a9', mishnah: '#e8c279', side: '#ddd3bd', focus: '#4f46e5', text: '#8a7f6a' } : { page: '#0f172a', stroke: '#334155', block: '#475569', mishnah: '#b45309', side: '#334155', focus: '#818cf8', text: '#94a3b8' };
  return (
    <aside className="hidden md:flex shrink-0 w-[128px] flex-col items-center gap-3 py-3 overflow-y-auto sd-scroll border-r border-black/5" aria-label="Where you are on the daf">
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: fill.text }}><MapIcon className="w-3 h-3" /> The daf</div>
      {amudim.map(([amud, idxs]) => {
        const total = idxs.reduce((a, i) => a + Math.max(40, daf.segments[i].he.length), 0);
        const H = Math.min(440, Math.max(160, Math.round(total / 9)));
        let y = PAD + 14;
        const rows = idxs.map((i) => { const h = Math.max(5, Math.round((Math.max(40, daf.segments[i].he.length) / total) * (H - PAD * 2 - 14)) - 2); const r = { i, y, h }; y += h + 2; return r; });
        return (
          <svg key={amud} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 drop-shadow-sm">
            <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={6} fill={fill.page} stroke={fill.stroke} />
            <text x={W / 2} y={11} textAnchor="middle" fontSize={8} fontWeight={800} fill={fill.text} style={{ fontFamily: HE_FONT }}>{daf.heTitle} {amud.endsWith('a') ? 'ע״א' : 'ע״ב'}</text>
            {rows.map(({ i, y, h }) => {
              const s = daf.segments[i]; const isFocus = i === focusIdx;
              const sugyaStart = daf.sugyot.some((sg) => sg.segments[0] === i && sg.kind !== 'continued');
              const rashi = count(s.ref, 'Rashi'), tos = count(s.ref, 'Tosafot');
              return (
                <g key={i} onClick={() => onJump(i)} className="cursor-pointer">
                  {sugyaStart && <line x1={PAD} x2={W - PAD} y1={y - 1.5} y2={y - 1.5} stroke={fill.focus} strokeOpacity={0.5} strokeWidth={1} />}
                  <rect x={PAD} y={y} width={COL} height={Math.min(h, 4 + tos * 6)} rx={1.5} fill={fill.side} opacity={tos ? 0.9 : 0.25} />
                  <rect x={PAD + COL + GAP} y={y} width={GEM} height={h} rx={2} fill={isFocus ? fill.focus : s.isMishnah ? fill.mishnah : fill.block} opacity={isFocus ? 1 : 0.85} />
                  <rect x={W - PAD - COL} y={y} width={COL} height={Math.min(h, 4 + rashi * 6)} rx={1.5} fill={fill.side} opacity={rashi ? 0.9 : 0.25} />
                  {marked.has(s.ref) && <circle cx={W - PAD - COL - 3} cy={y + 3} r={2.2} fill="#f59e0b" />}
                </g>
              );
            })}
          </svg>
        );
      })}
      <p className="px-2 text-[9px] leading-tight text-center" style={{ color: fill.text }}>Center: Gemara · right: Rashi · left: Tosafot · tap to jump</p>
    </aside>
  );
}

// ----------------------------------------------------------------------
// Page view: each amud in the form of the printed daf (columns from iPad width up).

function DafView({ daf, t, showEn, literal, fontScale, onSelect }: { daf: Daf; t: any; showEn: boolean; literal: boolean; fontScale: number; onSelect: (i: number) => void }) {
  const amudim = useMemo(() => { const g: Record<string, number[]> = {}; daf.segments.forEach((s, i) => { (g[s.amud] = g[s.amud] || []).push(i); }); return Object.entries(g); }, [daf]);
  const core = daf.sugyot.flatMap((s) => s.built?.core || []);
  const [hover, setHover] = useState<string | null>(null);
  const lemma = (he: string) => { const m = he.match(/^(.{2,60}?)(\s[-–—]\s|\.\s)/); return m ? [m[1], he.slice(m[0].length)] : [he.split(' ').slice(0, 3).join(' '), he.split(' ').slice(3).join(' ')]; };
  const Col = ({ items, empty }: { items: Comm[]; empty: string }) => (
    <div className={`sd-rashi ${t.muted}`} dir="rtl" style={{ fontSize: `${0.95 * fontScale}rem`, lineHeight: 1.6 }}>
      {items.length === 0 && <p className={`text-[11px] ${t.faint}`} style={{ fontFamily: EN_FONT }} dir="ltr">{empty}</p>}
      {items.map((c) => { const [dh, rest] = lemma(c.he); const on = hover === c.anchor; return (
        <p key={c.ref} className={`mb-1.5 ${on ? 'sd-hl px-1 -mx-1' : ''}`} onMouseEnter={() => setHover(c.anchor)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(daf.segments.findIndex((s) => s.ref === c.anchor))}><span className="font-bold">{dh}</span> {rest}</p>
      ); })}
    </div>
  );
  return (
    <div className="px-2 sm:px-4 py-4 space-y-8">
      <p className={`text-[11px] ${t.faint} text-center`}>The printed form of the page. Hover or tap a paragraph to light its Rashi and Tosafot; tap to study it.</p>
      {amudim.map(([amud, idxs]) => {
        const rashi = core.filter((c) => c.title === 'Rashi' && idxs.some((i) => daf.segments[i].ref === c.anchor));
        const tos = core.filter((c) => c.title === 'Tosafot' && idxs.some((i) => daf.segments[i].ref === c.anchor));
        return (
          <div key={amud} className={`${t.page} mx-auto max-w-6xl rounded-[1.25rem] shadow-[0_30px_60px_-30px_rgba(0,0,0,.5)] border ${t.rule} px-3 sm:px-6 py-5`}>
            <div className="flex items-baseline justify-between mb-4">
              <span className={`text-xs font-black uppercase tracking-[0.2em] ${t.faint}`}>{daf.book} {amud}</span>
              <span lang="he" dir="rtl" className="font-black text-xl" style={{ fontFamily: HE_FONT }}>{daf.heTitle} · דף {daf.heRef.split(' ').pop()} {amud.endsWith('a') ? 'ע״א' : 'ע״ב'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-4 md:gap-6">
              <div className="order-2 md:order-1"><p className={`text-[10px] font-black uppercase tracking-wider ${t.faint} mb-1`}>תוספות</p><Col items={tos} empty="No Tosafot on Sefaria for this amud" /></div>
              <div className="order-1 md:order-2" dir="rtl">
                {idxs.map((i) => { const s = daf.segments[i]; const on = hover === s.ref; return (
                  <div key={s.ref} data-seg={i} className={`sd-para mb-2 cursor-pointer rounded-lg px-1 -mx-1 ${on ? 'sd-hl' : ''}`} onMouseEnter={() => setHover(s.ref)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(i)}>
                    <p lang="he" style={{ fontFamily: HE_FONT, fontSize: `${1.35 * fontScale}rem`, lineHeight: 1.8 }}>{s.startsMishnah && <span className="font-black ml-1">מתני׳</span>}{s.startsGemara && <span className="font-black ml-1">גמ׳</span>}{s.startsTopic && <span className={`ml-1 ${t.accent}`}>§</span>}{s.he}</p>
                    {showEn && <Davidson text={s.en} html={s.enHtml} literal={literal} dir="ltr" style={{ fontFamily: EN_FONT, fontSize: `${0.88 * fontScale}rem`, lineHeight: 1.55 }} className={`${t.muted} mt-0.5 text-left`} />}
                  </div>
                ); })}
              </div>
              <div className="order-3"><p className={`text-[10px] font-black uppercase tracking-wider ${t.faint} mb-1`}>רש״י</p><Col items={rashi} empty="No Rashi on Sefaria for this amud" /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// Sheet frame and small widgets

function SheetFrame({ title, children, onClose, tall, back }: { title: string; children: ReactNode; onClose: () => void; tall?: boolean; back?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full sm:max-w-lg ${tall ? 'max-h-[85vh] sm:h-[80vh]' : 'max-h-[80vh]'} bg-slate-900 text-slate-200 border border-slate-800 rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200`}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
          {back && <button onClick={back} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>}
          <h3 className="font-black text-slate-100 text-sm truncate flex-1">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 sd-scroll">{children}</div>
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string; icon?: any }[] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-800 p-1 border border-slate-700">
      {options.map((o) => <button key={o.v} onClick={() => onChange(o.v)} className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${value === o.v ? 'bg-slate-100 text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>{o.icon && <o.icon className="w-3.5 h-3.5" />}{o.l}{value === o.v && <Check className="w-3.5 h-3.5" />}</button>)}
    </div>
  );
}

function CatchUp({ data, segRef }: { data?: TldrSoFar | 'loading' | { error: string }; segRef: string }) {
  if (!data || data === 'loading') return <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Summarizing the sugya up to {segRef}…</p>;
  if ('error' in data) return <p className="text-sm text-rose-300">{data.error}</p>;
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/25 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">The story so far</p><p className="text-sm leading-relaxed" style={{ fontFamily: EN_FONT }}>{data.sofar}</p></div>
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Right now</p><p className="text-sm leading-relaxed" style={{ fontFamily: EN_FONT }}>{data.nowWeAre}</p></div>
      {data.keepInMind?.length > 0 && <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Keep in mind</p><ul className="space-y-1">{data.keepInMind.map((k, i) => <li key={i} className="text-sm flex gap-2"><span className="text-indigo-300">◆</span><span>{k}</span></li>)}</ul></div>}
      <p className="text-[11px] text-slate-500">Only up to {segRef} — nothing after it is revealed.</p>
    </div>
  );
}

function AskThread({ messages, busy, input, setInput, onSend }: { messages: ChatMsg[]; busy: boolean; input: string; setInput: (s: string) => void; onSend: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, busy]);
  return (
    <div className="flex flex-col h-full -mx-5 -my-4">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 sd-scroll">
        {messages.length === 0 && <p className="text-sm text-slate-400">Ask anything about this sugya — a term, a step you lost, why Rashi says what he says. Answers draw only on the texts on this daf and cite them.</p>}
        {messages.map((m, i) => <div key={i} className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white ml-8' : 'bg-slate-800/70 border border-slate-700/60 mr-4'}`}>{m.role === 'user' ? m.content : <RefText text={m.content} />}</div>)}
        {busy && <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Reading the sources…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="shrink-0 p-3 border-t border-slate-800 flex items-end gap-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} rows={1} placeholder="Ask about this sugya…" className="flex-1 resize-none bg-slate-800 border border-slate-700 focus:border-indigo-500/60 rounded-2xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-32" />
        <button type="submit" disabled={busy || !input.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-full" aria-label="Send"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
