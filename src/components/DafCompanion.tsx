import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X, ChevronLeft, ChevronRight, ArrowRight, Share2, Scale, Landmark, BookOpen, Quote, Languages, ListTree, Link2, ListChecks, Loader2, ChevronDown } from 'lucide-react';
import { DAF_API, sefariaUrl } from '../lib/daf';
import { RefText, plain, shortRef } from './RefText';

// "From the daf": study material around one daf on the /daf front page.
// One card per kind - the iyun leads - and each opens a quiet reading panel.

type Rule = { ref: string; short: string; ruling: string } | null;
type Source = { stage: string; who: string; ref: string; quote: string; point: string };
type Iyun = { title: string; heTitle: string; hook: string; question: string; sources: Source[]; approaches: { name: string; who: string[]; sevara: string }[]; conclusion: string; takeaway: string; sugya?: { index: number; from: string; to: string } };
type Review = { overview: string; today: string; chapters: { n: number; title: string; summary: string; points: string[]; he: string; name: string; current: boolean }[] };
export type Companion = {
  available?: false;
  ref: string; heRef: string;
  sugyot: { index: number; from: string; to: string; tldr: string }[];
  takeaways: string[];
  halacha: { sugya: number; issue: string; refs: string[]; rambam: Rule; shulchanArukh: Rule; rema: Rule; note: string }[];
  rambam: { sugya: number; reading: string; rulings: { ref: string; ruling: string }[]; commentators: { source: string; ref: string; point: string }[] }[];
  machlokes: { sugya: number; issue: string; positions: { who: string; view: string; refs?: string[] }[] }[];
  shas: { ref: string; anchor: string; yerushalmi: boolean; en: string; he: string; headline: string }[];
  tosafot: { ref: string; anchor: string; dh: string; headline: string; bothers: string; answer: string; why: string }[];
  words: { he: string; translit: string; meaning: string; note: string; ref: string }[];
  iyun: Iyun | null;
  review: Review | null;
};

type PanelId = 'iyun' | 'remember' | 'halacha' | 'rambam' | 'tosafot' | 'machloket' | 'words' | 'review' | 'shas';

const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const EN_FONT = "'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const GOLD = '#d9ccad';
const HE_NUM = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז'];
const firstSentence = (s?: string) => { const t = plain(s).trim(); const m = t.replace(/\s*\[[^\]]+\]/g, '').match(/^(.+?[.!?])(\s|$)/); return m ? m[1] : t.replace(/\s*\[[^\]]+\]/g, ''); };
const segShort = (ref: string) => ref.replace(/^.*?(\d+[ab](:\d+)*)$/, '$1');

const cache = new Map<string, Companion>();

