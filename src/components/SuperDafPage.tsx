import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Headphones, X, ExternalLink, Clock, Loader2, Scale, Landmark, Send, MessageSquareText,
  Minus, Plus, Lock, Bookmark, BookmarkCheck, Maximize2, Minimize2, Type, Sun, Moon, Map as MapIcon, ListTree, Check, Library,
  Quote, Sparkles, NotebookPen, Share2, GripHorizontal, ChevronUp, ChevronDown, Download, ScrollText,
} from 'lucide-react';
import type { Video as MediaItem } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { DAF_API, pingDafOpen, gistText, dafPath, sefariaUrl, titleMatchesDaf, dafRefForMedia } from '../lib/daf';
import { useReadyDafs } from '../lib/useReadyDafs';
import { downloadDaf } from '../lib/dafExport';
import { recordDeviceDafRead } from '../lib/deviceTracker';
import { ReaderTour, TOUR_KEY } from './ReaderTour';

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
interface Ruling { ref: string; short?: string; ruling: string; analysis?: string }
interface HalachaItem { issue: string; refs?: string[]; rambam?: Ruling | null; shulchanArukh?: Ruling | null; rema?: Ruling | null; note?: string }
interface Halacha { available?: boolean; note?: string; items?: HalachaItem[]; caveat?: string; _error?: string }
interface MUnit { he: string; en?: string; literal?: string; elucidation?: string; notes?: number[] }
interface MNote { n: number; source: string; point: string; ref: string }
interface MesivtaSeg { ref: string; units: MUnit[]; notes: MNote[] }
interface Mesivta { segments?: MesivtaSeg[]; _error?: string }
interface PasukNote { ref: string; anchor: string; use?: string; talmudCount?: number | null; commentators?: { source: string; ref: string; point: string }[] }
interface SodNote { source: string; ref: string; anchor?: string; point: string }
interface SodText { ref: string; title: string; heTitle?: string; he: string; en: string; anchor: string; viaMishnah?: string | null }
interface Extras { pasuk?: PasukNote[]; sod?: SodNote[]; sodTexts?: SodText[] }
interface Built { partial?: boolean; core: Comm[]; rishonim: Comm[]; acharonim: Comm[]; other: Comm[]; rambamSources: Comm[]; halachaSources: Comm[]; synthesis: Synthesis | null; halacha: Halacha | null; mesivta: Mesivta | null; pasukSources?: Comm[]; mishnahSources?: Comm[]; sodSources?: Comm[]; extras?: Extras | null }
interface Sugya {
  index: number; kind: 'mishnah' | 'gemara' | 'topic' | 'continued'; heading: string; from: string; to: string; segments: number[];
  prelude?: { from: string; to: string; segments: Seg[] }; continuation?: { from: string; to: string; segments: Seg[] }; continuesOn?: string;
  built: Built | null;
}
interface Daf {
  ref: string; heRef: string; book: string; daf: string; title: string; heTitle: string; next: string | null; prev: string | null;
  mishnayot?: { ref: string; he: string; en: string; startsAt: string; endsAt?: string; fromDaf: string | null; lines?: { he: string; enHtml: string }[] }[];
  segments: Seg[]; sugyot: Sugya[]; status: 'ready' | 'building'; done: number; total: number; attribution: string;
  summary?: { preview?: string[]; takeaways?: string[]; sugyaLessons?: string[] } | null;
  versions: { he: { title: string; license: string }; en: { title: string; license: string } };
}
interface TldrSoFar { upto: string; sofar: string; nowWeAre: string; keepInMind: string[] }
interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface BookmarkItem { ref: string; segRef: string; heRef: string; snippet: string; at: number }

type Surface = 'paper' | 'dark';
type Lang = 'both' | 'he' | 'en';
type Tab = 'notes' | 'halacha' | 'sources' | 'big' | 'disputes' | 'ask';
type Sheet = { kind: 'library' } | { kind: 'sugyot' } | { kind: 'catchup' } | { kind: 'bookmarks' } | { kind: 'listen' } | { kind: 'settings' } | null;

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const RASHI_FONT = "'Noto Rashi Hebrew', 'Frank Ruhl Libre', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Rashi+Hebrew&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';
const SITE_URL = 'https://aisefarim.com';
const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr';

const PREFS_KEY = 'super_daf_prefs';
const BOOKMARKS_KEY = 'super_daf_bookmarks';
const LAST_KEY = 'super_daf_last';

function readJson<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function writeJson(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }

const KIND_LABEL: Record<Sugya['kind'], { he: string; en: string }> = {
  mishnah: { he: 'משנה', en: 'Mishnah' }, gemara: { he: 'גמרא', en: 'Gemara' }, topic: { he: 'סוגיא', en: 'New topic' }, continued: { he: 'המשך', en: 'Continued' },
};
const short = (ref: string, book: string) => ref.replace(book + ' ', '');
const firstSentence = (s?: string) => { const t = String(s || '').trim(); const m = t.match(/^(.+?[.!?])(\s|$)/); return m ? m[1] : t; };

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
// Davidson text with **bold** marks: bold = the Gemara's words, plain = elucidation.
function Marked({ text }: { text: string }) {
  const parts = String(text || '').replace(/<[^>]+>/g, '').split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i} className="sd-eluc">{p}</span>))}</>;
}
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


