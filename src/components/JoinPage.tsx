import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { BookOpen, PlayCircle, ScrollText, Sparkles, ArrowRight, Check, CheckCheck, Play } from 'lucide-react';
import { db } from '../lib/firebase';
import { DAF_API } from '../lib/daf';

// /join - landing page for "join our WhatsApp community" ads. Standalone (no
// library download) so it opens instantly from an ad. The invite link is the
// one in the admin site settings; today's daf and its points come live from
// Super Daf.

const FALLBACK_URL = 'https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.49-8.41" /></svg>
);

type Today = { ref: string; heRef?: string; preview?: string[] };

// Real covers and series art from the library, resized into /public/join so
// the page stays fast for visitors arriving from an ad.
const COVERS = [
  ['book01', 'Zohar Hakadosh, Volume 1'], ['book05', 'Etz Chaim, Volume 1'], ['book08', 'Orchard of Tehillim'], ['book02', 'Zohar Hakadosh, Volume 13'],
  ['book06', 'Pardes Rimonim, Volume 1'], ['book10', 'Reshit Chochmah'], ['book03', 'Zohar Hakadosh, Volume 26'], ['book07', "Sha'ar HaKavanot"],
  ['book13', 'The Depths of Yonah'], ['book04', 'Zohar Hakadosh, Volume 36'], ['book09', 'Torah Ohr'], ['book12', 'Siddur Rabbenu HaAri'],
  ['book11', 'Likkutei Torah'], ['book14', 'Orchard of Esther'],
];
const SERIES = [
  { img: 'art-daf', name: 'AI Daf', count: 95 }, { img: 'art-tanach', name: 'AI Tanach', count: 83 }, { img: 'art-rambam', name: 'AI Rambam', count: 81 },
  { img: 'art-parasha', name: 'AI Parasha', count: 65 }, { img: 'art-zohar', name: 'AI Zohar', count: 40 }, { img: 'art-etz', name: 'AI Etz Chaim', count: 35 },
];

