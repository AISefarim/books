import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, X, ScrollText, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { DAF_API, pingDafOpen } from '../lib/daf';

// The Daf tab's front page: today's daf, huge, then every finished daf by
// masechet with a search across names and what each daf teaches.

type DafMeta = { ref: string; heRef: string; sugyot: number | null; preview: string[]; takeaways: string[] };

const HE_FONT = "'Frank Ruhl Libre', 'David', serif";
const SHAS = ['Berakhot', 'Shabbat', 'Eruvin', 'Pesachim', 'Shekalim', 'Yoma', 'Sukkah', 'Beitzah', 'Rosh Hashanah', 'Taanit', 'Megillah', 'Moed Katan', 'Chagigah', 'Yevamot', 'Ketubot', 'Nedarim', 'Nazir', 'Sotah', 'Gittin', 'Kiddushin', 'Bava Kamma', 'Bava Metzia', 'Bava Batra', 'Sanhedrin', 'Makkot', 'Shevuot', 'Avodah Zarah', 'Horayot', 'Zevachim', 'Menachot', 'Chullin', 'Bekhorot', 'Arakhin', 'Temurah', 'Keritot', 'Meilah', 'Tamid', 'Niddah'];

const split = (ref: string) => { const m = ref.match(/^(.+?)\s+(\d+)$/); return m ? { book: m[1], n: Number(m[2]) } : { book: ref, n: 0 }; };
const heBook = (heRef: string) => heRef.replace(/\s+\S+$/, '');
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[֑-ׇ]/g, '').replace(/[^a-z0-9א-ת ]/g, ' ').replace(/\s+/g, ' ').trim();

