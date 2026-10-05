import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Headphones, X, ExternalLink, Clock, Layers, Loader2, Scale, Landmark,
  Send, MessageSquareText, Minus, Plus, Lock, ScrollText, Quote, ListChecks, Bookmark, BookmarkCheck, Maximize2, Minimize2,
  Type, Sun, Moon, Map as MapIcon, ListTree, Check,
} from 'lucide-react';
import type { Video as MediaItem } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { DAF_API, dafPath, sefariaUrl, titleMatchesDaf } from '../lib/daf';

// ----------------------------------------------------------------------
// Types mirroring the worker's /daf/get response

interface Seg { ref: string; amud: string; n: number; he: string; en: string; enHtml?: string; isMishnah?: boolean; startsMishnah?: boolean; startsGemara?: boolean; startsTopic?: boolean }
interface Comm { ref: string; title: string; heTitle: string; layer: string; he: string; en: string; url: string; anchor: string; enSource?: string }
interface Note { source: string; ref: string; point: string }
interface Built { partial?: boolean; core: Comm[]; rishonim: Comm[]; acharonim: Comm[]; other: Comm[]; rambamSources: Comm[]; halachaSources: Comm[]; intensive: any; rambam: any; halacha: any }
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
type Surface = 'paper' | 'dark';
type Lang = 'both' | 'he' | 'en';
type Sheet = 'sugyot' | 'catchup' | 'bookmarks' | 'ask' | 'listen' | 'settings' | null;
type PaneTab = 'translation' | 'rashi' | 'notes' | 'more';

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const RASHI_FONT = "'Noto Rashi Hebrew', 'Frank Ruhl Libre', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Rashi+Hebrew&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';

const PREFS_KEY = 'super_daf_prefs';
const BOOKMARKS_KEY = 'super_daf_bookmarks';
const LAST_KEY = 'super_daf_last';

function readJson<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

const KIND_LABEL: Record<Sugya['kind'], { he: string; en: string }> = {
  mishnah: { he: 'משנה', en: 'Mishnah' },
  gemara: { he: 'גמרא', en: 'Gemara' },
  topic: { he: 'סוגיא', en: 'New topic' },
  continued: { he: 'המשך', en: 'Continued' },
};

const short = (ref: string, book: string) => ref.replace(book + ' ', '');

// ----------------------------------------------------------------------
// Text rendering helpers

// "[Rashi on Bekhorot 17a:3:1]" inside generated prose -> Sefaria link.
function RefText({ text, className }: { text: string; className?: string }) {
  const parts = String(text || '').split(/(\[[^\]]{3,120}\])/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]$/);
        if (m && /\d/.test(m[1])) return <a key={i} href={sefariaUrl(m[1])} target="_blank" rel="noopener noreferrer" className="sd-ref" title={m[1]}>{m[1]}</a>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