export default function JoinPage() {
  const [url, setUrl] = useState(FALLBACK_URL);
  const [today, setToday] = useState<Today | null>(null);

  useEffect(() => {
    document.title = 'Join AI Sefarim on WhatsApp - free Torah learning';
    getDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_'))
      .then((s) => { const u = s.exists() ? (s.data() as any).bannerUrl : null; if (typeof u === 'string' && u.startsWith('https://')) setUrl(u); })
      .catch(() => {});
    // Today's daf + its "we'll learn" points (both small, cached responses).
    Promise.all([fetch(`${DAF_API}/current`).then((r) => r.json()), fetch(`${DAF_API}/index`).then((r) => r.json())])
      .then(([cur, idx]) => {
        if (!cur?.ref) return;
        const meta = (idx?.items || []).find((i: any) => i.ref === cur.ref);
        setToday({ ref: cur.ref, heRef: meta?.heRef || cur.heRef, preview: meta?.preview });
      })
      .catch(() => {});
  }, []);

  const tiles = [
    { href: '/', icon: BookOpen, title: 'Sefarim', text: 'The full Zohar and 95+ sefarim to read and download', tone: 'from-amber-500 to-orange-600', glow: 'group-hover:shadow-amber-500/30' },
    { href: '/?tab=videos', icon: PlayCircle, title: 'Media', text: '500+ videos & podcasts: daf, Tanach, Rambam, Zohar', tone: 'from-rose-500 to-pink-600', glow: 'group-hover:shadow-rose-500/30' },
    { href: '/daf', icon: ScrollText, title: 'Daf Yomi', text: today ? `Today: ${today.ref}, explained sugya by sugya` : "Today's daf, explained sugya by sugya", tone: 'from-indigo-500 to-violet-600', glow: 'group-hover:shadow-indigo-500/30' },
    { href: '/chat', icon: Sparkles, title: 'Super Agent', text: 'Ask any Torah question, answered from the sources', tone: 'from-sky-500 to-cyan-600', glow: 'group-hover:shadow-sky-500/30' },
  ];

  const bubbles = [
    { kind: 'Daf Yomi', text: today ? `Today's Super Daf: ${today.ref}${today.preview?.[0] ? ` - ${today.preview[0]}` : ''}` : "Today's Super Daf is ready - sugya by sugya, with Rashi, Tosafot and the Rambam", time: '7:02 AM' },
    { kind: 'New sefer', text: 'Zohar Hakadosh, Volume 36: Balak II - now free to read and download', time: '12:15 PM' },
    { kind: 'Podcast', text: 'New AI Daf episode - listen on the way to shul', time: '6:40 PM' },
  ];

  const JoinButton = ({ big = false }: { big?: boolean }) => (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`jp-shine relative overflow-hidden inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black transition-all hover:-translate-y-0.5 shadow-[0_18px_50px_-15px_rgba(16,185,129,0.85)] ${big ? 'px-7 py-5 text-xl' : 'px-5 py-3.5 text-base'}`}>
      <WhatsAppIcon className={big ? 'w-7 h-7' : 'w-5 h-5'} /> Join on WhatsApp
    </a>
  );

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#070a18] text-slate-100 pb-28 sm:pb-10">
      <style>{`
        @keyframes jp-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes jp-drift { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(30px,-20px) scale(1.08) } }
        @keyframes jp-pop { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes jp-sheen { 0% { transform: translateX(-120%) skewX(-20deg) } 60%,100% { transform: translateX(260%) skewX(-20deg) } }
        @keyframes jp-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes jp-ring { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55) } 100% { box-shadow: 0 0 0 18px rgba(16,185,129,0) } }
        .jp-float { animation: jp-float 6s ease-in-out infinite }
        .jp-blob { animation: jp-drift 14s ease-in-out infinite }
        .jp-pop { opacity: 0; animation: jp-pop .55s cubic-bezier(.2,.8,.2,1) forwards }
        .jp-shine::after { content: ''; position: absolute; inset: 0 auto 0 0; width: 35%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent); animation: jp-sheen 3.2s ease-in-out infinite }
        .jp-ring { animation: jp-ring 1.8s ease-out infinite }
        .jp-marquee { animation: jp-marquee 60s linear infinite } .jp-shelf:hover .jp-marquee { animation-play-state: paused }
        @media (prefers-reduced-motion: reduce) { .jp-float, .jp-blob, .jp-shine::after, .jp-ring, .jp-marquee { animation: none } .jp-pop { opacity: 1; animation: none } }
      `}</style>

      {/* background glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="jp-blob absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-indigo-600/25 blur-[120px]" />
        <div className="jp-blob absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-emerald-500/15 blur-[120px]" style={{ animationDelay: '-5s' }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 pt-8 sm:pt-14">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-black tracking-tight text-slate-300 hover:text-white"><span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center"><BookOpen className="w-4 h-4 text-white" /></span>AI Sefarim</a>

        <div className="mt-8 sm:mt-12 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          {/* ===== left: pitch + join + the 4 buttons ===== */}
          <div>
            <p className="jp-pop inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              <span className="relative flex w-2 h-2"><span className="jp-ring absolute inset-0 rounded-full" /><span className="relative w-2 h-2 rounded-full bg-emerald-400" /></span>
              Free Torah community
            </p>
            <h1 className="jp-pop mt-5 text-[2.6rem] leading-[1.02] sm:text-6xl font-black tracking-tight" style={{ animationDelay: '.08s' }}>
              Torah learning,<br />straight to your <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">WhatsApp</span>.
            </h1>
            <p className="jp-pop mt-5 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-xl" style={{ animationDelay: '.16s' }}>
              New sefarim, daily video shiurim, podcast episodes and today's daf, shared with the AI Sefarim community the moment they're out.
            </p>

            <div className="jp-pop mt-8 max-w-md" style={{ animationDelay: '.24s' }}>
              <JoinButton big />
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Completely free</span>
                <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Leave anytime</span>
              </p>
            </div>

            {/* the 4 buttons */}
            <p className="jp-pop mt-10 text-xs font-black uppercase tracking-[0.18em] text-slate-500" style={{ animationDelay: '.3s' }}>Or start learning right now</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {tiles.map(({ href, icon: Icon, title, text, tone, glow }, i) => (
                <a key={title} href={href} className={`jp-pop group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] p-4 sm:p-5 transition-all hover:-translate-y-1 hover:border-white/20 shadow-xl shadow-black/20 ${glow}`} style={{ animationDelay: `${0.36 + i * 0.07}s` }}>
                  <span className={`flex w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${tone} items-center justify-center shadow-lg transition-transform group-hover:scale-110 group-hover:-rotate-3`}><Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></span>
                  <span className="mt-3 flex items-center gap-1.5 font-black text-base sm:text-lg">{title}<ArrowRight className="w-4 h-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" /></span>
                  <span className="mt-1 block text-[13px] sm:text-sm text-slate-400 leading-snug">{text}</span>
                </a>
              ))}
            </div>
          </div>

          {/* ===== right: phone preview ===== */}
          <div className="jp-pop relative mx-auto w-full max-w-[360px]" style={{ animationDelay: '.3s' }}>
            <div className="jp-float rounded-[2.6rem] border border-white/15 bg-[#0b141a] p-2.5 shadow-[0_40px_120px_-30px_rgba(16,185,129,0.45)]">
              <div className="rounded-[2.1rem] overflow-hidden bg-[#0b141a]">
                <div className="flex items-center gap-3 bg-[#1f2c34] px-4 py-3">
                  <span className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center"><BookOpen className="w-4 h-4 text-white" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">AI Sefarim</p>
                    <p className="text-[11px] text-emerald-300/80">Torah community</p>
                  </div>
                </div>
                <div className="space-y-2.5 px-3 py-4 min-h-[340px]" style={{ backgroundColor: '#0b141a', backgroundImage: 'radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
                  <p className="mx-auto w-fit rounded-md bg-[#1f2c34] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">A taste of what's shared</p>
                  {bubbles.map((b, i) => (
                    <div key={i} className="jp-pop max-w-[88%] rounded-xl rounded-tl-sm bg-[#1f2c34] px-3 py-2 shadow" style={{ animationDelay: `${0.7 + i * 0.35}s` }}>
                      <p className="text-[11px] font-black text-emerald-300">{b.kind}</p>
                      <p className="text-[13px] leading-snug text-slate-100">{b.text}</p>
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">{b.time}<CheckCheck className="w-3.5 h-3.5 text-sky-400" /></p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Super Daf showcase ===== */}
        <section className="mt-24 sm:mt-32">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">Super Daf</p>
              <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">The daf, finally clear.</h2>
              <p className="mt-4 text-lg text-slate-300 leading-relaxed">Every day's daf, sugya by sugya: the Gemara phrase by phrase, Rashi and Tosafot right where they comment, the Rambam with his commentators, and the halacha under the paragraph it comes from.</p>
              <ul className="mt-5 space-y-2 text-slate-300">
                {['3 points before each daf, 3 takeaways after', '"Catch me up" if you fall behind mid-shiur', 'Ask any question on the sugya', 'Works on phone, iPad and computer, even offline'].map((x) => (
                  <li key={x} className="flex gap-2.5"><Check className="w-5 h-5 shrink-0 text-indigo-300 mt-0.5" />{x}</li>
                ))}
              </ul>
              {today && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Today · <span className="text-slate-100">{today.ref}</span>{today.heRef ? <span className="ml-2 text-indigo-200 normal-case tracking-normal" lang="he" style={{ fontFamily: "'Frank Ruhl Libre', 'David', serif" }}>{today.heRef}</span> : null}</p>
                  {today.preview?.[0] && <p className="mt-1.5 text-sm text-slate-300 leading-snug">We'll learn: {today.preview[0]}</p>}
                </div>
              )}
              <a href="/daf" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3.5 font-black shadow-lg shadow-indigo-600/30 transition-all hover:gap-3">Open today's daf <ArrowRight className="w-5 h-5" /></a>
            </div>

            <div className="relative pb-10 sm:pb-14 pr-0 sm:pr-16">
              {/* laptop */}
              <div className="rounded-t-2xl border border-white/15 bg-[#1b1f2e] p-2 sm:p-2.5 shadow-[0_50px_120px_-30px_rgba(79,70,229,0.55)]">
                <img src="/join/daf-desktop.jpg" alt="Super Daf on a computer: the Gemara with inline Rashi on the left, numbered notes on the right" width={1800} height={1125} loading="lazy" decoding="async" className="block w-full rounded-lg" />
              </div>
              <div className="mx-auto h-3 sm:h-4 w-[106%] -ml-[3%] rounded-b-2xl bg-gradient-to-b from-[#2a2f42] to-[#151926] border border-t-0 border-white/10" />
              {/* phone */}
              <div className="jp-float absolute -bottom-2 right-0 w-[30%] min-w-[118px] max-w-[210px] rounded-[1.8rem] border border-white/20 bg-black p-1.5 shadow-2xl shadow-black/60">
                <img src="/join/daf-phone.jpg" alt="Super Daf on a phone" width={578} height={1100} loading="lazy" decoding="async" className="block w-full rounded-[1.4rem]" />
              </div>
            </div>
          </div>
        </section>

        {/* ===== book covers ===== */}
        <section className="mt-24 sm:mt-32">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Sefarim</p>
              <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">The whole Zohar. And then some.</h2>
              <p className="mt-3 text-lg text-slate-300">All 42 volumes of the Zohar, the Arizal, the Ramak, Chassidut and Tanach. 95+ sefarim, free to read and download.</p>
            </div>
            <a href="/" className="inline-flex items-center gap-2 font-black text-amber-300 hover:gap-3 transition-all">Browse the library <ArrowRight className="w-5 h-5" /></a>
          </div>
          <div className="jp-shelf relative mt-8 -mx-5 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)' }}>
            <div className="jp-marquee flex w-max gap-5 py-4 px-5">
              {[...COVERS, ...COVERS].map(([img, title], i) => (
                <a key={i} href="/" aria-hidden={i >= COVERS.length ? true : undefined} tabIndex={i >= COVERS.length ? -1 : undefined} className="group shrink-0 w-[130px] sm:w-[160px]">
                  <img src={`/join/${img}.jpg`} alt={title} loading="lazy" decoding="async" className="block w-full aspect-[2/3] object-cover rounded-lg shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-[-1.5deg]" />
                  <p className="mt-2 text-xs font-semibold text-slate-400 line-clamp-1">{title}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ===== series art ===== */}
        <section className="mt-24 sm:mt-32">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">Watch &amp; listen</p>
              <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">500+ shiurim, one tap away.</h2>
              <p className="mt-3 text-lg text-slate-300">Short, clear videos and podcasts on the daf, Tanach, the Rambam, the parasha and the Zohar.</p>
            </div>
            <a href="/?tab=videos" className="inline-flex items-center gap-2 font-black text-rose-300 hover:gap-3 transition-all">All videos &amp; podcasts <ArrowRight className="w-5 h-5" /></a>
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
            {SERIES.map(({ img, name, count }) => (
              <a key={name} href="/?tab=videos" className="group block">
                <span className="relative block overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-xl shadow-black/40">
                  <img src={`/join/${img}.jpg`} alt={`${name} series art`} loading="lazy" decoding="async" className="block w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute top-3 right-3 flex w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 text-slate-900 items-center justify-center opacity-0 scale-75 transition-all group-hover:opacity-100 group-hover:scale-100"><Play className="w-5 h-5 ml-0.5" fill="currentColor" /></span>
                </span>
                <span className="mt-2.5 flex items-baseline justify-between gap-2 px-0.5">
                  <span className="font-black text-sm sm:text-base">{name}</span>
                  <span className="text-xs sm:text-sm text-slate-400">{count} episodes</span>
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* ===== final call ===== */}
        <div className="mt-24 sm:mt-32 text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Learn something new every day.</h2>
          <p className="mt-3 text-slate-400">Join learners in the free AI Sefarim community.</p>
          <div className="mt-6 mx-auto max-w-sm"><JoinButton big /></div>
        </div>

        <p className="mt-14 text-center text-sm text-slate-500"><a href="/" className="font-bold text-slate-300 hover:text-white">aisefarim.com</a> · Free Torah learning for everyone</p>
      </div>

      {/* sticky join bar on phones */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#070a18]/90 backdrop-blur px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <JoinButton />
      </div>
    </div>
  );
}
