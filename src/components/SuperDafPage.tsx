import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Sparkles, Headphones, X, ExternalLink, Clock, Layers,
  Sun, Moon, Loader2, Scale, Landmark, Send, MessageSquareText, Minus, Plus, Lock, ScrollText, Quote, ListChecks,
} from 'lucide-react';
import type { Video as MediaItem } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { DAF_API, dafPath, sefariaUrl, titleMatchesDaf } from '../lib/daf';

// ----------------------------------------------------------------------
// Types mirroring the worker's /daf/get response

interface Seg { ref: string; amud: string; n: number; he: string; en: string; isMishnah?: boolean }
interface Comm { ref: string; title: string; heTitle: string; layer: string; he: string; en: string; url: string; anchor: string; enSource?: string }
interface Note { source: string; ref: string; point: string }
interface Built {
  core: Comm[]; rishonim: Comm[]; acharonim: Comm[]; other: Comm[]; rambamSources: Comm[]; halachaSources: Comm[];
  intensive: any; rambam: any; halacha: any;
}
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

type Level = 'basic' | 'intensive';
type Surface = 'paper' | 'dark';
type Lang = 'both' | 'he' | 'en';
type PanelTab = 'notes' | 'rashi' | 'more' | 'sofar' | 'ask';

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';

const PREFS_KEY = 'super_daf_prefs';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}