export function DafCompanion({ refs, initialRef, onOpen }: { refs: string[]; initialRef: string | null; onOpen: (ref: string) => void }) {
  const [cur, setCur] = useState<string | null>(initialRef);
  useEffect(() => { setCur(initialRef); }, [initialRef]);
  const [data, setData] = useState<Companion | null>(null);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);

  useEffect(() => {
    if (!cur) return;
    const hit = cache.get(cur);
    if (hit) { setData(hit); return; }
    setLoading(true);
    let gone = false;
    fetch(`${DAF_API}/companion?ref=${encodeURIComponent(cur)}`).then((r) => r.json()).then((d: Companion) => {
      if (gone) return;
      if (d && d.available !== false) { cache.set(cur, d); setData(d); } else setData(null);
    }).catch(() => { if (!gone) setData(null); }).finally(() => { if (!gone) setLoading(false); });
    return () => { gone = true; };
  }, [cur]);

  const at = cur ? refs.indexOf(cur) : -1;
  const prev = at > 0 ? refs[at - 1] : null;
  const next = at >= 0 && at < refs.length - 1 ? refs[at + 1] : null;

  const cards = useMemo(() => {
    if (!data) return [];
    const c = data;
    const out: { id: PanelId; label: string; icon: typeof Scale; preview: ReactNode; meta?: string }[] = [];
    if (c.takeaways?.length) out.push({ id: 'remember', label: '3 to remember', icon: ListChecks, preview: plain(c.takeaways[0]), meta: `${c.takeaways.length} points` });
    if (c.halacha?.length) out.push({ id: 'halacha', label: 'Halachot', icon: Scale, preview: plain(c.halacha[0].issue), meta: `${c.halacha.length} ${c.halacha.length === 1 ? 'ruling' : 'rulings'}` });
    if (c.rambam?.length) out.push({ id: 'rambam', label: 'The Rambam’s view', icon: Landmark, preview: firstSentence(c.rambam[0].reading) });
    if (c.tosafot?.length) out.push({ id: 'tosafot', label: 'Tosafot snapshot', icon: BookOpen, preview: <span lang="he" dir="rtl" className="block text-[17px]" style={{ fontFamily: HE_FONT }}>ד״ה {c.tosafot[0].dh}</span>, meta: `${c.tosafot.length} Tosafot` });
    if (c.machlokes?.length) out.push({ id: 'machloket', label: 'Machloket', icon: Quote, preview: plain(c.machlokes[0].issue), meta: `${c.machlokes.length} ${c.machlokes.length === 1 ? 'dispute' : 'disputes'}` });
    if (c.words?.length) out.push({ id: 'words', label: 'Words to know', icon: Languages, preview: <span lang="he" dir="rtl" className="block text-[17px] truncate" style={{ fontFamily: HE_FONT }}>{c.words.map((w) => w.he).join(' · ')}</span>, meta: `${c.words.length} words` });
    if (c.review?.chapters?.length) out.push({ id: 'review', label: 'Masechet so far', icon: ListTree, preview: plain(c.review.overview), meta: `${c.review.chapters.length} ${c.review.chapters.length === 1 ? 'chapter' : 'chapters'}` });
    if (c.shas?.length) out.push({ id: 'shas', label: 'Elsewhere in Shas', icon: Link2, preview: c.shas.slice(0, 3).map((s) => s.ref.replace(/:\d.*$/, '')).join(' · '), meta: `${c.shas.length} places` });
    return out;
  }, [data]);

  if (!cur) return null;
  const heRef = data?.heRef || '';

  return (
    <section className="dc mt-8" aria-label="From the daf">
      <style>{`
        .dc .sd-cite { display:inline-block; margin-left:.3em; padding:0 .45em; border-radius:9999px; font-family: system-ui, sans-serif; font-size:.68em; font-weight:700; line-height:1.6; vertical-align:.12em; text-decoration:none; white-space:nowrap; color:#c7d2fe; background:rgba(165,180,252,.13); }
        .dc .sd-cite:hover { background:rgba(165,180,252,.24); }
        .dc .sd-key { font-weight:700; color:#fff; }
        .dc-scroll { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
      `}</style>
      {/* heading + which daf */}
      <div className="flex items-end gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">From the daf</h2>
          <p className="mt-1 text-lg sm:text-xl font-black text-slate-100 leading-tight">{cur} {heRef && <span className="ml-1 font-bold text-slate-400" lang="he" style={{ fontFamily: HE_FONT }}>{heRef}</span>}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button disabled={!prev} onClick={() => prev && setCur(prev)} className="p-2 rounded-full border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent" aria-label={prev ? `Previous daf: ${prev}` : 'No earlier daf'}><ChevronLeft className="w-4 h-4" /></button>
          <button disabled={!next} onClick={() => next && setCur(next)} className="p-2 rounded-full border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent" aria-label={next ? `Next daf: ${next}` : 'No later daf'}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-10 flex justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !data ? (
        <p className="py-6 text-sm text-slate-500">Not ready for this daf yet.</p>
      ) : (
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {data.iyun && <IyunCard iyun={data.iyun} onClick={() => setPanel('iyun')} />}
          {cards.map((c) => (
            <button key={c.id} onClick={() => setPanel(c.id)} className="group text-left rounded-2xl border border-slate-800 bg-slate-900/70 hover:bg-slate-900 hover:border-slate-600 p-4 min-h-[132px] flex flex-col transition-all hover:-translate-y-0.5">
              <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: `${GOLD}b3` }}><c.icon className="w-3.5 h-3.5" /> {c.label}</span>
              <span className="mt-2 text-sm leading-snug text-slate-200 line-clamp-3 flex-1">{c.preview}</span>
              {c.meta && <span className="mt-2 text-[11px] font-bold text-slate-500 group-hover:text-slate-400 inline-flex items-center gap-1">{c.meta} <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></span>}
            </button>
          ))}
        </div>
      )}

      {panel && data && <Panel id={panel} c={data} onClose={() => setPanel(null)} onOpen={onOpen} />}
    </section>
  );
}