// ---- Placing Rashi / Tosafot inside the paragraph ------------------------
// Each comment opens with its dibur hamatchil ("words - comment"). Find those
// words in the Gemara (ignoring nikud, plene spelling and abbreviations) and
// return the index of the last Gemara word they cover; -1 when unsure.
const FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const heSkel = (w: string) => w.replace(/[֑-ׇ]/g, '').replace(/[^א-ת"״']/g, '').replace(/[ךםןףץ]/g, (c) => FINALS[c]).replace(/[וי]/g, '');
const isAbbr = (w: string) => /["״']/.test(w);
function diburWords(he: string): string[] | null {
  const txt = he.replace(/<[^>]+>/g, '');
  const i = txt.search(/\s[-–—]\s/);
  if (i < 1) return null;
  return txt.slice(0, i).split(/\s+/).filter(Boolean).slice(0, 6);
}
function locateDibur(segWords: string[], dh: string[], from: number): number {
  const S = segWords.map(heSkel);
  const D = dh.map((w) => ({ abbr: isAbbr(w), k: heSkel(w).replace(/["״']/g, '') }));
  const eq = (a: string, b: string) => !!a && !!b && (a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))));
  let best = { score: 0, end: -1, start: -1 };
  for (let i = 0; i < S.length; i++) {
    if (D[0].abbr ? false : !eq(S[i], D[0].k)) continue;
    let p = i, j = 0, score = 0, skips = 0, end = i;
    while (j < D.length && p < S.length) {
      if (D[j].abbr) { score += 0.5; end = p; j++; p++; continue; }
      if (eq(S[p], D[j].k)) { score += 1; end = p; j++; p++; continue; }
      if (skips++ >= 1) break;
      if (p + 1 < S.length && eq(S[p + 1], D[j].k)) p++; else j++;
    }
    const firstUnique = D[0].k.length >= 4 && S.filter((x) => eq(x, D[0].k)).length === 1;
    const onlyOnce = S.filter((x) => x === D[0].k).length === 1;
    const ok = score >= 2 || (D.length === 1 && score >= 1 && (D[0].k.length >= 3 || onlyOnce)) || (score >= 1 && (firstUnique || (D[0].k.length >= 2 && onlyOnce)));
    if (!ok) continue;
    // prefer the reading order (comments run in sequence), then the stronger match
    const better = best.end < 0 || (i >= from && best.start < from) || ((i >= from) === (best.start >= from) && score > best.score);
    if (better) best = { score, end, start: i };
  }
  return best.end;
}
// Group the comments by the chunk (interlinear phrase or Hebrew clause) they belong after.
function placeComments(chunks: string[], comms: Comm[]): { at: Record<number, Comm[]>; rest: Comm[] } {
  const words: string[] = []; const chunkOf: number[] = [];
  chunks.forEach((c, k) => c.split(/\s+/).filter(Boolean).forEach((w) => { words.push(w); chunkOf.push(k); }));
  const at: Record<number, Comm[]> = {}; const rest: Comm[] = [];
  let from = 0;
  for (const c of comms) {
    const dh = diburWords(c.he);
    const end = dh && words.length ? locateDibur(words, dh, from) : -1;
    if (end < 0) { rest.push(c); continue; }
    from = end;
    (at[chunkOf[end]] ||= []).push(c);
  }
  return { at, rest };
}
const heClauses = (he: string) => he.split(/(?<=[:.?!;—])\s+/).filter(Boolean);

export function SuperDafPage({ initialRef, pinnedPodcastId, media, onExit }: { initialRef?: string | null; pinnedPodcastId?: string | null; media: MediaItem[]; onExit: () => void }) {
  const prefs = useMemo(() => readJson<any>(PREFS_KEY, {}), []);
  const [surface, setSurface] = useState<Surface>(prefs.surface || 'paper');
  const [lang, setLang] = useState<Lang>(prefs.lang || 'both');
  const [fontScale, setFontScale] = useState<number>(prefs.fontScale || 1);
  const [mapOpen, setMapOpen] = useState<boolean>(prefs.mapOpen === true);
  // 'full' = full Hebrew paragraph + phrase-by-phrase; 'phrases' = phrase-by-phrase only (about twice as much on screen)
  const [gemaraLayout, setGemaraLayout] = useState<'full' | 'phrases'>(prefs.gemaraLayout === 'phrases' ? 'phrases' : 'full');
  const [mapPeek, setMapPeek] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const scrollIdle = useRef<number | null>(null);
  const [splitTall, setSplitTall] = useState<number>(typeof prefs.split === 'number' ? prefs.split : 0.62);
  const [splitWide, setSplitWide] = useState<number>(typeof prefs.splitWide === 'number' ? prefs.splitWide : 0.6);
  const [lowerCollapsed, setLowerCollapsed] = useState<boolean>(prefs.lowerCollapsed === true);
  const [current, setCurrent] = useState<{ ref: string; date: string } | null>(null);
  const [ref, setRef] = useState<string | null>(initialRef || null);
  const [tour, setTour] = useState(() => { try { return new URLSearchParams(window.location.search).has('tour'); } catch { return false; } });
  const [daf, setDaf] = useState<Daf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const [sugyaScope, setSugyaScope] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('notes');
  const [noteN, setNoteN] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sofar, setSofar] = useState<Record<string, TldrSoFar | 'loading' | { error: string }>>({});
  const [chats, setChats] = useState<Record<number, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => readJson<BookmarkItem[]>(BOOKMARKS_KEY, []));
  const [resume, setResume] = useState<{ segRef: string } | null>(null);
  const [isFull, setIsFull] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const pinnedRef = useRef<number | null>(null);
  const dragging = useRef(false);
  // Side by side on computers, and on a tablet held sideways (iPad landscape);
  // notes below on phones and on a tablet held upright. Rotating switches live.
  const wideQuery = '(min-width: 1000px)';
  const [wide, setWide] = useState<boolean>(() => typeof window !== 'undefined' && window.matchMedia(wideQuery).matches);
  useEffect(() => {
    const mq = window.matchMedia(wideQuery);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const split = wide ? splitWide : splitTall;
  // Tall side-by-side screens (13-inch iPad upright, big monitors): the notes
  // column splits - the main tabs on top, a second panel (Halacha by default) below.
  const tallQuery = '(min-width: 1000px) and (min-height: 1100px)';
  const [tallNotes, setTallNotes] = useState<boolean>(() => typeof window !== 'undefined' && window.matchMedia(tallQuery).matches);
  useEffect(() => {
    const mq = window.matchMedia(tallQuery);
    const on = () => setTallNotes(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [tab2, setTab2] = useState<Tab>('halacha');
  // how much of the notes column the top panel gets (draggable; remembered)
  const [notesSplit, setNotesSplit] = useState<number>(typeof prefs.notesSplit === 'number' ? prefs.notesSplit : 0.7);
  const lowerRef = useRef<HTMLDivElement>(null);
  const notesDrag = useRef(false);
  const setSplit = (v: number | ((x: number) => number)) => (wide ? setSplitWide : setSplitTall)(v as any);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_HREF; document.head.appendChild(l); }
  }, []);
  useEffect(() => { writeJson(PREFS_KEY, { surface, lang, fontScale, mapOpen, split: splitTall, splitWide, lowerCollapsed, gemaraLayout, notesSplit }); }, [surface, lang, fontScale, mapOpen, splitTall, splitWide, lowerCollapsed, gemaraLayout, notesSplit]);
  useEffect(() => { writeJson(BOOKMARKS_KEY, bookmarks); }, [bookmarks]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(null), 1800); return () => window.clearTimeout(id); }, [toast]);

  // Own the viewport; on touch devices swallow any scroll gesture that would
  // reach the browser (pull-down at the top, push-up at the bottom, a move
  // outside a scrolling area).
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { bo: body.style.overflow, ho: html.style.overflow, bos: body.style.overscrollBehavior, hos: html.style.overscrollBehavior, pos: body.style.position, w: body.style.width };
    body.style.overflow = 'hidden'; html.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none'; html.style.overscrollBehavior = 'none';
    body.style.position = 'fixed'; body.style.width = '100%';
    const onFs = () => setIsFull(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    // iPad Safari decides who owns a swipe on its first move: if the inner
    // scroller is resting exactly at its top or bottom edge, the gesture is
    // handed to the page and full screen drags away with your finger. Keep
    // every scroller 1px off its edges so it always takes the gesture itself,
    // and swallow any touch that starts outside a scroller.
    const nudge = (el: HTMLElement) => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 1) return;
      if (el.scrollTop <= 0) el.scrollTop = 1;
      else if (el.scrollTop >= max) el.scrollTop = max - 1;
    };
    const onStart = (e: TouchEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('.sd-scroll') as HTMLElement | null;
      if (el) nudge(el);
    };
    const onMove = (e: TouchEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('.sd-scroll') as HTMLElement | null;
      if (!el) { if (e.cancelable) e.preventDefault(); return; }
      if (el.scrollHeight <= el.clientHeight + 1 && e.cancelable) e.preventDefault(); // nothing to scroll: don't let the page move
    };
    const onScrollAny = (e: Event) => { const el = e.target as HTMLElement; if (el?.classList?.contains('sd-scroll')) nudge(el); };
    document.addEventListener('scroll', onScrollAny, true);
    const root = rootRef.current;
    root?.addEventListener('touchstart', onStart, { passive: true });
    root?.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      body.style.overflow = prev.bo; html.style.overflow = prev.ho; body.style.overscrollBehavior = prev.bos; html.style.overscrollBehavior = prev.hos; body.style.position = prev.pos; body.style.width = prev.w;
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      root?.removeEventListener('touchstart', onStart); root?.removeEventListener('touchmove', onMove);
      document.removeEventListener('scroll', onScrollAny, true);
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
    // Sefaria gives neighbours by amud ("Bekhorot 17a"); Super Daf works by daf.
    const byDaf = (r?: string | null) => (r ? r.replace(/(\d+)[ab]$/, '$1') : r);
    d.next = byDaf(d.next); d.prev = byDaf(d.prev);
    return d as Daf;
  }, []);

  const scrollToSeg = useCallback((idx: number) => scrollRef.current?.querySelector<HTMLElement>(`[data-seg="${idx}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setError(null); setDaf(null); setSheet(null); setSofar({}); setPinned(null); setSugyaScope(null); setNoteN(null);
    window.history.replaceState({}, '', dafPath(ref) + window.location.search + window.location.hash);
    const last = readJson<{ ref: string; segRef: string } | null>(LAST_KEY, null);
    setResume(last && last.ref === ref ? { segRef: last.segRef } : null);
    let first = true;
    const tick = async () => {
      try {
        const d = await load(ref);
        if (cancelled) return;
        setDaf(d);
        if (first) {
          first = false;
          const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
          if (hash) { const i = d.segments.findIndex((s) => short(s.ref, d.book) === hash || s.ref === hash); if (i >= 0) { setResume(null); setTimeout(() => scrollToSeg(i), 200); } }
        }
        if (d.status !== 'ready') {
          let delay = 7000;
          try { const r = await fetch(`${DAF_API}/step?ref=${encodeURIComponent(ref)}`).then((x) => x.json()); if (r && !r.locked) delay = 300; } catch { /* poll */ }
          if (!cancelled) pollRef.current = window.setTimeout(tick, delay);
        }
      } catch (e: any) { if (!cancelled) setError(e.message || 'Could not load this daf.'); }
    };
    tick();
    return () => { cancelled = true; if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [ref, load, scrollToSeg]);

  useEffect(() => {
    if (!daf) return;
    const root = scrollRef.current; if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-seg]'));
    const obs = new IntersectionObserver(() => {
      // Judge every paragraph on screen, not just the ones whose visibility just
      // changed - otherwise the "current paragraph" (and Our Mishnah, and the
      // notes) can stick on an earlier one.
      const rr = root.getBoundingClientRect();
      const mid = rr.top + rr.height / 2;
      let best: HTMLElement | null = null, bestD = Infinity;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.bottom < rr.top || r.top > rr.bottom) continue;
        const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (d < bestD) { bestD = d; best = el; }
      }
      if (!best) return;
      const idx = Number(best.dataset.seg);
      setFocusIdx(idx);
      // Scrolling to another paragraph releases a tap-pin, so the notes follow you.
      if (pinnedRef.current !== null && pinnedRef.current !== idx) { pinnedRef.current = null; setPinned(null); setNoteN(null); setSugyaScope(null); }
      writeJson(LAST_KEY, { ref: daf.ref, segRef: daf.segments[idx]?.ref, at: Date.now() });
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [daf, splitTall, splitWide, lowerCollapsed]);

  // Divider drag.
  const onDragStart = (e: React.PointerEvent) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragging.current || !bodyRef.current) return;
    const r = bodyRef.current.getBoundingClientRect();
    const ratio = wide ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
    setSplit(Math.min(0.9, Math.max(wide ? 0.35 : 0.22, ratio)));
    if (lowerCollapsed) setLowerCollapsed(false);
  };
  const onDragEnd = () => { dragging.current = false; };

  // "Continue from ..." is a brief offer: it fades after a few seconds.
  useEffect(() => {
    if (!resume) return;
    const t = window.setTimeout(() => setResume(null), 6000);
    return () => window.clearTimeout(t);
  }, [resume]);
  useEffect(() => {
    if (!daf || daf.status !== 'ready') return;
    let seen = false;
    try { seen = localStorage.getItem(TOUR_KEY) === '1'; } catch { seen = true; }
    if (seen) return;
    const t = window.setTimeout(() => setTour(true), 1200);
    return () => window.clearTimeout(t);
  }, [daf?.ref, daf?.status]);
  const isCurrent = !!(daf && current && daf.ref === current.ref);
  const readyDafs = useReadyDafs();
  useEffect(() => { if (daf?.ref) pingDafOpen(daf.ref); }, [daf?.ref]);
  // Learning credit (worth three shiurim), given quietly once the daf has
  // really been learned: half of it read, or four minutes spent on it.
  useEffect(() => {
    if (!daf?.ref) return;
    const t = window.setTimeout(() => recordDeviceDafRead(daf.ref), 4 * 60 * 1000);
    return () => window.clearTimeout(t);
  }, [daf?.ref]);
  useEffect(() => {
    if (daf?.ref && daf.segments.length && focusIdx >= Math.floor(daf.segments.length / 2)) recordDeviceDafRead(daf.ref);
  }, [daf?.ref, daf?.segments.length, focusIdx]);
  const canGo = (r?: string | null) => !!r && (readyDafs.has(r) || r === current?.ref);
  const podcasts = useMemo(() => {
    if (!daf) return [] as MediaItem[];
    const pin = media.filter((m) => m.id === pinnedPodcastId);
    return [...pin, ...media.filter((m) => m.id !== pinnedPodcastId && (dafRefForMedia(m) === daf.ref || (m.type === 'audio' && titleMatchesDaf(m.title, daf.book, daf.daf))))];
  }, [media, daf, pinnedPodcastId]);
  const sugyaOf = useCallback((segIdx: number) => daf ? daf.sugyot.find((s) => s.segments.includes(segIdx)) || daf.sugyot[0] : null, [daf]);
  pinnedRef.current = pinned;
  const panelIdx = pinned ?? focusIdx;
  const panelSugya = sugyaScope !== null && daf ? daf.sugyot[sugyaScope] : sugyaOf(panelIdx);
  const focusSugya = sugyaOf(focusIdx);

  const openOn = (segIdx: number, t: Tab = 'notes', n: number | null = null) => { setPinned(segIdx); setSugyaScope(null); setTab(t); setNoteN(n); setLowerCollapsed(false); };
  const openSugya = (sIdx: number, t: Tab) => { setSugyaScope(sIdx); setPinned(null); setTab(t); setNoteN(null); setLowerCollapsed(false); };

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

  const ask = async (preset?: string) => {
    const text = (typeof preset === 'string' ? preset : chatInput).trim();
    if (!daf || !text || chatBusy || !panelSugya) return;
    const sg = panelSugya; const q = text; const history = chats[sg.index] || [];
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
  const shareSeg = async (segIdx: number) => {
    if (!daf) return;
    const s = daf.segments[segIdx];
    const url = `${SITE_URL}${dafPath(daf.ref)}#${encodeURIComponent(short(s.ref, daf.book))}`;
    const literal = s.en.length > 320 ? s.en.slice(0, 320).trim() + '…' : s.en;
    const text = `📖 *${daf.ref} · ${short(s.ref, daf.book)}*\n${s.he}\n\n${literal}\n\n🔗 Learn it on Super Daf: ${url}\n💬 Join our WhatsApp community: ${WHATSAPP_GROUP_URL}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${daf.ref} · ${short(s.ref, daf.book)}`, text, url }); return; }
    } catch { /* cancelled or unsupported - fall through */ }
    try { await navigator.clipboard.writeText(text); setToast('Copied - paste it into WhatsApp'); } catch { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank'); }
  };
  const toggleFullscreen = () => {
    const el: any = document.documentElement;
    const d: any = document;
    const inFs = d.fullscreenElement || d.webkitFullscreenElement;
    if (!inFs) { (el.requestFullscreen?.({ navigationUI: 'hide' }) || el.webkitRequestFullscreen?.())?.catch?.(() => {}); }
    else { (d.exitFullscreen?.() || d.webkitExitFullscreen?.())?.catch?.(() => {}); }
  };

  const t = surface === 'paper'
    ? { shell: 'bg-[#efe7d6]', page: 'bg-[#f7f2e7] text-stone-900', card: 'bg-white/70 border-[#e3d8c1]', soft: 'bg-[#efe6d3]', muted: 'text-stone-500', faint: 'text-stone-400', rule: 'border-[#e3d8c1]', accent: 'text-indigo-700', chip: 'bg-white/80 border-[#e3d8c1] text-stone-700', hover: 'hover:bg-white/70', sel: 'ring-2 ring-indigo-400/50' }
    : { shell: 'bg-[#0c0c0e]', page: 'bg-[#141416] text-[#e8e6e3]', card: 'bg-[#1c1c1f] border-[#2e2e33]', soft: 'bg-[#202024]', muted: 'text-[#a8a6a3]', faint: 'text-[#76757a]', rule: 'border-[#2e2e33]', accent: 'text-[#a5b4fc]', chip: 'bg-[#202024] border-[#34343a] text-[#dcdad6]', hover: 'hover:bg-[#202024]', sel: 'ring-2 ring-[#a5b4fc]/40' };
  const showHe = lang !== 'en', showEn = lang !== 'he';
  const dateLabel = current?.date ? new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const upperPct = lowerCollapsed ? 100 : Math.round(split * 100);

  return (
    <div ref={rootRef} className={`sd fixed inset-0 z-[60] flex flex-col ${t.shell} ${surface === 'dark' ? 'sd-dark' : ''}`} style={{ overscrollBehavior: 'none', height: '100dvh' }}>
      {tour && <ReaderTour onClose={() => setTour(false)} />}
      <style>{`
        .sd .sd-ref { color: #4f46e5; text-decoration: none; border-bottom: 1px dotted rgba(79,70,229,.5); font-size: .78em; font-weight: 600; }
        .sd .sd-ref:hover { border-bottom-style: solid; }
        .sd-dark .sd-ref { color: #a5b4fc; border-bottom-color: rgba(165,180,252,.5); }
        .sd .sd-eluc { opacity: .68; font-weight: 400; }
        .sd { touch-action: none; }
        .sd .sd-scroll { scrollbar-width: thin; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
        .sd button, .sd a, .sd textarea { touch-action: manipulation; }
        .sd .sd-para { scroll-margin-top: .5rem; }
        .sd .sd-rashi { font-family: ${RASHI_FONT}; }
        .sd .sd-note { display:inline-flex; align-items:center; justify-content:center; min-width:1.15rem; height:1.15rem; padding:0 .3rem; margin:0 .1rem; border-radius:.4rem; font-size:.62rem; font-weight:800; vertical-align:super; line-height:1; background:rgba(99,102,241,.14); color:#4f46e5; cursor:pointer; }
        .sd-dark .sd-note { background:rgba(129,140,248,.2); color:#c7d2fe; }
        .sd .sd-note:hover, .sd .sd-note.on { background:#4f46e5; color:#fff; }
        .sd .sd-unit:nth-child(even) { background: rgba(0,0,0,.025); }
        .sd-dark .sd-unit:nth-child(even) { background: rgba(255,255,255,.03); }
        .sd .sd-divider { touch-action: none; cursor: row-resize; }
        .sd .sd-divider.cursor-col-resize { cursor: col-resize; }
        /* Lower half on paper: a deeper shade of the same paper, not a dark slab. */
        .sd-lowp { background:#ece4d3; color:#292524; }
        .sd-lowd { background:#111113; color:#e8e6e3; }
        .sd-lowd .text-slate-100, .sd-lowd .text-slate-200 { color:#e8e6e3; }
        .sd-lowd .text-slate-300 { color:#c9c7c3; }
        .sd-lowd .text-slate-400 { color:#9a9894; }
        .sd-lowd .text-slate-500 { color:#727176; }
        .sd-lowd .text-indigo-300, .sd-lowd .text-indigo-200 { color:#a5b4fc; }
        .sd-lowd .bg-slate-800, .sd-lowd .bg-slate-900, .sd-lowd .bg-slate-800\\/60, .sd-lowd .bg-slate-800\\/50, .sd-lowd .bg-slate-800\\/70 { background:#1b1b1e; }
        .sd-lowd .hover\\:bg-slate-800:hover, .sd-lowd .hover\\:bg-slate-700:hover { background:#232327; }
        .sd-lowd .border-slate-700, .sd-lowd .border-slate-700\\/60, .sd-lowd .border-slate-800 { border-color:#2e2e33; }
        .sd-lowd .bg-indigo-600 { background:#5b5fd6; color:#fff; }
        .sd-lowd .bg-indigo-500\\/10 { background:rgba(165,180,252,.08); }
        .sd-lowd .border-indigo-400\\/60 { border-color:rgba(165,180,252,.45); }
        .sd-lowd .text-amber-700, .sd-lowd .text-amber-800 { color:#fcd9a0; }
        .sd-lowd .text-amber-300 { color:#fcd9a0; }
        .sd-lowd textarea { background:#1b1b1e; color:#e8e6e3; }
        .sd-dark .sd-ref { color:#a5b4fc; border-bottom-color:rgba(165,180,252,.4); }
        .sd-dark .sd-note { background:rgba(165,180,252,.16); color:#c7d2fe; }
        .sd-dark .sd-note:hover, .sd-dark .sd-note.on { background:#5b5fd6; color:#fff; }
        .sd-dark .text-amber-700, .sd-dark .text-amber-800, .sd-dark .text-amber-900 { color:#f5cf8e; }
        .sd-dark .text-amber-500, .sd-dark .text-amber-300 { color:#f5cf8e; }
        .sd-dark .bg-amber-500\\/10, .sd-dark .bg-amber-500\\/5 { background:rgba(245,207,142,.07); }
        .sd-dark .bg-amber-500\\/15 { background:rgba(245,207,142,.12); }
        .sd-dark .border-amber-500, .sd-dark .border-amber-500\\/50, .sd-dark .border-amber-500\\/40, .sd-dark .border-amber-500\\/30 { border-color:rgba(245,207,142,.35); }
        .sd-dark .text-emerald-700, .sd-dark .text-emerald-800 { color:#8fe3bf; }
        .sd-dark .bg-emerald-500\\/10 { background:rgba(143,227,191,.07); }
        .sd-dark .border-emerald-600\\/25 { border-color:rgba(143,227,191,.3); }
        .sd-dark .text-stone-900, .sd-dark .text-stone-700 { color:#e8e6e3; }
        .sd-dark .text-stone-500 { color:#a8a6a3; }
        .sd-dark .text-stone-400 { color:#76757a; }
        .sd-dark .text-indigo-700 { color:#a5b4fc; }
        .sd-dark .bg-indigo-600 { background:#5b5fd6; }
        .sd-dark .bg-slate-900 { background:#1b1b1e; }
        .sd-lowp .text-slate-100, .sd-lowp .text-slate-200 { color:#292524; }
        .sd-lowp .text-slate-300 { color:#44403c; }
        .sd-lowp .text-slate-400 { color:#78716c; }
        .sd-lowp .text-slate-500 { color:#a8a29e; }
        .sd-lowp .text-indigo-300, .sd-lowp .text-indigo-200 { color:#4338ca; }
        .sd-lowp .text-amber-300 { color:#b45309; }
        .sd-lowp .bg-slate-800, .sd-lowp .bg-slate-900, .sd-lowp .bg-slate-800\\/60, .sd-lowp .bg-slate-800\\/50, .sd-lowp .bg-slate-800\\/70 { background:#f7f2e7; }
        .sd-lowp .hover\\:bg-slate-800:hover, .sd-lowp .hover\\:bg-slate-700:hover { background:#fffaf0; }
        .sd-lowp .border-slate-700, .sd-lowp .border-slate-700\\/60, .sd-lowp .border-slate-800 { border-color:#ddd1b8; }
        .sd-lowp .bg-indigo-500\\/10 { background:rgba(99,102,241,.08); }
        .sd-lowp .bg-indigo-600 { background:#4f46e5; color:#fff; }
        .sd-lowp textarea { background:#fffaf0; color:#292524; }
        .sd-resume { animation: sd-resume-fade .6s ease 5.4s forwards; }
        .sd-mish-glow { animation: sd-mish-halo 3.2s ease-in-out infinite; }
        @keyframes sd-mish-halo { 0%,100% { box-shadow: 0 0 0 0 rgba(129,140,248,.45); } 50% { box-shadow: 0 0 0 6px rgba(129,140,248,0); } }
        @media (prefers-reduced-motion: reduce) { .sd-mish-glow { animation: none; } }
        @keyframes sd-resume-fade { to { opacity: 0; transform: translateY(-6px); pointer-events: none; } }
        .sd-x { border-width:1px; border-radius:1rem; }
        .sd-lowp .sd-x { background:#f7f2e7; border-color:#ddd1b8; } .sd-lowd .sd-x { background:#1b1b1e; border-color:#2e2e33; }
        .sd-lowp .sd-k-pasuk { color:#0f766e; } .sd-lowd .sd-k-pasuk { color:#5eead4; }
        .sd-lowp .sd-k-mishnah { color:#b45309; } .sd-lowd .sd-k-mishnah { color:#f5cf8e; }
        .sd-lowp .sd-k-sod { color:#6d28d9; } .sd-lowd .sd-k-sod { color:#c4b5fd; }
        .sd-lowp .sd-x-pasuk { border-left:4px solid #14b8a6; } .sd-lowd .sd-x-pasuk { border-left:4px solid #2dd4bf; }
        .sd-lowp .sd-x-mishnah { border-left:4px solid #f59e0b; } .sd-lowd .sd-x-mishnah { border-left:4px solid #f5cf8e; }
        .sd-lowp .sd-x-sod { border-left:4px solid #8b5cf6; } .sd-lowd .sd-x-sod { border-left:4px solid #a78bfa; }
        .sd-lowp .sd-quoted { background:#fde68a; border-radius:3px; } .sd-lowd .sd-quoted { background:rgba(245,207,142,.28); border-radius:3px; }
        .sd-chip-x { font-size:10px; font-weight:900; border-radius:9999px; padding:1px 7px; border-width:1px; }
        .sd-chip-pasuk { color:#0f766e; border-color:rgba(20,184,166,.45); } .sd-dark .sd-chip-pasuk { color:#5eead4; }
        .sd-chip-mishnah { color:#b45309; border-color:rgba(245,158,11,.45); } .sd-dark .sd-chip-mishnah { color:#f5cf8e; }
        .sd-chip-sod { color:#6d28d9; border-color:rgba(139,92,246,.45); } .sd-dark .sd-chip-sod { color:#c4b5fd; }
      `}</style>

      {/* ============ top bar ============ */}
      <header className="shrink-0 h-12 sm:h-14 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 bg-slate-950 text-slate-100 border-b border-slate-800">
        <button onClick={onExit} className="p-2 rounded-full hover:bg-slate-800 text-slate-300" aria-label="Back to AI Sefarim"><ArrowLeft className="w-5 h-5" /></button>
        <button onClick={() => setMapOpen((m) => !m)} className={`hidden md:inline-flex p-2 rounded-full border ${mapOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`} aria-label="Pin the daf map" title={mapOpen ? 'Unpin the daf map (it will show only while you scroll)' : 'Pin the daf map open'}><MapIcon className="w-4 h-4" /></button>
        <button disabled={!canGo(daf?.prev)} onClick={() => daf?.prev && canGo(daf.prev) && setRef(daf.prev)} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label="Previous daf"><ChevronLeft className="w-5 h-5" /></button>
        <button onClick={() => setSheet(sheet?.kind === 'library' ? null : { kind: 'library' })} className="min-w-0 flex-1 text-center leading-tight rounded-xl hover:bg-slate-900 py-0.5" title="Browse all dapim">
          <div className="truncate font-black text-[15px] sm:text-lg">{daf ? <><span lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{daf.heRef}</span><span className="text-slate-600 mx-2">·</span>{daf.ref}</> : ref || 'Super Daf'}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate">
            {isCurrent && dateLabel ? `Daf Yomi · ${dateLabel}` : 'Super Daf'}
            {daf && <> · {daf.segments[focusIdx]?.amud}{focusSugya ? ` · ${KIND_LABEL[focusSugya.kind].en} ${focusSugya.index + 1}/${daf.sugyot.length}` : ''}</>}
            {daf && daf.status !== 'ready' && <span className="ml-2 inline-flex items-center gap-1 text-indigo-300"><Loader2 className="w-3 h-3 animate-spin" /> preparing {daf.done}/{daf.total}</span>}
          </div>
        </button>
        <button disabled={!canGo(daf?.next)} onClick={() => daf?.next && canGo(daf.next) && setRef(daf.next)} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label="Next daf" title={canGo(daf?.next) ? `Next daf · ${daf?.next}` : 'The next daf opens at noon the day before'}>{canGo(daf?.next) ? <ChevronRight className="w-5 h-5" /> : <Lock className="w-4 h-4" />}</button>
        <button onClick={() => setSheet(sheet?.kind === 'library' ? null : { kind: 'library' })} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1.5 text-xs font-black ${sheet?.kind === 'library' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'}`} aria-label="All dapim" title="Browse all dapim"><Library className="w-4 h-4" /><span className="hidden sm:inline">All dapim</span></button>
        <button disabled={!daf || daf.status !== 'ready'} onClick={() => daf && downloadDaf(daf)} className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-30" aria-label="Download this daf for offline reading" title={daf?.status === 'ready' ? 'Download this daf (works offline, prints to PDF)' : 'Available once the daf is fully prepared'}><Download className="w-4 h-4" /></button>
        <button onClick={() => setSheet(sheet?.kind === 'settings' ? null : { kind: 'settings' })} className={`p-2 rounded-full border ${sheet?.kind === 'settings' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'}`} aria-label="Reading settings" title="Reading settings"><Type className="w-4 h-4" /></button>
        <button onClick={toggleFullscreen} className="hidden sm:inline-flex p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:text-white" aria-label="Full screen" title={isFull ? 'Exit full screen' : 'Full screen'}>{isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
      </header>

      {/* ============ body: upper (the daf) / divider / lower (the notes) ============ */}
      <div ref={bodyRef} className={`flex-1 min-h-0 flex relative ${wide ? 'flex-row' : 'flex-col'}`}>
        <div className="relative flex min-h-0 min-w-0" style={wide ? { width: `${upperPct}%` } : { height: `${upperPct}%` }}>
          {daf && (mapOpen || mapPeek || scrolling) && (
            <div className={`${mapOpen ? 'relative' : `absolute inset-y-0 left-0 z-30 shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200 transition-opacity ${mapPeek ? 'opacity-100' : 'opacity-50'}`} hidden md:block`} onMouseEnter={() => setMapPeek(true)} onMouseLeave={() => setMapPeek(false)}>
              <Minimap daf={daf} focusIdx={focusIdx} onJump={scrollToSeg} bookmarks={bookmarks} surface={surface} />
            </div>
          )}
          {daf && !mapOpen && <div className="hidden md:block absolute inset-y-0 left-0 w-3 z-20" onMouseEnter={() => setMapPeek(true)} title="The daf map" />}
          {daf && (daf.mishnayot || []).length > 0 && <MishnahPeek daf={daf} focusIdx={focusIdx} onGo={scrollToSeg} surface={surface} />}
          <div ref={scrollRef} className="sd-scroll flex-1 min-w-0 overflow-y-auto" onScroll={() => {
            // The daf map shows itself while you scroll and slips away when you stop.
            if (!scrolling) setScrolling(true);
            if (scrollIdle.current) window.clearTimeout(scrollIdle.current);
            scrollIdle.current = window.setTimeout(() => setScrolling(false), 450);
          }}>
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
              <div className="sd-resume sticky top-2 z-20 mx-auto w-fit max-w-[92%]">
                <button onClick={() => { const i = daf.segments.findIndex((s) => s.ref === resume.segRef); if (i >= 0) scrollToSeg(i); setResume(null); }} className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-slate-100 border border-slate-700 shadow-xl px-4 py-2 text-xs font-bold">
                  <Bookmark className="w-3.5 h-3.5 text-indigo-300" /> Continue from {short(resume.segRef, daf.book)}
                  <span onClick={(e) => { e.stopPropagation(); setResume(null); }} className="ml-1 text-slate-500 hover:text-slate-200"><X className="w-3.5 h-3.5" /></span>
                </button>
              </div>
            )}
            {daf && (
              <Reader daf={daf} t={t} showHe={showHe} showEn={showEn} fontScale={fontScale} panelIdx={pinned} noteN={noteN} gemaraLayout={gemaraLayout}
                isBookmarked={isBookmarked} toggleBookmark={toggleBookmark} onShare={shareSeg} openOn={openOn} openSugya={openSugya}
                canGo={canGo} onGo={(r) => { setRef(r); scrollRef.current?.scrollTo({ top: 0 }); }} />
            )}
            {daf && <footer className={`px-6 py-6 text-[11px] ${t.faint} leading-relaxed max-w-[62rem] mx-auto`}>{daf.attribution} · <a className="sd-ref" href={sefariaUrl(daf.ref)} target="_blank" rel="noopener noreferrer">open on Sefaria</a></footer>}
          </div>
        </div>

        {daf && (
          <div
            className={`sd-divider shrink-0 flex items-center justify-between select-none ${wide ? 'w-3 flex-col border-x py-3 px-0 cursor-col-resize' : 'h-7 border-y px-3'} ${surface === 'paper' ? 'bg-[#e2d7c0] border-[#d3c6aa]' : 'bg-[#0c0c0e] border-[#2e2e33]'}`}
            onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} onDoubleClick={() => { setSplit(0.62); setLowerCollapsed(false); }}
          >
            {!wide && <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 inline-flex items-center gap-1.5"><NotebookPen className="w-3 h-3" /> Notes {daf.segments[panelIdx] && sugyaScope === null ? `· ${short(daf.segments[panelIdx].ref, daf.book)}` : ''}</span>}
            <GripHorizontal className={`w-5 h-5 text-slate-600 ${wide ? 'rotate-90' : ''}`} />
            <div className={`flex items-center gap-1 ${wide ? 'hidden' : ''}`}>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { setLowerCollapsed(false); setSplit((s) => Math.max(0.22, s - 0.15)); }} className="p-1 rounded text-slate-400 hover:text-white" aria-label="More notes" title="More notes"><ChevronUp className="w-4 h-4" /></button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { if (split >= 0.85) setLowerCollapsed(true); else setSplit((s) => Math.min(0.9, s + 0.15)); }} className="p-1 rounded text-slate-400 hover:text-white" aria-label="Less notes" title="Less notes"><ChevronDown className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {daf && !lowerCollapsed && panelSugya && (
          <div ref={lowerRef} className={`sd-lower flex-1 min-h-0 min-w-0 flex flex-col ${surface === 'paper' ? 'sd-lowp' : 'sd-lowd'}`}>
            <div className={`min-h-0 flex flex-col ${wide && tallNotes ? '' : 'flex-1'}`} style={wide && tallNotes ? { flex: `0 0 ${Math.round(notesSplit * 100)}%` } : undefined}>
              <Panel daf={daf} sugya={panelSugya} segIdx={sugyaScope !== null ? null : panelIdx} tab={tab} setTab={setTab} noteN={noteN}
                sugyaScoped={sugyaScope !== null} onBackToParagraph={() => setSugyaScope(null)}
                chats={chats} chatInput={chatInput} setChatInput={setChatInput} chatBusy={chatBusy} onAsk={ask}
                onCatchUp={() => setSheet({ kind: 'catchup' })} />
            </div>
            {wide && tallNotes && (
              <div role="separator" aria-orientation="horizontal" aria-label="Drag to resize the two notes panels" title="Drag to resize · double-tap to reset"
                className="shrink-0 h-3 flex items-center justify-center cursor-row-resize bg-slate-800/80 hover:bg-slate-700 touch-none"
                onPointerDown={(e) => { notesDrag.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
                onPointerMove={(e) => { if (!notesDrag.current || !lowerRef.current) return; const r = lowerRef.current.getBoundingClientRect(); setNotesSplit(Math.min(0.88, Math.max(0.25, (e.clientY - r.top) / r.height))); }}
                onPointerUp={() => { notesDrag.current = false; }} onPointerCancel={() => { notesDrag.current = false; }}
                onDoubleClick={() => setNotesSplit(0.7)}>
                <GripHorizontal className="w-5 h-3 text-slate-500" />
              </div>
            )}
            {wide && tallNotes && (
              <div className="min-h-0 flex-1 flex flex-col">
                <Panel daf={daf} sugya={panelSugya} segIdx={sugyaScope !== null ? null : panelIdx} tab={tab2} setTab={setTab2} noteN={null}
                  sugyaScoped={sugyaScope !== null} onBackToParagraph={() => setSugyaScope(null)}
                  chats={chats} chatInput={chatInput} setChatInput={setChatInput} chatBusy={chatBusy} onAsk={ask}
                  onCatchUp={() => setSheet({ kind: 'catchup' })} />
              </div>
            )}
          </div>
        )}
        {toast && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-slate-900 text-slate-100 border border-slate-700 px-4 py-2 text-xs font-bold shadow-xl">{toast}</div>}
      </div>

      {/* ============ dock ============ */}
      {daf && (
        <nav className="shrink-0 bg-slate-950 border-t border-slate-800 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
          <div className={`mx-auto grid gap-1 lg:flex lg:items-center lg:justify-center lg:gap-3 lg:max-w-3xl ${(daf.mishnayot || []).length ? 'max-w-xl grid-cols-5' : 'max-w-lg grid-cols-4'}`}>
            {([
              // "Our Mishnah" comes first and stands out - it lives here so it never covers the text
              ...((daf.mishnayot || []).length ? [{ id: 'mishnah', label: 'Our Mishnah', icon: ScrollText, amber: true }] : []),
              { id: 'catchup', label: 'Catch me up', icon: Clock },
              { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
              { id: 'ask', label: 'Ask', icon: MessageSquareText }, { id: 'listen', label: 'Listen', icon: Headphones },
            ] as { id: string; label: string; icon: any; amber?: boolean }[]).map(({ id, label, icon: Icon, amber }) => {
              const disabled = id === 'listen' && podcasts.length === 0;
              const active = sheet?.kind === id || (id === 'ask' && tab === 'ask' && !lowerCollapsed);
              if (amber) return (
                // Our Mishnah: a raised, glowing circle - the one button that invites a tap
                <button key={id} onClick={() => window.dispatchEvent(new Event('sd-mishnah-toggle'))} className="group flex items-center justify-center py-1" title="Our Mishnah (M)" aria-label="Our Mishnah">
                  {/* phones: a filled circle with the label under it */}
                  <span className="flex lg:hidden flex-col items-center gap-0.5">
                    <span className="sd-mish-glow flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 ring-2 ring-indigo-300/60 group-active:bg-indigo-700">
                      <span lang="he" className="text-white" style={{ fontFamily: HE_FONT, fontSize: '0.85rem', fontWeight: 700 }}>מתני׳</span>
                    </span>
                    <span className="text-[10px] font-black" style={{ color: '#e0e7ff' }}>Our Mishnah</span>
                  </span>
                  {/* larger screens: a filled pill that fills its slot */}
                  <span className="sd-mish-glow hidden lg:inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 ring-2 ring-indigo-300/50 transition-colors group-hover:bg-indigo-500 group-active:bg-indigo-700">
                    <span lang="he" className="text-white" style={{ fontFamily: HE_FONT, fontSize: '1rem', fontWeight: 700 }}>מתני׳</span>
                    <span className="text-xs font-black text-white whitespace-nowrap">Our Mishnah</span>
                  </span>
                </button>
              );
              return (
                <button key={id} disabled={disabled} onClick={() => {
                  if (id === 'mishnah') { window.dispatchEvent(new Event('sd-mishnah-toggle')); return; }
                  if (id === 'ask') { setTab('ask'); setLowerCollapsed(false); setSheet(null); return; }
                  setSheet(sheet?.kind === id ? null : { kind: id } as Sheet);
                }} className={`flex flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-2 rounded-xl py-1.5 lg:py-2 lg:px-3 text-[10px] lg:text-xs font-bold transition-colors disabled:opacity-30 ${active ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-100'}`}>
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
          sheet.kind === 'library' ? 'All dapim in Super Daf' : sheet.kind === 'sugyot' ? 'Sugyot on this daf' : sheet.kind === 'catchup' ? `Catch me up · through ${short(daf.segments[focusIdx].ref, daf.book)}` : sheet.kind === 'bookmarks' ? 'Bookmarks' : sheet.kind === 'listen' ? 'Listen to the daf' : 'Reading settings'
        } tall={sheet.kind === 'sugyot' || sheet.kind === 'library'}>
          {sheet.kind === 'library' && <DafLibrary ready={readyDafs} current={current?.ref} open={daf.ref} onPick={(r) => { setSheet(null); if (r !== daf.ref) setRef(r); }} />}
          {sheet.kind === 'sugyot' && (
            <div className="space-y-2">
              {daf.sugyot.map((s) => (
                <button key={s.index} onClick={() => { scrollToSeg(s.segments[0]); setSheet(null); }} className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${focusSugya?.index === s.index ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800'}`}>
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-indigo-300"><span lang="he" style={{ fontFamily: HE_FONT, fontSize: '0.95rem' }}>{KIND_LABEL[s.kind].he}</span> {KIND_LABEL[s.kind].en}<span className="text-slate-500 normal-case tracking-normal font-semibold ml-auto">{short(s.from, daf.book)} – {short(s.to, daf.book)}</span></div>
                  <p className="mt-1 text-sm text-slate-200 line-clamp-2" style={{ fontFamily: EN_FONT }}>{firstSentence(s.built?.synthesis?.tldr) || daf.segments[s.segments[0]].en.slice(0, 160) + '…'}</p>
                </button>
              ))}
            </div>
          )}
          {sheet.kind === 'catchup' && <CatchUp daf={daf} segIdx={focusIdx} data={sofar[daf.segments[focusIdx].ref]} segRef={short(daf.segments[focusIdx].ref, daf.book)} onDeeper={() => requestSofar(focusIdx)} />}
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
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Gemara layout</p><Segmented value={gemaraLayout} onChange={(v) => setGemaraLayout(v as 'full' | 'phrases')} options={[{ v: 'full', l: 'Full paragraph + phrase by phrase' }, { v: 'phrases', l: 'Phrase by phrase only' }]} /><p className="mt-1.5 text-[11px] text-slate-500">“Phrase by phrase only” skips the repeated Hebrew paragraph, so about twice as much of the daf fits on screen.</p></div>
              <div className="flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Text size</p><div className="flex items-center rounded-full bg-slate-800 border border-slate-700"><button onClick={() => setFontScale((f) => Math.max(0.8, +(f - 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Smaller"><Minus className="w-4 h-4" /></button><span className="text-xs font-black text-slate-200 w-10 text-center tabular-nums">{Math.round(fontScale * 100)}%</span><button onClick={() => setFontScale((f) => Math.min(1.7, +(f + 0.1).toFixed(2)))} className="p-2 text-slate-300 hover:text-white" aria-label="Larger"><Plus className="w-4 h-4" /></button></div></div>
              <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Page</p><Segmented value={surface} onChange={(v) => setSurface(v as Surface)} options={[{ v: 'paper', l: 'Paper', icon: Sun }, { v: 'dark', l: 'Dark', icon: Moon }]} /></div>
              <div className="hidden md:block"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Daf map</p><Segmented value={mapOpen ? 'open' : 'closed'} onChange={(v) => setMapOpen(v === 'open')} options={[{ v: 'closed', l: 'Show while scrolling' }, { v: 'open', l: 'Always pinned' }]} /></div>
              <button onClick={() => { setSheet(null); setTimeout(() => setTour(true), 250); }} className="w-full rounded-2xl border border-indigo-400/40 bg-indigo-500/10 px-4 py-3 text-left text-sm font-black text-indigo-200 hover:bg-indigo-500/20">Show me around <span className="font-semibold text-slate-400">· a 30-second tour of Super Daf</span></button>
              <p className="text-[11px] text-slate-500">Reading the page: <strong className="text-slate-300">bold</strong> is the Gemara’s own words, lighter text is the Davidson elucidation, and the small numbers open notes in the lower half. Drag the divider to give the notes more or less room. On iPad, <strong className="text-slate-300">Add to Home Screen</strong> gives a true full screen with no browser bars.</p>
            </div>
          )}
        </SheetFrame>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Upper half: the daf. Hebrew, interlinear, Rashi & Tosafot inline, halacha standalone.

function Reader({ daf, t, showHe, showEn, fontScale, panelIdx, noteN, isBookmarked, toggleBookmark, onShare, openOn, openSugya, canGo, onGo, gemaraLayout = 'full' }: {
  gemaraLayout?: 'full' | 'phrases';
  daf: Daf; t: any; showHe: boolean; showEn: boolean; fontScale: number; panelIdx: number | null; noteN: number | null;
  isBookmarked: (r: string) => boolean; toggleBookmark: (i: number) => void; onShare: (i: number) => void; openOn: (i: number, tab?: Tab, n?: number | null) => void; openSugya: (s: number, tab: Tab) => void;
  canGo: (r?: string | null) => boolean; onGo: (r: string) => void;
}) {
  const heStyle: CSSProperties = { fontFamily: HE_FONT, fontSize: `${1.45 * fontScale}rem`, lineHeight: 1.8 };
  const [words, setWords] = useState<Record<string, boolean>>({});
  return (
    <div className={`${t.page} min-h-full`}>
      <div className="max-w-[62rem] mx-auto px-3 sm:px-5 lg:px-8 pt-3 pb-8">
        <div dir="rtl" className={`mb-1 flex items-center gap-3 ${t.muted}`} style={{ fontFamily: HE_FONT }}>
          <span className={`h-px flex-1 border-t ${t.rule}`} />
          <span className="text-lg sm:text-xl font-bold">מסכת {daf.heTitle || daf.heRef.replace(/\s+\S+$/, '')}</span>
          <span className="opacity-50">◆</span>
          <span className="text-lg sm:text-xl font-bold">דף {daf.heRef.split(' ').pop()}</span>
          <span className={`h-px flex-1 border-t ${t.rule}`} />
        </div>
        <p className={`mb-3 text-center text-[12px] italic ${t.faint}`} style={{ fontFamily: EN_FONT }}>Super Daf is dedicated to Carol Serouya, the best mother and wife</p>
        {daf.prev && canGo(daf.prev) && (
          <div className="mb-3 text-center">
            <button onClick={() => onGo(daf.prev!)} className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${t.accent}`}><ChevronLeft className="w-3.5 h-3.5" /> Previous daf · {daf.prev}</button>
          </div>
        )}
        {daf.summary?.preview?.length ? (
          <div className={`rounded-2xl border ${t.card} px-4 py-3 mb-4 shadow-sm`}>
            <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${t.accent} mb-1.5`}>On this daf we'll learn</p>
            <ul className="space-y-1">{daf.summary.preview.slice(0, 3).map((x, i) => <li key={i} className="flex gap-2 text-[15px] leading-snug" style={{ fontFamily: EN_FONT }}><span className={`font-black ${t.accent}`}>{i + 1}.</span><span>{x}</span></li>)}</ul>
          </div>
        ) : null}
        {daf.sugyot.map((sugya) => {
          const built = sugya.built;
          const syn = built?.synthesis && !built.synthesis._error ? built.synthesis : null;
          const steps = syn?.steps || [];
          const stepFor = (ref: string) => steps.find((st) => (st.refs || []).includes(ref));
          const halItems = (built?.halacha?.items || []) as HalachaItem[];
          const mes = built?.mesivta && !built.mesivta._error ? built.mesivta : null;
          const btn = (label: ReactNode, onClick: () => void, icon: any, dim = false) => { const Icon = icon; return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${t.chip} ${t.hover} ${dim ? 'opacity-45' : ''}`}><Icon className={`w-3.5 h-3.5 ${t.accent}`} />{label}</button>; };
          return (
            <section key={sugya.index} className="mb-8">
              {sugya.kind === 'mishnah' ? (
                <div className={sugya.index > 0 ? 'mt-12 mb-6' : 'mt-2 mb-5'} role="separator" aria-label="A new Mishnah begins">
                  <div className="rounded-3xl border-2 border-amber-500/40 bg-amber-500/10 px-5 py-5 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-4">
                      <span className="h-px flex-1 bg-amber-500/50" />
                      <span lang="he" className="text-amber-800" style={{ fontFamily: HE_FONT, fontSize: '2.3rem', fontWeight: 700, lineHeight: 1 }}>מַתְנִיתִין</span>
                      <span className="h-px flex-1 bg-amber-500/50" />
                    </div>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">A new Mishnah · {short(sugya.from, daf.book)}</p>
                  </div>
                </div>
              ) : sugya.index > 0 && (
                <div className="flex items-center gap-3 my-6" aria-hidden="true">
                  <div className={`flex-1 border-t-2 ${t.rule}`} />
                  <span className={`text-[11px] font-black ${t.faint}`} style={{ fontFamily: HE_FONT, fontSize: '0.95rem' }}>❖ {KIND_LABEL[sugya.kind].he}</span>
                  <div className={`flex-1 border-t-2 ${t.rule}`} />
                </div>
              )}
              <div className={`rounded-2xl border ${t.card} px-4 py-2.5 mb-3 shadow-sm`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[11px] font-black ${sugya.kind === 'mishnah' ? 'bg-amber-500/15 text-amber-800 border border-amber-500/30' : 'bg-indigo-500/10 border border-indigo-500/30 ' + t.accent}`}>
                    <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '0.95rem' }}>{KIND_LABEL[sugya.kind].he}</span><span className="uppercase tracking-wider">{KIND_LABEL[sugya.kind].en}</span>
                  </span>
                  <span className={`text-xs font-bold ${t.muted}`}>{short(sugya.from, daf.book)} – {short(sugya.to, daf.book)}</span>
                  {sugya.prelude && <span className={`text-[11px] font-semibold ${t.faint}`}>began on {short(sugya.prelude.from, daf.book)}</span>}
                  {!built && <span className={`ml-auto text-[11px] ${t.faint} inline-flex items-center gap-1`}><Loader2 className="w-3 h-3 animate-spin" /> preparing</span>}
                  {built && (
                    <span className="ml-auto flex flex-wrap gap-1">
                      {btn('Big picture', () => openSugya(sugya.index, 'big'), Sparkles, !syn?.bigPicture)}
                      {btn('Rambam', () => openSugya(sugya.index, 'notes'), Landmark, !syn?.rambam)}
                      {btn('Sources', () => openSugya(sugya.index, 'sources'), Library)}
                      {btn('Disputes', () => openSugya(sugya.index, 'disputes'), Quote, !(syn?.machlokes?.length || syn?.questions?.length))}
                    </span>
                  )}
                </div>
                {syn?.tldr && <p className="mt-1.5" style={{ fontFamily: EN_FONT, fontSize: `${0.98 * fontScale}rem`, lineHeight: 1.55 }}><span className={`font-black text-[10px] uppercase tracking-wider mr-2 ${t.accent}`}>In brief</span>{firstSentence(syn.tldr)}</p>}
              </div>

              {sugya.segments.map((idx) => {
                const s = daf.segments[idx];
                const step = stepFor(s.ref);
                const m = mes?.segments?.find((x) => x.ref === s.ref);
                const hal = halItems.filter((h) => (h.refs || []).includes(s.ref));
                const core = (built?.core || []).filter((c) => c.anchor === s.ref);
                const useUnits = showEn && !!m?.units?.length;
                const clauses = !useUnits && showHe ? heClauses(s.he) : [];
                const placed = useUnits ? placeComments(m!.units.map((u) => u.he), core) : showHe && clauses.length > 1 ? placeComments(clauses, core) : { at: {} as Record<number, Comm[]>, rest: core };
                const blurb = (c: Comm) => {
                  const on = !!words[c.ref];
                  return (
                    <div key={c.ref} className={`sd-blurb rounded-lg px-2.5 py-1.5 ${t.soft}`} onClick={(e) => e.stopPropagation()}>
                      <p className="text-[13px] leading-snug" dir="ltr" style={{ textAlign: 'left', fontFamily: 'inherit' }}>
                        <span lang="he" className="sd-rashi font-bold mr-1.5" style={{ fontSize: '1rem' }}>{c.title === 'Rashi' ? 'רש״י' : 'תוס׳'}</span>
                        <span>{c.gist || m?.notes?.find((n) => n.ref === c.ref)?.point || firstSentence(c.en) || ''}</span>
                        <button onClick={() => setWords((w) => ({ ...w, [c.ref]: !w[c.ref] }))} className={`ml-2 text-[11px] font-bold ${t.accent}`}>{on ? 'hide words' : 'words'}</button>
                      </p>
                      {on && (
                        <div className="mt-1.5 animate-in fade-in duration-150">
                          <p lang="he" dir="rtl" className="sd-rashi" style={{ fontSize: `${1.1 * fontScale}rem`, lineHeight: 1.65 }}>{c.he}</p>
                          {c.en && <Rich text={c.en} className={`${t.muted} mt-1`} style={{ fontFamily: EN_FONT, fontSize: `${0.88 * fontScale}rem`, lineHeight: 1.55 }} />}
                          <p className={`text-[10px] ${t.faint} mt-0.5`}><SourceLink r={c.ref} />{c.enSource === 'ai' && <span className="ml-1.5 italic">AI translation</span>}</p>
                        </div>
                      )}
                    </div>
                  );
                };
                const nNotes = m?.notes?.length || 0;
                const hasPasuk = (built?.pasukSources || []).some((v) => v.anchor === s.ref);
                const hasMishnah = (built?.mishnahSources || []).some((v) => v.anchor === s.ref);
                const hasSod = (built?.extras?.sod || []).some((v) => v.anchor === s.ref);
                const isPanel = panelIdx === idx;
                return (
                  <article key={s.ref} data-seg={idx} className={`sd-para rounded-2xl px-3 sm:px-4 py-3 mb-2 ${isPanel ? t.sel : ''}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-black tabular-nums ${t.faint}`}>{s.amud}:{s.n}</span>
                      {s.startsMishnah && <span className={`text-[10px] font-black uppercase tracking-widest ${t.accent}`}>Mishnah</span>}
                      {s.startsGemara && <span className={`text-[10px] font-black uppercase tracking-widest ${t.accent}`}>Gemara</span>}
                      {s.startsTopic && <span className={`text-[10px] font-black ${t.accent}`}>§ new topic</span>}
                      <span className="flex-1" />
                      {hasPasuk && <button onClick={() => openOn(idx, 'notes')} className="sd-chip-x sd-chip-pasuk" title="A verse is quoted here - see it in the notes"><span lang="he" style={{ fontFamily: HE_FONT }}>פסוק</span></button>}
                      {hasMishnah && <button onClick={() => openOn(idx, 'notes')} className="sd-chip-x sd-chip-mishnah" title="Another Mishnah is cited here - read it in the notes"><span lang="he" style={{ fontFamily: HE_FONT }}>משנה</span></button>}
                      {hasSod && <button onClick={() => openOn(idx, 'notes')} className="sd-chip-x sd-chip-sod" title="A sod reading of this passage - in the notes"><span lang="he" style={{ fontFamily: HE_FONT }}>סוד</span></button>}
                      {nNotes > 0 && <button onClick={() => openOn(idx, 'notes')} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${t.chip} ${t.hover}`}><NotebookPen className="w-3 h-3" /> {nNotes}</button>}
                      <button onClick={() => onShare(idx)} className={`p-1 rounded-md ${t.faint}`} aria-label="Share this paragraph" title="Share"><Share2 className="w-4 h-4" /></button>
                      <button onClick={() => toggleBookmark(idx)} className={`p-1 rounded-md ${isBookmarked(s.ref) ? 'text-amber-500' : t.faint}`} aria-label="Bookmark this paragraph">{isBookmarked(s.ref) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}</button>
                    </div>

                    {step && step.refs[0] === s.ref && (
                      <div className="text-center mb-2">
                        <button onClick={() => openOn(idx, 'notes')} className={`inline-flex items-center gap-1.5 text-[13px] font-black ${t.accent}`}>{step.headline}</button>
                      </div>
                    )}
                    {showHe && !(gemaraLayout === 'phrases' && useUnits) && (clauses.length > 1 && Object.keys(placed.at).length ? (
                      <div lang="he" dir="rtl" style={heStyle} className="cursor-pointer" onClick={() => openOn(idx, 'notes')}>
                        {clauses.map((cl, k) => (
                          <span key={k}>
                            {cl}{' '}
                            {placed.at[k]?.length ? <span className="block my-1.5 space-y-1" dir="ltr">{placed.at[k].map(blurb)}</span> : null}
                          </span>
                        ))}
                      </div>
                    ) : <p lang="he" dir="rtl" style={heStyle} className="cursor-pointer" onClick={() => openOn(idx, 'notes')}>{s.he}</p>)}

                    {showEn && (m && m.units?.length ? (
                      <div className={`mt-2 rounded-xl overflow-hidden border ${t.rule}`}>
                        {m.units.map((u, k) => (
                          <div key={k}>
                          <div className="sd-unit grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-x-4 gap-y-0.5 px-3 py-1.5 cursor-pointer" onClick={() => openOn(idx, 'notes', u.notes?.[0] ?? null)}>
                            {showHe && <p lang="he" dir="rtl" className="text-right" style={{ fontFamily: HE_FONT, fontSize: `${1.05 * fontScale}rem`, lineHeight: 1.6 }}>{u.he}</p>}
                            <p style={{ fontFamily: EN_FONT, fontSize: `${0.95 * fontScale}rem`, lineHeight: 1.55 }}>
                              {u.en ? <Marked text={u.en} /> : <><strong>{u.literal}</strong>{u.elucidation ? <span className="sd-eluc"> {u.elucidation}</span> : null}</>}
                              {(u.notes || []).map((n) => <span key={n} className={`sd-note ${isPanel && noteN === n ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); openOn(idx, 'notes', n); }} title="Open this note below">{n}</span>)}
                            </p>
                          </div>
                          {placed.at[k]?.length ? <div className="px-2 py-1.5 space-y-1">{placed.at[k].map(blurb)}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 cursor-pointer" onClick={() => openOn(idx, 'notes')}>
                        <Davidson text={s.en} html={s.enHtml} style={{ fontFamily: EN_FONT, fontSize: `${1.0 * fontScale}rem`, lineHeight: 1.65 }} />
                        {built && !mes && <p className={`mt-1 text-[11px] ${t.faint} inline-flex items-center gap-1`}><Loader2 className="w-3 h-3 animate-spin" /> interlinear on its way</p>}
                      </div>
                    ))}

                    {placed.rest.length > 0 && <div className="mt-2 space-y-1">{placed.rest.map(blurb)}</div>}

                    {hal.length > 0 && (
                      <div className="mt-2 rounded-xl border-l-4 border-amber-500 bg-amber-500/10 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Scale className="w-3.5 h-3.5 text-amber-700" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">Halacha</span>
                          <button onClick={() => openOn(idx, 'halacha')} className="ml-auto text-[11px] font-bold text-amber-800 hover:underline">Full ruling & analysis →</button>
                        </div>
                        {hal.map((it, i) => (
                          <div key={i} className="mt-1.5 text-[13px] leading-snug">
                            <p className="font-bold">{it.issue}</p>
                            {([['Rambam', it.rambam], ['Shulchan Arukh', it.shulchanArukh], ['Rema', it.rema]] as [string, Ruling | null | undefined][]).map(([who, r]) => r ? (
                              <p key={who} className="mt-0.5"><span className="font-black text-amber-900">{who}:</span> {r.short || firstSentence(r.ruling)}</p>
                            ) : null)}
                          </div>
                        ))}
                      </div>
                    )}

                  </article>
                );
              })}
              {daf.summary?.sugyaLessons?.[sugya.index] && (
                <div className="mt-2 rounded-2xl bg-indigo-600 text-white px-4 py-3 shadow-md shadow-indigo-600/20 flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-200">What we learned</span>
                  <span className="text-[15px] font-semibold leading-snug" style={{ fontFamily: EN_FONT }}>{daf.summary.sugyaLessons[sugya.index]}</span>
                </div>
              )}
              {sugya.continuesOn && <p className={`mt-1 px-3 text-xs ${t.muted} italic`}>Continues on {short(sugya.continuesOn, daf.book)} — tomorrow’s daf.</p>}
            </section>
          );
        })}
        {daf.summary?.takeaways?.length ? (
          <div className="rounded-2xl border border-emerald-600/25 bg-emerald-500/10 px-4 py-3 mt-2 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800 mb-1.5">Take away from this daf</p>
            <ul className="space-y-1">{daf.summary.takeaways.slice(0, 3).map((x, i) => <li key={i} className="flex gap-2 text-[15px] leading-snug" style={{ fontFamily: EN_FONT }}><span className="font-black text-emerald-700">✓</span><span>{x}</span></li>)}</ul>
          </div>
        ) : null}
        {daf.next && (
          canGo(daf.next) ? (
            <button onClick={() => onGo(daf.next!)} className="group mt-6 w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-4 flex items-center gap-4 shadow-lg shadow-indigo-600/25 transition-colors text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">Continue learning</span>
                <span className="block text-lg font-black">Next daf · {daf.next}</span>
                {daf.sugyot[daf.sugyot.length - 1]?.continuesOn && <span className="block text-xs text-indigo-100 mt-0.5">The last sugya carries on there.</span>}
              </span>
              <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <div className={`mt-6 rounded-2xl border ${t.card} px-5 py-4 flex items-center gap-3`}>
              <Lock className={`w-4 h-4 ${t.faint}`} />
              <span className={`text-sm ${t.muted}`}>{daf.next} opens at noon the day before it is learned.</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Lower half: the notes.

function Panel({ daf, sugya, segIdx, tab, setTab, noteN, sugyaScoped, onBackToParagraph, chats, chatInput, setChatInput, chatBusy, onAsk, onCatchUp }: {
  daf: Daf; sugya: Sugya; segIdx: number | null; tab: Tab; setTab: (t: Tab) => void; noteN: number | null;
  sugyaScoped: boolean; onBackToParagraph: () => void; chats: Record<number, ChatMsg[]>; chatInput: string; setChatInput: (s: string) => void; chatBusy: boolean; onAsk: (q?: string) => void; onCatchUp: () => void;
}) {
  const built = sugya.built;
  const syn = built?.synthesis && !built.synthesis._error ? built.synthesis : null;
  const seg = segIdx !== null ? daf.segments[segIdx] : null;
  const step = seg ? syn?.steps?.find((st) => (st.refs || []).includes(seg.ref)) : null;
  // The Rambam's reading of the sugya shows open in Notes on every paragraph.
  const mes = seg ? built?.mesivta?.segments?.find((x) => x.ref === seg.ref) : null;
  const all = built ? [...built.core, ...built.rishonim, ...built.acharonim, ...built.other] : [];
  const halAll = (built?.halacha?.items || []) as HalachaItem[];
  const hal = seg ? halAll.filter((h) => (h.refs || []).includes(seg.ref)) : halAll;
  const srcs = seg ? all.filter((c) => c.anchor === seg.ref) : all;
  const [work, setWork] = useState<string | null>(null);
  const [words, setWords] = useState<Record<string, boolean>>({});
  const noteRef = useRef<HTMLDivElement>(null);
  useEffect(() => { noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [noteN, tab, segIdx]);
  useEffect(() => { setWork(null); }, [segIdx, sugya.index]);
  const orderedNotes = useMemo(() => { const ns = mes?.notes || []; if (noteN === null) return ns; return [...ns.filter((n) => n.n === noteN), ...ns.filter((n) => n.n !== noteN)]; }, [mes, noteN]);

  const tabs: { id: Tab; label: string; icon: any; count?: number; dim?: boolean }[] = [
    { id: 'notes', label: 'Notes', icon: NotebookPen, count: mes?.notes?.length || 0 },
    { id: 'halacha', label: 'Halacha', icon: Scale, count: hal.length, dim: !hal.length },
    { id: 'big', label: 'Big picture', icon: Sparkles, dim: !syn?.bigPicture },
    { id: 'disputes', label: 'Disputes', icon: Quote, dim: !(syn?.machlokes?.length || syn?.questions?.length) },
    { id: 'ask', label: 'Ask', icon: MessageSquareText },
    { id: 'sources', label: 'Sources', icon: Library, count: new Set(srcs.map((c) => c.title)).size, dim: !srcs.length },
  ];

  return (
    <>
      <div className="px-3 sm:px-4 pt-2 pb-1.5 border-b border-slate-800 shrink-0 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ id, label, icon: Icon, count, dim }) => (
          <button key={id} onClick={() => setTab(id)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all ${tab === id ? 'bg-indigo-600 text-white' : dim ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}>
            <Icon className="w-3.5 h-3.5" />{label}{count ? <span className={`${tab === id ? 'text-indigo-200' : 'text-slate-500'}`}>{count}</span> : null}
          </button>
        ))}
        <span className="flex-1" />
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-500">{seg ? short(seg.ref, daf.book) : `${KIND_LABEL[sugya.kind].en} · whole sugya`}</span>
        {sugyaScoped && <button onClick={onBackToParagraph} className="shrink-0 text-[10px] font-bold text-indigo-300 hover:text-white">back to paragraph</button>}
      </div>

      <div className="flex-1 overflow-y-auto sd-scroll px-3 sm:px-4 py-3 text-sm">
        {!built && tab !== 'ask' && <p className="text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Preparing this sugya - the Gemara is readable meanwhile.</p>}

        {tab === 'notes' && built && (
          <div className="space-y-4">
            {orderedNotes.length ? (
              <div className="space-y-2">
                {orderedNotes.map((n) => (
                  <div key={n.n} ref={noteN === n.n ? noteRef : undefined} className={`rounded-xl border px-3 py-2.5 ${noteN === n.n ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-700/60 bg-slate-800/50'}`}>
                    <p className="flex items-center gap-2 mb-1"><span className="sd-note on" style={{ verticalAlign: 'baseline' }}>{n.n}</span><span className="text-[11px] font-black text-indigo-200">{n.source}</span><span className="ml-auto"><SourceLink r={n.ref} /></span></p>
                    <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '0.96rem' }}><RefText text={n.point} /></p>
                  </div>
                ))}
              </div>
            ) : seg && built.mesivta ? <p className="text-slate-500">No commentary on Sefaria is anchored to this paragraph.</p> : seg ? <p className="text-slate-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Notes on their way.</p> : null}
            <ExtraSections built={built} seg={seg} />
            {syn?.rambam && (
              <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 px-3.5 py-3">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-700"><Landmark className="w-4 h-4" /> The Rambam</p>
                <p className="mt-1.5 leading-relaxed text-slate-100" style={{ fontFamily: EN_FONT, fontSize: '0.98rem' }}><RefText text={syn.rambam.reading} /></p>
                {syn.rambam.commentators?.length ? (
                  <ul className="mt-2 space-y-1.5">{syn.rambam.commentators.map((c, i) => <li key={i} className="flex gap-2"><span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black border border-amber-500/40 text-amber-800 bg-amber-500/10">{c.source}</span><span className="text-slate-200"><RefText text={c.point} /> <SourceLink r={c.ref} /></span></li>)}</ul>
                ) : null}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {syn.rambam.rulings?.length ? <button onClick={() => setWords((o) => ({ ...o, __rulings: o.__rulings === false }))} className="rounded-full border border-amber-500/40 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-amber-800">{words.__rulings !== false ? 'Hide' : 'Show'} his rulings ({syn.rambam.rulings.length})</button> : null}
                  {built.rambamSources.length ? <button onClick={() => setWords((o) => ({ ...o, __rtexts: !o.__rtexts }))} className="rounded-full border border-amber-500/40 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-amber-800">{words.__rtexts ? 'Hide' : 'Read'} the texts & commentators ({built.rambamSources.length})</button> : null}
                </div>
                {words.__rulings !== false && syn.rambam.rulings?.length ? <div className="mt-2 space-y-2">{syn.rambam.rulings.map((x, i) => <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2"><p className="text-[11px] font-black"><SourceLink r={x.ref} /></p><p className="mt-0.5 text-slate-200"><RefText text={x.ruling} /></p></div>)}</div> : null}
                {words.__rtexts ? <div className="mt-2"><Words comms={built.rambamSources} words={words} setWords={setWords} /></div> : null}
              </div>
            )}
            {step && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">This step of the sugya</p>
                <p className="font-bold text-slate-100 mb-1">{step.headline}</p>
                <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '0.96rem' }}><RefText text={step.explanation} /></p>
                {step.layers?.length ? (
                  <div className="mt-3 space-y-2.5">
                    {step.layers.map((ly, i) => (
                      <div key={i}><p className="font-bold text-slate-100">{ly.title}</p><p className="leading-relaxed text-slate-300"><RefText text={ly.body} /></p>{ly.refs?.length ? <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1">{ly.refs.map((r) => <SourceLink key={r} r={r} />)}</p> : null}</div>
                    ))}
                    {step.deeper && <div><p className="font-bold text-slate-100">Go deeper</p><p className="leading-relaxed text-slate-300"><RefText text={step.deeper} /></p></div>}
                  </div>
                ) : null}
              </div>
            )}
            {!step && !seg && syn?.bigPicture && <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT }}><RefText text={syn.bigPicture} /></p>}
            <button onClick={onCatchUp} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-700"><Clock className="w-3.5 h-3.5" /> Catch me up to here</button>
          </div>
        )}

        {tab === 'halacha' && built && (hal.length ? (
          <div className="space-y-4">
            {hal.map((it, i) => (
              <div key={i}>
                <p className="font-bold text-slate-100 mb-2"><RefText text={it.issue} /></p>
                <div className="space-y-2">
                  {([['Rambam', it.rambam], ['Shulchan Arukh', it.shulchanArukh], ['Rema', it.rema]] as [string, Ruling | null | undefined][]).map(([who, r]) => (
                    <div key={who} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-2.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{who}{r ? <span className="ml-2 normal-case tracking-normal"><SourceLink r={r.ref} /></span> : null}</p>
                      {r ? (
                        <>
                          <p className="mt-1 font-bold text-slate-100"><RefText text={r.short || firstSentence(r.ruling)} /></p>
                          <p className="mt-1 text-slate-200"><RefText text={r.ruling} /></p>
                          {r.analysis && <p className="mt-1.5 text-slate-400 italic"><RefText text={r.analysis} /></p>}
                        </>
                      ) : <p className="mt-1 text-xs text-slate-500 italic">not linked on Sefaria for this point</p>}
                    </div>
                  ))}
                </div>
                {it.note && <p className="mt-2 text-xs text-slate-400 italic"><RefText text={it.note} /></p>}
              </div>
            ))}
            {built.halacha?.caveat && <p className="text-[11px] text-slate-500">{built.halacha.caveat}</p>}
            <p className="text-[11px] text-slate-500">For practice, confirm with your rav.</p>
          </div>
        ) : <p className="text-slate-400">{built.halacha?.available === false ? built.halacha.note : seg ? 'No ruling is anchored to this paragraph.' : 'No halachic codes are linked to this sugya on Sefaria.'}</p>)}

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
              <p className="text-[11px] text-slate-500">Everything Sefaria links {seg ? 'to this paragraph' : 'to this sugya'}. A work not listed is not on Sefaria for this passage; nothing is reconstructed from memory.</p>
            </div>
          ) : <p className="text-slate-400">No commentary on Sefaria is anchored {seg ? 'to this paragraph' : 'to this sugya'}.</p>
        )}

        {tab === 'big' && built && (
          <div className="space-y-3">
            <p className="leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '0.98rem' }}><RefText text={syn?.bigPicture || 'Not available yet.'} /></p>
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
            <p className="text-slate-200"><span className="font-black text-indigo-300">{c.title}</span>{c.gist ? <> — {gistText(c.title, c.gist)}</> : null}</p>
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

// ----------------------------------------------------------------------
// Minimap: the daf drawn as pages, one per amud.

function Minimap({ daf, focusIdx, onJump, bookmarks, surface }: { daf: Daf; focusIdx: number; onJump: (i: number) => void; bookmarks: BookmarkItem[]; surface: Surface }) {
  const W = 104, PAD = 6, COL = 20, GAP = 4, GEM = W - PAD * 2 - (COL + GAP) * 2;
  const amudim = useMemo(() => { const g: Record<string, number[]> = {}; daf.segments.forEach((s, i) => { (g[s.amud] = g[s.amud] || []).push(i); }); return Object.entries(g); }, [daf]);
  const core = daf.sugyot.flatMap((s) => s.built?.core || []);
  const count = (segRef: string, title: string) => core.filter((c) => c.anchor === segRef && c.title === title).length;
  const marked = new Set(bookmarks.filter((b) => b.ref === daf.ref).map((b) => b.segRef));
  const mishnayot = daf.segments.map((s, i) => (s.startsMishnah ? i : -1)).filter((i) => i >= 0);
  const fill = surface === 'paper' ? { page: '#fbf7ee', stroke: '#d9cdb3', block: '#cfc3a9', mishnah: '#e8c279', side: '#ddd3bd', focus: '#4f46e5', text: '#8a7f6a', bg: '#efe7d6' } : { page: '#18181b', stroke: '#2e2e33', block: '#3a3a40', mishnah: '#6b5a3a', side: '#2e2e33', focus: '#a5b4fc', text: '#8a898e', bg: '#0c0c0e' };
  return (
    <aside className="flex h-full shrink-0 w-[128px] flex-col items-center gap-3 py-3 overflow-y-auto sd-scroll border-r border-black/5" style={{ background: fill.bg }} aria-label="Where you are on the daf">
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: fill.text }}><MapIcon className="w-3 h-3" /> The daf</div>
      {mishnayot.length > 0 && (
        <div className="w-full px-2 flex flex-col gap-1">
          {mishnayot.map((i, k) => (
            <button key={i} onClick={() => onJump(i)} className="w-full rounded-lg px-2 py-1 text-left text-[10px] font-black leading-tight transition-colors" style={{ background: fill.mishnah, color: surface === 'paper' ? '#5b3a06' : '#f5e3c0' }} title={`Jump to this Mishnah (${daf.segments[i].ref})`}>
              <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '0.8rem' }}>מתני׳</span> {mishnayot.length > 1 ? `${k + 1} · ` : ''}{daf.segments[i].amud}
            </button>
          ))}
        </div>
      )}
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
                  {s.startsMishnah && <line x1={2} x2={W - 2} y1={y - 1.5} y2={y - 1.5} stroke="#d97706" strokeWidth={2.5} strokeLinecap="round" />}
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
      <p className="px-2 text-[9px] leading-tight text-center" style={{ color: fill.text }}>Center: Gemara (amber = Mishnah) · right: Rashi · left: Tosafot · tap to jump</p>
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

// Catch me up: an instant outline built from what the page already has (no
// waiting), with the fuller AI catch-up one tap away.
function CatchUp({ daf, segIdx, data, segRef, onDeeper }: { daf: Daf; segIdx: number; data?: TldrSoFar | 'loading' | { error: string }; segRef: string; onDeeper: () => void }) {
  const sg = daf.sugyot.find((x) => x.segments.includes(segIdx)) || daf.sugyot[0];
  const idxOf = (ref: string) => daf.segments.findIndex((x) => x.ref === ref);
  const earlier = daf.sugyot.filter((x) => x.index < sg.index).map((x) => daf.summary?.sugyaLessons?.[x.index] || firstSentence(x.built?.synthesis?.tldr)).filter(Boolean) as string[];
  const syn = sg.built?.synthesis && !sg.built.synthesis._error ? sg.built.synthesis : null;
  const steps = (syn?.steps || []).filter((st) => { const i = idxOf((st.refs || [])[0]); return i >= 0 && i <= segIdx; });

  return (
    <div className="space-y-3">
      {earlier.length > 0 && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Earlier on this daf</p>
          <ul className="space-y-1">{earlier.map((l, i) => <li key={i} className="text-sm flex gap-2 leading-snug"><span className="text-indigo-300">◆</span><span>{l}</span></li>)}</ul>
        </div>
      )}
      <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/25 px-3 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">This sugya so far{sg.prelude ? ` · began on ${short(sg.prelude.from, daf.book)}` : ''}</p>
        {syn?.tldr && <p className="text-sm leading-relaxed" style={{ fontFamily: EN_FONT }}>{syn.tldr}</p>}
        {steps.length > 0 && (
          <ol className="mt-2 space-y-1">
            {steps.map((st, i) => <li key={i} className="text-sm flex gap-2 leading-snug"><span className="shrink-0 font-black text-indigo-300 tabular-nums">{i + 1}.</span><span>{st.headline}</span></li>)}
          </ol>
        )}
      </div>

      {!data ? (
        <button onClick={onDeeper} className="w-full rounded-xl border border-indigo-400/40 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2.5 text-sm font-black text-indigo-200 inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Go deeper: the full story so far</button>
      ) : data === 'loading' ? (
        <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Writing the full story up to {segRef}…</p>
      ) : 'error' in data ? (
        <p className="text-sm text-rose-300">{data.error}</p>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">The full story so far</p><p className="text-sm leading-relaxed" style={{ fontFamily: EN_FONT }}>{data.sofar}</p></div>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Right now</p><p className="text-sm leading-relaxed" style={{ fontFamily: EN_FONT }}>{data.nowWeAre}</p></div>
          {data.keepInMind?.length > 0 && <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Keep in mind</p><ul className="space-y-1">{data.keepInMind.map((k, i) => <li key={i} className="text-sm flex gap-2"><span className="text-indigo-300">◆</span><span>{k}</span></li>)}</ul></div>}
        </div>
      )}
      <p className="text-[11px] text-slate-500">Only up to {segRef} - nothing after it is revealed.</p>
    </div>
  );
}

// Light markdown for chat answers: paragraphs, bold/italic, bullet lists, [ref] links.
function AskMarkdown({ text }: { text: string }) {
  const blocks = String(text || '').trim().split(/\n{2,}/);
  const inline = (line: string, key: number) => {
    const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g);
    return <span key={key}>{parts.map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}><RefText text={p.slice(2, -2)} /></strong>;
      if (/^(_[^_]+_|\*[^*]+\*)$/.test(p)) return <em key={i}><RefText text={p.slice(1, -1)} /></em>;
      return <RefText key={i} text={p} />;
    })}</span>;
  };
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter(Boolean);
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return <ul key={i} className="space-y-1 pl-1">{lines.map((l, j) => <li key={j} className="flex gap-2"><span className="text-indigo-300">•</span><span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''), j)}</span></li>)}</ul>;
        }
        if (/^#{1,4}\s/.test(lines[0])) return <p key={i} className="font-black">{inline(lines.join(' ').replace(/^#{1,4}\s/, ''), i)}</p>;
        return <p key={i}>{inline(lines.join(' '), i)}</p>;
      })}
    </div>
  );
}