// A citation like "[Rashi on Bekhorot 17a:3:1]" inside generated prose
// becomes a link to that text on Sefaria.
function RefText({ text, className }: { text: string; className?: string }) {
  const parts = String(text || '').split(/(\[[^\]]{3,120}\])/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]$/);
        if (m && /\d/.test(m[1])) {
          return (
            <a key={i} href={sefariaUrl(m[1])} target="_blank" rel="noopener noreferrer" className="sd-ref" title={m[1]}>
              {m[1]}
            </a>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

// Translations come back with light markdown (a **bold** dibbur hamatchil);
// render just that, nothing else.
function Rich({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={className} style={style}>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="sd-dh">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </p>
  );
}

function SourceLink({ r }: { r: string }) {
  return (
    <a href={sefariaUrl(r)} target="_blank" rel="noopener noreferrer" className="sd-ref inline-flex items-center gap-1">
      {r} <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}

const KIND_LABEL: Record<Sugya['kind'], { he: string; en: string }> = {
  mishnah: { he: 'משנה', en: 'Mishnah' },
  gemara: { he: 'גמרא', en: 'Gemara' },
  topic: { he: 'סוגיא', en: 'New topic' },
  continued: { he: 'המשך', en: 'Continued' },
};

// ----------------------------------------------------------------------

export function SuperDafPage({
  initialRef, pinnedPodcastId, media, onExit,
}: { initialRef?: string | null; pinnedPodcastId?: string | null; media: MediaItem[]; onExit: () => void }) {
  const prefs = useMemo(loadPrefs, []);
  const [level, setLevel] = useState<Level>(prefs.level || 'basic');
  const [surface, setSurface] = useState<Surface>(prefs.surface || 'paper');
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [fontScale, setFontScale] = useState<number>(prefs.fontScale || 1);
  const [current, setCurrent] = useState<{ ref: string; date: string } | null>(null);
  const [ref, setRef] = useState<string | null>(initialRef || null);
  const [daf, setDaf] = useState<Daf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ sugya: number; seg: number | null; tab: PanelTab } | null>(null);
  const [openTldr, setOpenTldr] = useState<Record<number, boolean>>({});
  const [openPrelude, setOpenPrelude] = useState<Record<number, boolean>>({});
  const [sofar, setSofar] = useState<Record<string, TldrSoFar | 'loading' | { error: string }>>({});
  const [chats, setChats] = useState<Record<number, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [activeSugya, setActiveSugya] = useState(0);
  const sugyaRefs = useRef<Record<number, HTMLElement | null>>({});
  const pollRef = useRef<number | null>(null);

  // Fonts for the reading surface, loaded once.
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = FONTS_HREF;
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ level, surface, lang, fontScale })); } catch { /* ignore */ }
  }, [level, surface, lang, fontScale]);

  // Which daf is "today's" (the next day's Daf Yomi, New York time).
  useEffect(() => {
    fetch(`${DAF_API}/current`).then((r) => r.json()).then((d) => {
      if (d && d.ref) {
        setCurrent({ ref: d.ref, date: d.date });
        if (!initialRef) setRef(d.ref);
      } else if (!initialRef) setError('Could not determine today’s daf.');
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
    setError(null);
    setDaf(null);
    setPanel(null);
    setOpenTldr({});
    setSofar({});
    window.history.replaceState({}, '', dafPath(ref) + window.location.search);
    // While the notes are still being prepared, this tab drives the build:
    // one task per request to /daf/step (which may take a minute), then a
    // refresh. If another tab holds the build lock, just poll.
    const tick = async () => {
      try {
        const d = await load(ref);
        if (cancelled) return;
        setDaf(d);
        if (d.status !== 'ready') {
          let delay = 7000;
          try {
            const r = await fetch(`${DAF_API}/step?ref=${encodeURIComponent(ref)}`).then((x) => x.json());
            if (r && !r.locked) delay = 300; // something finished - show it right away
          } catch { /* fall back to polling */ }
          if (!cancelled) pollRef.current = window.setTimeout(tick, delay);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Could not load this daf.');
      }
    };
    tick();
    return () => { cancelled = true; if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [ref, load]);

  // Track which sugya is on screen (for the floating Ask button + nav chips).
  useEffect(() => {
    if (!daf) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSugya(Number((visible[0].target as HTMLElement).dataset.sugya));
    }, { rootMargin: '-30% 0px -55% 0px' });
    Object.values(sugyaRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [daf]);

  const isCurrent = !!(daf && current && daf.ref === current.ref);
  const nextLocked = !!(daf && current && isCurrent);

  const podcasts = useMemo(() => {
    if (!daf) return [] as MediaItem[];
    const pinned = media.filter((m) => m.id === pinnedPodcastId);
    const matched = media.filter((m) => m.type === 'audio' && m.id !== pinnedPodcastId && titleMatchesDaf(m.title, daf.book, daf.daf));
    return [...pinned, ...matched];
  }, [media, daf, pinnedPodcastId]);

  // --- generated-on-click: summary up to a paragraph
  const requestSofar = async (sugyaIndex: number, segRef: string) => {
    if (!daf || sofar[segRef]) return;
    setSofar((s) => ({ ...s, [segRef]: 'loading' }));
    try {
      const res = await fetch(`${DAF_API}/tldr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: daf.ref, sugya: sugyaIndex, upto: segRef }) });
      const d = await res.json();
      setSofar((s) => ({ ...s, [segRef]: d.error ? { error: d.error } : d }));
    } catch {
      setSofar((s) => ({ ...s, [segRef]: { error: 'Could not reach Super Daf.' } }));
    }
  };

  const openPanel = (sugya: number, seg: number | null, tab: PanelTab) => {
    setPanel({ sugya, seg, tab });
    if (tab === 'sofar' && seg !== null && daf) requestSofar(sugya, daf.segments[seg].ref);
  };

  const ask = async () => {
    if (!daf || !panel || !chatInput.trim() || chatBusy) return;
    const q = chatInput.trim();
    const sIdx = panel.sugya;
    const history = chats[sIdx] || [];
    setChats((c) => ({ ...c, [sIdx]: [...history, { role: 'user', content: q }] }));
    setChatInput('');
    setChatBusy(true);
    try {
      const res = await fetch(`${DAF_API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: daf.ref, sugya: sIdx, question: q, history }) });
      const d = await res.json();
      setChats((c) => ({ ...c, [sIdx]: [...(c[sIdx] || []), { role: 'assistant', content: d.error ? `Sorry - ${d.error}` : d.answer }] }));
    } catch {
      setChats((c) => ({ ...c, [sIdx]: [...(c[sIdx] || []), { role: 'assistant', content: 'Sorry - could not reach Super Daf.' }] }));
    } finally {
      setChatBusy(false);
    }
  };

  // --- theme tokens for the reading surface
  const t = surface === 'paper'
    ? { page: 'bg-[#f5efe3] text-stone-900', card: 'bg-[#fbf7ee] border-[#e6dcc6]', soft: 'bg-[#efe6d3]', muted: 'text-stone-500', faint: 'text-stone-400', rule: 'border-[#e6dcc6]', accent: 'text-indigo-700', chip: 'bg-white/70 border-[#e6dcc6] text-stone-700', hover: 'hover:bg-white/60' }
    : { page: 'bg-slate-950 text-slate-100', card: 'bg-slate-900 border-slate-800', soft: 'bg-slate-800/60', muted: 'text-slate-400', faint: 'text-slate-500', rule: 'border-slate-800', accent: 'text-indigo-300', chip: 'bg-slate-800 border-slate-700 text-slate-200', hover: 'hover:bg-slate-800/60' };
  const showHe = lang !== 'en';
  const showEn = lang !== 'he';
  const heStyle = { fontFamily: HE_FONT, fontSize: `${1.5 * fontScale}rem`, lineHeight: 1.85 } as const;
  const enStyle = { fontFamily: EN_FONT, fontSize: `${1.04 * fontScale}rem`, lineHeight: 1.7 } as const;
  const smallHe = { fontFamily: HE_FONT, fontSize: `${1.08 * fontScale}rem`, lineHeight: 1.75 } as const;
  const smallEn = { fontFamily: EN_FONT, fontSize: `${0.92 * fontScale}rem`, lineHeight: 1.6 } as const;

  const commentsFor = (sugya: Sugya, segRef: string, title: 'Rashi' | 'Tosafot') =>
    (sugya.built?.core || []).filter((c) => c.title === title && c.anchor === segRef);
  const notesFor = (sugya: Sugya, segRef: string): { flow?: string; notes: Note[] } | null => {
    const seg = sugya.built?.intensive?.segments?.find((s: any) => s.ref === segRef);
    return seg ? { flow: seg.flow, notes: seg.notes || [] } : null;
  };

  // ----------------------------------------------------------------------
  // Render

  const dateLabel = current?.date ? new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="sd -mx-1 sm:-mx-6 lg:-mx-12 -mt-2 sm:-mt-4">
      <style>{`
        .sd .sd-ref { color: #4f46e5; text-decoration: none; border-bottom: 1px dotted rgba(79,70,229,.5); font-size: .78em; font-weight: 600; letter-spacing: .01em; }
        .sd .sd-ref:hover { border-bottom-style: solid; }
        .sd-dark .sd-ref { color: #a5b4fc; border-bottom-color: rgba(165,180,252,.5); }
        .sd .sd-seg { scroll-margin-top: 9rem; }
        .sd .sd-seg:hover .sd-tools, .sd .sd-seg:focus-within .sd-tools { opacity: 1; }
        .sd .sd-dh { font-weight: 700; }
        @media (prefers-reduced-motion: no-preference) { .sd .sd-seg { transition: background-color .25s ease; } }
      `}</style>

      {/* ---------- top bar ---------- */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2 sm:gap-4">
          <button onClick={onExit} className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">AI Sefarim</span>
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
            <button
              disabled={!daf?.prev}
              onClick={() => daf?.prev && setRef(daf.prev)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
              aria-label="Previous daf"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 text-center flex-1">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300">Super Daf</span>
                {isCurrent && <span className="hidden sm:inline text-[10px] font-bold text-slate-500">· Daf Yomi · {dateLabel}</span>}
              </div>
              <h1 className="truncate font-black text-slate-50 leading-tight text-base sm:text-xl">
                {daf ? <><span lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{daf.heRef}</span><span className="text-slate-500 mx-2">·</span>{daf.ref}</> : ref || 'Loading…'}
              </h1>
            </div>
            <button
              disabled={!daf?.next || nextLocked}
              onClick={() => daf?.next && !nextLocked && setRef(daf.next)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
              aria-label="Next daf"
              title={nextLocked ? 'Tomorrow’s daf opens tonight' : 'Next daf'}
            >
              {nextLocked ? <Lock className="w-4 h-4" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
          {/* controls */}
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="hidden sm:flex rounded-full bg-slate-800 p-0.5 border border-slate-700">
              {(['basic', 'intensive'] as Level[]).map((l) => (
                <button key={l} onClick={() => setLevel(l)} className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${level === l ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                  {l === 'basic' ? 'Basic' : 'Intensive'}
                </button>
              ))}
            </div>
            <div className="hidden md:flex rounded-full bg-slate-800 p-0.5 border border-slate-700">
              {(['both', 'he', 'en'] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`px-2.5 py-1 rounded-full text-[11px] font-black transition-all ${lang === l ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
                  {l === 'both' ? 'עב/EN' : l === 'he' ? 'עב' : 'EN'}
                </button>
              ))}
            </div>
            <div className="hidden md:flex items-center rounded-full bg-slate-800 border border-slate-700">
              <button onClick={() => setFontScale((f) => Math.max(0.8, +(f - 0.1).toFixed(2)))} className="p-1.5 text-slate-400 hover:text-white" aria-label="Smaller text"><Minus className="w-3.5 h-3.5" /></button>
              <span className="text-[11px] font-black text-slate-300 w-7 text-center">A</span>
              <button onClick={() => setFontScale((f) => Math.min(1.6, +(f + 0.1).toFixed(2)))} className="p-1.5 text-slate-400 hover:text-white" aria-label="Larger text"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            <button onClick={() => setSurface(surface === 'paper' ? 'dark' : 'paper')} className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white" aria-label="Toggle paper / dark reading surface" title={surface === 'paper' ? 'Dark reading surface' : 'Paper reading surface'}>
              {surface === 'paper' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {/* mobile level toggle + sugya chips */}
        {daf && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="sm:hidden shrink-0 flex rounded-full bg-slate-800 p-0.5 border border-slate-700">
              {(['basic', 'intensive'] as Level[]).map((l) => (
                <button key={l} onClick={() => setLevel(l)} className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${level === l ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{l}</button>
              ))}
            </div>
            {daf.sugyot.map((s) => (
              <button
                key={s.index}
                onClick={() => sugyaRefs.current[s.index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border transition-all ${activeSugya === s.index ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-100' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
              >
                <span lang="he" style={{ fontFamily: HE_FONT }}>{KIND_LABEL[s.kind].he}</span>
                <span className="text-slate-500">{s.from.replace(daf.book + ' ', '')}</span>
                {!s.built && daf.status !== 'ready' && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
              </button>
            ))}
            {daf.status !== 'ready' && (
              <span className="shrink-0 ml-auto text-[10px] font-bold text-slate-500 tabular-nums">preparing notes {daf.done}/{daf.total}</span>
            )}
          </div>
        )}
      </div>

      {/* ---------- states ---------- */}
      {error && (
        <div className="max-w-3xl mx-auto mt-10 px-4">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-200 text-sm font-medium">{error}</div>
        </div>
      )}
      {!daf && !error && (
        <div className="max-w-3xl mx-auto mt-16 px-4 flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-sm font-medium">Opening the daf…</p>
        </div>
      )}

      {daf && (
        <>
          {/* ---------- podcasts ---------- */}
          {podcasts.length > 0 && (
            <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5">
              <div className="rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-slate-900 to-slate-900 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Headphones className="w-4 h-4 text-indigo-300" />
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-200">Listen to the daf</p>
                  <span className="text-[11px] text-slate-500 font-medium">— then learn it below with the sources open</span>
                </div>
                <div className={`grid gap-3 ${podcasts.length > 1 ? 'md:grid-cols-2' : ''}`}>
                  {podcasts.map((p) => (
                    <div key={p.id} className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3">
                      <p className="text-sm font-black text-slate-100 mb-2 truncate">{p.title}</p>
                      <AudioPlayer url={p.url} title={p.title} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------- the daf ---------- */}
          <div className={`mt-5 ${surface === 'dark' ? 'sd-dark' : ''}`}>
            <div className={`${t.page} rounded-t-[2rem] sm:rounded-t-[2.5rem] shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.6)] pb-16`}>
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
                {/* edition line */}
                <div className={`flex flex-wrap items-center justify-between gap-2 text-[11px] ${t.faint} mb-6`}>
                  <span className="inline-flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {daf.versions.en.title} · {daf.versions.en.license} · <a className="sd-ref" href={sefariaUrl(daf.ref)} target="_blank" rel="noopener noreferrer">open on Sefaria</a></span>
                  <span className="hidden sm:inline">Tap any paragraph for notes · <span className="font-bold">So far</span> summarizes the sugya up to that point</span>
                </div>

                {daf.sugyot.map((sugya) => {
                  const segs = sugya.segments.map((i) => daf.segments[i]);
                  const built = sugya.built;
                  const intensive = built?.intensive && !built.intensive._error ? built.intensive : null;
                  const rashiCount = (built?.core || []).filter((c) => c.title === 'Rashi').length;
                  const tosCount = (built?.core || []).filter((c) => c.title === 'Tosafot').length;
                  // Tzurat hadaf only where there is something to put in the margins:
                  // three columns when both Rashi and Tosafot exist for this sugya,
                  // two when only one does, a single wide column otherwise.
                  const grid = rashiCount && tosCount
                    ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_minmax(0,1fr)] lg:gap-6'
                    : rashiCount || tosCount
                      ? 'lg:grid lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] lg:gap-8'
                      : '';
                  return (
                    <section key={sugya.index} ref={(el) => { sugyaRefs.current[sugya.index] = el; }} data-sugya={sugya.index} className="mb-14 scroll-mt-32">
                      {/* sugya header */}
                      <header className={`rounded-2xl border ${t.card} px-4 sm:px-6 py-4 mb-5 shadow-sm`}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${sugya.kind === 'mishnah' ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30' : 'bg-indigo-500/10 border border-indigo-500/30 ' + t.accent}`}>
                            <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '1rem' }}>{KIND_LABEL[sugya.kind].he}</span>
                            <span className="uppercase tracking-wider">{KIND_LABEL[sugya.kind].en}</span>
                          </span>
                          <span className={`text-xs font-bold ${t.muted}`}>{sugya.from.replace(daf.book + ' ', '')} – {sugya.to.replace(daf.book + ' ', '')}</span>
                          {sugya.prelude && (
                            <button onClick={() => setOpenPrelude((o) => ({ ...o, [sugya.index]: !o[sugya.index] }))} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}>
                              <ScrollText className="w-3.5 h-3.5" /> began on {sugya.prelude.from.replace(daf.book + ' ', '')} · {openPrelude[sugya.index] ? 'hide' : 'read the beginning'}
                            </button>
                          )}
                          <span className={`ml-auto text-[11px] ${t.faint} font-semibold`}>
                            {built ? <>{rashiCount} Rashi · {tosCount} Tosafot{built.rishonim.length ? ` · ${built.rishonim.length} Rishonim` : ''}{built.acharonim.length ? ` · ${built.acharonim.length} Acharonim` : ''}{(built as any).partial && <span className="inline-flex items-center gap-1 ml-2"><Loader2 className="w-3 h-3 animate-spin" /> finishing notes</span>}</> : <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> preparing notes</span>}
                          </span>
                        </div>
                        {/* TL;DR */}
                        <div className="mt-3 flex items-start gap-3">
                          <button
                            onClick={() => setOpenTldr((o) => ({ ...o, [sugya.index]: !o[sugya.index] }))}
                            className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${openTldr[sugya.index] ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 ' + t.accent + ' hover:bg-indigo-500/20'}`}
                          >
                            <ListChecks className="w-4 h-4" /> TL;DR
                          </button>
                          {openTldr[sugya.index] && (
                            <div className="min-w-0 animate-in fade-in slide-in-from-left-1 duration-300">
                              {intensive?.tldr ? (
                                <p style={enStyle} className="font-medium">{intensive.tldr}</p>
                              ) : (
                                <p className={`text-sm ${t.muted} inline-flex items-center gap-2`}><Loader2 className="w-3.5 h-3.5 animate-spin" /> The summary is being prepared with the notes for this sugya.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </header>

                      {/* prelude from previous daf */}
                      {sugya.prelude && openPrelude[sugya.index] && (
                        <div className={`rounded-2xl border border-dashed ${t.rule} ${t.soft} px-4 sm:px-6 py-4 mb-5`}>
                          <p className={`text-[11px] font-black uppercase tracking-wider ${t.muted} mb-3`}>Earlier in this sugya · {sugya.prelude.from.replace(daf.book + ' ', '')} – {sugya.prelude.to.replace(daf.book + ' ', '')}</p>
                          {sugya.prelude.segments.map((s) => (
                            <div key={s.ref} className="mb-3">
                              {showHe && <p lang="he" dir="rtl" style={smallHe}>{s.he}</p>}
                              {showEn && <p style={smallEn} className={t.muted}>{s.en}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* intensive overview */}
                      {level === 'intensive' && intensive?.overview && (
                        <div className={`rounded-2xl border ${t.card} px-4 sm:px-6 py-4 mb-5`}>
                          <p className={`text-[11px] font-black uppercase tracking-wider ${t.accent} mb-1.5`}>The sugya at a glance</p>
                          <RefText text={intensive.overview} className="block" />
                          {intensive.themes?.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              {intensive.themes.map((th: any, i: number) => (
                                <li key={i} className="flex gap-2 text-sm"><span className={t.accent}>◆</span><span><RefText text={th.point} /> {th.refs?.map((r: string) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</span></li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* segments: tzurat hadaf on large screens */}
                      <div className="space-y-1">
                        {segs.map((s, k) => {
                          const idx = sugya.segments[k];
                          const rashi = commentsFor(sugya, s.ref, 'Rashi');
                          const tos = commentsFor(sugya, s.ref, 'Tosafot');
                          const n = notesFor(sugya, s.ref);
                          const col = (items: Comm[], label: string, show: boolean) => show && (
                            <div className="hidden lg:block">
                              {items.length > 0 && <p className={`text-[10px] font-black uppercase tracking-wider ${t.faint} mb-1`}>{label}</p>}
                              {items.map((c) => (
                                <div key={c.ref} className="mb-2.5">
                                  {showHe && <p lang="he" dir="rtl" style={{ fontFamily: HE_FONT, fontSize: `${0.98 * fontScale}rem`, lineHeight: 1.7 }}>{c.he}</p>}
                                  {showEn && c.en && <Rich text={c.en} style={{ fontFamily: EN_FONT, fontSize: `${0.84 * fontScale}rem`, lineHeight: 1.55 }} className={t.muted} />}
                                  <p className={`text-[10px] ${t.faint}`}><SourceLink r={c.ref} />{c.enSource === 'ai' && showEn && <span className="ml-1.5 italic">AI translation</span>}</p>
                                </div>
                              ))}
                            </div>
                          );
                          return (
                            <article
                              key={s.ref}
                              className={`sd-seg group rounded-2xl px-3 sm:px-4 py-3 ${t.hover} cursor-pointer ${grid} lg:items-start`}
                              onClick={() => openPanel(sugya.index, idx, level === 'intensive' ? 'notes' : 'rashi')}
                            >
                              {col(tos, 'תוספות · Tosafot', tosCount > 0 && rashiCount > 0)}
                              <div className="min-w-0">
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    {s.isMishnah && k === 0 && <p className={`text-[10px] font-black uppercase tracking-widest ${t.accent} mb-1`}>Mishnah</p>}
                                    {showHe && <p lang="he" dir="rtl" style={heStyle} className="tracking-tight">{s.he}</p>}
                                    {showEn && <p style={enStyle} className={`${showHe ? 'mt-2 ' + t.muted : ''}`}>{s.en}</p>}
                                  </div>
                                  <span className={`shrink-0 text-[10px] ${t.faint} font-bold tabular-nums mt-1.5`}>{s.amud}:{s.n}</span>
                                </div>
                                {/* intensive inline notes */}
                                {level === 'intensive' && n && (
                                  <div className={`mt-3 rounded-xl ${t.soft} px-3 py-2.5`}>
                                    {n.flow && <p className="text-sm italic"><RefText text={n.flow} /></p>}
                                    {n.notes.length > 0 && (
                                      <ul className="mt-1.5 space-y-1.5">
                                        {n.notes.map((nt, i) => (
                                          <li key={i} className="text-sm flex gap-2">
                                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black ${t.chip} border`}>{nt.source}</span>
                                            <span><RefText text={nt.point} /> <SourceLink r={nt.ref} /></span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )}
                                {/* tools */}
                                <div className="sd-tools mt-2 flex flex-wrap items-center gap-1.5 opacity-100 lg:opacity-0 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => openPanel(sugya.index, idx, 'sofar')} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}><Clock className="w-3 h-3" /> So far</button>
                                  <button onClick={() => openPanel(sugya.index, idx, 'notes')} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}><Layers className="w-3 h-3" /> Notes</button>
                                  <button onClick={() => openPanel(sugya.index, idx, 'rashi')} className={`lg:hidden inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}><span lang="he" style={{ fontFamily: HE_FONT }}>רש״י</span>{rashi.length ? ` ${rashi.length}` : ''} · <span lang="he" style={{ fontFamily: HE_FONT }}>תוס׳</span>{tos.length ? ` ${tos.length}` : ''}</button>
                                  <button onClick={() => openPanel(sugya.index, idx, 'ask')} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${t.chip} ${t.hover}`}><MessageSquareText className="w-3 h-3" /> Ask</button>
                                </div>
                              </div>
                              {rashiCount > 0 ? col(rashi, 'רש״י · Rashi', true) : col(tos, 'תוספות · Tosafot', tosCount > 0)}
                            </article>
                          );
                        })}
                      </div>

                      {/* continues on next daf */}
                      {sugya.continuesOn && (
                        <p className={`mt-3 px-3 text-xs ${t.muted} italic inline-flex items-center gap-1.5`}><ChevronRight className="w-3.5 h-3.5" /> This sugya continues on {sugya.continuesOn.replace(daf.book + ' ', '')} — tomorrow’s daf.{intensive?.continuesOn ? ` ${intensive.continuesOn}` : ''}</p>
                      )}

                      {/* sugya footer: Q&A, Rambam, Halacha */}
                      {built && (
                        <div className="mt-6 grid gap-4 lg:grid-cols-2">
                          {level === 'intensive' && intensive?.questions?.length > 0 && (
                            <div className={`lg:col-span-2 rounded-2xl border ${t.card} px-4 sm:px-6 py-4`}>
                              <p className={`text-[11px] font-black uppercase tracking-wider ${t.accent} mb-2 inline-flex items-center gap-1.5`}><Quote className="w-3.5 h-3.5" /> Questions the commentaries ask</p>
                              <div className="space-y-3">
                                {intensive.questions.map((q: any, i: number) => (
                                  <div key={i} className="text-sm">
                                    <p className="font-bold"><RefText text={q.question} /></p>
                                    <p className={`mt-0.5 ${t.muted}`}><RefText text={q.answer} /> {q.refs?.map((r: string) => <span key={r} className="ml-1"><SourceLink r={r} /></span>)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <RambamCard rambam={built.rambam} sources={built.rambamSources} t={t} />
                          <HalachaCard halacha={built.halacha} t={t} />
                        </div>
                      )}
                    </section>
                  );
                })}

                <footer className={`mt-10 pt-6 border-t ${t.rule} text-[11px] ${t.faint} leading-relaxed`}>
                  {daf.attribution}
                </footer>
              </div>
            </div>
          </div>

          {/* ---------- floating Ask ---------- */}
          {!panel && (
            <button
              onClick={() => openPanel(activeSugya, null, 'ask')}
              className="fixed bottom-5 right-4 sm:right-8 z-30 inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 text-sm font-black shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all"
            >
              <MessageSquareText className="w-4 h-4" /> Ask about this sugya
            </button>
          )}

          {/* ---------- detail panel ---------- */}
          {panel && (
            <DetailPanel
              daf={daf}
              sugya={daf.sugyot[panel.sugya]}
              seg={panel.seg !== null ? daf.segments[panel.seg] : null}
              tab={panel.tab}
              setTab={(tab) => { setPanel({ ...panel, tab }); if (tab === 'sofar' && panel.seg !== null) requestSofar(panel.sugya, daf.segments[panel.seg].ref); }}
              onClose={() => setPanel(null)}
              sofar={panel.seg !== null ? sofar[daf.segments[panel.seg].ref] : undefined}
              chat={chats[panel.sugya] || []}
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatBusy={chatBusy}
              onAsk={ask}
              level={level}
              fonts={{ he: HE_FONT, en: EN_FONT }}
              showHe={showHe}
              showEn={showEn}
            />
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Sugya footer cards

function RambamCard({ rambam, sources, t }: { rambam: any; sources: Comm[]; t: any }) {
  const [open, setOpen] = useState(true);
  if (!rambam) return null;
  return (
    <div className={`rounded-2xl border ${t.card} px-4 sm:px-6 py-4`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 text-left">
        <p className={`text-[11px] font-black uppercase tracking-wider ${t.accent} inline-flex items-center gap-1.5`}><Landmark className="w-3.5 h-3.5" /> Through the eyes of the Rambam</p>
        <span className={`text-[11px] ${t.faint}`}>{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="mt-2 text-sm space-y-3">
          {rambam._error ? <p className={t.muted}>This section could not be prepared ({rambam._error}).</p>
          : !rambam.available ? <p className={t.muted}>{rambam.note}</p>
          : (
            <>
              <RefText text={rambam.summary} className="block" />
              {rambam.rulings?.length > 0 && (
                <div className="space-y-2">
                  {rambam.rulings.map((r: any, i: number) => (
                    <div key={i} className={`rounded-xl ${t.soft} px-3 py-2`}>
                      <p className="text-[11px] font-black"><SourceLink r={r.ref} /></p>
                      <p className="mt-0.5"><RefText text={r.ruling} /></p>
                      {r.reading && <p className={`mt-1 ${t.muted} italic`}><RefText text={r.reading} /></p>}
                    </div>
                  ))}
                </div>
              )}
              {rambam.mishnah && <p><span className="font-bold">Commentary on the Mishnah: </span><RefText text={rambam.mishnah} /></p>}
              {rambam.commentators?.length > 0 && (
                <ul className="space-y-1.5">
                  {rambam.commentators.map((c: any, i: number) => (
                    <li key={i} className="flex gap-2"><span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border ${t.chip}`}>{c.source}</span><span><RefText text={c.point} /> <SourceLink r={c.ref} /></span></li>
                  ))}
                </ul>
              )}
              {rambam.notAvailable?.length > 0 && <p className={`text-xs ${t.faint}`}>Not available on Sefaria for this passage: {rambam.notAvailable.join(', ')}.</p>}
              {sources?.length > 0 && <p className={`text-[11px] ${t.faint}`}>Sources: {sources.map((s) => <span key={s.ref} className="mr-2"><SourceLink r={s.ref} /></span>)}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HalachaCard({ halacha, t }: { halacha: any; t: any }) {
  const [open, setOpen] = useState(true);
  if (!halacha) return null;
  const cell = (x: any, label: string) => (
    <div className={`rounded-xl ${t.soft} px-3 py-2 min-w-0`}>
      <p className={`text-[10px] font-black uppercase tracking-wider ${t.faint}`}>{label}</p>
      {x ? <><p className="text-sm mt-0.5"><RefText text={x.ruling} /></p><p className="mt-1"><SourceLink r={x.ref} /></p></> : <p className={`text-xs mt-0.5 ${t.faint} italic`}>not linked here</p>}
    </div>
  );
  return (
    <div className={`rounded-2xl border ${t.card} px-4 sm:px-6 py-4`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 text-left">
        <p className={`text-[11px] font-black uppercase tracking-wider ${t.accent} inline-flex items-center gap-1.5`}><Scale className="w-3.5 h-3.5" /> Halacha in practice</p>
        <span className={`text-[11px] ${t.faint}`}>{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {halacha._error ? <p className={`text-sm ${t.muted}`}>This section could not be prepared ({halacha._error}).</p>
          : !halacha.available ? <p className={`text-sm ${t.muted}`}>{halacha.note}</p>
          : (
            <>
              {halacha.items?.map((it: any, i: number) => (
                <div key={i}>
                  <p className="text-sm font-bold mb-1.5"><RefText text={it.issue} /></p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {cell(it.rambam, 'Rambam')}
                    {cell(it.shulchanArukh, 'Shulchan Arukh')}
                    {cell(it.rema, 'Rema')}
                  </div>
                  {it.note && <p className={`mt-1.5 text-xs ${t.muted} italic`}><RefText text={it.note} /></p>}
                </div>
              ))}
              {halacha.caveat && <p className={`text-[11px] ${t.faint}`}>{halacha.caveat}</p>}
              <p className={`text-[11px] ${t.faint}`}>For practice, confirm with your rav.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Detail panel: drawer on wide screens, bottom sheet on phones

function DetailPanel({
  daf, sugya, seg, tab, setTab, onClose, sofar, chat, chatInput, setChatInput, chatBusy, onAsk, level, fonts, showHe, showEn,
}: {
  daf: Daf; sugya: Sugya; seg: Seg | null; tab: PanelTab; setTab: (t: PanelTab) => void; onClose: () => void;
  sofar?: TldrSoFar | 'loading' | { error: string }; chat: ChatMsg[]; chatInput: string; setChatInput: (s: string) => void; chatBusy: boolean; onAsk: () => void;
  level: Level; fonts: { he: string; en: string }; showHe: boolean; showEn: boolean;
}) {
  const built = sugya.built;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.length, chatBusy]);
  const core = (built?.core || []).filter((c) => !seg || c.anchor === seg.ref);
  const more = [...(built?.rishonim || []), ...(built?.acharonim || []), ...(built?.other || [])].filter((c) => !seg || c.anchor === seg.ref);
  const notes = seg ? built?.intensive?.segments?.find((s: any) => s.ref === seg.ref) : null;
  const tabs: { id: PanelTab; label: string; icon: any; disabled?: boolean }[] = [
    { id: 'notes', label: 'Notes', icon: Layers, disabled: !seg },
    { id: 'rashi', label: 'Rashi · Tosafot', icon: BookOpen },
    { id: 'more', label: 'More', icon: ScrollText },
    { id: 'sofar', label: 'So far', icon: Clock, disabled: !seg },
    { id: 'ask', label: 'Ask', icon: MessageSquareText },
  ];
  const Comment = ({ c }: { c: Comm }) => (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">{c.title} <span className="text-slate-500 normal-case tracking-normal font-semibold">· {c.anchor.replace(daf.book + ' ', '')}</span></p>
      {showHe && <p lang="he" dir="rtl" style={{ fontFamily: fonts.he, fontSize: '1.05rem', lineHeight: 1.75 }} className="text-slate-100">{c.he}</p>}
      {showEn && c.en && <Rich text={c.en} style={{ fontFamily: fonts.en, fontSize: '.92rem', lineHeight: 1.6 }} className="text-slate-300 mt-1.5" />}
      {showEn && !c.en && <p className="text-xs text-slate-500 italic mt-1">No translation available yet.</p>}
      <p className="mt-1.5 text-[10px] text-slate-500"><SourceLink r={c.ref} />{c.enSource === 'ai' && <span className="ml-1.5 italic">AI translation</span>}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end lg:items-stretch lg:justify-end">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full lg:w-[460px] xl:w-[520px] max-h-[88vh] lg:max-h-none lg:h-full bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 rounded-t-[1.75rem] lg:rounded-none shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 lg:slide-in-from-right-6 duration-300">
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">{KIND_LABEL[sugya.kind].en} · {sugya.from.replace(daf.book + ' ', '')}–{sugya.to.replace(daf.book + ' ', '')}</p>
              {seg ? (
                <p className="text-sm text-slate-200 mt-1 line-clamp-2" style={{ fontFamily: fonts.en }}>{seg.en}</p>
              ) : (
                <p className="text-sm text-slate-300 mt-1">The whole sugya</p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map(({ id, label, icon: Icon, disabled }) => (
              <button key={id} disabled={disabled} onClick={() => setTab(id)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all disabled:opacity-30 ${tab === id ? 'bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-400/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 text-slate-200">
          {!built && tab !== 'sofar' && tab !== 'ask' && (
            <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> The notes for this sugya are still being prepared — the Gemara is readable meanwhile.</p>
          )}

          {tab === 'notes' && built && (
            notes ? (
              <>
                {notes.flow && <p className="text-sm italic text-slate-300"><RefText text={notes.flow} /></p>}
                {notes.notes?.length ? notes.notes.map((nt: Note, i: number) => (
                  <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5 text-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">{nt.source}</p>
                    <RefText text={nt.point} />
                    <p className="mt-1.5"><SourceLink r={nt.ref} /></p>
                  </div>
                )) : <p className="text-sm text-slate-500">No commentary on Sefaria is anchored to this paragraph.</p>}
                {level === 'basic' && <p className="text-[11px] text-slate-500">Switch to <span className="font-bold text-slate-300">Intensive</span> to see these notes inline on the daf.</p>}
              </>
            ) : <p className="text-sm text-slate-500">No notes for this paragraph.</p>
          )}

          {tab === 'rashi' && built && (core.length ? core.map((c) => <Comment key={c.ref} c={c} />) : <p className="text-sm text-slate-500">No Rashi or Tosafot on Sefaria {seg ? 'for this paragraph' : 'for this sugya'}.</p>)}

          {tab === 'more' && built && (more.length ? more.map((c) => <Comment key={c.ref} c={c} />) : <p className="text-sm text-slate-500">No further commentaries are linked on Sefaria {seg ? 'for this paragraph' : 'for this sugya'}.</p>)}

          {tab === 'sofar' && (
            !sofar || sofar === 'loading' ? (
              <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Summarizing the sugya up to this paragraph…</p>
            ) : 'error' in sofar ? (
              <p className="text-sm text-rose-300">{sofar.error}</p>
            ) : (
              <>
                <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/25 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">The story so far</p>
                  <p className="text-sm leading-relaxed" style={{ fontFamily: fonts.en }}>{sofar.sofar}</p>
                </div>
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Right now</p>
                  <p className="text-sm leading-relaxed" style={{ fontFamily: fonts.en }}>{sofar.nowWeAre}</p>
                </div>
                {sofar.keepInMind?.length > 0 && (
                  <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Keep in mind</p>
                    <ul className="space-y-1">{sofar.keepInMind.map((k, i) => <li key={i} className="text-sm flex gap-2"><span className="text-indigo-300">◆</span><span>{k}</span></li>)}</ul>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Summarizes only up to {seg?.ref.replace(daf.book + ' ', '')} — nothing after it is revealed.</p>
              </>
            )
          )}

          {tab === 'ask' && (
            <>
              {chat.length === 0 && (
                <p className="text-sm text-slate-400">Ask anything about this sugya — a term, a step you lost, why Rashi says what he says. Answers draw only on the texts on this page and cite them.</p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white ml-8' : 'bg-slate-800/70 border border-slate-700/60 mr-4'}`}>
                  {m.role === 'user' ? m.content : <RefText text={m.content} />}
                </div>
              ))}
              {chatBusy && <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Reading the sources…</p>}
              <div ref={endRef} />
            </>
          )}
        </div>

        {tab === 'ask' && (
          <form onSubmit={(e) => { e.preventDefault(); onAsk(); }} className="shrink-0 p-3 border-t border-slate-800 flex items-end gap-2 bg-slate-900">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAsk(); } }}
              rows={1}
              placeholder="Ask about this sugya…"
              className="flex-1 resize-none bg-slate-800 border border-slate-700 focus:border-indigo-500/60 rounded-2xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-32"
            />
            <button type="submit" disabled={chatBusy || !chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-full shadow-lg" aria-label="Send"><Send className="w-4 h-4" /></button>
          </form>
        )}
      </div>
    </div>
  );
}