// The iyun leads: a large card set like the today card - its Hebrew name big.
function IyunCard({ iyun, onClick }: { iyun: Iyun; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group relative col-span-2 lg:row-span-2 overflow-hidden text-left rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col transition-all hover:-translate-y-0.5"
      style={{ background: 'radial-gradient(110% 80% at 85% 0%, rgba(217,204,173,0.10) 0%, transparent 60%), linear-gradient(180deg, #14172a 0%, #0e1020 100%)' }}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border" style={{ borderColor: `${GOLD}1f` }} />
      <span className="relative text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: `${GOLD}b3` }}>Iyun of the day</span>
      <p lang="he" dir="rtl" className="relative mt-4 text-[34px] sm:text-[42px] leading-[1.1] text-[#f1e9d6]" style={{ fontFamily: HE_FONT, fontWeight: 700 }}>{iyun.heTitle}</p>
      <p className="relative mt-2 text-lg sm:text-xl font-black text-slate-100 leading-snug">{plain(iyun.title)}</p>
      <p className="relative mt-3 text-[15px] leading-relaxed text-slate-300 line-clamp-3 lg:line-clamp-4" style={{ fontFamily: EN_FONT }}>{plain(iyun.question)}</p>
      <span className="relative mt-auto pt-5 flex items-center gap-3 text-xs font-bold text-slate-400">
        <span>{iyun.sources.length} sources · Gemara to halacha</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black text-slate-900 transition-all group-hover:gap-2.5" style={{ background: GOLD }}>Learn it <ArrowRight className="w-3.5 h-3.5" /></span>
      </span>
    </button>
  );
}

const TITLES: Record<PanelId, string> = { iyun: 'Iyun of the day', remember: '3 to remember', halacha: 'Halachot from the daf', rambam: 'The Rambam’s view', tosafot: 'Tosafot snapshot', machloket: 'Machloket', words: 'Words to know', review: 'Masechet so far', shas: 'Elsewhere in Shas' };