function AskThread({ messages, busy, input, setInput, onSend }: { messages: ChatMsg[]; busy: boolean; input: string; setInput: (s: string) => void; onSend: (q?: string) => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, busy]);
  return (
    <div className="flex flex-col h-full -mx-3 sm:-mx-4 -my-3">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 sd-scroll">
        {messages.length === 0 && <p className="text-sm text-slate-400">Ask anything about this sugya — a term, a step you lost, why Rashi says what he says. Answers draw only on the texts on this daf and cite them.</p>}
        {messages.map((m, i) => {
          const last = i === messages.length - 1;
          const offersMore = m.role === 'assistant' && /want more detail\?/i.test(m.content);
          return (
            <div key={i} className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white ml-8' : 'bg-slate-800/70 border border-slate-700/60 mr-4'}`}>
              {m.role === 'user' ? m.content : <AskMarkdown text={offersMore ? m.content.replace(/_?\*?want more detail\?\*?_?\s*$/i, '').trim() : m.content} />}
              {offersMore && last && !busy && (
                <button onClick={() => onSend('Yes, give me the full answer.')} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 text-white px-3 py-1.5 text-[11px] font-black">More detail →</button>
              )}
            </div>
          );
        })}
        {busy && <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Reading the sources…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="shrink-0 p-2.5 border-t border-slate-800 flex items-end gap-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} rows={1} placeholder="Ask about this sugya…" className="flex-1 resize-none bg-slate-800 border border-slate-700 focus:border-indigo-500/60 rounded-2xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-32" />
        <button type="submit" disabled={busy || !input.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-full" aria-label="Send"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}

// Every daf that has been built, grouped by masechet - the way to reach
// dafim other than today's. Only built dafim are listed (they cost nothing to open).
function DafLibrary({ ready, current, open, onPick }: { ready: Set<string>; current?: string; open: string; onPick: (ref: string) => void }) {
  const groups = useMemo(() => {
    const all = new Set(ready); if (current) all.add(current);
    const by: Record<string, number[]> = {};
    for (const r of all) { const m = r.match(/^(.+?)\s+(\d+)$/); if (m) (by[m[1]] ||= []).push(Number(m[2])); }
    return Object.entries(by).map(([book, ds]) => [book, ds.sort((a, b) => a - b)] as const).sort(([a], [b]) => (current?.startsWith(a + ' ') ? -1 : current?.startsWith(b + ' ') ? 1 : a.localeCompare(b)));
  }, [ready, current]);
  if (!groups.length) return <p className="text-sm text-slate-400"><Loader2 className="inline w-4 h-4 animate-spin mr-1" /> Loading…</p>;
  return (
    <div className="space-y-5">
      {groups.map(([book, ds]) => (
        <div key={book}>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">{book} <span className="normal-case tracking-normal font-semibold text-slate-500">· {ds.length} {ds.length === 1 ? 'daf' : 'dapim'}</span></p>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
            {ds.map((n) => {
              const r = `${book} ${n}`; const isOpen = r === open; const isToday = r === current;
              return (
                <button key={r} onClick={() => onPick(r)} className={`relative rounded-xl border py-2 text-sm font-black tabular-nums transition-colors ${isOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700/60 bg-slate-800/40 text-slate-200 hover:bg-slate-800'}`} title={isToday ? `${r} · today's daf` : r}>
                  {n}
                  {isToday && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[8px] font-black uppercase leading-[14px] text-white">today</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-500">Each new daf is prepared at noon the day before it is learned, then stays here for everyone.</p>
    </div>
  );
}

// ----------------------------------------------------------------------
// Passuk / Mishnah / Sod: each appears only when Sefaria links one to this
// paragraph. Verses and Mishnayot are Sefaria's own links and texts - never
// generated - so the reader always sees the real source.
function quotedWords(verseHe: string, segHe: string): Set<number> {
  const seg = new Set(segHe.split(/\s+/).map(heSkel).filter((w) => w.length >= 2));
  const out = new Set<number>();
  verseHe.split(/\s+/).forEach((w, i) => { const k = heSkel(w); if (k.length >= 2 && seg.has(k)) out.add(i); });
  return out;
}

function ExtraSections({ built, seg }: { built: Built; seg: Seg | null }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const on = (r: { anchor?: string }) => !seg || r.anchor === seg.ref;
  const dedupe = <T extends { ref: string }>(xs: T[]) => xs.filter((x, i) => xs.findIndex((y) => y.ref === x.ref) === i);
  const verses = dedupe((built.pasukSources || []).filter(on));
  const mishnayot = dedupe((built.mishnahSources || []).filter(on));
  const sod = dedupe((built.extras?.sod || []).filter(on));
  if (!verses.length && !mishnayot.length && !sod.length) return null;
  const notes = built.extras?.pasuk || [];
  const sodTexts = built.extras?.sodTexts || [];
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="space-y-3">
      {verses.map((v) => {
        const n = notes.find((x) => x.ref === v.ref);
        const marks = seg ? quotedWords(v.he, seg.he) : new Set<number>();
        return (
          <div key={v.ref} className="sd-x sd-x-pasuk px-3.5 py-3">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] sd-k-pasuk">
              <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '1rem', letterSpacing: 0 }}>פסוק</span> The verse
              <span className="ml-auto normal-case tracking-normal font-bold"><SourceLink r={v.ref} /></span>
            </p>
            <p lang="he" dir="rtl" className="mt-2 text-slate-100" style={{ fontFamily: HE_FONT, fontSize: '1.2rem', lineHeight: 1.7 }}>
              {v.he.split(/\s+/).map((w, i) => <span key={i}>{marks.has(i) ? <span className="sd-quoted px-0.5">{w}</span> : w} </span>)}
            </p>
            {v.en && <p className="mt-1 text-slate-300" style={{ fontFamily: EN_FONT, fontSize: '0.95rem', lineHeight: 1.55 }}>{v.en}</p>}
            {marks.size > 0 && <p className="mt-1 text-[11px] text-slate-500">Highlighted: the words the Gemara quotes here.</p>}
            {n?.use && <p className="mt-2.5 text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '0.95rem', lineHeight: 1.55 }}><span className="font-black sd-k-pasuk">How the Gemara reads it · </span>{n.use}</p>}
            {n?.commentators?.length ? (
              <div className="mt-2.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">On the verse itself</p>
                <ul className="space-y-1.5">
                  {n.commentators.map((c) => (
                    <li key={c.ref} className="text-[0.92rem] leading-snug text-slate-200"><span className="font-black sd-k-pasuk">{c.source.replace(/ on (Torah|Tanakh|Nevi'im|Ketuvim).*$/, '')}</span> · {c.point} <SourceLink r={c.ref} /></li>
                  ))}
                </ul>
              </div>
            ) : null}
            {typeof n?.talmudCount === 'number' && n.talmudCount > 1 && <p className="mt-2 text-[11px] font-bold text-slate-400">This verse is quoted {n.talmudCount} times across the Talmud.</p>}
          </div>
        );
      })}

      {mishnayot.map((m) => (
        <div key={m.ref} className="sd-x sd-x-mishnah px-3.5 py-3">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] sd-k-mishnah">
            <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '1rem', letterSpacing: 0 }}>משנה</span> Mishnah cited
            <span className="ml-auto normal-case tracking-normal font-bold"><SourceLink r={m.ref} /></span>
          </p>
          <p lang="he" dir="rtl" className={`mt-2 text-slate-100 ${open['m:' + m.ref] ? '' : 'line-clamp-4'}`} style={{ fontFamily: HE_FONT, fontSize: '1.1rem', lineHeight: 1.7 }}>{m.he}</p>
          {m.en && <p className={`mt-1 text-slate-300 ${open['m:' + m.ref] ? '' : 'line-clamp-4'}`} style={{ fontFamily: EN_FONT, fontSize: '0.95rem', lineHeight: 1.55 }}>{m.en}</p>}
          <button onClick={() => toggle('m:' + m.ref)} className="mt-1.5 text-[11px] font-black sd-k-mishnah">{open['m:' + m.ref] ? 'Show less' : 'Read the whole Mishnah'}</button>
        </div>
      ))}

      {sod.map((x) => {
        const src = sodTexts.find((t) => t.ref === x.ref) || (built.sodSources || []).find((t) => t.ref === x.ref);
        return (
          <div key={x.ref} className="sd-x sd-x-sod px-3.5 py-3">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] sd-k-sod">
              <span lang="he" style={{ fontFamily: HE_FONT, fontSize: '1rem', letterSpacing: 0 }}>סוד</span> The inner meaning
              <span className="ml-auto normal-case tracking-normal font-bold"><SourceLink r={x.ref} /></span>
            </p>
            <p className="mt-2 text-slate-200" style={{ fontFamily: EN_FONT, fontSize: '0.96rem', lineHeight: 1.6 }}><span className="font-black sd-k-sod">{x.source} · </span>{x.point}</p>
            {src && (src.he || src.en) && (
              <>
                <button onClick={() => toggle('s:' + x.ref)} className="mt-1.5 text-[11px] font-black sd-k-sod">{open['s:' + x.ref] ? 'Hide the text' : 'Read the text'}</button>
                {open['s:' + x.ref] && (
                  <div className="mt-1.5">
                    {src.he && <p lang="he" dir="rtl" className="text-slate-200" style={{ fontFamily: HE_FONT, fontSize: '1.05rem', lineHeight: 1.7 }}>{src.he}</p>}
                    {src.en && <p className="mt-1 text-slate-300" style={{ fontFamily: EN_FONT, fontSize: '0.92rem', lineHeight: 1.55 }}>{src.en}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// "Which Mishnah am I on?" - a pill that always names the Mishnah the current
// paragraph belongs to (even one that began dapim ago) and opens it in a card,
// so the reader never has to scroll back to remember it. Text from Sefaria.
function MishnahPeek({ daf, focusIdx, onGo, surface }: { daf: Daf; focusIdx: number; onGo: (i: number) => void; surface: Surface }) {
  // Only the Mishnah this point of the Gemara belongs to.
  const list = (daf.mishnayot || []).map((m) => ({ ...m, idx: daf.segments.findIndex((s) => s.ref === m.startsAt) }));
  const shown = list.reduce<(typeof list)[number] | null>((acc, m) => (m.idx <= focusIdx ? m : acc), list[0] || null);
  const [open, setOpen] = useState(() => { try { return new URLSearchParams(window.location.search).has('mishnah'); } catch { return false; } });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) setOpen((o) => !o);
    };
    const onDock = () => setOpen((o) => !o);
    window.addEventListener('keydown', onKey);
    window.addEventListener('sd-mishnah-toggle', onDock);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('sd-mishnah-toggle', onDock); };
  }, []);
  if (!shown) return null;
  const from = shown.idx < 0 ? shown.startsAt.match(/(\d+)([ab])/) : null;
  const back = from ? Number(daf.daf) - Number(from[1]) : 0;
  const paper = surface === 'paper';
  const lines = shown.lines?.length ? shown.lines : [{ he: shown.he, enHtml: shown.en }];

  return (
    <>
      {open && (
        <div className={`absolute top-3 bottom-3 right-3 z-30 w-[calc(100%-1.5rem)] sm:w-[min(620px,92%)] flex flex-col rounded-3xl border shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200 ${paper ? 'bg-[#fbf6ea] border-amber-500/30 text-stone-900' : 'bg-[#17150f] border-amber-400/25 text-stone-100'}`} role="dialog" aria-label="Our Mishnah">
          <div className={`flex items-start gap-3 px-5 pt-4 pb-3 border-b ${paper ? 'border-amber-500/20' : 'border-amber-400/15'}`}>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black">Our Mishnah</p>
              <p className={`text-xs mt-0.5 ${paper ? 'text-stone-500' : 'text-stone-400'}`}>
                {shown.ref} · {shown.idx < 0 ? <>began on {shown.startsAt.replace(daf.book + ' ', '')}{back > 0 ? `, ${back} ${back === 1 ? 'daf' : 'dapim'} back` : ''}</> : <>on this daf at {shown.startsAt.replace(daf.book + ' ', '')}</>}
              </p>
            </div>
            {shown.idx >= 0 && <button onClick={() => { onGo(shown.idx); setOpen(false); }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${paper ? 'bg-amber-600 text-white' : 'bg-amber-400 text-stone-900'}`}>Go to it</button>}
            <button onClick={() => setOpen(false)} className={`p-1.5 rounded-full ${paper ? 'hover:bg-amber-100' : 'hover:bg-white/10'}`} aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
          {/* set like the page: Hebrew and English side by side, bold = the Mishnah's own words */}
          <div className="overflow-y-auto sd-scroll px-4 sm:px-5 py-3">
            {lines.map((l, i) => (
              <div key={i} className={`grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-x-5 gap-y-1 py-2.5 ${i ? (paper ? 'border-t border-amber-500/15' : 'border-t border-amber-400/10') : ''}`}>
                <p lang="he" dir="rtl" className="text-right" style={{ fontFamily: HE_FONT, fontSize: '1.15rem', lineHeight: 1.7 }}>{l.he}</p>
                <Davidson text={l.enHtml.replace(/<[^>]+>/g, '')} html={l.enHtml} className={paper ? 'text-stone-800' : 'text-stone-200'} style={{ fontFamily: EN_FONT, fontSize: '0.95rem', lineHeight: 1.6 }} />
              </div>
            ))}
          </div>
          <p className={`px-5 py-2.5 border-t text-[11px] ${paper ? 'border-amber-500/20 text-stone-500' : 'border-amber-400/15 text-stone-400'}`}><b>Bold</b> is the Mishnah's own words · press <kbd className="font-bold">M</kbd> anytime</p>
        </div>
      )}
    </>
  );
}
