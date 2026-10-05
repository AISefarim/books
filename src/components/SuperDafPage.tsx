import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Headphones, X, ExternalLink, Clock, Loader2, Scale, Landmark, Send, MessageSquareText,
  Minus, Plus, Lock, Bookmark, BookmarkCheck, Maximize2, Minimize2, Type, Sun, Moon, Map as MapIcon, ListTree, Check, Library,
  Quote, Sparkles, NotebookPen, Pin, PinOff, PanelRightOpen,
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
interface MUnit { he: string; en?: string; literal?: string; elucidation?: string; notes?: number[] }
interface MNote { n: number; source: string; point: string; ref: string }
interface MesivtaSeg { ref: string; units: MUnit[]; notes: MNote[] }
interface Mesivta { segments?: MesivtaSeg[]; _error?: string }
interface Built { partial?: boolean; core: Comm[]; rishonim: Comm[]; acharonim: Comm[]; other: Comm[]; rambamSources: Comm[]; halachaSources: Comm[]; synthesis: Synthesis | null; halacha: Halacha | null; mesivta: Mesivta | null }
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

type Surface = 'paper' | 'dark';
type Lang = 'both' | 'he' | 'en';
type Tab = 'notes' | 'halacha' | 'sources' | 'rambam' | 'big' | 'disputes' | 'ask';
type Sheet = { kind: 'sugyot' } | { kind: 'catchup' } | { kind: 'bookmarks' } | { kind: 'listen' } | { kind: 'settings' } | null;

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
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('<b>') && p.endsWith('</b>')) return <strong key={i}>{p.slice(3, -4)}</strong>;
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}
// Davidson text carrying **bold** marks: bold = the Gemara's words, plain = elucidation.
function Marked({ text }: { text: string }) {
  const parts = String(text || '').replace(/<[^>]+>/g, '').split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i} className="sd-eluc">{p}</span>))}</>;
}

// Davidson English keeps its typography: bold = the Gemara's words, regular = elucidation.
function Davidson({ html, text, className, style }: { html?: string; text: string; className?: string; style?: CSSProperties }) {
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
    nodes.push(bold ? <strong key={key++} className={ital ? 'italic' : ''}>{t}</strong> : <span key={key++} className={`sd-eluc ${ital ? 'italic' : ''}`}>{t}</span>);
  }
  return <p className={className} style={style}>{nodes}</p>;
}

// ----------------------------------------------------------------------

