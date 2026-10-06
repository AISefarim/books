import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

// A short guided tour of the Super Daf reader: each step lights up one part
// of the screen with a plain explanation. Shown once per device; "Show me
// around" in the reading settings replays it. Steps whose target isn't on
// screen (e.g. no Rashi on the first paragraph) are skipped.

export const TOUR_KEY = 'super_daf_tour_seen_v1';

type Step = { find: () => Element | null; title: string; body: string };

const inView = (sel: string) => () => {
  const all = Array.from(document.querySelectorAll(sel));
  return all.find((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > 60 && r.top < window.innerHeight - 60; }) || null;
};

const STEPS: Step[] = [
  { find: () => null, title: 'Welcome to Super Daf', body: 'The daily daf, laid out sugya by sugya, with the commentaries, the Rambam and halacha woven in. Here is a 30-second look around.' },
  { find: inView('.sd .sd-para'), title: 'The Gemara', body: 'Hebrew and English side by side. Bold is the Gemara’s own words; lighter text is the explanation. Tap any paragraph to open its notes.' },
  { find: inView('.sd .sd-blurb'), title: 'Rashi and Tosafot', body: 'Explained in a line, right where they comment. Tap “words” to read the original.' },
  { find: () => document.querySelector('.sd .sd-lower'), title: 'The notes', body: 'Numbered notes from the commentaries, the Rambam, halacha, the big picture, disputes, sources - and Ask, for any question. Drag the divider to give the notes more or less room.' },
  { find: () => document.querySelector('.sd [aria-label="Our Mishnah"]'), title: 'Our Mishnah', body: 'Forgot the Mishnah this Gemara is discussing? Tap here and it opens beside the daf - even if it began a few dapim back.' },
  { find: () => { const n = document.querySelectorAll('.sd nav'); return n[n.length - 1] || null; }, title: 'Tools', body: '“Catch me up” on everything so far - instantly, with a deeper version a tap away - save bookmarks, ask a question, and listen to the shiur.' },
  { find: () => document.querySelector('.sd header'), title: 'Up top', body: 'Move to the previous or next daf, browse all dapim, download this daf for offline, and change text size or switch to dark mode (the “T”).' },
];

export function ReaderTour({ onClose }: { onClose: () => void }) {
  // ?tour=N opens the tour at step N (1-based) - handy for showing someone one part.
  const [i, setI] = useState(() => { const n = Number(new URLSearchParams(window.location.search).get('tour')); return n >= 1 && n <= STEPS.length ? n - 1 : 0; });
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];

  const measure = useCallback(() => {
    const el = step.find();
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Skip steps with nothing to point at (except the welcome card) - but only
  // once the daf is on screen, so a slow load doesn't skip everything.
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    const loaded = !!document.querySelector('.sd .sd-para');
    if (loaded && i > 0 && !step.find()) { setI((x) => Math.min(x + 1, STEPS.length - 1)); return; }
    measure();
  }, [i, step, measure, tick]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    const t = window.setInterval(() => setTick((n) => n + 1), 400); // follows the page as it loads and shifts
    return () => { window.removeEventListener('resize', measure); window.clearInterval(t); };
  }, [measure]);

  const finish = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ } onClose(); };
  const last = i === STEPS.length - 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, STEPS.length - 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Card placement: below the highlight if there's room, else above, else centered.
  const W = Math.min(360, window.innerWidth - 24);
  const pad = 8;
  let cardStyle: React.CSSProperties = { left: (window.innerWidth - W) / 2, top: window.innerHeight / 2 - 110, width: W };
  if (rect) {
    const left = Math.max(12, Math.min(window.innerWidth - W - 12, rect.left + rect.width / 2 - W / 2));
    const below = rect.bottom + 14, above = rect.top - 14;
    if (window.innerHeight - below > 220) cardStyle = { left, top: below, width: W };
    else if (above > 220) cardStyle = { left, bottom: window.innerHeight - above, width: W };
    else cardStyle = { left, top: Math.max(12, window.innerHeight / 2 - 110), width: W };
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-label={`Tour: ${step.title}`}>
      {/* the dimmed screen with a lit window over the current part */}
      {rect ? (
        <div className="absolute rounded-2xl transition-all duration-300 ease-out pointer-events-none" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(5,7,15,0.72)', outline: '2px solid rgba(165,180,252,0.85)' }} />
      ) : (
        <div className="absolute inset-0 bg-[#05070f]/75" />
      )}
      <div className="absolute inset-0" onClick={finish} />

      <div className="absolute rounded-3xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl p-5 transition-all duration-300 ease-out" style={cardStyle}>
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-300">{i + 1} of {STEPS.length}</p>
          <button onClick={finish} className="-mt-1 -mr-1 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close the tour"><X className="w-4 h-4" /></button>
        </div>
        <h3 className="mt-1 text-lg font-black">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex gap-1.5" aria-hidden="true">{STEPS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-indigo-400' : 'w-1.5 bg-slate-600'}`} />)}</div>
          <span className="flex-1" />
          {i > 0 && <button onClick={() => setI(i - 1)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>}
          {last
            ? <button onClick={finish} className="rounded-full bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-black">Start learning</button>
            : <button onClick={() => setI(i + 1)} className="inline-flex items-center gap-1 rounded-full bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-black">{i === 0 ? 'Show me' : 'Next'} <ArrowRight className="w-3.5 h-3.5" /></button>}
        </div>
        {i === 0 && <button onClick={finish} className="mt-3 text-xs font-bold text-slate-500 hover:text-slate-300">Skip the tour</button>}
      </div>
    </div>
  );
}