export function DafHub({ onOpen, onExit, whatsappUrl }: { onOpen: (ref: string) => void; onExit: () => void; whatsappUrl?: string }) {
  const [items, setItems] = useState<DafMeta[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [today, setToday] = useState<{ ref: string; heRef?: string; date: string } | null>(null);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { pingDafOpen(); }, []);
  useEffect(() => {
    fetch(`${DAF_API}/index`).then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => { setItems([]); setFailed(true); });
    fetch(`${DAF_API}/current`).then((r) => r.json()).then((d) => { if (d && d.ref) setToday(d); }).catch(() => {});
  }, []);

  const todayMeta = items?.find((i) => i.ref === today?.ref);
  const todayHe = today?.heRef || todayMeta?.heRef || '';
  const dateLabel = today?.date ? new Date(today.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  // Search: tractate (English or Hebrew), daf number, or anything the daf teaches.
  const results = useMemo(() => {
    if (!items) return [];
    const query = norm(q);
    const words = query.split(' ').filter(Boolean);
    return items
      .map((it) => {
        if (!words.length) return { it, hit: null as string | null };
        const name = norm(`${it.ref} ${it.heRef} ${heBook(it.heRef)}`);
        const nameHit = words.every((w) => name.includes(w) || (/^\d+$/.test(w) && String(split(it.ref).n) === w));
        if (nameHit) return { it, hit: null };
        const points = [...it.preview, ...it.takeaways];
        const p = points.find((pt) => { const n = norm(pt); return words.every((w) => n.includes(w)); });
        if (p) return { it, hit: p };
        const all = norm(`${it.ref} ${it.heRef} ${points.join(' ')}`);
        return words.every((w) => all.includes(w)) ? { it, hit: null } : null;
      })
      .filter(Boolean) as { it: DafMeta; hit: string | null }[];
  }, [items, q]);

  const groups = useMemo(() => {
    const by: Record<string, { it: DafMeta; hit: string | null }[]> = {};
    for (const r of results) (by[split(r.it.ref).book] ||= []).push(r);
    const order = (b: string) => { const i = SHAS.findIndex((s) => norm(s) === norm(b)); return i < 0 ? 999 : i; };
    const todayBook = today ? split(today.ref).book : '';
    return Object.entries(by)
      .map(([book, rs]) => [book, rs.sort((a, b) => split(a.it.ref).n - split(b.it.ref).n)] as const)
      .sort(([a], [b]) => (a === todayBook ? -1 : b === todayBook ? 1 : order(a) - order(b) || a.localeCompare(b)));
  }, [results, today]);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-slate-950 text-slate-100 px-4 sm:px-8 pb-24">
      <div className="max-w-5xl mx-auto">
        {/* top bar */}
        <div className="flex items-center gap-3 pt-4 pb-3">
          <button onClick={onExit} className="p-2 -ml-2 rounded-full hover:bg-slate-800 text-slate-300" aria-label="Back to AI Sefarim"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 font-black text-lg tracking-tight"><ScrollText className="w-5 h-5 text-indigo-300" /> Super Daf</div>
          <p className="ml-auto hidden sm:block text-xs italic text-slate-500">Dedicated to Carol Serouya, the best mother and wife</p>
        </div>

        {/* ===== today's daf, extremely prominent ===== */}
        <button onClick={() => today && onOpen(today.ref)} disabled={!today} className="group relative w-full overflow-hidden text-left rounded-[28px] border border-indigo-400/30 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 shadow-[0_30px_80px_-30px_rgba(99,102,241,0.8)] px-5 sm:px-10 py-7 sm:py-10 transition-transform hover:-translate-y-0.5">
          <div className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 text-[120px] sm:text-[200px] leading-none font-black text-white/[0.07] select-none" style={{ fontFamily: HE_FONT }} aria-hidden>{todayHe.split(' ').pop() || 'דף'}</div>
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" /> Today’s Daf Yomi{dateLabel ? ` · ${dateLabel}` : ''}
            </p>
            {today ? (
              <>
                <h1 className="mt-4 text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.05]">{today.ref}</h1>
                {todayHe && <p className="mt-1 text-3xl sm:text-4xl text-indigo-100" lang="he" dir="rtl" style={{ fontFamily: HE_FONT, textAlign: 'left' }}>{todayHe}</p>}
                {todayMeta?.preview?.length ? (
                  <div className="mt-6 max-w-2xl">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-200 mb-2">On this daf we’ll learn</p>
                    <ol className="space-y-1.5">
                      {todayMeta.preview.map((p, i) => (
                        <li key={i} className="flex gap-3 text-[15px] sm:text-lg text-white/95 leading-snug"><span className="shrink-0 w-6 h-6 rounded-full bg-white/20 text-xs font-black flex items-center justify-center mt-0.5">{i + 1}</span>{p}</li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <p className="mt-5 text-indigo-100 text-sm sm:text-base">Gemara, Rashi, Tosafot, Mesivta notes, the Rambam and halacha, sugya by sugya.</p>
                )}
                <span className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white text-indigo-700 px-6 py-3.5 text-base sm:text-lg font-black shadow-xl group-hover:gap-3 transition-all">
                  {todayMeta ? 'Start learning' : 'Open today’s daf'} <ArrowRight className="w-5 h-5" />
                </span>
                {todayMeta?.sugyot ? <span className="ml-4 text-sm font-semibold text-indigo-100">{todayMeta.sugyot} sugyot</span> : null}
              </>
            ) : (
              <div className="mt-6 flex items-center gap-2 text-indigo-100"><Loader2 className="w-5 h-5 animate-spin" /> Finding today’s daf…</div>
            )}
          </div>
        </button>

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
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a masechet, a daf, or a topic - “Bekhorot 16”, “בכורות”, “twins”…"
              className="w-full rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 outline-none pl-12 pr-12 py-3.5 text-base text-slate-100 placeholder:text-slate-500" />
            {q && <button onClick={() => { setQ(''); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Clear search"><X className="w-4 h-4" /></button>}
          </div>
        </div>

        {/* ===== library by masechet ===== */}
        {!items ? (
          <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            {failed ? 'Could not load the library right now.' : q ? <>Nothing matches “{q}”.</> : 'No dafim yet.'}
          </div>
        ) : (
          <div className="space-y-10 mt-4">
            {groups.map(([book, rs]) => (
              <section key={book}>
                <div className="flex items-baseline gap-3 mb-4 border-b border-slate-800 pb-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">{book}</h2>
                  {rs[0].it.heRef && <span className="text-xl text-slate-400" lang="he" style={{ fontFamily: HE_FONT }}>{heBook(rs[0].it.heRef)}</span>}
                  <span className="ml-auto text-xs font-bold text-slate-500">{rs.length} {rs.length === 1 ? 'daf' : 'dafim'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rs.map(({ it, hit }) => {
                    const isToday = it.ref === today?.ref;
                    return (
                      <button key={it.ref} onClick={() => onOpen(it.ref)} className={`group text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${isToday ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 w-14 h-14 rounded-xl bg-slate-800 group-hover:bg-indigo-600 transition-colors flex flex-col items-center justify-center">
                            <span className="text-lg font-black leading-none" lang="he" style={{ fontFamily: HE_FONT }}>{it.heRef.split(' ').pop()}</span>
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-100 mt-0.5">daf {split(it.ref).n}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-slate-100">{it.ref}</p>
                              {isToday && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Today</span>}
                            </div>
                            <p className="mt-1 text-sm text-slate-400 leading-snug line-clamp-3">{hit ? <><Sparkles className="inline w-3.5 h-3.5 text-indigo-300 mr-1 -mt-0.5" />{hit}</> : it.preview[0]}</p>
                            {it.sugyot ? <p className="mt-2 text-[11px] font-bold text-slate-500 flex items-center gap-1"><BookOpen className="w-3 h-3" /> {it.sugyot} sugyot</p> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        <p className="mt-12 text-center text-xs text-slate-600">Each new daf is prepared at noon the day before it is learned, and then stays here for everyone.</p>
      </div>
    </div>
  );
}