function SourceLink({ r }: { r: string }) {
  return (
    <a href={sefariaUrl(r)} target="_blank" rel="noopener noreferrer" className="sd-ref inline-flex items-center gap-1">
      {r} <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}

// Light markdown/HTML bold (the dibbur hamatchil of a translated Rashi).
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

// The Davidson English keeps its typography: bold = the Gemara's own words,
// regular = the editors' elucidation. `literal` shows only the bold words.
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

// ----------------------------------------------------------------------

export function SuperDafPage({
  initialRef, pinnedPodcastId, media, onExit,
}: { initialRef?: string | null; pinnedPodcastId?: string | null; media: MediaItem[]; onExit: () => void }) {
  const prefs = useMemo(() => readJson<any>(PREFS_KEY, {}), []);
  const [view, setView] = useState<View>(prefs.view || 'study');
  const [surface, setSurface] = useState<Surface>(prefs.surface || 'paper');
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [literal, setLiteral] = useState<boolean>(!!prefs.literal);
  const [fontScale, setFontScale] = useState<number>(prefs.fontScale || 1);
  const [current, setCurrent] = useState<{ ref: string; date: string } | null>(null);
  const [ref, setRef] = useState<string | null>(initialRef || null);
  const [daf, setDaf] = useState<Daf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null); // segment index open in the study pane
  const [paneTab, setPaneTab] = useState<PaneTab>('translation');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [focusIdx, setFocusIdx] = useState(0); // paragraph nearest the middle of the screen
  const [openSugya, setOpenSugya] = useState<Record<number, boolean>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
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

  // Fonts once.
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_HREF; document.head.appendChild(l);
    }
  }, []);
  useEffect(() => { writeJson(PREFS_KEY, { view, surface, lang, literal, fontScale }); }, [view, surface, lang, literal, fontScale]);
  useEffect(() => { writeJson(BOOKMARKS_KEY, bookmarks); }, [bookmarks]);

  // Lock the document behind the full-screen shell.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => { document.body.style.overflow = prev; document.removeEventListener('fullscreenchange', onFs); };
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
    return d as Daf;
  }, []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setError(null); setDaf(null); setSelected(null); setSheet(null); setSofar({}); setOpenSugya({}); setOpenNotes({});
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
          try {
            const r = await fetch(`${DAF_API}/step?ref=${encodeURIComponent(ref)}`).then((x) => x.json());
            if (r && !r.locked) delay = 300;
          } catch { /* poll */ }
          if (!cancelled) pollRef.current = window.setTimeout(tick, delay);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Could not load this daf.');
      }
    };
    tick();
    return () => { cancelled = true; if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [ref, load]);

  // Which paragraph is in the middle of the screen: drives the minimap,
  // "catch me up", and the resume position.
  useEffect(() => {
    if (!daf) return;
    const root = scrollRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-seg]'));
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting);
      if (!vis.length) return;
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

  const scrollToSeg = (idx: number) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-seg="${idx}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const requestSofar = async (segIdx: number) => {
    if (!daf) return;
    const segRef = daf.segments[segIdx].ref;
    const sg = sugyaOf(segIdx);
    if (!sg || sofar[segRef]) return;
    setSofar((s) => ({ ...s, [segRef]: 'loading' }));
    try {
      const res = await fetch(`${DAF_API}/tldr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: daf.ref, sugya: sg.index, upto: segRef }) });
      const d = await res.json();
      setSofar((s) => ({ ...s, [segRef]: d.error ? { error: d.error } : d }));
    } catch { setSofar((s) => ({ ...s, [segRef]: { error: 'Could not reach Super Daf.' } })); }
  };

  const ask = async () => {
    if (!daf || !chatInput.trim() || chatBusy) return;
    const sg = sugyaOf(selected ?? focusIdx);
    if (!sg) return;
    const q = chatInput.trim();
    const history = chats[sg.index] || [];
    setChats((c) => ({ ...c, [sg.index]: [...history, { role: 'user', content: q }] }));
    setChatInput(''); setChatBusy(true);
    try {
      const res = await fetch(`${DAF_API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: daf.ref, sugya: sg.index, question: q, history }) });
      const d = await res.json();
      setChats((c) => ({ ...c, [sg.index]: [...(c[sg.index] || []), { role: 'assistant', content: d.error ? `Sorry - ${d.error}` : d.answer }] }));
    } catch { setChats((c) => ({ ...c, [sg.index]: [...(c[sg.index] || []), { role: 'assistant', content: 'Sorry - could not reach Super Daf.' }] })); }
    finally { setChatBusy(false); }
  };

  const isBookmarked = (segRef: string) => bookmarks.some((b) => b.segRef === segRef);
  const toggleBookmark = (segIdx: number) => {
    if (!daf) return;
    const s = daf.segments[segIdx];
    setBookmarks((bs) => isBookmarked(s.ref) ? bs.filter((b) => b.segRef !== s.ref) : [{ ref: daf.ref, segRef: s.ref, heRef: daf.heRef, snippet: s.he.slice(0, 90), at: Date.now() }, ...bs].slice(0, 200));
  };

  const toggleFullscreen = () => {
    const el: any = rootRef.current;
    if (!document.fullscreenElement && el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  };

  // Theme tokens for the reading surface.
  const t = surface === 'paper'
    ? { shell: 'bg-[#efe7d6]', page: 'bg-[#f7f2e7] text-stone-900', card: 'bg-white/70 border-[#e3d8c1]', soft: 'bg-[#efe6d3]', muted: 'text-stone-500', faint: 'text-stone-400', rule: 'border-[#e3d8c1]', accent: 'text-indigo-700', chip: 'bg-white/80 border-[#e3d8c1] text-stone-700', hover: 'hover:bg-white/60', sel: 'bg-indigo-50/80 ring-1 ring-indigo-300/60' }
    : { shell: 'bg-slate-950', page: 'bg-slate-900 text-slate-100', card: 'bg-slate-800/60 border-slate-700/60', soft: 'bg-slate-800/60', muted: 'text-slate-400', faint: 'text-slate-500', rule: 'border-slate-800', accent: 'text-indigo-300', chip: 'bg-slate-800 border-slate-700 text-slate-200', hover: 'hover:bg-slate-800/60', sel: 'bg-indigo-500/10 ring-1 ring-indigo-400/40' };
  const showHe = lang !== 'en', showEn = lang !== 'he';
  const heStyle: CSSProperties = { fontFamily: HE_FONT, fontSize: `${1.5 * fontScale}rem`, lineHeight: 1.85 };
  const enStyle: CSSProperties = { fontFamily: EN_FONT, fontSize: `${1.04 * fontScale}rem`, lineHeight: 1.7 };

  const dateLabel = current?.date ? new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const nextLocked = isCurrent;

  // ----------------------------------------------------------------------

  return (
    <div ref={rootRef} className={`sd fixed inset-0 z-[60] flex flex-col ${t.shell} ${surface === 'dark' ? 'sd-dark' : ''}`}>
      <style>{`
        .sd .sd-ref { color: #4f46e5; text-decoration: none; border-bottom: 1px dotted rgba(79,70,229,.5); font-size: .78em; font-weight: 600; }
        .sd .sd-ref:hover { border-bottom-style: solid; }
        .sd-dark .sd-ref { color: #a5b4fc; border-bottom-color: rgba(165,180,252,.5); }
        .sd .sd-eluc { opacity: .72; font-weight: 400; }
        .sd .sd-dh { font-weight: 700; }
        .sd .sd-scroll { scrollbar-width: thin; }
        .sd .sd-col { column-fill: auto; }
        .sd .sd-para { scroll-margin-top: 5rem; }
        .sd .sd-rashi { font-family: ${RASHI_FONT}; }
        .sd .sd-hl { background: rgba(99,102,241,.14); border-radius: .35rem; }
        @media (prefers-reduced-motion: no-preference) { .sd .sd-para { transition: background-color .25s ease, box-shadow .25s ease; } }
      `}</style>

      {/* ============ top bar ============ */}
      <header className="shrink-0 h-12 sm:h-14 flex items-center gap-2 px-2 sm:px-4 bg-slate-950 text-slate-100 border-b border-slate-800">
        <button onClick={onExit} className="p-2 rounded-full hover:bg-slate-800 text-slate-300" aria-label="Back to AI Sefarim"><ArrowLeft className="w-5 h-5" /></button>
        <button disabled={!daf?.prev} onClick={() => daf?.prev && setRef(daf.prev)} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label="Previous daf"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div className="truncate font-black text-[15px] sm:text-lg">
            {daf ? <><span lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{daf.heRef}</span><span className="text-slate-600 mx-2">·</span>{daf.ref}</> : ref || 'Super Daf'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate">
            {isCurrent && dateLabel ? `Daf Yomi · ${dateLabel}` : 'Super Daf'}
            {daf && <> · {daf.segments[focusIdx]?.amud}{focusSugya ? ` · ${KIND_LABEL[focusSugya.kind].en} ${focusSugya.index + 1}/${daf.sugyot.length}` : ''}</>}
            {daf && daf.status !== 'ready' && <span className="ml-2 inline-flex items-center gap-1 text-indigo-300"><Loader2 className="w-3 h-3 animate-spin" /> notes {daf.done}/{daf.total}</span>}
          </div>
        </div>
        <button disabled={!daf?.next || nextLocked} onClick={() => daf?.next && !nextLocked && setRef(daf.next)} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label="Next daf" title={nextLocked ? 'Tomorrow’s daf opens tonight' : 'Next daf'}>
          {nextLocked ? <Lock className="w-4 h-4" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        <div className="hidden sm:flex rounded-full bg-slate-800 p-0.5 border border-slate-700 ml-1">
          {(['study', 'daf'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${view === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{v === 'study' ? 'Study' : 'Daf'}</button>
          ))}
        </div>
        <button onClick={() => setSheet(sheet === 'settings' ? null : 'settings')} className={`p-2 rounded-full border ${sheet === 'settings' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'}`} aria-label="Reading settings" title="Reading settings"><Type className="w-4 h-4" /></button>
        <button onClick={toggleFullscreen} className="hidden sm:inline-flex p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:text-white" aria-label="Full screen" title={isFull ? 'Exit full screen' : 'Full screen'}>{isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
      </header>

      {/* ============ body ============ */}
      <div className="flex-1 min-h-0 flex">
        {daf && <Minimap daf={daf} focusIdx={focusIdx} onJump={scrollToSeg} bookmarks={bookmarks} surface={surface} />}

        <div ref={scrollRef} className="sd-scroll flex-1 min-w-0 overflow-y-auto overscroll-contain">
          {error && <div className="max-w-2xl mx-auto mt-10 px-4"><div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-700 dark:text-rose-200 text-sm font-medium">{error}</div></div>}
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
            <StudyView
              daf={daf} t={t} showHe={showHe} showEn={showEn} literal={literal} heStyle={heStyle} enStyle={enStyle} fontScale={fontScale}
              selected={selected} onSelect={(i) => { setSelected(i); setPaneTab('translation'); }}
              openSugya={openSugya} setOpenSugya={setOpenSugya} openNotes={openNotes} setOpenNotes={setOpenNotes}
              isBookmarked={isBookmarked} toggleBookmark={toggleBookmark}
              onCatchUp={(i) => { setFocusIdx(i); requestSofar(i); setSheet('catchup'); }}
            />
          )}
          {daf && view === 'daf' && (
            <DafView daf={daf} t={t} showEn={showEn} literal={literal} fontScale={fontScale} selected={selected} onSelect={(i) => { setSelected(i); setPaneTab('rashi'); }} />
          )}
          {daf && <footer className={`px-6 py-8 text-[11px] ${t.faint} leading-relaxed max-w-3xl mx-auto`}>{daf.attribution} · <a className="sd-ref" href={sefariaUrl(daf.ref)} target="_blank" rel="noopener noreferrer">open on Sefaria</a></footer>}
        </div>

        {daf && selected !== null && (
          <StudyPane
            daf={daf} seg={daf.segments[selected]} segIdx={selected} sugya={sugyaOf(selected)!} tab={paneTab} setTab={setPaneTab}
            onClose={() => setSelected(null)} literal={literal} showHe={showHe} showEn={showEn}
            bookmarked={isBookmarked(daf.segments[selected].ref)} onBookmark={() => toggleBookmark(selected)}
            onCatchUp={() => { setFocusIdx(selected); requestSofar(selected); setSheet('catchup'); }}
            onAsk={() => setSheet('ask')}
          />
        )}
      </div>

      {/* ============ dock ============ */}
      {daf && (
        <nav className="shrink-0 bg-slate-950 border-t border-slate-800 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
          <div className="max-w-xl mx-auto grid grid-cols-5 gap-1">
            {([
              { id: 'sugyot', label: 'Sugyot', icon: ListTree },
              { id: 'catchup', label: 'Catch me up', icon: Clock },
              { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
              { id: 'ask', label: 'Ask', icon: MessageSquareText },
              { id: 'listen', label: 'Listen', icon: Headphones },
            ] as { id: Sheet; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => {
              const disabled = id === 'listen' && podcasts.length === 0;
              return (
                <button
                  key={id!}
                  disabled={disabled}
                  onClick={() => { if (id === 'catchup') requestSofar(focusIdx); setSheet(sheet === id ? null : id); }}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition-colors disabled:opacity-30 ${sheet === id ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-100'}`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ============ sheets ============ */}
      {daf && sheet && (
        <Sheet onClose={() => setSheet(null)} title={
          sheet === 'sugyot' ? 'Sugyot on this daf' : sheet === 'catchup' ? `Catch me up · through ${short(daf.segments[focusIdx].ref, daf.book)}` : sheet === 'bookmarks' ? 'Bookmarks' : sheet === 'ask' ? `Ask about ${focusSugya ? KIND_LABEL[focusSugya.kind].en.toLowerCase() + ' ' + short(focusSugya.from, daf.book) : 'this sugya'}` : sheet === 'listen' ? 'Listen to the daf' : 'Reading settings'
        } tall={sheet === 'ask' || sheet === 'sugyot'}>
          {sheet === 'sugyot' && (
            <div className="space-y-2">
              {daf.sugyot.map((s) => {
                const tl = s.built?.intensive?.tldr;
                return (
                  <button key={s.index} onClick={() => { scrollToSeg(s.segments[0]); setSheet(null); }} className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${focusSugya?.index === s.index ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-indigo-300">
                      <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '0.95rem' }}>{KIND_LABEL[s.kind].he}</span> {KIND_LABEL[s.kind].en}
                      <span className="text-slate-500 normal-case tracking-normal font-semibold ml-auto">{short(s.from, daf.book)} – {short(s.to, daf.book)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-200 line-clamp-3" style={{ fontFamily: EN_FONT }}>{tl || daf.segments[s.segments[0]].en.slice(0, 180) + '…'}</p>
                    {s.prelude && <p className="mt-1 text-[11px] text-slate-500">Began on {short(s.prelude.from, daf.book)}</p>}
                  </button>
                );
              })}
            </div>
          )}
          {sheet === 'catchup' && <CatchUp data={sofar[daf.segments[focusIdx].ref]} segRef={short(daf.segments[focusIdx].ref, daf.book)} />}
          {sheet === 'bookmarks' && (
            bookmarks.length === 0 ? <p className="text-sm text-slate-400">No bookmarks yet. Tap the bookmark icon on any paragraph to save your place.</p> : (
              <div className="space-y-2">
                {bookmarks.map((b) => (
                  <div key={b.segRef} className="flex items-start gap-2 rounded-2xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5">
                    <button onClick={() => { if (b.ref === daf.ref) { const i = daf.segments.findIndex((s) => s.ref === b.segRef); if (i >= 0) scrollToSeg(i); } else { setRef(b.ref); } setSheet(null); }} className="min-w-0 flex-1 text-left">
                      <p className="text-[11px] font-black text-indigo-300">{b.segRef}</p>
                      <p lang="he" dir="rtl" className="text-sm text-slate-200 line-clamp-2" style={{ fontFamily: HE_FONT }}>{b.snippet}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{new Date(b.at).toLocaleDateString()}</p>
                    </button>
                    <button onClick={() => setBookmarks((bs) => bs.filter((x) => x.segRef !== b.segRef))} className="p-1.5 text-slate-500 hover:text-rose-300" aria-label="Remove bookmark"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )
          )}
          {sheet === 'ask' && focusSugya && (
            <AskThread messages={chats[(selected !== null ? sugyaOf(selected) : focusSugya)!.index] || []} busy={chatBusy} input={chatInput} setInput={setChatInput} onSend={ask} />
          )}
          {sheet === 'listen' && (
            <div className="space-y-3">
              {podcasts.map((p) => (
                <div key={p.id} className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-3">
                  <p className="text-sm font-black text-slate-100 mb-2">{p.title}</p>
                  <AudioPlayer url={p.url} title={p.title} />
                </div>
              ))}
            </div>
          )}
          {sheet === 'settings' && (
            <div className="space-y-5">
              <div className="sm:hidden">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">View</p>
                <Segmented value={view} onChange={(v) => setView(v as View)} options={[{ v: 'study', l: 'Study' }, { v: 'daf', l: 'Daf' }]} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Language</p>
                <Segmented value={lang} onChange={(v) => setLang(v as Lang)} options={[{ v: 'both', l: 'Hebrew + English' }, { v: 'he', l: 'Hebrew' }, { v: 'en', l: 'English' }]} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Translation</p>
                <Segmented value={literal ? 'literal' : 'full'} onChange={(v) => setLiteral(v === 'literal')} options={[{ v: 'full', l: 'Full (with elucidation)' }, { v: 'literal', l: 'Literal words only' }]} />
                <p className="text-[11px] text-slate-500 mt-1.5"><strong className="text-slate-300">Bold</strong> is the Gemara’s own words; lighter text is the Davidson elucidation.</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Text size</p>
                <div className="flex items-center rounded-full bg-slate-800 border border-slate-700">
                  <button onClick={() => setFontScale((f) => Math.max(0.8, +(f - 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Smaller"><Minus className="w-4 h-4" /></button>
                  <span className="text-xs font-black text-slate-200 w-10 text-center tabular-nums">{Math.round(fontScale * 100)}%</span>
                  <button onClick={() => setFontScale((f) => Math.min(1.7, +(f + 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Larger"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Page</p>
                <Segmented value={surface} onChange={(v) => setSurface(v as Surface)} options={[{ v: 'paper', l: 'Paper', icon: Sun }, { v: 'dark', l: 'Dark', icon: Moon }]} />
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Minimap: the daf drawn as pages, one per amud. Center blocks are the
// Gemara paragraphs (height ~ length), margins are Rashi (inner/right) and
// Tosafot (outer/left). The paragraph on screen is lit; tap to jump.

function Minimap({ daf, focusIdx, onJump, bookmarks, surface }: { daf: Daf; focusIdx: number; onJump: (i: number) => void; bookmarks: BookmarkItem[]; surface: Surface }) {
  const W = 104, PAD = 6, COL = 20, GAP = 4, GEM = W - PAD * 2 - (COL + GAP) * 2;
  const amudim = useMemo(() => {
    const groups: Record<string, number[]> = {};
    daf.segments.forEach((s, i) => { (groups[s.amud] = groups[s.amud] || []).push(i); });
    return Object.entries(groups);
  }, [daf]);
  const coreFor = (segRef: string, title: 'Rashi' | 'Tosafot') => daf.sugyot.flatMap((s) => s.built?.core || []).filter((c) => c.anchor === segRef && c.title === title);
  const marked = new Set(bookmarks.filter((b) => b.ref === daf.ref).map((b) => b.segRef));
  const fill = surface === 'paper' ? { page: '#fbf7ee', stroke: '#d9cdb3', block: '#cfc3a9', mishnah: '#e8c279', side: '#ddd3bd', focus: '#4f46e5', text: '#8a7f6a' } : { page: '#0f172a', stroke: '#334155', block: '#475569', mishnah: '#b45309', side: '#334155', focus: '#818cf8', text: '#94a3b8' };
  return (
    <aside className="hidden md:flex shrink-0 w-[128px] flex-col items-center gap-3 py-3 overflow-y-auto sd-scroll border-r border-black/5" aria-label="Where you are on the daf">
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: fill.text }}><MapIcon className="w-3 h-3" /> The daf</div>
      {amudim.map(([amud, idxs]) => {
        const total = idxs.reduce((a, i) => a + Math.max(40, daf.segments[i].he.length), 0);
        const H = Math.min(440, Math.max(160, Math.round(total / 9)));
        let y = PAD + 14;
        const rows = idxs.map((i) => {
          const h = Math.max(5, Math.round(((Math.max(40, daf.segments[i].he.length)) / total) * (H - PAD * 2 - 14)) - 2);
          const r = { i, y, h }; y += h + 2; return r;
        });
        return (
          <svg key={amud} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 drop-shadow-sm">
            <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={6} fill={fill.page} stroke={fill.stroke} />
            <text x={W / 2} y={11} textAnchor="middle" fontSize={8} fontWeight={800} fill={fill.text} style={{ fontFamily: HE_FONT }}>{daf.heTitle} {amud.endsWith('a') ? 'ע״א' : 'ע״ב'}</text>
            {rows.map(({ i, y, h }) => {
              const s = daf.segments[i];
              const isFocus = i === focusIdx;
              const sugyaStart = daf.sugyot.some((sg) => sg.segments[0] === i && sg.kind !== 'continued');
              const rashi = coreFor(s.ref, 'Rashi').length, tos = coreFor(s.ref, 'Tosafot').length;
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
      <p className="px-2 text-[9px] leading-tight text-center" style={{ color: fill.text }}>Center: Gemara · right: Rashi · left: Tosafot</p>
    </aside>
  );
}

// ----------------------------------------------------------------------
// Study view: paragraph by paragraph, with sugya cards between sugyot.

function StudyView({
  daf, t, showHe, showEn, literal, heStyle, enStyle, fontScale, selected, onSelect, openSugya, setOpenSugya, openNotes, setOpenNotes, isBookmarked, toggleBookmark, onCatchUp,
}: {
  daf: Daf; t: any; showHe: boolean; showEn: boolean; literal: boolean; heStyle: CSSProperties; enStyle: CSSProperties; fontScale: number;
  selected: number | null; onSelect: (i: number) => void;
  openSugya: Record<number, boolean>; setOpenSugya: (f: (o: Record<number, boolean>) => Record<number, boolean>) => void;
  openNotes: Record<string, boolean>; setOpenNotes: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void;
  isBookmarked: (r: string) => boolean; toggleBookmark: (i: number) => void; onCatchUp: (i: number) => void;
}) {
  return (
    <div className={`${t.page} min-h-full`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-4 pb-10">
        {daf.sugyot.map((sugya) => {
          const built = sugya.built;
          const intensive = built?.intensive && !built.intensive._error ? built.intensive : null;
          const isOpen = !!openSugya[sugya.index];
          return (
            <section key={sugya.index} className="mb-10">
              {/* sugya header */}
              <div className={`rounded-2xl border ${t.card} px-4 py-3 mb-4 shadow-sm`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${sugya.kind === 'mishnah' ? 'bg-amber-500/15 text-amber-800 border border-amber-500/30' : 'bg-indigo-500/10 border border-indigo-500/30 ' + t.accent}`}>
                    <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '1rem' }}>{KIND_LABEL[sugya.kind].he}</span>
                    <span className="uppercase tracking-wider">{KIND_LABEL[sugya.kind].en}</span>
                  </span>
                  <span className={`text-xs font-bold ${t.muted}`}>{short(sugya.from, daf.book)} – {short(sugya.to, daf.book)}</span>
                  {sugya.prelude && <span className={`text-[11px] font-semibold ${t.faint}`}>· began on {short(sugya.prelude.from, daf.book)}</span>}
                  {!built && <span className={`ml-auto text-[11px] ${t.faint} inline-flex items-center gap-1`}><Loader2 className="w-3 h-3 animate-spin" /> preparing notes</span>}
                </div>
                {intensive?.tldr ? (
                  <p className="mt-2.5" style={{ ...enStyle, fontSize: `${0.98 * fontScale}rem` }}><span className={`font-black text-[10px] uppercase tracking-wider mr-2 ${t.accent}`}>TL;DR</span>{intensive.tldr}</p>
                ) : null}
                {(sugya.prelude || intensive?.overview) && (
                  <button onClick={() => setOpenSugya((o) => ({ ...o, [sugya.index]: !o[sugya.index] }))} className={`mt-2 text-[11px] font-bold ${t.accent}`}>
                    {isOpen ? 'Hide' : 'Show'} {sugya.prelude ? 'the beginning of this sugya' : ''}{sugya.prelude && intensive?.overview ? ' and ' : ''}{intensive?.overview ? 'the overview' : ''}
                  </button>
                )}
                {isOpen && sugya.prelude && (
                  <div className={`mt-3 rounded-xl border border-dashed ${t.rule} ${t.soft} px-3 py-3`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${t.muted} mb-2`}>Earlier in this sugya · {short(sugya.prelude.from, daf.book)} – {short(sugya.prelude.to, daf.book)}</p>
                    {sugya.prelude.segments.map((s) => (
                      <div key={s.ref} className="mb-2.5">
                        {showHe && <p lang="he" dir="rtl" style={{ fontFamily: HE_FONT, fontSize: `${1.1 * fontScale}rem`, lineHeight: 1.75 }}>{s.he}</p>}
                        {showEn && <Davidson text={s.en} html={s.enHtml} literal={literal} style={{ fontFamily: EN_FONT, fontSize: `${0.92 * fontScale}rem`, lineHeight: 1.6 }} className={t.muted} />}
                      </div>
                    ))}
                  </div>
                )}
                {isOpen && intensive?.overview && (
                  <div className="mt-3 text-sm">
                    <p className={`text-[10px] font-black uppercase tracking-wider ${t.accent} mb-1`}>Overview</p>
                    <RefText text={intensive.overview} />
                    {intensive.themes?.length > 0 && <ul className="mt-2 space-y-1">{intensive.themes.map((th: any, i: number) => <li key={i} className="flex gap-2"><span className={t.accent}>◆</span><span><RefText text={th.point} /> {th.refs?.map((r: string) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</span></li>)}</ul>}
                  </div>
                )}
              </div>

              {/* paragraphs */}
              {sugya.segments.map((idx) => {
                const s = daf.segments[idx];
                const rashi = (built?.core || []).filter((c) => c.title === 'Rashi' && c.anchor === s.ref);
                const tos = (built?.core || []).filter((c) => c.title === 'Tosafot' && c.anchor === s.ref);
                const notes = intensive?.segments?.find((x: any) => x.ref === s.ref);
                const nNotes = notes?.notes?.length || 0;
                const key = s.ref;
                const open = !!openNotes[key];
                const isSel = selected === idx;
                return (
                  <article key={s.ref} data-seg={idx} className={`sd-para rounded-2xl px-3 sm:px-4 py-3 mb-1 ${isSel ? t.sel : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onSelect(idx)}>
                        {s.startsMishnah && <p className={`text-[10px] font-black uppercase tracking-widest ${t.accent} mb-1`}>Mishnah</p>}
                        {s.startsGemara && <p className={`text-[10px] font-black uppercase tracking-widest ${t.accent} mb-1`}>Gemara</p>}
                        {showHe && <p lang="he" dir="rtl" style={heStyle}>{s.he}</p>}
                        {showEn && <Davidson text={s.en} html={s.enHtml} literal={literal} style={enStyle} className={showHe ? 'mt-2' : ''} />}
                      </div>
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <span className={`text-[10px] ${t.faint} font-bold tabular-nums`}>{s.amud}:{s.n}</span>
                        <button onClick={() => toggleBookmark(idx)} className={`p-1 rounded-md ${isBookmarked(s.ref) ? 'text-amber-500' : t.faint + ' hover:text-amber-500'}`} aria-label="Bookmark this paragraph">
                          {isBookmarked(s.ref) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {/* one accordion: commentary & notes */}
                    {(built || true) && (
                      <div className="mt-2">
                        <button
                          onClick={() => setOpenNotes((o) => ({ ...o, [key]: !o[key] }))}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          {built ? <>{rashi.length ? `Rashi ${rashi.length}` : ''}{rashi.length && (tos.length || nNotes) ? ' · ' : ''}{tos.length ? `Tosafot ${tos.length}` : ''}{tos.length && nNotes ? ' · ' : ''}{nNotes ? `Notes ${nNotes}` : ''}{!rashi.length && !tos.length && !nNotes ? 'No commentary linked here' : ''}</> : <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> notes coming</span>}
                          <span className={t.faint}>{open ? '▴' : '▾'}</span>
                        </button>
                        <button onClick={() => onCatchUp(idx)} className={`ml-1.5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}><Clock className="w-3.5 h-3.5" /> Catch me up here</button>
                        {open && built && (
                          <div className={`mt-2 rounded-xl ${t.soft} px-3 py-3 space-y-3 animate-in fade-in duration-200`}>
                            {notes?.flow && <p className="text-sm italic"><RefText text={notes.flow} /></p>}
                            {[...rashi, ...tos].map((c) => (
                              <div key={c.ref}>
                                <p className={`text-[10px] font-black uppercase tracking-wider ${t.accent}`}>{c.title}</p>
                                {showHe && <p lang="he" dir="rtl" className="sd-rashi" style={{ fontSize: `${1.12 * fontScale}rem`, lineHeight: 1.7 }}>{c.he}</p>}
                                {showEn && c.en && <Rich text={c.en} style={{ fontFamily: EN_FONT, fontSize: `${0.9 * fontScale}rem`, lineHeight: 1.6 }} className={`${t.muted} mt-1`} />}
                                <p className={`text-[10px] ${t.faint} mt-0.5`}><SourceLink r={c.ref} />{c.enSource === 'ai' && showEn && <span className="ml-1.5 italic">AI translation</span>}</p>
                              </div>
                            ))}
                            {nNotes > 0 && (
                              <ul className="space-y-1.5">
                                {notes.notes.map((nt: Note, i: number) => (
                                  <li key={i} className="text-sm flex gap-2"><span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border ${t.chip}`}>{nt.source}</span><span><RefText text={nt.point} /> <SourceLink r={nt.ref} /></span></li>
                                ))}
                              </ul>
                            )}
                            <button onClick={() => onSelect(idx)} className={`text-[11px] font-bold ${t.accent}`}>Open the full study pane →</button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {sugya.continuesOn && <p className={`mt-2 px-3 text-xs ${t.muted} italic`}>This sugya continues on {short(sugya.continuesOn, daf.book)} — tomorrow’s daf.{intensive?.continuesOn ? ` ${intensive.continuesOn}` : ''}</p>}

              {built && (
                <div className="mt-5 space-y-3">
                  {intensive?.questions?.length > 0 && (
                    <Card t={t} icon={Quote} title="Questions the commentaries ask" defaultOpen={false} teaser={`${intensive.questions.length} questions`}>
                      <div className="space-y-3">
                        {intensive.questions.map((q: any, i: number) => (
                          <div key={i} className="text-sm"><p className="font-bold"><RefText text={q.question} /></p><p className={`mt-0.5 ${t.muted}`}><RefText text={q.answer} /> {q.refs?.map((r: string) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</p></div>
                        ))}
                      </div>
                    </Card>
                  )}
                  <RambamCard rambam={built.rambam} sources={built.rambamSources} t={t} />
                  <HalachaCard halacha={built.halacha} t={t} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Daf view: a page per amud in the form of the printed daf.

function DafView({ daf, t, showEn, literal, fontScale, selected, onSelect }: { daf: Daf; t: any; showEn: boolean; literal: boolean; fontScale: number; selected: number | null; onSelect: (i: number) => void }) {
  const amudim = useMemo(() => {
    const groups: Record<string, number[]> = {};
    daf.segments.forEach((s, i) => { (groups[s.amud] = groups[s.amud] || []).push(i); });
    return Object.entries(groups);
  }, [daf]);
  const core = daf.sugyot.flatMap((s) => s.built?.core || []);
  const [hover, setHover] = useState<string | null>(null);
  const active = selected !== null ? daf.segments[selected].ref : hover;
  const lemma = (he: string) => { const m = he.match(/^(.{2,60}?)(\s[-–—]\s|\.\s)/); return m ? [m[1], he.slice(m[0].length)] : [he.split(' ').slice(0, 3).join(' '), he.split(' ').slice(3).join(' ')]; };
  const Col = ({ items, side }: { items: Comm[]; side: 'rashi' | 'tos' }) => (
    <div className={`sd-rashi ${t.muted}`} dir="rtl" style={{ fontSize: `${0.98 * fontScale}rem`, lineHeight: 1.6 }}>
      {items.length === 0 && <p className={`text-[11px] ${t.faint} not-italic`} style={{ fontFamily: EN_FONT }}>{side === 'rashi' ? 'No Rashi on Sefaria for this amud' : 'No Tosafot on Sefaria for this amud'}</p>}
      {items.map((c) => {
        const [dh, rest] = lemma(c.he);
        const on = active === c.anchor;
        return (
          <p key={c.ref} className={`mb-1.5 ${on ? 'sd-hl px-1 -mx-1' : ''}`} onMouseEnter={() => setHover(c.anchor)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(daf.segments.findIndex((s) => s.ref === c.anchor))}>
            <span className="font-bold text-stone-900 dark:text-slate-100">{dh}</span> {rest}
          </p>
        );
      })}
    </div>
  );
  return (
    <div className="px-2 sm:px-6 py-4 space-y-8">
      {amudim.map(([amud, idxs]) => {
        const rashi = core.filter((c) => c.title === 'Rashi' && idxs.some((i) => daf.segments[i].ref === c.anchor));
        const tos = core.filter((c) => c.title === 'Tosafot' && idxs.some((i) => daf.segments[i].ref === c.anchor));
        return (
          <div key={amud} className={`${t.page} mx-auto max-w-6xl rounded-[1.25rem] shadow-[0_30px_60px_-30px_rgba(0,0,0,.5)] border ${t.rule} px-4 sm:px-8 py-5`}>
            <div className="flex items-baseline justify-between mb-4">
              <span className={`text-xs font-black uppercase tracking-[0.2em] ${t.faint}`}>{daf.book} {amud}</span>
              <span lang="he" dir="rtl" className="font-black text-xl" style={{ fontFamily: HE_FONT }}>{daf.heTitle} · דף {daf.heRef.split(' ').pop()} {amud.endsWith('a') ? 'ע״א' : 'ע״ב'}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-5 lg:gap-8">
              <div className="order-2 lg:order-1"><p className={`text-[10px] font-black uppercase tracking-wider ${t.faint} mb-1`}>תוספות</p><Col items={tos} side="tos" /></div>
              <div className="order-1 lg:order-2" dir="rtl">
                {idxs.map((i) => {
                  const s = daf.segments[i];
                  const on = active === s.ref;
                  return (
                    <div key={s.ref} data-seg={i} className={`sd-para mb-2 cursor-pointer rounded-lg px-1 -mx-1 ${on ? 'sd-hl' : ''}`} onMouseEnter={() => setHover(s.ref)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(i)}>
                      <p lang="he" style={{ fontFamily: HE_FONT, fontSize: `${1.42 * fontScale}rem`, lineHeight: 1.8 }}>
                        {s.startsMishnah && <span className="font-black ml-1">מתני׳</span>}
                        {s.startsGemara && <span className="font-black ml-1">גמ׳</span>}
                        {s.startsTopic && <span className={`ml-1 ${t.accent}`}>§</span>}
                        {s.he}
                      </p>
                      {showEn && <Davidson text={s.en} html={s.enHtml} literal={literal} dir="ltr" style={{ fontFamily: EN_FONT, fontSize: `${0.9 * fontScale}rem`, lineHeight: 1.55 }} className={`${t.muted} mt-0.5 text-left`} />}
                    </div>
                  );
                })}
              </div>
              <div className="order-3"><p className={`text-[10px] font-black uppercase tracking-wider ${t.faint} mb-1`}>רש״י</p><Col items={rashi} side="rashi" /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// Study pane for one paragraph: drawer on wide screens, sheet on phones.

function StudyPane({
  daf, seg, segIdx, sugya, tab, setTab, onClose, literal, showHe, showEn, bookmarked, onBookmark, onCatchUp, onAsk,
}: {
  daf: Daf; seg: Seg; segIdx: number; sugya: Sugya; tab: PaneTab; setTab: (t: PaneTab) => void; onClose: () => void; literal: boolean; showHe: boolean; showEn: boolean;
  bookmarked: boolean; onBookmark: () => void; onCatchUp: () => void; onAsk: () => void;
}) {
  const built = sugya.built;
  const core = (built?.core || []).filter((c) => c.anchor === seg.ref);
  const more = [...(built?.rishonim || []), ...(built?.acharonim || []), ...(built?.other || [])].filter((c) => c.anchor === seg.ref);
  const notes = built?.intensive?.segments?.find((s: any) => s.ref === seg.ref);
  const tabs: { id: PaneTab; label: string }[] = [
    { id: 'translation', label: 'Translation' }, { id: 'rashi', label: `Rashi · Tosafot${core.length ? ` (${core.length})` : ''}` }, { id: 'notes', label: `Notes${notes?.notes?.length ? ` (${notes.notes.length})` : ''}` }, { id: 'more', label: `More${more.length ? ` (${more.length})` : ''}` },
  ];
  const Comment = ({ c }: { c: Comm }) => (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">{c.title}</p>
      {showHe && <p lang="he" dir="rtl" className="sd-rashi text-slate-100" style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>{c.he}</p>}
      {showEn && (c.en ? <Rich text={c.en} style={{ fontFamily: EN_FONT, fontSize: '.92rem', lineHeight: 1.6 }} className="text-slate-300 mt-1.5" /> : <p className="text-xs text-slate-500 italic mt-1">No translation available yet.</p>)}
      <p className="mt-1.5 text-[10px] text-slate-500"><SourceLink r={c.ref} />{c.enSource === 'ai' && <span className="ml-1.5 italic">AI translation</span>}</p>
    </div>
  );
  return (
    <div className="fixed inset-x-0 bottom-0 top-12 sm:top-14 lg:static lg:inset-auto z-30 lg:z-auto flex items-end lg:items-stretch">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] lg:hidden" onClick={onClose} />
      <div className="relative w-full lg:w-[440px] xl:w-[500px] max-h-[82vh] lg:max-h-none lg:h-full bg-slate-900 text-slate-200 border-t lg:border-t-0 lg:border-l border-slate-800 rounded-t-[1.5rem] lg:rounded-none shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 lg:slide-in-from-right-4 duration-300">
        <div className="px-4 pt-3 pb-2 border-b border-slate-800 shrink-0">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">{short(seg.ref, daf.book)} · {KIND_LABEL[sugya.kind].en}</p>
              <p lang="he" dir="rtl" className="text-sm text-slate-200 line-clamp-2 mt-0.5" style={{ fontFamily: HE_FONT }}>{seg.he}</p>
            </div>
            <button onClick={onBookmark} className={`p-1.5 rounded-lg ${bookmarked ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'}`} aria-label="Bookmark">{bookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}</button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${tab === tb.id ? 'bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-400/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{tb.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 sd-scroll">
          {tab === 'translation' && (
            <>
              <Davidson text={seg.en} html={seg.enHtml} literal={false} style={{ fontFamily: EN_FONT, fontSize: '1.02rem', lineHeight: 1.75 }} className="text-slate-100" />
              <p className="text-[11px] text-slate-500"><strong className="text-slate-300">Bold</strong> = the Gemara’s words · lighter = the Davidson elucidation{literal ? ' (the page shows literal words only)' : ''}.</p>
              <p className="text-[11px] text-slate-500"><SourceLink r={seg.ref} /></p>
            </>
          )}
          {tab === 'rashi' && (!built ? <Pending /> : core.length ? core.map((c) => <Comment key={c.ref} c={c} />) : <p className="text-sm text-slate-500">No Rashi or Tosafot on Sefaria for this paragraph.</p>)}
          {tab === 'notes' && (!built ? <Pending /> : notes ? (
            <>
              {notes.flow && <p className="text-sm italic text-slate-300"><RefText text={notes.flow} /></p>}
              {notes.notes?.length ? notes.notes.map((nt: Note, i: number) => (
                <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5 text-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">{nt.source}</p>
                  <RefText text={nt.point} /><p className="mt-1.5"><SourceLink r={nt.ref} /></p>
                </div>
              )) : <p className="text-sm text-slate-500">No commentary on Sefaria is anchored to this paragraph.</p>}
            </>
          ) : <p className="text-sm text-slate-500">No notes for this paragraph.</p>)}
          {tab === 'more' && (!built ? <Pending /> : more.length ? more.map((c) => <Comment key={c.ref} c={c} />) : <p className="text-sm text-slate-500">No further commentaries are linked on Sefaria for this paragraph.</p>)}
        </div>
        <div className="shrink-0 p-3 border-t border-slate-800 flex gap-2">
          <button onClick={onCatchUp} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-2.5 text-xs font-bold"><Clock className="w-4 h-4" /> Catch me up to here</button>
          <button onClick={onAsk} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2.5 text-xs font-bold"><MessageSquareText className="w-4 h-4" /> Ask about this</button>
        </div>
      </div>
    </div>
  );
}

function Pending() {
  return <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> The notes for this sugya are still being prepared.</p>;
}

// ----------------------------------------------------------------------
// Sheets (bottom on phone, centered card on desktop) and small widgets

function Sheet({ title, children, onClose, tall }: { title: string; children: ReactNode; onClose: () => void; tall?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full sm:max-w-lg ${tall ? 'max-h-[85vh] sm:h-[80vh]' : 'max-h-[80vh]'} bg-slate-900 text-slate-200 border border-slate-800 rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-250`}>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-800 shrink-0">
          <h3 className="font-black text-slate-100 text-sm truncate">{title}</h3>
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
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${value === o.v ? 'bg-slate-100 text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>
          {o.icon && <o.icon className="w-3.5 h-3.5" />}{o.l}{value === o.v && <Check className="w-3.5 h-3.5" />}
        </button>
      ))}
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
        {messages.map((m, i) => (
          <div key={i} className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white ml-8' : 'bg-slate-800/70 border border-slate-700/60 mr-4'}`}>{m.role === 'user' ? m.content : <RefText text={m.content} />}</div>
        ))}
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

function Card({ t, icon: Icon, title, teaser, defaultOpen = true, children }: { t: any; icon: any; title: string; teaser?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border ${t.card} px-4 sm:px-5 py-3.5`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 text-left">
        <p className={`text-[11px] font-black uppercase tracking-wider ${t.accent} inline-flex items-center gap-1.5`}><Icon className="w-3.5 h-3.5" /> {title}</p>
        <span className={`text-[11px] ${t.faint}`}>{open ? 'hide' : teaser || 'show'}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function RambamCard({ rambam, sources, t }: { rambam: any; sources: Comm[]; t: any }) {
  if (!rambam) return null;
  const ok = rambam.available && !rambam._error;
  return (
    <Card t={t} icon={Landmark} title="Through the eyes of the Rambam" defaultOpen={ok} teaser={ok ? `${rambam.rulings?.length || 0} rulings` : 'nothing linked'}>
      <div className="text-sm space-y-3">
        {rambam._error ? <p className={t.muted}>This section could not be prepared ({rambam._error}).</p>
        : !rambam.available ? <p className={t.muted}>{rambam.note}</p>
        : (
          <>
            <RefText text={rambam.summary} className="block" />
            {rambam.rulings?.length > 0 && <div className="space-y-2">{rambam.rulings.map((r: any, i: number) => (
              <div key={i} className={`rounded-xl ${t.soft} px-3 py-2`}><p className="text-[11px] font-black"><SourceLink r={r.ref} /></p><p className="mt-0.5"><RefText text={r.ruling} /></p>{r.reading && <p className={`mt-1 ${t.muted} italic`}><RefText text={r.reading} /></p>}</div>
            ))}</div>}
            {rambam.mishnah && <p><span className="font-bold">Commentary on the Mishnah: </span><RefText text={rambam.mishnah} /></p>}
            {rambam.commentators?.length > 0 && <ul className="space-y-1.5">{rambam.commentators.map((c: any, i: number) => <li key={i} className="flex gap-2"><span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border ${t.chip}`}>{c.source}</span><span><RefText text={c.point} /> <SourceLink r={c.ref} /></span></li>)}</ul>}
            {rambam.notAvailable?.length > 0 && <p className={`text-xs ${t.faint}`}>Not on Sefaria for this passage: {rambam.notAvailable.join(', ')}.</p>}
            {sources?.length > 0 && <p className={`text-[11px] ${t.faint}`}>Sources: {sources.map((s) => <span key={s.ref} className="mr-2"><SourceLink r={s.ref} /></span>)}</p>}
          </>
        )}
      </div>
    </Card>
  );
}

function HalachaCard({ halacha, t }: { halacha: any; t: any }) {
  if (!halacha) return null;
  const ok = halacha.available && !halacha._error;
  const cell = (x: any, label: string) => (
    <div className={`rounded-xl ${t.soft} px-3 py-2 min-w-0`}>
      <p className={`text-[10px] font-black uppercase tracking-wider ${t.faint}`}>{label}</p>
      {x ? <><p className="text-sm mt-0.5"><RefText text={x.ruling} /></p><p className="mt-1"><SourceLink r={x.ref} /></p></> : <p className={`text-xs mt-0.5 ${t.faint} italic`}>not linked here</p>}
    </div>
  );
  return (
    <Card t={t} icon={Scale} title="Halacha in practice" defaultOpen={ok} teaser={ok ? `${halacha.items?.length || 0} points` : 'nothing linked'}>
      <div className="space-y-3">
        {halacha._error ? <p className={`text-sm ${t.muted}`}>This section could not be prepared ({halacha._error}).</p>
        : !halacha.available ? <p className={`text-sm ${t.muted}`}>{halacha.note}</p>
        : (
          <>
            {halacha.items?.map((it: any, i: number) => (
              <div key={i}>
                <p className="text-sm font-bold mb-1.5"><RefText text={it.issue} /></p>
                <div className="grid gap-2 sm:grid-cols-3">{cell(it.rambam, 'Rambam')}{cell(it.shulchanArukh, 'Shulchan Arukh')}{cell(it.rema, 'Rema')}</div>
                {it.note && <p className={`mt-1.5 text-xs ${t.muted} italic`}><RefText text={it.note} /></p>}
              </div>
            ))}
            {halacha.caveat && <p className={`text-[11px] ${t.faint}`}>{halacha.caveat}</p>}
            <p className={`text-[11px] ${t.faint}`}>For practice, confirm with your rav.</p>
          </>
        )}
      </div>
    </Card>
  );
}

// Unused-import guard for icons referenced only in some branches.
void BookOpen; void ScrollText; void ListChecks;
