import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Share2, Loader2, Gem, Sun, Moon, Scale, Link2 } from 'lucide-react';
import { DAF_API, sefariaUrl } from '../lib/daf';
import { RefText, plain, shortRef } from './RefText';

// "Gems from the Daf": supplementary study material around one daf. The hub
// shows a parchment band of cards - set apart from the daf itself - and each
// gem opens as its own full-page article at /daf/<Masechet>/<n>/gems/<id>.

type Rule = { ref: string; short: string; ruling: string } | null;
type Source = { stage: string; who: string; ref: string; quote: string; point: string };
type Iyun = { title: string; heTitle: string; hook: string; background?: string[]; question: string; sources: Source[]; approaches: { name: string; who: string[]; sevara: string }[]; conclusion: string; takeaway: string; sugya?: { index: number; from: string; to: string } };
type Review = { overview: string; today: string; chapters: { n: number; title: string; summary: string; points: string[]; he: string; name: string; current: boolean }[] };
type Article = { title: string; heTitle?: string; dek: string; sections: { heading: string; paragraphs: string[]; source: { ref: string; quote: string; translation: string } | null }[]; takeaway: string };
export type Companion = {
  available?: false;
  ref: string; heRef: string;
  sugyot: { index: number; from: string; to: string; tldr: string }[];
  takeaways: string[];
  halacha: { sugya: number; issue: string; refs: string[]; rambam: Rule; shulchanArukh: Rule; rema: Rule; note: string }[];
  machlokes: { sugya: number; issue: string; positions: { who: string; view: string; refs?: string[] }[] }[];
  shas: { ref: string; anchor: string; yerushalmi: boolean; en: string; he: string; headline: string }[];
  tosafot: { ref: string; anchor: string; dh: string; headline: string; bothers: string; answer: string; why: string }[];
  words: { he: string; translit: string; meaning: string; note: string; ref: string }[];
  iyun: Iyun | null;
  review: Review | null;
  articles?: { rambam?: Article; halacha?: Article; tosafot?: Article; machloket?: Article };
};

export type GemId = 'iyun' | 'remember' | 'halacha' | 'rambam' | 'tosafot' | 'machloket' | 'words' | 'review' | 'shas';

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const HE_NUM = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז'];
// last daf of each masechet (for "how far in" on Masechet so far)
const LAST_DAF: Record<string, number> = { Berakhot: 64, Shabbat: 157, Eruvin: 105, Pesachim: 121, Shekalim: 22, Yoma: 88, Sukkah: 56, Beitzah: 40, 'Rosh Hashanah': 35, Taanit: 31, Megillah: 32, 'Moed Katan': 29, Chagigah: 27, Yevamot: 122, Ketubot: 112, Nedarim: 91, Nazir: 66, Sotah: 49, Gittin: 90, Kiddushin: 82, 'Bava Kamma': 119, 'Bava Metzia': 119, 'Bava Batra': 176, Sanhedrin: 113, Makkot: 24, Shevuot: 49, 'Avodah Zarah': 76, Horayot: 14, Zevachim: 120, Menachot: 110, Chullin: 142, Bekhorot: 61, Arakhin: 34, Temurah: 34, Keritot: 28, Meilah: 22, Tamid: 33, Niddah: 73 };
const splitRef = (ref: string) => { const m = ref.match(/^(.+?)\s+(\d+)$/); return m ? { book: m[1], n: Number(m[2]) } : { book: ref, n: 0 }; };
const segShort = (ref: string) => ref.replace(/^.*?(\d+[ab](:\d+)*)$/, '$1');
export const gemPath = (ref: string, id: GemId) => { const { book, n } = splitRef(ref); return `/daf/${encodeURIComponent(book.replace(/ /g, '_'))}/${n}/gems/${id}`; };
export const gemFromPath = (p: string): { ref: string; id: GemId } | null => {
  const m = p.match(/^\/(?:super)?daf\/([^/]+)\/(\d+)[ab]?\/gems\/([a-z]+)\/?$/);
  return m ? { ref: `${decodeURIComponent(m[1]).replace(/_/g, ' ')} ${m[2]}`, id: m[3] as GemId } : null;
};

const cache = new Map<string, Promise<Companion | null>>();
function loadCompanion(ref: string) {
  if (!cache.has(ref)) cache.set(ref, fetch(`${DAF_API}/companion?ref=${encodeURIComponent(ref)}`).then((r) => r.json()).then((d) => (d && d.available !== false ? d : null)).catch(() => { cache.delete(ref); return null; }));
  return cache.get(ref)!;
}
function useCompanion(ref: string | null) {
  const [state, setState] = useState<{ ref: string | null; data: Companion | null; loading: boolean }>({ ref: null, data: null, loading: false });
  useEffect(() => {
    if (!ref) return;
    let gone = false;
    setState((s) => ({ ref, data: s.ref === ref ? s.data : s.data, loading: true }));
    loadCompanion(ref).then((d) => { if (!gone) setState({ ref, data: d, loading: false }); });
    return () => { gone = true; };
  }, [ref]);
  return state;
}

