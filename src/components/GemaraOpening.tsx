import { useEffect, useRef } from 'react';

// A short "opening the Gemara" moment when a daf is opened from the Super Daf
// page: a leather cover with gold lettering swings open (right to left, like a
// sefer) onto a page laid out like a daf - Gemara in the middle, commentary on
// the sides - and then gives way to the reader. ~1.3s, tap to skip, never shown
// to people who prefer reduced motion.

const HE_FONT = "'Frank Ruhl Libre', 'David', serif";

// Deterministic "text lines" for the miniature daf: justified, so nearly
// every line runs full width and only a paragraph's last line is short.
const lines = (n: number, seed: number, min: number) =>
  Array.from({ length: n }, (_, i) => ((i * 7 + seed * 5) % 9 === 0 || i === n - 1 ? min + ((i * 23 + seed * 11) % (90 - min)) : 100));

export function GemaraOpening({ heRef, onDone }: { heRef: string; onDone: () => void }) {
  const parts = heRef.trim().split(/\s+/);
  const dafHe = parts.length > 1 ? parts.pop()! : '';
  const masechet = parts.join(' ');

  // One timer for the whole moment, however often the reader re-renders.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    // &openingAt=<ms> freezes the moment for previews/screenshots.
    const at = Number(new URLSearchParams(window.location.search).get('openingAt'));
    if (at > 0) {
      requestAnimationFrame(() => document.getAnimations().forEach((an) => { if (/^go-/.test((an as CSSAnimation).animationName || '')) { an.pause(); an.currentTime = at; } }));
      return;
    }
    const t = window.setTimeout(() => done.current(), 1450);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="go-wrap fixed inset-0 z-[80] flex items-center justify-center bg-[#07080f] cursor-pointer" onClick={onDone} role="presentation" aria-hidden="true">
      <style>{`
        .go-wrap { animation: go-fade .4s ease 1.05s forwards }
        .go-book { perspective: 1800px; animation: go-in .3s ease-out both, go-zoom .45s cubic-bezier(.5,0,.75,0) .95s forwards }
        .go-cover { transform-origin: right center; transform-style: preserve-3d; animation: go-open .75s cubic-bezier(.55,.05,.3,1) .22s forwards }
        @keyframes go-in { from { opacity: 0; transform: scale(.94) translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes go-open { to { transform: rotateY(168deg) } }
        @keyframes go-zoom { to { transform: scale(1.5); opacity: 0 } }
        @keyframes go-fade { to { opacity: 0; visibility: hidden } }
      `}</style>

      <div className="go-book relative" style={{ width: 'min(74vw, 330px)', aspectRatio: '3 / 4' }}>
        {/* the page underneath: a miniature daf */}
        <div className="absolute inset-0 rounded-[6px] overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" style={{ background: 'linear-gradient(270deg, #e6dcc3 0%, #f4ecd8 9%, #f6efdd 100%)' }}>
          <div className="absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-black/15 to-transparent" />
          <div dir="rtl" className="flex items-baseline justify-between px-[9%] pt-[7%] text-[#3b2a17]" style={{ fontFamily: HE_FONT }}>
            <span className="text-[13px] sm:text-[15px] font-bold">{masechet}</span>
            <span className="text-[13px] sm:text-[15px] font-bold">דף {dafHe}</span>
          </div>
          <div className="mx-[9%] mt-[3%] h-px bg-[#3b2a17]/30" />
          {/* tzurat hadaf: Gemara in the middle, Rashi and Tosafot around it, then wrapping underneath */}
          <div dir="rtl" className="mx-[9%] mt-[5%] grid gap-x-[5%]" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
            {[{ n: 25, s: 1, m: 35, h: 2 }, { n: 17, s: 2, m: 40, h: 3.5 }, { n: 25, s: 3, m: 35, h: 2 }].map((col, c) => (
              <div key={c} className="flex flex-col gap-[5px]">
                {c === 1 && <div className="mb-1 self-start rounded-[2px] bg-[#2a1d10] px-1.5 text-[13px] sm:text-[15px] font-bold leading-snug text-[#f4ecd8]" style={{ fontFamily: HE_FONT }}>גמ׳</div>}
                {lines(col.n, col.s, col.m).map((w, i) => <div key={i} className="rounded-full bg-[#4a3520]/25 ml-auto" style={{ width: `${w}%`, height: col.h }} />)}
              </div>
            ))}
          </div>
          <div dir="rtl" className="mx-[9%] mt-[4%] grid grid-cols-2 gap-x-[5%]">
            {[4, 5].map((seed) => (
              <div key={seed} className="flex flex-col gap-[5px]">
                {lines(17, seed, 35).map((w, i) => <div key={i} className="rounded-full bg-[#4a3520]/20 ml-auto" style={{ width: `${w}%`, height: 2 }} />)}
              </div>
            ))}
          </div>
        </div>

        {/* the cover */}
        <div className="go-cover absolute inset-0 rounded-[6px]" style={{ backfaceVisibility: 'hidden' }}>
          <div className="absolute inset-0 rounded-[6px] overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 30% 20%, #5a2a1f 0%, #3a1912 55%, #24100b 100%)', boxShadow: 'inset -10px 0 18px rgba(0,0,0,0.45), 0 30px 80px -20px rgba(0,0,0,0.9)' }}>
            <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/40 to-transparent" />
            <div className="absolute inset-[7%] rounded-[3px] border-2" style={{ borderColor: '#c9a24a' }} />
            <div className="absolute inset-[9.5%] rounded-[2px] border" style={{ borderColor: 'rgba(201,162,74,0.55)' }} />
            <div dir="rtl" className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center" style={{ fontFamily: HE_FONT, color: '#dcb860', textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}>
              <span className="text-[13px] sm:text-[15px] tracking-[0.15em]">תלמוד בבלי</span>
              <span className="w-10 h-px" style={{ background: '#c9a24a' }} />
              <span className="text-[30px] sm:text-[38px] font-bold leading-none">מסכת</span>
              <span className="text-[34px] sm:text-[44px] font-bold leading-none">{masechet}</span>
              <span className="w-10 h-px" style={{ background: '#c9a24a' }} />
              <span className="text-[12px] sm:text-[13px] tracking-[0.2em] opacity-80">SUPER DAF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// The Daf page leaves a note just before opening a daf; the reader plays the
// opening only for that daf, only right after the click.
export function takeOpeningFor(ref: string | null | undefined): string | null {
  try {
    // ?opening=<Hebrew name> plays it on demand (handy for demos and previews).
    const forced = new URLSearchParams(window.location.search).get('opening');
    if (forced) return forced;
    const raw = sessionStorage.getItem('sd_open');
    sessionStorage.removeItem('sd_open');
    if (!raw || !ref) return null;
    const o = JSON.parse(raw);
    if (o.ref !== ref || Date.now() - o.at > 8000 || !o.heRef) return null;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
    return o.heRef as string;
  } catch {
    return null;
  }
}

export function noteOpening(ref: string, heRef?: string) {
  try { if (heRef) sessionStorage.setItem('sd_open', JSON.stringify({ ref, heRef, at: Date.now() })); } catch { /* ignore */ }
}