function Panel({ id, c, onClose, onOpen }: { id: PanelId; c: Companion; onClose: () => void; onOpen: (ref: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dc fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={TITLES[id]}>
      <div className="absolute inset-0 bg-[#05070f]/75 backdrop-blur-sm" onClick={onClose} />
      <div ref={box} tabIndex={-1} className="relative w-full sm:max-w-3xl h-[94vh] sm:h-auto sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0f1222] shadow-2xl outline-none">
        <header className="shrink-0 flex items-center gap-3 px-5 sm:px-8 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: `${GOLD}b3` }}>{TITLES[id]}</p>
            <p className="text-sm font-bold text-slate-400">{c.ref} <span lang="he" style={{ fontFamily: HE_FONT }}>{c.heRef}</span></p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10" aria-label="Close"><X className="w-5 h-5" /></button>
        </header>
        <div className="dc-scroll flex-1 overflow-y-auto overscroll-contain px-5 sm:px-8 py-6">
          {id === 'iyun' && c.iyun && <IyunBody iyun={c.iyun} />}
          {id === 'remember' && <RememberBody c={c} />}
          {id === 'halacha' && <HalachaBody c={c} />}
          {id === 'rambam' && <RambamBody c={c} />}
          {id === 'tosafot' && <TosafotBody c={c} />}
          {id === 'machloket' && <MachloketBody c={c} />}
          {id === 'words' && <WordsBody c={c} />}
          {id === 'review' && c.review && <ReviewBody r={c.review} />}
          {id === 'shas' && <ShasBody c={c} />}
        </div>
        <footer className="shrink-0 px-5 sm:px-8 py-3 border-t border-white/[0.06] flex items-center gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-slate-500 leading-snug">From Sefaria’s texts; AI explanations cite their sources.</p>
          <button onClick={() => { onClose(); onOpen(c.ref); }} className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-black text-white">Open the daf <ArrowRight className="w-3.5 h-3.5" /></button>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

const Chip = ({ r }: { r: string }) => <a href={sefariaUrl(r)} target="_blank" rel="noopener noreferrer" className="sd-cite" title={r}>{shortRef(r)}</a>;
const Prose = ({ text, className = '' }: { text: string; className?: string }) => <p className={`text-[16.5px] leading-[1.7] text-slate-200 ${className}`} style={{ fontFamily: EN_FONT }}><RefText text={text} /></p>;
const H = ({ children }: { children: ReactNode }) => <h3 className="mt-9 mb-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: `${GOLD}b3` }}>{children}<span className="h-px flex-1" style={{ background: `${GOLD}26` }} /></h3>;
const Ornament = () => <div className="mx-auto flex w-36 items-center gap-3" style={{ color: `${GOLD}66` }} aria-hidden="true"><span className="h-px flex-1 bg-current" /><span className="text-[9px]">◆</span><span className="h-px flex-1 bg-current" /></div>;
const sugyaLabel = (c: Companion, i: number) => { const s = c.sugyot.find((x) => x.index === i); return s ? `${segShort(s.from)}–${segShort(s.to)}` : ''; };

const STAGE: Record<string, { he: string; dot: string }> = {
  Gemara: { he: 'גמרא', dot: GOLD },
  Rishonim: { he: 'ראשונים', dot: '#a5b4fc' },
  Acharonim: { he: 'אחרונים', dot: '#7dd3fc' },
  Halacha: { he: 'הלכה', dot: '#6ee7b7' },
};

function IyunBody({ iyun }: { iyun: Iyun }) {
  const groups: { stage: string; items: Source[] }[] = [];
  for (const s of iyun.sources) { const g = groups[groups.length - 1]; if (g && g.stage === s.stage) g.items.push(s); else groups.push({ stage: s.stage, items: [s] }); }
  return (
    <article className="max-w-2xl mx-auto">
      <header className="text-center pt-2">
        <p lang="he" dir="rtl" className="text-[40px] sm:text-[52px] leading-[1.1] text-[#f1e9d6]" style={{ fontFamily: HE_FONT, fontWeight: 700 }}>{iyun.heTitle}</p>
        <h2 className="mt-3 text-xl sm:text-2xl font-black text-slate-100">{plain(iyun.title)}</h2>
        {iyun.sugya && <p className="mt-1 text-xs font-bold text-slate-500">From the sugya on {segShort(iyun.sugya.from)}–{segShort(iyun.sugya.to)}</p>}
        <div className="mt-5"><Ornament /></div>
        <p className="mt-5 text-[17px] leading-relaxed italic text-slate-300" style={{ fontFamily: EN_FONT }}><RefText text={iyun.hook} /></p>
      </header>

      {/* the question */}
      <div className="relative mt-8 rounded-2xl border px-5 sm:px-7 py-5" style={{ borderColor: `${GOLD}33`, background: `${GOLD}0a` }}>
        <span aria-hidden="true" className="absolute -top-4 left-5 px-2 text-4xl leading-none bg-[#0f1222]" style={{ color: `${GOLD}99`, fontFamily: EN_FONT }}>“</span>
        <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: `${GOLD}b3` }}>The question</p>
        <p className="mt-2 text-[19px] leading-[1.6] text-[#f1e9d6]" style={{ fontFamily: EN_FONT }}><RefText text={iyun.question} /></p>
      </div>

      {/* through the sources: a line from the Gemara down to the halacha */}
      <H>Through the sources</H>
      <ol className="relative">
        <span aria-hidden="true" className="absolute left-[11px] top-2 bottom-2 w-px" style={{ background: `linear-gradient(${GOLD}55, #a5b4fc44, #7dd3fc44, #6ee7b755)` }} />
        {groups.map((g, gi) => {
          const st = STAGE[g.stage] || { he: '', dot: '#94a3b8' };
          return (
            <li key={gi} className="relative pl-10 pb-2">
              <span aria-hidden="true" className="absolute left-[5px] top-1 w-[13px] h-[13px] rounded-full ring-4 ring-[#0f1222]" style={{ background: st.dot }} />
              <p className="flex items-baseline gap-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: st.dot }}>{g.stage}<span lang="he" className="normal-case tracking-normal text-sm font-bold opacity-70" style={{ fontFamily: HE_FONT }}>{st.he}</span></p>
              <div className="mt-3 space-y-6 pb-6">
                {g.items.map((s, i) => (
                  <div key={i}>
                    <p className="flex flex-wrap items-baseline gap-x-1 font-black text-slate-100">{s.who} <Chip r={s.ref} /></p>
                    {s.quote && <blockquote lang="he" dir="rtl" className="mt-2 pr-4 border-r-2 text-[19px] leading-[1.65] text-[#efe6d0]" style={{ fontFamily: HE_FONT, borderColor: `${st.dot}88` }}>{s.quote}</blockquote>}
                    <Prose text={s.point} className="mt-2 !text-slate-300" />
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {iyun.approaches?.length ? (
        <>
          <H>Ways to understand it</H>
          <div className={`grid gap-3 ${iyun.approaches.length > 2 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {iyun.approaches.map((a, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <span lang="he" className="flex w-9 h-9 items-center justify-center rounded-full border text-lg" style={{ fontFamily: HE_FONT, color: '#f1e9d6', borderColor: `${GOLD}55` }}>{HE_NUM[i]}</span>
                <p className="mt-3 font-black text-slate-100 leading-snug">{plain(a.name)}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-300" style={{ fontFamily: EN_FONT }}><RefText text={a.sevara} /></p>
                {a.who?.length ? <p className="mt-3 flex flex-wrap gap-1.5">{a.who.map((w) => <span key={w} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-400">{w}</span>)}</p> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {iyun.conclusion && (
        <>
          <H>Where it lands</H>
          <div className="rounded-2xl border-l-4 border-emerald-400/70 bg-emerald-500/[0.06] px-5 py-4"><Prose text={iyun.conclusion} /></div>
        </>
      )}

      {iyun.takeaway && (
        <div className="mt-10 mb-2 text-center">
          <Ornament />
          <p className="mt-5 text-[20px] leading-relaxed italic text-[#f1e9d6]" style={{ fontFamily: EN_FONT }}>{plain(iyun.takeaway)}</p>
          <div className="mt-5"><Ornament /></div>
        </div>
      )}
    </article>
  );
}

function RememberBody({ c }: { c: Companion }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="max-w-2xl mx-auto">
      <ol className="space-y-6">
        {c.takeaways.map((t, i) => (
          <li key={i} className="flex gap-4">
            <span className="shrink-0 flex w-9 h-9 items-center justify-center rounded-full border text-lg" style={{ fontFamily: HE_FONT, color: '#f1e9d6', borderColor: `${GOLD}55` }}>{HE_NUM[i]}</span>
            <p className="text-[19px] leading-[1.6] text-slate-100" style={{ fontFamily: EN_FONT }}>{plain(t)}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex justify-center">
        <button disabled={busy} onClick={async () => { setBusy(true); try { await shareCard(c); } finally { setBusy(false); } }} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-black text-slate-100">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share as an image
        </button>
      </div>
    </div>
  );
}

const WHO: [keyof Pick<Companion['halacha'][number], 'rambam' | 'shulchanArukh' | 'rema'>, string][] = [['rambam', 'Rambam'], ['shulchanArukh', 'Shulchan Arukh'], ['rema', 'Rema']];
function HalachaBody({ c }: { c: Companion }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {c.halacha.map((h, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <p className="font-black text-slate-100 leading-snug"><RefText text={h.issue} /></p>
          <div className="mt-3 space-y-3">
            {WHO.map(([k, label]) => {
              const r = h[k];
              if (!r) return null;
              const key = `${i}${k}`;
              const more = r.ruling && r.ruling !== r.short;
              return (
                <div key={k} className="flex gap-3">
                  <span className="shrink-0 w-24 pt-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-300/80">{label}</span>
                  <div className="min-w-0">
                    <p className="text-[15.5px] leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT }}><RefText text={r.short || r.ruling} />{r.ref && <Chip r={r.ref} />}</p>
                    {more && open === key && <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400" style={{ fontFamily: EN_FONT }}><RefText text={r.ruling} /></p>}
                    {more && <button onClick={() => setOpen(open === key ? null : key)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-300">{open === key ? 'Less' : 'The full ruling'} <ChevronDown className={`w-3 h-3 transition-transform ${open === key ? 'rotate-180' : ''}`} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
          {h.note && <p className="mt-3 text-sm italic text-slate-400"><RefText text={h.note} /></p>}
        </div>
      ))}
    </div>
  );
}

function RambamBody({ c }: { c: Companion }) {
  return (
    <div className="max-w-2xl mx-auto">
      {c.rambam.map((r, i) => (
        <section key={i} className={i ? 'mt-8 pt-8 border-t border-white/[0.06]' : ''}>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">The sugya on {sugyaLabel(c, r.sugya)}</p>
          <Prose text={r.reading} className="mt-2" />
          {r.rulings?.length ? <div className="mt-4 space-y-2">{r.rulings.map((x, j) => <div key={j} className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3"><p className="text-xs font-black text-amber-200/90"><Chip r={x.ref} /></p><p className="mt-1 text-[15px] leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT }}><RefText text={x.ruling} /></p></div>)}</div> : null}
          {r.commentators?.length ? <ul className="mt-4 space-y-2">{r.commentators.map((x, j) => <li key={j} className="flex gap-2 text-[15px] leading-relaxed text-slate-300" style={{ fontFamily: EN_FONT }}><span className="shrink-0 rounded-md border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-black text-amber-200/90 h-fit mt-1" style={{ fontFamily: 'system-ui, sans-serif' }}>{x.source}</span><span><RefText text={x.point} />{x.ref && <Chip r={x.ref} />}</span></li>)}</ul> : null}
        </section>
      ))}
    </div>
  );
}

function TosafotBody({ c }: { c: Companion }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {c.tosafot.map((t, i) => (
        <article key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div lang="he" dir="rtl" className="flex items-baseline gap-2" style={{ fontFamily: HE_FONT }}>
            <span className="text-sm text-sky-300/80">ד״ה</span>
            <span className="text-[24px] leading-snug text-[#f1e9d6] font-bold">{t.dh}</span>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-500">On {segShort(t.anchor)}{t.headline ? ` · ${t.headline}` : ''} <Chip r={t.ref} /></p>
          <dl className="mt-4 space-y-3">
            <div><dt className="text-[11px] font-black uppercase tracking-wider text-sky-300/80">What bothers Tosafot</dt><dd className="mt-1"><Prose text={t.bothers} /></dd></div>
            <div><dt className="text-[11px] font-black uppercase tracking-wider text-sky-300/80">The answer</dt><dd className="mt-1"><Prose text={t.answer} /></dd></div>
            {t.why && <div><dt className="text-[11px] font-black uppercase tracking-wider text-sky-300/80">Why it matters</dt><dd className="mt-1"><Prose text={t.why} className="!text-slate-300 italic" /></dd></div>}
          </dl>
        </article>
      ))}
    </div>
  );
}

function MachloketBody({ c }: { c: Companion }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {c.machlokes.map((m, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">The sugya on {sugyaLabel(c, m.sugya)}</p>
          <p className="mt-1 font-black text-slate-100 leading-snug"><RefText text={m.issue} /></p>
          <div className={`mt-3 grid gap-3 ${m.positions.length === 2 ? 'sm:grid-cols-2' : ''}`}>
            {m.positions.map((p, j) => (
              <div key={j} className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                <p className="text-sm font-black" style={{ color: '#f1e9d6' }}>{p.who}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-slate-300" style={{ fontFamily: EN_FONT }}><RefText text={p.view} />{p.refs?.map((r) => <Chip key={r} r={r} />)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WordsBody({ c }: { c: Companion }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {c.words.map((w, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p lang="he" dir="rtl" className="text-[28px] leading-tight text-[#f1e9d6]" style={{ fontFamily: HE_FONT, fontWeight: 700 }}>{w.he}</p>
          <p className="mt-1 text-sm italic text-indigo-200/90" style={{ fontFamily: EN_FONT }}>{w.translit}</p>
          <p className="mt-2 font-black text-slate-100">{plain(w.meaning)}</p>
          <p className="mt-1 text-[14.5px] leading-relaxed text-slate-400" style={{ fontFamily: EN_FONT }}>{plain(w.note)}{w.ref && <Chip r={w.ref} />}</p>
        </div>
      ))}
    </div>
  );
}

function ReviewBody({ r }: { r: Review }) {
  return (
    <div className="max-w-2xl mx-auto">
      <Prose text={r.overview} className="text-[17px]" />
      <ol className="relative mt-8">
        <span aria-hidden="true" className="absolute left-[17px] top-3 bottom-3 w-px bg-white/10" />
        {r.chapters.map((ch) => (
          <li key={ch.n} className="relative pl-14 pb-8">
            <span lang="he" className={`absolute left-0 top-0 flex w-9 h-9 items-center justify-center rounded-full border text-lg ring-4 ring-[#0f1222] ${ch.current ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-[#0f1222]'}`} style={{ fontFamily: HE_FONT, ...(ch.current ? {} : { color: '#f1e9d6', borderColor: `${GOLD}55` }) }}>{HE_NUM[ch.n - 1] || ch.n}</span>
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-bold text-slate-500">
              <span>Chapter {ch.n}</span>
              {ch.he && <span lang="he" className="text-base text-slate-400" style={{ fontFamily: HE_FONT }}>{ch.he}</span>}
              {ch.current && <span className="rounded-full bg-indigo-500/20 text-indigo-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">You are here</span>}
            </p>
            <p className="mt-1 text-lg font-black text-slate-100 leading-snug">{plain(ch.title)}</p>
            <Prose text={ch.summary} className="mt-1.5 !text-[15.5px] !text-slate-300" />
            {ch.points?.length ? <ul className="mt-3 space-y-1.5">{ch.points.map((p, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-200" style={{ fontFamily: EN_FONT }}><span className="mt-[0.7em] w-1 h-1 shrink-0 rounded-full" style={{ background: GOLD }} />{plain(p)}</li>)}</ul> : null}
            {ch.current && r.today && <p className="mt-4 rounded-xl border border-indigo-400/25 bg-indigo-500/[0.08] px-4 py-3 text-[15px] leading-relaxed text-indigo-100" style={{ fontFamily: EN_FONT }}>{plain(r.today)}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ShasBody({ c }: { c: Companion }) {
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm text-slate-400 mb-5">Passages Sefaria links to this daf - the same discussion, or the same principle, in another place.</p>
      <div className="space-y-3">
        {c.shas.map((s, i) => (
          <a key={i} href={sefariaUrl(s.ref)} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-4 sm:p-5 transition-colors">
            <p className="flex flex-wrap items-center gap-2 font-black text-slate-100">{s.ref}{s.yerushalmi && <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Yerushalmi</span>}</p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">Linked to {segShort(s.anchor)}{s.headline ? ` · ${s.headline}` : ''}</p>
            {s.en ? <p className="mt-2 text-[15px] leading-relaxed text-slate-300" style={{ fontFamily: EN_FONT }}>{plain(s.en)}</p>
              : s.he ? <p lang="he" dir="rtl" className="mt-2 text-[17px] leading-relaxed text-slate-300" style={{ fontFamily: HE_FONT }}>{s.he}…</p> : null}
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- share image

async function shareCard(c: Companion) {
  const W = 1080, Hh = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d'); if (!g) return;
  try { await Promise.all(['700 64px "Frank Ruhl Libre"', '400 40px "Source Serif 4"'].map((f) => document.fonts.load(f))); } catch { /* fall back */ }
  const bg = g.createLinearGradient(0, 0, 0, Hh); bg.addColorStop(0, '#121527'); bg.addColorStop(1, '#0d0f1c');
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  const glow = g.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900); glow.addColorStop(0, 'rgba(99,102,241,0.20)'); glow.addColorStop(1, 'rgba(99,102,241,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = 'rgba(217,204,173,0.22)'; g.lineWidth = 2; g.strokeRect(36, 36, W - 72, Hh - 72);
  g.strokeStyle = 'rgba(217,204,173,0.10)'; g.strokeRect(50, 50, W - 100, Hh - 100);
  g.textAlign = 'center';
  g.fillStyle = 'rgba(217,204,173,0.75)'; g.font = '400 44px "Frank Ruhl Libre", serif'; g.direction = 'rtl'; g.fillText(c.heRef, W / 2, 160); g.direction = 'ltr';
  g.fillStyle = '#f1e9d6'; g.font = '700 72px "Source Serif 4", Georgia, serif'; g.fillText('3 to remember', W / 2, 260);
  g.fillStyle = '#94a3b8'; g.font = '600 34px system-ui, sans-serif'; g.fillText(c.ref, W / 2, 315);
  g.fillStyle = 'rgba(217,204,173,0.5)'; g.fillRect(W / 2 - 110, 362, 80, 2); g.fillRect(W / 2 + 30, 362, 80, 2); g.font = '18px serif'; g.fillText('◆', W / 2, 370);
  // the points, shrinking the type until they fit
  const pts = c.takeaways.slice(0, 3).map((t) => plain(t));
  const left = 200, maxW = W - left - 130, top = 440, bottom = Hh - 170;
  let size = 42, lines: string[][] = [];
  const wrap = (t: string) => { const out: string[] = []; let line = ''; for (const w of t.split(' ')) { const tryL = line ? `${line} ${w}` : w; if (g.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; } if (line) out.push(line); return out; };
  for (; size >= 28; size -= 2) { g.font = `400 ${size}px "Source Serif 4", Georgia, serif`; lines = pts.map(wrap); const h = lines.reduce((a, l) => a + l.length * size * 1.42, 0) + (pts.length - 1) * size * 1.3; if (h <= bottom - top) break; }
  let y = top;
  g.textAlign = 'left';
  lines.forEach((ls, i) => {
    g.strokeStyle = 'rgba(217,204,173,0.45)'; g.lineWidth = 2; g.beginPath(); g.arc(left - 60, y + size * 0.05, 30, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f1e9d6'; g.font = '700 32px "Frank Ruhl Libre", serif'; g.textAlign = 'center'; g.fillText(HE_NUM[i], left - 60, y + size * 0.05 + 11); g.textAlign = 'left';
    g.fillStyle = '#e2e8f0'; g.font = `400 ${size}px "Source Serif 4", Georgia, serif`;
    ls.forEach((l, j) => g.fillText(l, left, y + size * 0.35 + j * size * 1.42));
    y += ls.length * size * 1.42 + size * 1.3;
  });
  g.textAlign = 'center'; g.fillStyle = '#64748b'; g.font = '600 30px system-ui, sans-serif'; g.fillText('Super Daf · aisefarim.com/daf', W / 2, Hh - 100);
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