// Which gems a daf has, in reading order.
function gemsOf(c: Companion): GemId[] {
  const a = c.articles || {};
  const out: GemId[] = [];
  if (c.iyun) out.push('iyun');
  if (c.takeaways?.length) out.push('remember');
  if (a.halacha) out.push('halacha');
  if (a.rambam) out.push('rambam');
  if (a.tosafot) out.push('tosafot');
  if (a.machloket) out.push('machloket');
  if (c.words?.length) out.push('words');
  if (c.review?.chapters?.length) out.push('review');
  if (c.shas?.length) out.push('shas');
  return out;
}
const LABEL: Record<GemId, string> = { iyun: 'Iyun of the day', remember: '3 to remember', halacha: 'Halachot', rambam: 'The Rambam’s view', tosafot: 'Tosafot', machloket: 'Machloket', words: 'Words to know', review: 'Masechet so far', shas: 'Elsewhere in Shas' };
const titleOf = (c: Companion, id: GemId) => {
  const a = c.articles || {};
  if (id === 'iyun') return plain(c.iyun?.title);
  if (id === 'halacha' || id === 'rambam' || id === 'tosafot' || id === 'machloket') return plain(a[id]?.title);
  if (id === 'remember') return 'The three things to take from the daf';
  if (id === 'words') return 'Five terms that unlock the daf';
  if (id === 'review') return `${splitRef(c.ref).book}, chapter by chapter`;
  return 'The same idea in other places';
};

// ====================================================================== hub

const P = { paper: '#f4ede0', card: '#fbf7ef', ink: '#231d15', muted: '#75675a', rule: '#e2d5bb', gold: '#9a7a35' };