export function SuperDafPage({ initialRef, pinnedPodcastId, media, onExit }: { initialRef?: string | null; pinnedPodcastId?: string | null; media: MediaItem[]; onExit: () => void }) {
  const prefs = useMemo(() => readJson<any>(PREFS_KEY, {}), []);
  const [surface, setSurface] = useState<Surface>(prefs.surface || 'paper');
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [fontScale, setFontScale] = useState<number>(prefs.fontScale || 1);
  const [mapOpen, setMapOpen] = useState<boolean>(prefs.mapOpen !== false);
  const [mapPeek, setMapPeek] = useState(false);
  const [current, setCurrent] = useState<{ ref: string; date: string } | null>(null);
  const [ref, setRef] = useState<string | null>(initialRef || null);
  const [daf, setDaf] = useState<Daf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);     // paragraph pinned in the panel (else it follows the scroll)
  const [tab, setTab] = useState<Tab>('notes');
  const [sugyaScope, setSugyaScope] = useState<number | null>(null); // panel shows a sugya-level tab
  const [noteN, setNoteN] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);               // small screens: panel as a sheet
  const [sheet, setSheet] = useState<Sheet>(null);
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

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_HREF; document.head.appendChild(l); }
  }, []);
  useEffect(() => { writeJson(PREFS_KEY, { surface, lang, fontScale, mapOpen }); }, [surface, lang, fontScale, mapOpen]);
  useEffect(() => { writeJson(BOOKMARKS_KEY, bookmarks); }, [bookmarks]);

  // Own the viewport. On touch devices, swallow the pull-down at the top of
  // the reader (and the push-up at the bottom) so the gesture never reaches
  // the browser - that is what was escaping full screen.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { bo: body.style.overflow, ho: html.style.overflow, bos: body.style.overscrollBehavior, hos: html.style.overscrollBehavior };
    body.style.overflow = 'hidden'; html.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none'; html.style.overscrollBehavior = 'none';
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    let startY = 0;
    const onStart = (e: TouchEvent) => { startY = e.touches[0]?.clientY || 0; };
    const onMove = (e: TouchEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('.sd-scroll') as HTMLElement | null;
      const dy = (e.touches[0]?.clientY || 0) - startY;
      if (!el) { e.preventDefault(); return; }
      const atTop = el.scrollTop <= 0, atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
      if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault();
    };
    const root = rootRef.current;
    root?.addEventListener('touchstart', onStart, { passive: true });
    root?.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      body.style.overflow = prev.bo; html.style.overflow = prev.ho; body.style.overscrollBehavior = prev.bos; html.style.overscrollBehavior = prev.hos;
      document.removeEventListener('fullscreenchange', onFs);
      root?.removeEventListener('touchstart', onStart); root?.removeEventListener('touchmove', onMove);
    };
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
    setError(null); setDaf(null); setSheet(null); setSofar({}); setPinned(null); setSugyaScope(null); setNoteN(null); setPanelOpen(false);
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
  }, [daf]);

  const isCurrent = !!(daf && current && daf.ref === current.ref);
  const podcasts = useMemo(() => {
    if (!daf) return [] as MediaItem[];
    const pin = media.filter((m) => m.id === pinnedPodcastId);
    return [...pin, ...media.filter((m) => m.type === 'audio' && m.id !== pinnedPodcastId && titleMatchesDaf(m.title, daf.book, daf.daf))];
  }, [media, daf, pinnedPodcastId]);
  const sugyaOf = useCallback((segIdx: number) => daf ? daf.sugyot.find((s) => s.segments.includes(segIdx)) || daf.sugyot[0] : null, [daf]);
  const panelIdx = pinned ?? focusIdx;
  const panelSugya = sugyaScope !== null && daf ? daf.sugyot[sugyaScope] : sugyaOf(panelIdx);

  const scrollToSeg = (idx: number) => scrollRef.current?.querySelector<HTMLElement>(`[data-seg="${idx}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Open the panel on a paragraph (tap on the text, a note number, a pill).
  const openOn = (segIdx: number, t: Tab = 'notes', n: number | null = null) => {
    setPinned(segIdx); setSugyaScope(null); setTab(t); setNoteN(n); setPanelOpen(true);
  };
  const openSugya = (sIdx: number, t: Tab) => { setSugyaScope(sIdx); setPinned(null); setTab(t); setNoteN(null); setPanelOpen(true); };

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

  const ask = async () => {
    if (!daf || !chatInput.trim() || chatBusy || !panelSugya) return;
    const sg = panelSugya; const q = chatInput.trim(); const history = chats[sg.index] || [];
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
    ? { shell: 'bg-[#efe7d6]', page: 'bg-[#f7f2e7] text-stone-900', card: 'bg-white/70 border-[#e3d8c1]', soft: 'bg-[#efe6d3]', muted: 'text-stone-500', faint: 'text-stone-400', rule: 'border-[#e3d8c1]', accent: 'text-indigo-700', chip: 'bg-white/80 border-[#e3d8c1] text-stone-700', hover: 'hover:bg-white/70', sel: 'ring-2 ring-indigo-400/50 bg-white/50' }
    : { shell: 'bg-slate-950', page: 'bg-slate-900 text-slate-100', card: 'bg-slate-800/60 border-slate-700/60', soft: 'bg-slate-800/60', muted: 'text-slate-400', faint: 'text-slate-500', rule: 'border-slate-800', accent: 'text-indigo-300', chip: 'bg-slate-800 border-slate-700 text-slate-200', hover: 'hover:bg-slate-800/60', sel: 'ring-2 ring-indigo-400/50 bg-slate-800/40' };
  const showHe = lang !== 'en', showEn = lang !== 'he';
  const dateLabel = current?.date ? new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const focusSugya = sugyaOf(focusIdx);

  return (
    <div ref={rootRef} className={`sd fixed inset-0 z-[60] flex flex-col ${t.shell} ${surface === 'dark' ? 'sd-dark' : ''}`} style={{ overscrollBehavior: 'none', touchAction: 'pan-y' }}>
      <style>{`
        .sd .sd-ref { color: #4f46e5; text-decoration: none; border-bottom: 1px dotted rgba(79,70,229,.5); font-size: .78em; font-weight: 600; }
        .sd .sd-ref:hover { border-bottom-style: solid; }
        .sd-dark .sd-ref { color: #a5b4fc; border-bottom-color: rgba(165,180,252,.5); }
        .sd .sd-eluc { opacity: .68; font-weight: 400; }
        .sd .sd-scroll { scrollbar-width: thin; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
        .sd .sd-para { scroll-margin-top: 5rem; }
        .sd .sd-rashi { font-family: ${RASHI_FONT}; }
        .sd .sd-note { display:inline-flex; align-items:center; justify-content:center; min-width:1.15rem; height:1.15rem; padding:0 .3rem; margin:0 .1rem; border-radius:.4rem; font-size:.62rem; font-weight:800; vertical-align:super; line-height:1; background:rgba(99,102,241,.14); color:#4f46e5; cursor:pointer; }
        .sd-dark .sd-note { background:rgba(129,140,248,.2); color:#c7d2fe; }
        .sd .sd-note:hover, .sd .sd-note.on { background:#4f46e5; color:#fff; }
        .sd .sd-unit:nth-child(even) { background: rgba(0,0,0,.025); }
        .sd-dark .sd-unit:nth-child(even) { background: rgba(255,255,255,.03); }
      `}</style>

      {/* ============ top bar ============ */}
      <header className="shrink-0 h-12 sm:h-14 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 bg-slate-950 text-slate-100 border-b border-slate-800">
        <button onClick={onExit} className="p-2 rounded-full hover:bg-slate-800 text-slate-300" aria-label="Back to AI Sefarim"><ArrowLeft className="w-5 h-5" /></button>
        <button onClick={() => setMapOpen((m) => !m)} className={`hidden md:inline-flex p-2 rounded-full border ${mapOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`} aria-label="Show the daf map" title={mapOpen ? 'Hide the daf map' : 'Show the daf map'}><MapIcon className="w-4 h-4" /></button>
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
        <button onClick={() => setPanelOpen((o) => !o)} className="lg:hidden p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200" aria-label="Open the study panel" title="Study panel"><PanelRightOpen className="w-4 h-4" /></button>
        <button onClick={() => setSheet(sheet?.kind === 'settings' ? null : { kind: 'settings' })} className={`p-2 rounded-full border ${sheet?.kind === 'settings' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'}`} aria-label="Reading settings" title="Reading settings"><Type className="w-4 h-4" /></button>
        <button onClick={toggleFullscreen} className="hidden sm:inline-flex p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:text-white" aria-label="Full screen" title={isFull ? 'Exit full screen' : 'Full screen'}>{isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
      </header>

      {/* ============ body ============ */}
      <div className="flex-1 min-h-0 flex relative">
        {/* daf map: docked when open; otherwise a hover/peek edge */}
        {daf && (mapOpen || mapPeek) && (
          <div className={`${mapOpen ? 'relative' : 'absolute inset-y-0 left-0 z-30 shadow-2xl'} hidden md:block`} onMouseLeave={() => setMapPeek(false)}>
            <Minimap daf={daf} focusIdx={focusIdx} onJump={scrollToSeg} bookmarks={bookmarks} surface={surface} />
          </div>
        )}
        {daf && !mapOpen && <div className="hidden md:block absolute inset-y-0 left-0 w-3 z-20 cursor-ew-resize" onMouseEnter={() => setMapPeek(true)} title="The daf map" />}

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
          {daf && (
            <Reader daf={daf} t={t} showHe={showHe} showEn={showEn} fontScale={fontScale} panelIdx={pinned} noteN={noteN}
              isBookmarked={isBookmarked} toggleBookmark={toggleBookmark} openOn={openOn} openSugya={openSugya} />
          )}
          {daf && <footer className={`px-6 py-8 text-[11px] ${t.faint} leading-relaxed max-w-3xl mx-auto`}>{daf.attribution} · <a className="sd-ref" href={sefariaUrl(daf.ref)} target="_blank" rel="noopener noreferrer">open on Sefaria</a></footer>}
        </div>

        {/* context panel: column on wide screens, sheet on small */}
        {daf && panelSugya && (
          <>
            <div className="hidden lg:flex w-[400px] xl:w-[440px] shrink-0 border-l border-slate-800 bg-slate-900 text-slate-200 flex-col min-h-0">
              <Panel daf={daf} sugya={panelSugya} segIdx={sugyaScope !== null ? null : panelIdx} tab={tab} setTab={setTab} noteN={noteN} pinned={pinned !== null} onUnpin={() => { setPinned(null); setSugyaScope(null); }}
                sugyaScoped={sugyaScope !== null} onBackToParagraph={() => { setSugyaScope(null); }} chats={chats} chatInput={chatInput} setChatInput={setChatInput} chatBusy={chatBusy} onAsk={ask}
                onCatchUp={() => { requestSofar(panelIdx); setSheet({ kind: 'catchup' }); }} />
            </div>
            {panelOpen && (
              <div className="lg:hidden fixed inset-0 z-50 flex items-end">
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={() => setPanelOpen(false)} />
                <div className="relative w-full h-[85vh] bg-slate-900 text-slate-200 border-t border-slate-800 rounded-t-[1.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 duration-200">
                  <Panel daf={daf} sugya={panelSugya} segIdx={sugyaScope !== null ? null : panelIdx} tab={tab} setTab={setTab} noteN={noteN} pinned={pinned !== null} onUnpin={() => { setPinned(null); setSugyaScope(null); }}
                    sugyaScoped={sugyaScope !== null} onBackToParagraph={() => setSugyaScope(null)} onClose={() => setPanelOpen(false)} chats={chats} chatInput={chatInput} setChatInput={setChatInput} chatBusy={chatBusy} onAsk={ask}
                    onCatchUp={() => { requestSofar(panelIdx); setPanelOpen(false); setSheet({ kind: 'catchup' }); }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============ dock ============ */}
      {daf && (
        <nav className="shrink-0 bg-slate-950 border-t border-slate-800 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
          <div className="max-w-xl mx-auto grid grid-cols-5 gap-1">
            {([
              { id: 'sugyot', label: 'Sugyot', icon: ListTree }, { id: 'catchup', label: 'Catch me up', icon: Clock }, { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
              { id: 'ask', label: 'Ask', icon: MessageSquareText }, { id: 'listen', label: 'Listen', icon: Headphones },
            ] as { id: string; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => {
              const disabled = id === 'listen' && podcasts.length === 0;
              const active = sheet?.kind === id || (id === 'ask' && tab === 'ask' && (panelOpen || window.innerWidth >= 1024));
              return (
                <button key={id} disabled={disabled} onClick={() => {
                  if (id === 'ask') { setTab('ask'); setPanelOpen(true); setSheet(null); return; }
                  if (id === 'catchup') requestSofar(focusIdx);
                  setSheet(sheet?.kind === id ? null : { kind: id } as Sheet);
                }} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition-colors disabled:opacity-30 ${active ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-100'}`}>
                  <Icon className="w-5 h-5" />{label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ============ sheets ============ */}
      {daf && sheet && (
        <SheetFrame onClose={() => setSheet(null)} title={
          sheet.kind === 'sugyot' ? 'Sugyot on this daf' : sheet.kind === 'catchup' ? `Catch me up · through ${short(daf.segments[focusIdx].ref, daf.book)}` : sheet.kind === 'bookmarks' ? 'Bookmarks' : sheet.kind === 'listen' ? 'Listen to the daf' : 'Reading settings'
        } tall={sheet.kind === 'sugyot'}>
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
          {sheet.kind === 'listen' && <div className="space-y-3">{podcasts.map((p) => <div key={p.id} className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-3"><p className="text-sm font-black text-slate-100 mb-2">{p.title}</p><AudioPlayer url={p.url} title={p.title} /></div>)}</div>}
          {sheet.kind === 'settings' && (
            <div className="space-y-5">
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Language</p><Segmented value={lang} onChange={(v) => setLang(v as Lang)} options={[{ v: 'both', l: 'Hebrew + English' }, { v: 'he', l: 'Hebrew' }, { v: 'en', l: 'English' }]} /></div>
              <div className="flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Text size</p><div className="flex items-center rounded-full bg-slate-800 border border-slate-700"><button onClick={() => setFontScale((f) => Math.max(0.8, +(f - 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Smaller"><Minus className="w-4 h-4" /></button><span className="text-xs font-black text-slate-200 w-10 text-center tabular-nums">{Math.round(fontScale * 100)}%</span><button onClick={() => setFontScale((f) => Math.min(1.7, +(f + 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Larger"><Plus className="w-4 h-4" /></button></div></div>
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Page</p><Segmented value={surface} onChange={(v) => setSurface(v as Surface)} options={[{ v: 'paper', l: 'Paper', icon: Sun }, { v: 'dark', l: 'Dark', icon: Moon }]} /></div>
              <div className="hidden md:block"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Daf map</p><Segmented value={mapOpen ? 'open' : 'closed'} onChange={(v) => setMapOpen(v === 'open')} options={[{ v: 'open', l: 'Docked' }, { v: 'closed', l: 'Hidden (hover the left edge to peek)' }]} /></div>
              <p className="text-[11px] text-slate-500">How to read the translation: <strong className="text-slate-300">bold</strong> is the Gemara’s own words, lighter text is the Davidson elucidation, and the small numbers are notes — analysis from the commentaries, opened in the study panel.</p>
            </div>
          )}
        </SheetFrame>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// The reader: one integrated mode. Hebrew, then the Mesivta interlinear
// (phrase · literal · elucidation · note numbers), with pills for what this
// paragraph carries. Tapping anything opens the study panel on it.

function Reader({ daf, t, showHe, showEn, fontScale, panelIdx, noteN, isBookmarked, toggleBookmark, openOn, openSugya }: {
  daf: Daf; t: any; showHe: boolean; showEn: boolean; fontScale: number; panelIdx: number | null; noteN: number | null;
  isBookmarked: (r: string) => boolean; toggleBookmark: (i: number) => void; openOn: (i: number, tab?: Tab, n?: number | null) => void; openSugya: (s: number, tab: Tab) => void;
}) {
  const heStyle: CSSProperties = { fontFamily: HE_FONT, fontSize: `${1.5 * fontScale}rem`, lineHeight: 1.85 };
  return (
    <div className={`${t.page} min-h-full`}>
      <div className="max-w-3xl mx-auto px-3 sm:px-8 pt-4 pb-10">
        {daf.sugyot.map((sugya) => {
          const built = sugya.built;
          const syn = built?.synthesis && !built.synthesis._error ? built.synthesis : null;
          const steps = syn?.steps || [];
          const stepFor = (ref: string) => steps.find((st) => (st.refs || []).includes(ref));
          const allComm = built ? [...built.core, ...built.rishonim, ...built.acharonim, ...built.other] : [];
          const works = Array.from(new Set(allComm.map((c) => c.title)));
          const halItems = (built?.halacha?.items || []) as HalachaItem[];
          const mes = built?.mesivta && !built.mesivta._error ? built.mesivta : null;
          const btn = (label: ReactNode, onClick: () => void, icon: any, dim = false) => { const Icon = icon; return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${t.chip} ${t.hover} ${dim ? 'opacity-45' : ''}`}><Icon className={`w-3.5 h-3.5 ${t.accent}`} />{label}</button>; };
          return (
            <section key={sugya.index} className="mb-10">
              {/* sugya card */}
              <div className={`rounded-2xl border ${t.card} px-4 py-3 mb-3 shadow-sm`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${sugya.kind === 'mishnah' ? 'bg-amber-500/15 text-amber-800 border border-amber-500/30' : 'bg-indigo-500/10 border border-indigo-500/30 ' + t.accent}`}>
                    <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '1rem' }}>{KIND_LABEL[sugya.kind].he}</span><span className="uppercase tracking-wider">{KIND_LABEL[sugya.kind].en}</span>
                  </span>
                  <span className={`text-xs font-bold ${t.muted}`}>{short(sugya.from, daf.book)} – {short(sugya.to, daf.book)}</span>
                  {sugya.prelude && <span className={`text-[11px] font-semibold ${t.faint}`}>began on {short(sugya.prelude.from, daf.book)}</span>}
                  {!built && <span className={`ml-auto text-[11px] ${t.faint} inline-flex items-center gap-1`}><Loader2 className="w-3 h-3 animate-spin" /> preparing</span>}
                </div>
                {syn?.tldr && <p className="mt-2.5" style={{ fontFamily: EN_FONT, fontSize: `${0.98 * fontScale}rem`, lineHeight: 1.6 }}><span className={`font-black text-[10px] uppercase tracking-wider mr-2 ${t.accent}`}>TL;DR</span>{syn.tldr}</p>}
                {built && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {btn('Big picture', () => openSugya(sugya.index, 'big'), Sparkles, !syn?.bigPicture)}
                    {btn(<>Halacha{halItems.length ? <span className={t.faint}> {halItems.length}</span> : null}</>, () => openSugya(sugya.index, 'halacha'), Scale, !halItems.length)}
                    {btn('Rambam', () => openSugya(sugya.index, 'rambam'), Landmark, !syn?.rambam)}
                    {btn(<>Sources{works.length ? <span className={t.faint}> {works.length}</span> : null}</>, () => openSugya(sugya.index, 'sources'), Library, !works.length)}
                    {btn('Disputes', () => openSugya(sugya.index, 'disputes'), Quote, !(syn?.machlokes?.length || syn?.questions?.length))}
                  </div>
                )}
              </div>

              {/* paragraphs */}
              {sugya.segments.map((idx) => {
                const s = daf.segments[idx];
                const step = stepFor(s.ref);
                const m = mes?.segments?.find((x) => x.ref === s.ref);
                const hal = halItems.filter((h) => (h.refs || []).includes(s.ref));
                const nNotes = m?.notes?.length || 0;
                const isPanel = panelIdx === idx;
                return (
                  <article key={s.ref} data-seg={idx} className={`sd-para rounded-2xl px-3 sm:px-4 py-3 mb-2 transition-shadow ${isPanel ? t.sel : ''}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-black tabular-nums ${t.faint}`}>{s.amud}:{s.n}</span>
                      {s.startsMishnah && <span className={`text-[10px] font-black uppercase tracking-widest ${t.accent}`}>Mishnah</span>}
                      {s.startsGemara && <span className={`text-[10px] font-black uppercase tracking-widest ${t.accent}`}>Gemara</span>}
                      {s.startsTopic && <span className={`text-[10px] font-black ${t.accent}`}>§ new topic</span>}
                      <span className="flex-1" />
                      {hal.length > 0 && <button onClick={() => openOn(idx, 'halacha')} className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-800 px-2.5 py-0.5 text-[10px] font-black"><Scale className="w-3 h-3" /> Halacha</button>}
                      {nNotes > 0 && <button onClick={() => openOn(idx, 'notes')} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${t.chip} ${t.hover}`}><NotebookPen className="w-3 h-3" /> {nNotes} notes</button>}
                      <button onClick={() => toggleBookmark(idx)} className={`p-1 rounded-md ${isBookmarked(s.ref) ? 'text-amber-500' : t.faint + ' hover:text-amber-500'}`} aria-label="Bookmark this paragraph">{isBookmarked(s.ref) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}</button>
                    </div>

                    {showHe && <p lang="he" dir="rtl" style={heStyle} className="cursor-pointer" onClick={() => openOn(idx, 'notes')}>{s.he}</p>}

                    {/* interlinear */}
                    {showEn && (m && m.units?.length ? (
                      <div className={`mt-2 rounded-xl overflow-hidden border ${t.rule}`}>
                        {m.units.map((u, k) => (
                          <div key={k} className="sd-unit grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-x-4 gap-y-0.5 px-3 py-1.5 cursor-pointer" onClick={() => openOn(idx, 'notes', u.notes?.[0] ?? null)}>
                            {showHe && <p lang="he" dir="rtl" className="text-right" style={{ fontFamily: HE_FONT, fontSize: `${1.08 * fontScale}rem`, lineHeight: 1.6 }}>{u.he}</p>}
                            <p style={{ fontFamily: EN_FONT, fontSize: `${0.96 * fontScale}rem`, lineHeight: 1.55 }}>
                              {u.en ? <Marked text={u.en} /> : <><strong>{u.literal}</strong>{u.elucidation ? <span className="sd-eluc"> {u.elucidation}</span> : null}</>}
                              {(u.notes || []).map((n) => <span key={n} className={`sd-note ${isPanel && noteN === n ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); openOn(idx, 'notes', n); }} title="Note">{n}</span>)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 cursor-pointer" onClick={() => openOn(idx, 'notes')}>
                        <Davidson text={s.en} html={s.enHtml} style={{ fontFamily: EN_FONT, fontSize: `${1.02 * fontScale}rem`, lineHeight: 1.7 }} />
                        {built && !mes && <p className={`mt-1 text-[11px] ${t.faint} inline-flex items-center gap-1`}><Loader2 className="w-3 h-3 animate-spin" /> interlinear notes on their way</p>}
                      </div>
                    ))}

                    {step && step.refs[0] === s.ref && (
                      <button onClick={() => openOn(idx, 'notes')} className={`mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold ${t.accent}`}>
                        <ChevronRight className="w-3.5 h-3.5" /> {step.headline}
                      </button>
                    )}
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

// ----------------------------------------------------------------------
// The study panel (HQ): buttons, not dropdowns. Follows the paragraph on
// screen unless pinned by a tap.

function Panel({ daf, sugya, segIdx, tab, setTab, noteN, pinned, onUnpin, sugyaScoped, onBackToParagraph, onClose, chats, chatInput, setChatInput, chatBusy, onAsk, onCatchUp }: {
  daf: Daf; sugya: Sugya; segIdx: number | null; tab: Tab; setTab: (t: Tab) => void; noteN: number | null; pinned: boolean; onUnpin: () => void;
  sugyaScoped: boolean; onBackToParagraph: () => void; onClose?: () => void; chats: Record<number, ChatMsg[]>; chatInput: string; setChatInput: (s: string) => void; chatBusy: boolean; onAsk: () => void; onCatchUp: () => void;
}) {
  const built = sugya.built;
  const syn = built?.synthesis && !built.synthesis._error ? built.synthesis : null;
  const seg = segIdx !== null ? daf.segments[segIdx] : null;
  const step = seg ? syn?.steps?.find((st) => (st.refs || []).includes(seg.ref)) : null;
  const mes = seg ? built?.mesivta?.segments?.find((x) => x.ref === seg.ref) : null;
  const all = built ? [...built.core, ...built.rishonim, ...built.acharonim, ...built.other] : [];
  const halAll = (built?.halacha?.items || []) as HalachaItem[];
  const hal = seg ? halAll.filter((h) => (h.refs || []).includes(seg.ref)) : halAll;
  const srcs = seg ? all.filter((c) => c.anchor === seg.ref) : all;
  const [work, setWork] = useState<string | null>(null);
  const [words, setWords] = useState<Record<string, boolean>>({});
  const noteRef = useRef<HTMLDivElement>(null);
  useEffect(() => { noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [noteN, tab, segIdx]);
  useEffect(() => { setWork(null); }, [segIdx, sugya.index]);

  const tabs: { id: Tab; label: string; icon: any; count?: number; dim?: boolean }[] = [
    { id: 'notes', label: 'Notes', icon: NotebookPen, count: mes?.notes?.length || 0 },
    { id: 'halacha', label: 'Halacha', icon: Scale, count: hal.length, dim: !hal.length },
    { id: 'sources', label: 'Sources', icon: Library, count: new Set(srcs.map((c) => c.title)).size, dim: !srcs.length },
    { id: 'rambam', label: 'Rambam', icon: Landmark, dim: !syn?.rambam },
    { id: 'big', label: 'Big picture', icon: Sparkles, dim: !syn?.bigPicture },
    { id: 'disputes', label: 'Disputes', icon: Quote, dim: !(syn?.machlokes?.length || syn?.questions?.length) },
    { id: 'ask', label: 'Ask', icon: MessageSquareText },
  ];
  const dark = { soft: 'bg-slate-800/60', faint: 'text-slate-500', muted: 'text-slate-400', accent: 'text-indigo-300', chip: 'bg-slate-800 border-slate-700 text-slate-200', hover: 'hover:bg-slate-800' };

  return (
    <>
      <div className="px-4 pt-3 pb-2 border-b border-slate-800 shrink-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">{KIND_LABEL[sugya.kind].en} · {short(sugya.from, daf.book)}–{short(sugya.to, daf.book)}{seg ? ` · ${short(seg.ref, daf.book)}` : ' · whole sugya'}</p>
            {seg ? <p lang="he" dir="rtl" className="text-sm text-slate-200 line-clamp-2 mt-0.5" style={{ fontFamily: HE_FONT }}>{seg.he}</p> : <p className="text-sm text-slate-300 mt-0.5">{syn?.tldr || ''}</p>}
          </div>
          {sugyaScoped ? <button onClick={onBackToParagraph} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" title="Back to the paragraph on screen"><PinOff className="w-4 h-4" /></button>
            : pinned ? <button onClick={onUnpin} className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-slate-800" title="Pinned to this paragraph - tap to follow the scroll again"><Pin className="w-4 h-4" /></button>
            : <span className="p-1.5 text-slate-600" title="Following the paragraph on screen"><PinOff className="w-4 h-4" /></span>}
          {onClose && <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close"><X className="w-5 h-5" /></button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {tabs.map(({ id, label, icon: Icon, count, dim }) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all ${tab === id ? 'bg-indigo-600 text-white' : dim ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}>
              <Icon className="w-3.5 h-3.5" />{label}{count ? <span className={`${tab === id ? 'text-indigo-200' : 'text-slate-500'}`}>{count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto sd-scroll px-4 py-4 text-sm">
        {!built && tab !== 'ask' && <p className="text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Preparing this sugya - the Gemara is readable meanwhile.</p>}

        {tab === 'notes' && built && (
          <div className="space-y-4">
            {step && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">What this step is doing</p>
                <p className="font-bold text-slate-100 mb-1.5">{step.headline}</p>
                <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '0.98rem' }}><RefText text={step.explanation} /></p>
              </div>
            )}
            {mes?.notes?.length ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1.5">Notes on this paragraph</p>
                <div className="space-y-2">
                  {mes.notes.map((n) => (
                    <div key={n.n} ref={noteN === n.n ? noteRef : undefined} className={`rounded-xl border px-3 py-2.5 ${noteN === n.n ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-700/60 bg-slate-800/50'}`}>
                      <p className="flex items-center gap-2 mb-1"><span className="sd-note on" style={{ verticalAlign: 'baseline' }}>{n.n}</span><span className="text-[11px] font-black text-indigo-200">{n.source}</span></p>
                      <p className="leading-relaxed text-slate-200"><RefText text={n.point} /></p>
                      <p className="mt-1"><SourceLink r={n.ref} /></p>
                    </div>
                  ))}
                </div>
              </div>
            ) : seg && built.mesivta ? <p className="text-slate-500">No commentary on Sefaria is anchored to this paragraph.</p> : seg ? <p className="text-slate-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Notes on their way.</p> : null}
            {step?.layers?.length ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1.5">In more depth</p>
                <div className="space-y-3">
                  {step.layers.map((ly, i) => (
                    <div key={i}>
                      <p className="font-bold text-slate-100">{ly.title}</p>
                      <p className="leading-relaxed text-slate-300"><RefText text={ly.body} /></p>
                      {ly.refs?.length ? <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">{ly.refs.map((r) => <SourceLink key={r} r={r} />)}</p> : null}
                    </div>
                  ))}
                  {step.deeper && <div><p className="font-bold text-slate-100">Go deeper</p><p className="leading-relaxed text-slate-300"><RefText text={step.deeper} /></p></div>}
                </div>
              </div>
            ) : null}
            {!step && !seg && syn?.bigPicture && <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT }}><RefText text={syn.bigPicture} /></p>}
            <button onClick={onCatchUp} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-700"><Clock className="w-3.5 h-3.5" /> Catch me up to here</button>
          </div>
        )}

        {tab === 'halacha' && built && (hal.length ? <HalachaItems items={hal} t={dark} /> : <p className="text-slate-400">{built.halacha?.available === false ? built.halacha.note : seg ? 'No ruling is anchored to this paragraph. Use the Halacha button on the sugya card for the whole sugya.' : 'No halachic codes are linked to this sugya on Sefaria.'}</p>)}

        {tab === 'sources' && built && (
          work ? (
            <div>
              <button onClick={() => setWork(null)} className="mb-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300"><ArrowLeft className="w-3.5 h-3.5" /> All sources</button>
              <Words comms={srcs.filter((c) => c.title === work)} words={words} setWords={setWords} />
            </div>
          ) : srcs.length ? (
            <div className="space-y-4">
              {(['core', 'rishonim', 'acharonim', 'other'] as const).map((layer) => {
                const ws = Array.from(new Set(srcs.filter((c) => c.layer === layer).map((c) => c.title)));
                if (!ws.length) return null;
                const label = { core: 'Rashi & Tosafot', rishonim: 'Rishonim', acharonim: 'Acharonim', other: 'Other commentaries' }[layer];
                return (
                  <div key={layer}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{label}</p>
                    <div className="flex flex-wrap gap-1.5">{ws.map((w) => <button key={w} onClick={() => setWork(w)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700">{w} <span className="text-slate-500">{srcs.filter((c) => c.title === w).length}</span></button>)}</div>
                  </div>
                );
              })}
              <p className="text-[11px] text-slate-500">Everything Sefaria links {seg ? 'to this paragraph' : 'to this sugya'}. A work not listed (Rashba, Ritva, Meiri on some tractates) is not on Sefaria for this passage; nothing is reconstructed from memory.</p>
            </div>
          ) : <p className="text-slate-400">No commentary on Sefaria is anchored {seg ? 'to this paragraph' : 'to this sugya'}.</p>
        )}

        {tab === 'rambam' && built && (
          !syn?.rambam ? <p className="text-slate-400">Sefaria links no Mishneh Torah or Rambam commentary to this sugya, so there is no sourced Rambam section here.</p> : (
            <div className="space-y-3">
              <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '0.98rem' }}><RefText text={syn.rambam.reading} /></p>
              {syn.rambam.rulings?.length ? <div className="space-y-2">{syn.rambam.rulings.map((x, i) => <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2"><p className="text-[11px] font-black"><SourceLink r={x.ref} /></p><p className="mt-0.5 text-slate-200"><RefText text={x.ruling} /></p></div>)}</div> : null}
              {syn.rambam.commentators?.length ? <ul className="space-y-1.5">{syn.rambam.commentators.map((c, i) => <li key={i} className="flex gap-2"><span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border border-slate-700 bg-slate-800">{c.source}</span><span className="text-slate-200"><RefText text={c.point} /> <SourceLink r={c.ref} /></span></li>)}</ul> : null}
              {built.rambamSources.length > 0 && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">The texts</p><Words comms={built.rambamSources} words={words} setWords={setWords} /></div>}
            </div>
          )
        )}

        {tab === 'big' && built && (
          <div className="space-y-3">
            <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '1rem' }}><RefText text={syn?.bigPicture || 'Not available yet.'} /></p>
            {syn?.continuesOn && <p className="text-slate-400 italic">{syn.continuesOn}</p>}
            {syn?.sourcesUsed?.length ? <p className="text-[11px] text-slate-500">Drawn from: {syn.sourcesUsed.join(', ')}.</p> : null}
          </div>
        )}

        {tab === 'disputes' && built && (
          <div className="space-y-4">
            {syn?.machlokes?.length ? <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Where the commentaries part ways</p><div className="space-y-3">{syn.machlokes.map((m, i) => <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5"><p className="font-bold text-slate-100"><RefText text={m.issue} /></p><ul className="mt-1.5 space-y-1">{m.positions.map((p, j) => <li key={j} className="flex gap-2"><span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border border-slate-700 bg-slate-800">{p.who}</span><span className="text-slate-200"><RefText text={p.view} /> {p.refs?.map((r) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</span></li>)}</ul></div>)}</div></div> : null}
            {syn?.questions?.length ? <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Questions the commentaries ask</p><div className="space-y-3">{syn.questions.map((q, i) => <div key={i}><p className="font-bold text-slate-100"><RefText text={q.question} /></p><p className="mt-0.5 text-slate-300"><RefText text={q.answer} /> {q.refs?.map((r) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</p></div>)}</div></div> : null}
            {!syn?.machlokes?.length && !syn?.questions?.length && <p className="text-slate-400">No disputes or classic questions were found in the sources linked to this sugya.</p>}
          </div>
        )}

        {tab === 'ask' && <AskThread messages={chats[sugya.index] || []} busy={chatBusy} input={chatInput} setInput={setChatInput} onSend={onAsk} />}
      </div>
    </>
  );
}

function Words({ comms, words, setWords }: { comms: Comm[]; words: Record<string, boolean>; setWords: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void }) {
  return (
    <div className="space-y-2">
      {comms.map((c) => {
        const on = !!words[c.ref];
        return (
          <div key={c.ref} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5">
            <p className="text-slate-200"><span className="font-black text-indigo-300">{c.title}</span>{c.gist ? <> — {c.gist}</> : null}</p>
            <div className="mt-1.5 flex gap-2">
              <button onClick={() => setWords((o) => ({ ...o, [c.ref]: !o[c.ref] }))} className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700">{on ? 'Hide the words' : 'Read the words'}</button>
              <a href={sefariaUrl(c.ref)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-white inline-flex items-center gap-1">Sefaria <ExternalLink className="w-3 h-3" /></a>
            </div>
            {on && (
              <div className="mt-2 animate-in fade-in duration-200">
                <p lang="he" dir="rtl" className="sd-rashi text-slate-100" style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>{c.he}</p>
                {c.en ? <Rich text={c.en} style={{ fontFamily: EN_FONT, fontSize: '.92rem', lineHeight: 1.6 }} className="text-slate-300 mt-1.5" /> : <p className="text-xs italic text-slate-500 mt-1">No translation yet.</p>}
                {c.enSource === 'ai' && <p className="text-[10px] text-slate-500 italic mt-1">AI translation</p>}
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
      {x ? <><p className="text-sm mt-0.5 text-slate-200"><RefText text={x.ruling} /></p><p className="mt-1"><SourceLink r={x.ref} /></p></> : <p className={`text-xs mt-0.5 ${t.faint} italic`}>not linked here</p>}
    </div>
  );
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <p className="text-sm font-bold text-slate-100 mb-1.5"><RefText text={it.issue} /></p>
          <div className="grid gap-2">{cell(it.rambam, 'Rambam')}{cell(it.shulchanArukh, 'Shulchan Arukh')}{cell(it.rema, 'Rema')}</div>
          {it.note && <p className={`mt-1.5 text-xs ${t.muted} italic`}><RefText text={it.note} /></p>}
        </div>
      ))}
      <p className={`text-[11px] ${t.faint}`}>For practice, confirm with your rav.</p>
    </div>
  );
}

// ----------------------------------------------------------------------
// Minimap: the daf drawn as pages, one per amud.

function Minimap({ daf, focusIdx, onJump, bookmarks, surface }: { daf: Daf; focusIdx: number; onJump: (i: number) => void; bookmarks: BookmarkItem[]; surface: Surface }) {
  const W = 104, PAD = 6, COL = 20, GAP = 4, GEM = W - PAD * 2 - (COL + GAP) * 2;
  const amudim = useMemo(() => { const g: Record<string, number[]> = {}; daf.segments.forEach((s, i) => { (g[s.amud] = g[s.amud] || []).push(i); }); return Object.entries(g); }, [daf]);
  const core = daf.sugyot.flatMap((s) => s.built?.core || []);
  const count = (segRef: string, title: string) => core.filter((c) => c.anchor === segRef && c.title === title).length;
  const marked = new Set(bookmarks.filter((b) => b.ref === daf.ref).map((b) => b.segRef));
  const fill = surface === 'paper' ? { page: '#fbf7ee', stroke: '#d9cdb3', block: '#cfc3a9', mishnah: '#e8c279', side: '#ddd3bd', focus: '#4f46e5', text: '#8a7f6a', bg: '#efe7d6' } : { page: '#0f172a', stroke: '#334155', block: '#475569', mishnah: '#b45309', side: '#334155', focus: '#818cf8', text: '#94a3b8', bg: '#020617' };
  return (
    <aside className="flex h-full shrink-0 w-[128px] flex-col items-center gap-3 py-3 overflow-y-auto sd-scroll border-r border-black/5" style={{ background: fill.bg }} aria-label="Where you are on the daf">
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
// Sheet frame and small widgets

function SheetFrame({ title, children, onClose, tall }: { title: string; children: ReactNode; onClose: () => void; tall?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full sm:max-w-lg ${tall ? 'max-h-[85vh] sm:h-[80vh]' : 'max-h-[80vh]'} bg-slate-900 text-slate-200 border border-slate-800 rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200`}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
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
    <div className="flex flex-col h-full -mx-4 -my-4">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 sd-scroll">
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