export function GemsSection({ refs, initialRef, onGem }: { refs: string[]; initialRef: string | null; onGem: (ref: string, id: GemId) => void }) {
  const [cur, setCur] = useState<string | null>(initialRef);
  useEffect(() => { setCur(initialRef); }, [initialRef]);
  const { data, loading } = useCompanion(cur);
  if (!cur) return null;
  const at = refs.indexOf(cur);
  const prev = at > 0 ? refs[at - 1] : null;
  const next = at >= 0 && at < refs.length - 1 ? refs[at + 1] : null;
  const gems = data ? gemsOf(data) : [];
  return (
    <section className="mt-10 rounded-[28px] border px-4 sm:px-7 pt-6 pb-6 sm:pb-7" style={{ background: `radial-gradient(120% 70% at 0% 0%, #fbf6ea 0%, ${P.paper} 60%)`, borderColor: P.rule, color: P.ink }} aria-label="Gems from the Daf">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="flex w-11 h-11 shrink-0 items-center justify-center rounded-full" style={{ background: P.ink, color: '#e8cf8f' }}><Gem className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl sm:text-[28px] font-black tracking-tight leading-none" style={{ fontFamily: EN_FONT }}>Gems from the Daf</h2>
          <p className="mt-1.5 text-sm" style={{ color: P.muted }}>Supplemental material to aid your learning</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border px-1 py-1" style={{ borderColor: P.rule, background: P.card }}>
          <button disabled={!prev} onClick={() => prev && setCur(prev)} className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-25" aria-label={prev ? `Gems from ${prev}` : 'No earlier daf'}><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-1 text-sm font-black whitespace-nowrap">{cur}</span>
          <button disabled={!next} onClick={() => next && setCur(next)} className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-25" aria-label={next ? `Gems from ${next}` : 'No later daf'}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-12 flex justify-center" style={{ color: P.muted }}><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !data || !gems.length ? (
        <p className="py-8 text-sm" style={{ color: P.muted }}>The gems for this daf are still being prepared.</p>
      ) : (
        <div className={`mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {gems.map((id) => <GemCard key={id} id={id} c={data} onClick={() => onGem(data.ref, id)} />)}
        </div>
      )}
    </section>
  );
}

function GemCard({ id, c, onClick }: { id: GemId; c: Companion; onClick: () => void }) {
  if (id === 'iyun' && c.iyun) {
    return (
      <button onClick={onClick} className="group relative col-span-2 md:row-span-2 overflow-hidden text-left rounded-2xl p-5 sm:p-6 flex flex-col min-h-[240px] transition-transform hover:-translate-y-0.5 shadow-[0_18px_40px_-22px_rgba(35,29,21,0.8)]" style={{ background: 'radial-gradient(110% 80% at 90% 0%, #3a2f1f 0%, #231d15 55%, #1a150f 100%)', color: '#f1e9d6' }}>
        <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-[#e8cf8f]/15" />
        <span className="relative text-[11px] font-black uppercase tracking-[0.2em] text-[#e8cf8f]/80">Iyun of the day</span>
        <span className="relative flex-1 flex flex-col justify-center py-4">
          <span lang="he" dir="rtl" className="block text-[40px] sm:text-[54px] leading-[1.05]" style={{ fontFamily: HE_FONT, fontWeight: 700 }}>{c.iyun.heTitle}</span>
          <span className="mt-3 block text-lg sm:text-xl font-bold leading-snug text-[#f1e9d6]/90" style={{ fontFamily: EN_FONT }}>{plain(c.iyun.title)}</span>
        </span>
        <span className="relative flex items-center gap-3">
          {/* the sources it travels through, as a line of dots */}
          <span className="flex items-center gap-1.5" aria-label={`${c.iyun.sources.length} sources`}>
            {c.iyun.sources.map((s, i) => <span key={i} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STAGE[s.stage]?.dot || '#e8cf8f' }} />{i < c.iyun!.sources.length - 1 && <span className="w-2.5 h-px bg-[#e8cf8f]/30" />}</span>)}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#e8cf8f] text-[#231d15] px-4 py-2 text-xs font-black transition-all group-hover:gap-2.5">Learn it <ArrowRight className="w-3.5 h-3.5" /></span>
        </span>
      </button>
    );
  }
  let visual: ReactNode = null;
  let line = titleOf(c, id);
  if (id === 'remember') visual = <span className="text-[52px] leading-none font-bold" style={{ fontFamily: EN_FONT, color: P.gold }}>3</span>;
  if (id === 'halacha') { visual = <span className="flex items-end gap-2"><Scale className="w-9 h-9" style={{ color: P.gold }} strokeWidth={1.5} /></span>; }
  if (id === 'rambam') visual = <span lang="he" className="text-[34px] leading-none font-bold" style={{ fontFamily: HE_FONT, color: P.gold }}>רמב״ם</span>;
  if (id === 'tosafot') visual = <span lang="he" className="text-[34px] leading-none font-bold" style={{ fontFamily: HE_FONT, color: P.gold }}>תוספות</span>;
  if (id === 'machloket') visual = <span lang="he" className="text-[34px] leading-none font-bold" style={{ fontFamily: HE_FONT, color: P.gold }}>מחלוקת</span>;
  if (id === 'words') { visual = <span lang="he" dir="rtl" className="block w-full truncate text-[30px] leading-tight font-bold" style={{ fontFamily: HE_FONT, color: P.gold }}>{c.words[0]?.he}</span>; line = `${c.words.length} terms that unlock the daf`; }
  if (id === 'review') { const { book, n } = splitRef(c.ref); visual = <Ring n={n} last={LAST_DAF[book] || 0} />; }
  if (id === 'shas') { visual = <Link2 className="w-9 h-9" style={{ color: P.gold }} strokeWidth={1.5} />; line = `${c.shas.length} places in Shas that share this daf’s ideas`; }
  return (
    <button onClick={onClick} className="group text-left rounded-2xl border p-4 flex flex-col min-h-[150px] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(35,29,21,0.6)]" style={{ background: P.card, borderColor: P.rule, color: P.ink }}>
      <span className="text-[10.5px] font-black uppercase tracking-[0.16em]" style={{ color: P.muted }}>{LABEL[id]}</span>
      <span className="flex-1 flex items-center py-3">{visual}</span>
      <span className="text-[14px] leading-snug font-semibold line-clamp-2" style={{ fontFamily: EN_FONT }}>{line}</span>
    </button>
  );
}

function Ring({ n, last }: { n: number; last: number }) {
  if (!last) return null;
  const pct = Math.max(0, Math.min(1, (n - 1) / (last - 1)));
  const r = 22, C = 2 * Math.PI * r;
  return (
    <span className="flex items-center gap-3">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke={P.rule} strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={P.gold} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 28 28)" />
      </svg>
      <span className="leading-tight"><span className="block text-xl font-black">{n}<span className="text-sm font-bold" style={{ color: P.muted }}> / {last}</span></span><span className="block text-[11px] font-bold" style={{ color: P.muted }}>{Math.round(pct * 100)}% through</span></span>
    </span>
  );
}

// ====================================================================== gem page

const THEMES = {
  paper: { '--bg': '#f6f1e6', '--ink': '#231d15', '--muted': '#6f6252', '--accent': '#9a7a35', '--rule': '#ddcfb2', '--card': '#fbf8f1', '--cite': '#4338ca', '--citebg': 'rgba(99,102,241,.10)', '--quote': '#2b2318' },
  night: { '--bg': '#15130f', '--ink': '#ece4d4', '--muted': '#a99d88', '--accent': '#d9b86a', '--rule': '#39322a', '--card': '#1d1a15', '--cite': '#c7d2fe', '--citebg': 'rgba(165,180,252,.14)', '--quote': '#f1e9d6' },
} as const;

export function GemPage({ refName, id, onClose, onGem, onOpenDaf }: { refName: string; id: GemId; onClose: () => void; onGem: (ref: string, id: GemId) => void; onOpenDaf: (ref: string) => void }) {
  const { data, loading } = useCompanion(refName);
  const [theme, setTheme] = useState<'paper' | 'night'>(() => { try { return localStorage.getItem('sd_gem_theme') === 'night' ? 'night' : 'paper'; } catch { return 'paper'; } });
  const scroller = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => { scroller.current?.scrollTo(0, 0); }, [id, refName]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const onScroll = () => { const el = scroller.current; if (el) setProgress(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)); };
  const gems = data ? gemsOf(data) : [];
  const i = gems.indexOf(id);
  const nextId = i >= 0 && i < gems.length - 1 ? gems[i + 1] : gems[0];
  const vars = THEMES[theme] as unknown as CSSProperties;
  const words = useMemo(() => (data ? readingWords(data, id) : 0), [data, id]);
  const share = async () => {
    const url = window.location.origin + gemPath(refName, id);
    try { if (navigator.share) { await navigator.share({ title: `${LABEL[id]} · ${refName}`, url }); return; } } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  };

  return (
    <div ref={scroller} onScroll={onScroll} className="gp fixed inset-0 z-[90] overflow-y-auto overscroll-contain" style={{ ...vars, background: 'var(--bg)', color: 'var(--ink)' }} role="document">
      <style>{`
        .gp .sd-cite { display:inline-block; margin-left:.3em; padding:0 .45em; border-radius:9999px; font-family: system-ui, sans-serif; font-size:.62em; font-weight:700; line-height:1.65; vertical-align:.18em; text-decoration:none; white-space:nowrap; color:var(--cite); background:var(--citebg); }
        .gp .sd-key { font-weight:700; }
        .gp .dropcap::first-letter { float:left; font-size:3.7em; line-height:.82; padding:.06em .1em 0 0; font-weight:700; color:var(--accent); }
      `}</style>
      {/* reading progress */}
      <div className="fixed top-0 left-0 right-0 z-10 h-[3px]" aria-hidden="true"><div className="h-full transition-[width] duration-150" style={{ width: `${progress * 100}%`, background: 'var(--accent)' }} /></div>
      <header className="sticky top-0 z-[5] backdrop-blur-md border-b" style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', borderColor: 'var(--rule)' }}>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2">
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold hover:bg-black/5" aria-label="Back to Super Daf"><ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Super Daf</span></button>
          <span className="mx-auto text-xs sm:text-sm font-black uppercase tracking-[0.16em] inline-flex items-center gap-2" style={{ color: 'var(--accent)' }}><Gem className="w-4 h-4" /> Gems from the Daf</span>
          <button onClick={() => { const t = theme === 'paper' ? 'night' : 'paper'; setTheme(t); try { localStorage.setItem('sd_gem_theme', t); } catch { /* ignore */ } }} className="p-2 rounded-full hover:bg-black/5" aria-label={theme === 'paper' ? 'Night reading' : 'Day reading'}>{theme === 'paper' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</button>
          <button onClick={share} className="p-2 rounded-full hover:bg-black/5" aria-label="Share this gem"><Share2 className="w-4 h-4" /></button>
        </div>
      </header>

      {!data ? (
        <div className="py-32 flex justify-center" style={{ color: 'var(--muted)' }}>{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'This gem isn’t available.'}</div>
      ) : (
        <>
          <article className="max-w-[700px] mx-auto px-5 sm:px-6 pt-10 sm:pt-16 pb-16">
            <Hero c={data} id={id} words={words} />
            <div className="mt-10">
              {id === 'iyun' && data.iyun && <IyunBody iyun={data.iyun} />}
              {(id === 'halacha' || id === 'rambam' || id === 'tosafot' || id === 'machloket') && data.articles?.[id] && <ArticleBody a={data.articles[id]!} />}
              {id === 'remember' && <RememberBody c={data} />}
              {id === 'words' && <WordsBody c={data} />}
              {id === 'review' && data.review && <ReviewBody r={data.review} />}
              {id === 'shas' && <ShasBody c={data} />}
            </div>
          </article>

          {/* what's next */}
          <footer className="border-t" style={{ borderColor: 'var(--rule)' }}>
            <div className="max-w-[700px] mx-auto px-5 sm:px-6 py-10">
              {nextId && nextId !== id && (
                <button onClick={() => onGem(refName, nextId)} className="group w-full text-left rounded-2xl border p-5 sm:p-6 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}>
                  <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>Next gem · {LABEL[nextId]}</span>
                  <span className="mt-2 flex items-center gap-3"><span className="flex-1 text-xl sm:text-2xl font-bold leading-snug" style={{ fontFamily: EN_FONT }}>{titleOf(data, nextId)}</span><ArrowRight className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--accent)' }} /></span>
                </button>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {gems.filter((g) => g !== id && g !== nextId).map((g) => <button key={g} onClick={() => onGem(refName, g)} className="rounded-full border px-3 py-1.5 text-xs font-bold hover:bg-black/5" style={{ borderColor: 'var(--rule)' }}>{LABEL[g]}</button>)}
              </div>
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 justify-between">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Written from Sefaria’s texts; every claim cites its source.</p>
                <button onClick={() => onOpenDaf(refName)} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 text-sm font-black">Learn {refName} <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

function readingWords(c: Companion, id: GemId) {
  const count = (s?: string) => plain(s).split(/\s+/).filter(Boolean).length;
  const a = c.articles?.[id as 'rambam'];
  if (a) return count(a.dek) + a.sections.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + count(p), 0), 0);
  if (id === 'iyun' && c.iyun) return count(c.iyun.hook) + (c.iyun.background || []).reduce((n, p) => n + count(p), 0) + count(c.iyun.question) + c.iyun.sources.reduce((n, s) => n + count(s.point), 0) + c.iyun.approaches.reduce((n, x) => n + count(x.sevara), 0) + count(c.iyun.conclusion);
  if (id === 'review' && c.review) return count(c.review.overview) + c.review.chapters.reduce((n, ch) => n + count(ch.summary) + ch.points.reduce((m, p) => m + count(p), 0), 0);
  return 0;
}

function Hero({ c, id, words }: { c: Companion; id: GemId; words: number }) {
  const a = c.articles?.[id as 'rambam'];
  const he = id === 'iyun' ? c.iyun?.heTitle : a?.heTitle || '';
  const title = titleOf(c, id);
  const dek = id === 'iyun' ? c.iyun?.hook : a ? a.dek : id === 'review' ? c.review?.overview : id === 'remember' ? `What a learner should walk away knowing from ${c.ref}.` : id === 'words' ? 'The Aramaic words and Talmudic terms you will meet on this daf.' : 'Passages elsewhere in the Talmud that Sefaria links to this daf.';
  const mins = words ? Math.max(2, Math.round(words / 220)) : 0;
  return (
    <header className="text-center">
      <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>{LABEL[id]}</p>
      {he ? <p lang="he" dir="rtl" className="mt-6 text-[44px] sm:text-[60px] leading-[1.05]" style={{ fontFamily: HE_FONT, fontWeight: 700 }}>{he}</p> : null}
      <h1 className={`${he ? 'mt-4' : 'mt-6'} text-[32px] sm:text-[44px] leading-[1.12] font-bold tracking-tight`} style={{ fontFamily: EN_FONT }}>{title}</h1>
      {dek && <p className="mt-5 text-[19px] sm:text-[21px] leading-relaxed italic" style={{ fontFamily: EN_FONT, color: 'var(--muted)' }}><RefText text={dek} /></p>}
      <p className="mt-6 text-xs font-bold tracking-wide" style={{ color: 'var(--muted)' }}>{c.ref} · <bdi lang="he" dir="rtl" style={{ fontFamily: HE_FONT }}>{c.heRef}</bdi>{mins ? <> · {mins} min read</> : null}</p>
      <div className="mt-8"><Ornament /></div>
    </header>
  );
}

// ---------------------------------------------------------------- pieces

const Ornament = () => <div className="mx-auto flex w-40 items-center gap-3" style={{ color: 'var(--accent)', opacity: 0.6 }} aria-hidden="true"><span className="h-px flex-1 bg-current" /><span className="text-[9px]">◆</span><span className="h-px flex-1 bg-current" /></div>;
const Chip = ({ r }: { r: string }) => <a href={sefariaUrl(r)} target="_blank" rel="noopener noreferrer" className="sd-cite" title={r}>{shortRef(r)}</a>;
const Para = ({ text, drop }: { text: string; drop?: boolean }) => <p className={`text-[19px] sm:text-[20px] leading-[1.75] ${drop ? 'dropcap' : ''}`} style={{ fontFamily: EN_FONT }}><RefText text={text} /></p>;
const H2 = ({ children }: { children: ReactNode }) => <h2 className="mt-12 mb-4 text-[24px] sm:text-[27px] font-bold leading-snug tracking-tight" style={{ fontFamily: EN_FONT }}>{children}</h2>;
const Label = ({ children }: { children: ReactNode }) => <p className="mt-12 mb-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>{children}<span className="h-px flex-1" style={{ background: 'var(--rule)' }} /></p>;

// A quoted text: the Hebrew set like a page, the translation beneath.
function SourceQuote({ s }: { s: { ref: string; quote: string; translation?: string } }) {
  return (
    <figure className="my-9 rounded-2xl border px-5 sm:px-8 py-6 text-center" style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}>
      <blockquote lang="he" dir="rtl" className="text-[23px] sm:text-[26px] leading-[1.6]" style={{ fontFamily: HE_FONT, color: 'var(--quote)' }}>{s.quote}</blockquote>
      {s.translation && <p className="mt-3 text-[17px] leading-relaxed italic" style={{ fontFamily: EN_FONT, color: 'var(--muted)' }}>“{plain(s.translation)}”</p>}
      <figcaption className="mt-3 text-sm"><Chip r={s.ref} /></figcaption>
    </figure>
  );
}

function Takeaway({ text }: { text: string }) {
  return (
    <div className="mt-14 text-center">
      <Ornament />
      <p className="mt-6 text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Remember</p>
      <p className="mt-3 text-[22px] sm:text-[24px] leading-relaxed italic" style={{ fontFamily: EN_FONT }}>{plain(text)}</p>
      <div className="mt-6"><Ornament /></div>
    </div>
  );
}

function ArticleBody({ a }: { a: Article }) {
  return (
    <div>
      {a.sections.map((s, i) => (
        <section key={i}>
          {i > 0 || s.heading ? <H2>{s.heading}</H2> : null}
          <div className="space-y-5">{s.paragraphs.map((p, j) => <Para key={j} text={p} drop={i === 0 && j === 0} />)}</div>
          {s.source && <SourceQuote s={s.source} />}
        </section>
      ))}
      {a.takeaway && <Takeaway text={a.takeaway} />}
    </div>
  );
}

const STAGE: Record<string, { he: string; dot: string }> = {
  Gemara: { he: 'גמרא', dot: '#c9a24a' },
  Rishonim: { he: 'ראשונים', dot: '#818cf8' },
  Acharonim: { he: 'אחרונים', dot: '#38bdf8' },
  Halacha: { he: 'הלכה', dot: '#34d399' },
};

function IyunBody({ iyun }: { iyun: Iyun }) {
  const groups: { stage: string; items: Source[] }[] = [];
  for (const s of iyun.sources) { const g = groups[groups.length - 1]; if (g && g.stage === s.stage) g.items.push(s); else groups.push({ stage: s.stage, items: [s] }); }
  return (
    <div>
      {iyun.background?.length ? (
        <section>
          <H2>The case</H2>
          <div className="space-y-5">{iyun.background.map((p, i) => <Para key={i} text={p} drop={i === 0} />)}</div>
        </section>
      ) : null}

      {/* the question, set apart */}
      <div className="my-12 text-center px-2">
        <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>The question</p>
        <p className="mt-4 text-[25px] sm:text-[29px] leading-[1.45] font-semibold" style={{ fontFamily: EN_FONT }}><span aria-hidden="true" style={{ color: 'var(--accent)' }}>“</span><RefText text={iyun.question} /><span aria-hidden="true" style={{ color: 'var(--accent)' }}>”</span></p>
      </div>

      <Label>Through the sources</Label>
      <ol className="relative">
        <span aria-hidden="true" className="absolute left-[11px] top-2 bottom-6 w-[2px] rounded-full" style={{ background: 'linear-gradient(#c9a24a, #818cf8, #38bdf8, #34d399)', opacity: 0.45 }} />
        {groups.map((g, gi) => {
          const st = STAGE[g.stage] || { he: '', dot: 'var(--muted)' };
          return (
            <li key={gi} className="relative pl-11 pb-4">
              <span aria-hidden="true" className="absolute left-[4px] top-[3px] w-4 h-4 rounded-full border-4" style={{ background: st.dot, borderColor: 'var(--bg)' }} />
              <p className="flex items-baseline gap-2.5 text-xs font-black uppercase tracking-[0.18em]" style={{ color: st.dot }}>{g.stage}<span lang="he" className="normal-case tracking-normal text-base font-bold" style={{ fontFamily: HE_FONT }}>{st.he}</span></p>
              <div className="mt-4 space-y-8 pb-6">
                {g.items.map((s, i) => (
                  <div key={i}>
                    <p className="text-[17px] font-black" style={{ fontFamily: EN_FONT }}>{s.who} <Chip r={s.ref} /></p>
                    {s.quote && <blockquote lang="he" dir="rtl" className="mt-3 pr-4 border-r-[3px] text-[21px] sm:text-[22px] leading-[1.65]" style={{ fontFamily: HE_FONT, borderColor: st.dot, color: 'var(--quote)' }}>{s.quote}</blockquote>}
                    <div className="mt-3"><Para text={s.point} /></div>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {iyun.approaches?.length ? (
        <>
          <Label>Ways to understand it</Label>
          <div className={`grid gap-4 ${iyun.approaches.length > 2 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {iyun.approaches.map((a, i) => (
              <div key={i} className="rounded-2xl border p-5" style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}>
                <span lang="he" className="flex w-10 h-10 items-center justify-center rounded-full border-2 text-xl font-bold" style={{ fontFamily: HE_FONT, borderColor: 'var(--accent)', color: 'var(--accent)' }}>{HE_NUM[i]}</span>
                <p className="mt-4 text-[19px] font-bold leading-snug" style={{ fontFamily: EN_FONT }}>{plain(a.name)}</p>
                <p className="mt-2 text-[16.5px] leading-[1.7]" style={{ fontFamily: EN_FONT }}><RefText text={a.sevara} /></p>
                {a.who?.length ? <p className="mt-4 flex flex-wrap gap-1.5">{a.who.map((w) => <span key={w} className="rounded-full border px-2.5 py-0.5 text-xs font-bold" style={{ borderColor: 'var(--rule)', color: 'var(--muted)' }}>{w}</span>)}</p> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {iyun.conclusion && (
        <>
          <Label>Where it lands</Label>
          <div className="rounded-2xl border-l-4 pl-5 pr-4 py-4" style={{ borderColor: '#34d399', background: 'var(--card)' }}><Para text={iyun.conclusion} /></div>
        </>
      )}
      {iyun.takeaway && <Takeaway text={iyun.takeaway} />}
    </div>
  );
}

function RememberBody({ c }: { c: Companion }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <ol className="space-y-10">
        {c.takeaways.map((t, i) => (
          <li key={i} className="flex gap-5">
            <span lang="he" className="shrink-0 flex w-12 h-12 items-center justify-center rounded-full border-2 text-2xl font-bold" style={{ fontFamily: HE_FONT, borderColor: 'var(--accent)', color: 'var(--accent)' }}>{HE_NUM[i]}</span>
            <p className="pt-1 text-[22px] sm:text-[24px] leading-[1.55]" style={{ fontFamily: EN_FONT }}>{plain(t)}</p>
          </li>
        ))}
      </ol>
      <div className="mt-12 flex justify-center">
        <button disabled={busy} onClick={async () => { setBusy(true); try { await shareCard(c); } finally { setBusy(false); } }} className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-black hover:bg-black/5" style={{ borderColor: 'var(--rule)' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share as an image
        </button>
      </div>
    </div>
  );
}

function WordsBody({ c }: { c: Companion }) {
  return (
    <div className="space-y-4">
      {c.words.map((w, i) => (
        <div key={i} className="rounded-2xl border px-5 sm:px-7 py-6 sm:flex sm:items-center sm:gap-8" style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}>
          <div className="sm:w-48 shrink-0 sm:text-center">
            <p lang="he" dir="rtl" className="text-[34px] leading-tight font-bold" style={{ fontFamily: HE_FONT, color: 'var(--quote)' }}>{w.he}</p>
            <p className="mt-1 text-base italic" style={{ fontFamily: EN_FONT, color: 'var(--accent)' }}>{w.translit}</p>
          </div>
          <div className="mt-3 sm:mt-0 min-w-0">
            <p className="text-[20px] font-bold leading-snug" style={{ fontFamily: EN_FONT }}>{plain(w.meaning)}</p>
            <p className="mt-1.5 text-[17px] leading-relaxed" style={{ fontFamily: EN_FONT, color: 'var(--muted)' }}>{plain(w.note)}{w.ref && <Chip r={w.ref} />}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewBody({ r }: { r: Review }) {
  return (
    <ol className="relative">
      <span aria-hidden="true" className="absolute left-[21px] top-4 bottom-4 w-px" style={{ background: 'var(--rule)' }} />
      {r.chapters.map((ch) => (
        <li key={ch.n} className="relative pl-16 pb-12">
          <span lang="he" className="absolute left-0 top-0 flex w-11 h-11 items-center justify-center rounded-full border-2 text-xl font-bold" style={{ fontFamily: HE_FONT, ...(ch.current ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--bg)' } : { background: 'var(--bg)', borderColor: 'var(--rule)', color: 'var(--accent)' }) }}>{HE_NUM[ch.n - 1] || ch.n}</span>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
            Chapter {ch.n}{ch.he && <span lang="he" className="normal-case tracking-normal text-lg font-bold" style={{ fontFamily: HE_FONT, color: 'var(--ink)' }}>{ch.he}</span>}
            {ch.current && <span className="rounded-full px-2.5 py-0.5 text-[10px]" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>You are here</span>}
          </p>
          <H3>{plain(ch.title)}</H3>
          <Para text={ch.summary} />
          {ch.points?.length ? <ul className="mt-4 space-y-2.5">{ch.points.map((p, i) => <li key={i} className="flex gap-3 text-[18px] leading-relaxed" style={{ fontFamily: EN_FONT }}><span className="mt-[0.75em] w-1.5 h-1.5 shrink-0 rotate-45" style={{ background: 'var(--accent)' }} />{plain(p)}</li>)}</ul> : null}
          {ch.current && r.today && <p className="mt-6 rounded-2xl border px-5 py-4 text-[18px] leading-relaxed italic" style={{ fontFamily: EN_FONT, borderColor: 'var(--accent)' }}>{plain(r.today)}</p>}
        </li>
      ))}
    </ol>
  );
}
const H3 = ({ children }: { children: ReactNode }) => <h3 className="mt-2 mb-3 text-[23px] font-bold leading-snug" style={{ fontFamily: EN_FONT }}>{children}</h3>;

function ShasBody({ c }: { c: Companion }) {
  return (
    <div className="space-y-4">
      {c.shas.map((s, i) => (
        <a key={i} href={sefariaUrl(s.ref)} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border px-5 sm:px-6 py-5 transition-transform hover:-translate-y-0.5" style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}>
          <p className="flex flex-wrap items-center gap-2 text-[19px] font-bold" style={{ fontFamily: EN_FONT }}>{s.ref}{s.yerushalmi && <span className="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ borderColor: 'var(--rule)', color: 'var(--muted)' }}>Yerushalmi</span>}</p>
          <p className="mt-1 text-xs font-bold" style={{ color: 'var(--muted)' }}>Connected to our daf at {segShort(s.anchor)}{s.headline ? ` - ${s.headline}` : ''}</p>
          {s.en ? <p className="mt-3 text-[17px] leading-relaxed" style={{ fontFamily: EN_FONT }}>{plain(s.en)}</p>
            : s.he ? <p lang="he" dir="rtl" className="mt-3 text-[20px] leading-relaxed" style={{ fontFamily: HE_FONT }}>{s.he}…</p> : null}
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- share image

async function shareCard(c: Companion) {
  const W = 1080, Hh = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d'); if (!g) return;
  try { await Promise.all(['700 64px "Frank Ruhl Libre"', '400 40px "Source Serif 4"'].map((f) => document.fonts.load(f))); } catch { /* fall back */ }
  g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = 'rgba(154,122,53,0.45)'; g.lineWidth = 2; g.strokeRect(36, 36, W - 72, Hh - 72);
  g.strokeStyle = 'rgba(154,122,53,0.2)'; g.strokeRect(50, 50, W - 100, Hh - 100);
  g.textAlign = 'center';
  g.fillStyle = '#9a7a35'; g.font = '400 44px "Frank Ruhl Libre", serif'; g.fillText(c.heRef, W / 2, 160);
  g.fillStyle = '#231d15'; g.font = '700 72px "Source Serif 4", Georgia, serif'; g.fillText('3 to remember', W / 2, 260);
  g.fillStyle = '#6f6252'; g.font = '600 34px system-ui, sans-serif'; g.fillText(c.ref, W / 2, 315);
  g.fillStyle = 'rgba(154,122,53,0.6)'; g.fillRect(W / 2 - 110, 362, 80, 2); g.fillRect(W / 2 + 30, 362, 80, 2); g.font = '18px serif'; g.fillText('◆', W / 2, 370);
  const pts = c.takeaways.slice(0, 3).map((t) => plain(t));
  const left = 200, maxW = W - left - 130, top = 440, bottom = Hh - 170;
  let size = 42, lines: string[][] = [];
  const wrap = (t: string) => { const out: string[] = []; let line = ''; for (const w of t.split(' ')) { const tryL = line ? `${line} ${w}` : w; if (g.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; } if (line) out.push(line); return out; };
  for (; size >= 28; size -= 2) { g.font = `400 ${size}px "Source Serif 4", Georgia, serif`; lines = pts.map(wrap); const h = lines.reduce((a, l) => a + l.length * size * 1.42, 0) + (pts.length - 1) * size * 1.3; if (h <= bottom - top) break; }
  let y = top;
  lines.forEach((ls, i) => {
    g.strokeStyle = 'rgba(154,122,53,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(left - 60, y + size * 0.05, 30, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#9a7a35'; g.font = '700 32px "Frank Ruhl Libre", serif'; g.textAlign = 'center'; g.fillText(HE_NUM[i], left - 60, y + size * 0.05 + 11); g.textAlign = 'left';
    g.fillStyle = '#231d15'; g.font = `400 ${size}px "Source Serif 4", Georgia, serif`;
    ls.forEach((l, j) => g.fillText(l, left, y + size * 0.35 + j * size * 1.42));
    y += ls.length * size * 1.42 + size * 1.3;
  });
  g.textAlign = 'center'; g.fillStyle = '#6f6252'; g.font = '600 30px system-ui, sans-serif'; g.fillText('Gems from the Daf · aisefarim.com/daf', W / 2, Hh - 100);
  const blob: Blob | null = await new Promise((res) => cv.toBlob(res, 'image/png'));
  if (!blob) return;
  const name = `${c.ref.replace(/\s+/g, '-')}-3-to-remember.png`;
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `${c.ref}: 3 to remember`, text: 'https://aisefarim.com/daf' }); return; }
  } catch (e: any) { if (e?.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
