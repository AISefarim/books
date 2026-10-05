import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { BookOpen, ArrowRight, Check, CheckCheck, Play, Sparkles, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { DAF_API } from '../lib/daf';

// /join - landing page for "join our WhatsApp community" ads. Standalone (no
// library download) so it opens instantly from an ad. The invite link is the
// one in the admin site settings; today's daf and its points come live from
// Super Daf. Every picture is a link into that part of the site.

const FALLBACK_URL = 'https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.49-8.41" /></svg>
);

type Today = { ref: string; heRef?: string; preview?: string[] };
type Teaser = {
  ref: string; heRef?: string; headline?: string | null;
  units: { he: string; en: string }[];
  comment?: { title: string; gist: string } | null;
  halacha?: { issue?: string; who: string; text: string; ref?: string } | null;
};

// Shown instantly (and if the live call fails); replaced by today's daf
// from /daf/teaser as soon as it loads.
const FALLBACK_TEASER: Teaser = {
  ref: 'Bekhorot 17', heRef: 'בכורות י״ז',
  headline: "Resolving Rabban Shimon ben Gamliel's challenge to Rav Huna",
  units: [
    { he: 'הַיְינוּ דַּאֲמַר לֵיהּ רַבָּן שִׁמְעוֹן בֶּן גַּמְלִיאֵל:', en: '**this is what Rabban Shimon ben Gamliel said to him:**' },
    { he: 'אֲפִילּוּ עַד עֲשָׂרָה דּוֹרוֹת', en: '**Even until ten generations,**' },
    { he: 'פְּטוּרִין.', en: 'the offspring **are exempt.**' },
  ],
  comment: { title: 'Rashi', gist: 'Rashi explains why Rabban Shimon ben Gamliel said "up to ten generations" (meaning indefinitely) rather than only exempting grandchildren.' },
  halacha: { who: 'Rambam', text: "An offspring resembling another species is exempt from bekhorah unless it possesses some of its mother's physical characteristics.", ref: 'Mishneh Torah, Firstlings 2:6' },
};

// "Rashi explains why..." under a "Rashi" label -> "Explains why..."
const cleanGist = (title: string, gist: string) => {
  const g = gist.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`), '');
  return g.charAt(0).toUpperCase() + g.slice(1);
};

// **bold** = the Gemara's own words, plain = the explanation (as in Super Daf).
const Marked = ({ text }: { text: string }) => (
  <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') ? <strong key={i} className="font-bold text-stone-900">{part.slice(2, -2)}</strong> : <span key={i} className="text-stone-500">{part}</span>)}</>
);

// Real covers and series art from the library, resized into /public/join so
// the page stays fast for visitors arriving from an ad. Each links to the
// book itself (/b/<id>) or the series (/c/<series>/videos).
const COVERS: { img: string; title: string; id: string }[] = [
  { img: 'book01', title: 'Zohar Hakadosh, Volume 1', id: 'doALp2AGDWcZ6YqI3mlX' },
  { img: 'book05', title: 'Etz Chaim, Volume 1', id: 'Ejjp4NZFiiapfktSLoKh' },
  { img: 'book08', title: 'Orchard of Tehillim', id: 'omOeTg9T1qr8I0Mqs7ba' },
  { img: 'book02', title: 'Zohar Hakadosh, Volume 13', id: 'DunFAjqGpZGSIokehIcy' },
  { img: 'book06', title: 'Pardes Rimonim, Volume 1', id: '1wEBGckfoMZVQMG9F8JW' },
  { img: 'book10', title: 'Reshit Chochmah', id: '1UQF1atazYd9CiA3NPAx' },
  { img: 'book03', title: 'Zohar Hakadosh, Volume 26', id: 'HzkUiEWxvP9RmEr5z6eE' },
  { img: 'book07', title: "Sha'ar HaKavanot", id: 'RLBItlwQaodLDNvftsbE' },
  { img: 'book13', title: 'The Depths of Yonah', id: 'RPq6PCYtwcXbyWiMTibq' },
  { img: 'book04', title: 'Zohar Hakadosh, Volume 36', id: '0MGYdnUkNyQ8FerFQz5S' },
  { img: 'book09', title: 'Torah Ohr', id: 'Ep52OT2J88O1BC7ahSfi' },
  { img: 'book12', title: 'Siddur Rabbenu HaAri', id: '81BXcnIC9ravThR9g5rt' },
  { img: 'book11', title: 'Likkutei Torah', id: 'leZ1iut3tAsLxjYTVkQD' },
  { img: 'book14', title: 'Orchard of Esther', id: 'oKRyG6Xux0GrY9ep5jws' },
];
const SERIES = [
  { img: 'art-daf', name: 'AI Daf', count: 95 }, { img: 'art-tanach', name: 'AI Tanach', count: 83 }, { img: 'art-rambam', name: 'AI Rambam', count: 81 },
  { img: 'art-parasha', name: 'AI Parasha', count: 65 }, { img: 'art-zohar', name: 'AI Zohar', count: 40 }, { img: 'art-etz', name: 'AI Etz Chaim', count: 35 },
];
const seriesHref = (name: string) => `/c/${encodeURIComponent(name)}/videos`;
const HE_FONT = "'Frank Ruhl Libre', 'David', serif";

export default function JoinPage() {
  const [url, setUrl] = useState(FALLBACK_URL);
  const [today, setToday] = useState<Today | null>(null);
  const [teaser, setTeaser] = useState<Teaser>(FALLBACK_TEASER);

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
        return fetch(`${DAF_API}/teaser?ref=${encodeURIComponent(cur.ref)}`).then((r) => r.json()).then((t) => { if (t && t.available !== false && t.units?.length) setTeaser(t); });
      })
      .catch(() => {});
  }, []);

  const bubbles = [
    { kind: 'Daf Yomi', text: today ? `Today's Super Daf: ${today.ref}${today.preview?.[0] ? ` - ${today.preview[0]}` : ''}` : "Today's Super Daf is ready - sugya by sugya, with Rashi, Tosafot and the Rambam", time: '7:02 AM' },
    { kind: 'New sefer', text: 'Zohar Hakadosh, Volume 36: Balak II - now free to read and download', time: '12:15 PM' },
    { kind: 'Podcast', text: 'New AI Daf episode - listen on the way to shul', time: '6:40 PM' },
  ];

  const JoinButton = ({ big = false }: { big?: boolean }) => (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`jp-shine relative overflow-hidden inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black transition-all hover:-translate-y-0.5 shadow-[0_18px_50px_-15px_rgba(16,185,129,0.85)] ${big ? 'px-7 py-4 sm:py-5 text-lg sm:text-xl' : 'px-5 py-3.5 text-base'}`}>
      <WhatsAppIcon className={big ? 'w-7 h-7' : 'w-5 h-5'} /> Join on WhatsApp
    </a>
  );

  const card = 'group relative block overflow-hidden rounded-3xl ring-1 ring-white/10 hover:ring-white/25 bg-[#10142a] shadow-xl shadow-black/40 transition-all duration-300 hover:-translate-y-1';

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#070a18] text-slate-100 pb-28 sm:pb-10">
      <style>{`
        @keyframes jp-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes jp-drift { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(30px,-20px) scale(1.08) } }
        @keyframes jp-pop { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes jp-sheen { 0% { transform: translateX(-120%) skewX(-20deg) } 60%,100% { transform: translateX(260%) skewX(-20deg) } }
        @keyframes jp-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes jp-ring { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55) } 100% { box-shadow: 0 0 0 18px rgba(16,185,129,0) } }
        @keyframes jp-pan { 0%,100% { object-position: 50% 0% } 50% { object-position: 50% 38% } }
        .jp-float { animation: jp-float 6s ease-in-out infinite }
        .jp-blob { animation: jp-drift 14s ease-in-out infinite }
        .jp-pop { opacity: 0; animation: jp-pop .55s cubic-bezier(.2,.8,.2,1) forwards }
        .jp-shine::after { content: ''; position: absolute; inset: 0 auto 0 0; width: 35%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent); animation: jp-sheen 3.2s ease-in-out infinite }
        .jp-ring { animation: jp-ring 1.8s ease-out infinite }
        .jp-pan { animation: jp-pan 16s ease-in-out infinite }
        .jp-marquee { animation: jp-marquee 60s linear infinite } .jp-shelf:hover .jp-marquee { animation-play-state: paused }
        .jp-fan > img { transition: transform .4s cubic-bezier(.2,.8,.2,1) }
        .group:hover .jp-fan > img:nth-child(1) { transform: translate(-100%, -44%) rotate(-17deg) !important }
        .group:hover .jp-fan > img:nth-child(2) { transform: translate(0%, -44%) rotate(17deg) !important }
        .group:hover .jp-fan > img:nth-child(3) { transform: translate(-50%, -58%) !important }
        @media (prefers-reduced-motion: reduce) { .jp-float, .jp-blob, .jp-shine::after, .jp-ring, .jp-marquee, .jp-pan { animation: none } .jp-pop { opacity: 1; animation: none } }
      `}</style>

      {/* stays on screen while scrolling */}
      <div className="fixed inset-x-0 top-0 z-30 border-b border-emerald-300/20 bg-gradient-to-r from-emerald-700/95 via-emerald-600/95 to-teal-700/95 backdrop-blur shadow-lg shadow-black/30">
        <p className="mx-auto max-w-6xl px-4 py-2 sm:py-2.5 text-center text-[13px] sm:text-base font-black tracking-tight text-white">
          Everything is <span lang="he" dir="rtl" className="ml-1 text-[1.15em] font-bold text-emerald-50" style={{ fontFamily: HE_FONT }}>לְשֵׁם שָׁמַיִם</span>. Everything is free.
        </p>
      </div>

      {/* background glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="jp-blob absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-indigo-600/25 blur-[120px]" />
        <div className="jp-blob absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-emerald-500/15 blur-[120px]" style={{ animationDelay: '-5s' }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 pt-16 sm:pt-20">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-black tracking-tight text-slate-300 hover:text-white"><span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center"><BookOpen className="w-4 h-4 text-white" /></span>AI Sefarim</a>

        <div className="mt-6 sm:mt-10 grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-12 items-center">
          {/* ===== pitch + join ===== */}
          <div>
            <p className="jp-pop inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              <span className="relative flex w-2 h-2"><span className="jp-ring absolute inset-0 rounded-full" /><span className="relative w-2 h-2 rounded-full bg-emerald-400" /></span>
              100% free · Torah community
            </p>
            <h1 className="jp-pop mt-4 text-[2.4rem] leading-[1.02] sm:text-6xl font-black tracking-tight" style={{ animationDelay: '.08s' }}>
              Torah learning, straight to your <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">WhatsApp</span>.
            </h1>
            <p className="jp-pop mt-4 text-base sm:text-xl text-slate-300 leading-relaxed max-w-xl" style={{ animationDelay: '.16s' }}>
              New sefarim, daily video shiurim, podcast episodes and today's daf, shared with the AI Sefarim community the moment they're out.
            </p>
            <div className="jp-pop mt-6 sm:mt-8 max-w-md" style={{ animationDelay: '.24s' }}>
              <JoinButton big />
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Free forever</span>
                <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> No subscriptions</span>
                <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> No ads</span>
              </p>
            </div>
          </div>

          {/* ===== the juicy stuff, right up top: every card is a way in ===== */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Super Daf: a live mini version of the reader, with today's real text */}
            <a href="/daf" className={`${card} jp-pop col-span-2 !bg-[#f7f2e7] text-stone-900`} style={{ animationDelay: '.2s' }}>
              <div className="flex items-center gap-2 bg-[#0c1022] px-3.5 py-2 text-slate-100">
                <span className="flex gap-1.5" aria-hidden><span className="w-2.5 h-2.5 rounded-full bg-white/20" /><span className="w-2.5 h-2.5 rounded-full bg-white/20" /><span className="w-2.5 h-2.5 rounded-full bg-white/20" /></span>
                <span className="mx-auto text-xs sm:text-sm font-black truncate">{teaser.heRef ? <span lang="he" className="mr-2 text-indigo-200" style={{ fontFamily: HE_FONT }}>{teaser.heRef}</span> : null}{teaser.ref}</span>
                <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Free</span>
              </div>
              <div className="px-3.5 sm:px-5 pt-3 pb-3.5">
                {teaser.headline && <p className="text-center text-[12px] sm:text-[13px] font-black text-indigo-700 truncate">› {teaser.headline}</p>}
                <div className="mt-2 rounded-xl border border-[#e3d8c1] overflow-hidden bg-white/50">
                  {teaser.units.slice(0, 3).map((u, i) => (
                    <div key={i}>
                      <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-x-3 items-baseline px-3 py-1.5 ${i % 2 ? 'bg-black/[0.025]' : ''}`}>
                        <p lang="he" dir="rtl" className="text-right text-[15px] sm:text-[17px] leading-snug text-stone-900" style={{ fontFamily: HE_FONT }}>{u.he}</p>
                        <p className="text-[12.5px] sm:text-[14px] leading-snug" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}><Marked text={u.en} /></p>
                      </div>
                      {i === 0 && teaser.comment && (
                        <div className="mx-2 mb-1.5 rounded-lg bg-[#efe6d3] px-2.5 py-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-stone-700"><p className="line-clamp-2"><span className="font-black text-indigo-700 mr-1">{teaser.comment.title}</span>{cleanGist(teaser.comment.title, teaser.comment.gist)}</p></div>
                      )}
                    </div>
                  ))}
                </div>
                {teaser.halacha && (
                  <div className="mt-2 rounded-lg border-l-4 border-amber-500 bg-amber-100/70 px-2.5 py-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-stone-800"><p className="line-clamp-2"><span className="font-black text-amber-800 mr-1">Halacha · {teaser.halacha.who}</span>{teaser.halacha.text}</p></div>
                )}
                <p className="mt-2.5 flex items-center justify-between gap-2 text-[12px] sm:text-sm font-black text-indigo-700">
                  <span>Super Daf{today?.ref === teaser.ref ? " · today's daf" : ''}, sugya by sugya</span>
                  <span className="inline-flex items-center gap-1">Open <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></span>
                </p>
              </div>
            </a>

            {/* Sefarim: a fan of real covers */}
            <a href="/" className={`${card} jp-pop h-[180px] sm:h-[200px]`} style={{ animationDelay: '.28s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-transparent" />
              <div className="jp-fan absolute inset-x-0 top-0 h-[64%]">
                <img src="/join/book05.jpg" alt="" className="absolute left-1/2 top-1/2 w-[34%] rounded-md shadow-xl ring-1 ring-white/10" style={{ transform: 'translate(-82%, -46%) rotate(-11deg)' }} />
                <img src="/join/book08.jpg" alt="" className="absolute left-1/2 top-1/2 w-[34%] rounded-md shadow-xl ring-1 ring-white/10" style={{ transform: 'translate(-18%, -46%) rotate(11deg)' }} />
                <img src="/join/book01.jpg" alt="Zohar Hakadosh" className="absolute left-1/2 top-1/2 z-10 w-[38%] rounded-md shadow-2xl ring-1 ring-white/20" style={{ transform: 'translate(-50%, -50%)' }} />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Sefarim</p>
                <p className="mt-0.5 font-black leading-tight">The Zohar + 95 more</p>
              </div>
            </a>

            {/* Media: a mosaic of series art */}
            <a href="/?tab=videos" className={`${card} jp-pop h-[180px] sm:h-[200px]`} style={{ animationDelay: '.34s' }}>
              <div className="absolute inset-x-0 top-0 grid grid-cols-2 grid-rows-2 gap-0.5 h-[64%]">
                {['art-daf', 'art-zohar', 'art-tanach', 'art-etz'].map((a) => <img key={a} src={`/join/${a}.jpg`} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />)}
              </div>
              <span className="absolute left-1/2 top-[32%] -translate-x-1/2 -translate-y-1/2 flex w-11 h-11 rounded-full bg-white/95 text-slate-900 items-center justify-center shadow-xl transition-transform group-hover:scale-110"><Play className="w-5 h-5 ml-0.5" fill="currentColor" /></span>
              <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-300">Media</p>
                <p className="mt-0.5 font-black leading-tight">500+ videos &amp; podcasts</p>
              </div>
            </a>

            {/* Super Agent */}
            <a href="/chat" className={`${card} jp-pop col-span-2 p-4 sm:p-5`} style={{ animationDelay: '.4s' }}>
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/15 via-transparent to-violet-500/10" />
              <div className="relative flex items-center gap-3 sm:gap-4">
                <span className="shrink-0 flex w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 items-center justify-center shadow-lg"><Sparkles className="w-5 h-5 text-white" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-300">Super Agent</p>
                  <p className="mt-1 flex items-center gap-2 rounded-xl bg-white/[0.06] ring-1 ring-white/10 px-3 py-2 text-sm text-slate-400"><Search className="w-4 h-4 shrink-0" /><span className="truncate">Ask any Torah question, answered from the sources…</span></p>
                </div>
                <ArrowRight className="hidden sm:block w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </div>
            </a>
          </div>
        </div>

        {/* ===== Super Daf showcase ===== */}
        <section className="mt-24 sm:mt-28">
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
              {today?.preview?.length ? (
                <a href="/daf" className="mt-6 block rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] p-4 transition-colors">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Today · <span className="text-slate-100">{today.ref}</span></p>
                  <p className="mt-1.5 text-sm text-slate-300 leading-snug">We'll learn: {today.preview[0]}</p>
                </a>
              ) : null}
              <a href="/daf" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3.5 font-black shadow-lg shadow-indigo-600/30 transition-all hover:gap-3">Open today's daf <ArrowRight className="w-5 h-5" /></a>
            </div>
            <a href="/daf" className="group relative block pb-10 sm:pb-14 pr-0 sm:pr-16" aria-label="Open Super Daf">
              <div className="rounded-t-2xl border border-white/15 bg-[#1b1f2e] p-2 sm:p-2.5 shadow-[0_50px_120px_-30px_rgba(79,70,229,0.55)] transition-transform duration-500 group-hover:-translate-y-1">
                <img src="/join/daf-desktop.jpg" alt="Super Daf on a computer: the Gemara with inline Rashi on the left, numbered notes on the right" width={1800} height={1125} loading="lazy" decoding="async" className="block w-full rounded-lg" />
              </div>
              <div className="mx-auto h-3 sm:h-4 w-[106%] -ml-[3%] rounded-b-2xl bg-gradient-to-b from-[#2a2f42] to-[#151926] border border-t-0 border-white/10" />
              <div className="jp-float absolute -bottom-2 right-0 w-[30%] min-w-[118px] max-w-[210px] rounded-[1.8rem] border border-white/20 bg-black p-1.5 shadow-2xl shadow-black/60">
                <img src="/join/daf-phone.jpg" alt="Super Daf on a phone" width={578} height={1100} loading="lazy" decoding="async" className="block w-full rounded-[1.4rem]" />
              </div>
            </a>
          </div>
        </section>

        {/* ===== book covers ===== */}
        <section className="mt-24 sm:mt-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Sefarim</p>
              <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">The whole Zohar. And then some.</h2>
              <p className="mt-3 text-lg text-slate-300">All 42 volumes of the Zohar, the Arizal, the Ramak, Chassidut and Tanach. 95+ sefarim, free to read and download. Tap any cover to open it.</p>
            </div>
            <a href="/" className="inline-flex items-center gap-2 font-black text-amber-300 hover:gap-3 transition-all">Browse the library <ArrowRight className="w-5 h-5" /></a>
          </div>
          <div className="jp-shelf relative mt-8 -mx-5 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)' }}>
            <div className="jp-marquee flex w-max gap-5 py-4 px-5">
              {[...COVERS, ...COVERS].map(({ img, title, id }, i) => (
                <a key={i} href={`/b/${id}`} aria-hidden={i >= COVERS.length ? true : undefined} tabIndex={i >= COVERS.length ? -1 : undefined} className="group shrink-0 w-[130px] sm:w-[160px]">
                  <img src={`/join/${img}.jpg`} alt={title} loading="lazy" decoding="async" className="block w-full aspect-[2/3] object-cover rounded-lg shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-[-1.5deg]" />
                  <p className="mt-2 text-xs font-semibold text-slate-400 group-hover:text-slate-200 line-clamp-1">{title}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ===== series art ===== */}
        <section className="mt-24 sm:mt-28">
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
              <a key={name} href={seriesHref(name)} className="group block">
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

        {/* ===== what lands in your WhatsApp + final call ===== */}
        <section className="mt-24 sm:mt-28 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]">Learn something new every day.</h2>
            <p className="mt-4 text-lg text-slate-300">Join the free AI Sefarim community on WhatsApp. New sefarim, shiurim and today's daf, right on your phone. Free now, free forever.</p>
            <div className="mt-7 mx-auto lg:mx-0 max-w-sm"><JoinButton big /></div>
          </div>
          <div className="relative mx-auto w-full max-w-[360px]">
            <div className="jp-float rounded-[2.6rem] border border-white/15 bg-[#0b141a] p-2.5 shadow-[0_40px_120px_-30px_rgba(16,185,129,0.45)]">
              <div className="rounded-[2.1rem] overflow-hidden bg-[#0b141a]">
                <div className="flex items-center gap-3 bg-[#1f2c34] px-4 py-3">
                  <span className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center"><BookOpen className="w-4 h-4 text-white" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">AI Sefarim</p>
                    <p className="text-[11px] text-emerald-300/80">Torah community</p>
                  </div>
                </div>
                <div className="space-y-2.5 px-3 py-4" style={{ backgroundColor: '#0b141a', backgroundImage: 'radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
                  <p className="mx-auto w-fit rounded-md bg-[#1f2c34] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">A taste of what's shared</p>
                  {bubbles.map((b, i) => (
                    <div key={i} className="max-w-[88%] rounded-xl rounded-tl-sm bg-[#1f2c34] px-3 py-2 shadow">
                      <p className="text-[11px] font-black text-emerald-300">{b.kind}</p>
                      <p className="text-[13px] leading-snug text-slate-100">{b.text}</p>
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">{b.time}<CheckCheck className="w-3.5 h-3.5 text-sky-400" /></p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-16 text-center text-sm text-slate-500"><a href="/" className="font-bold text-slate-300 hover:text-white">aisefarim.com</a> · Free Torah learning for everyone</p>
      </div>

      {/* sticky join bar on phones */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#070a18]/90 backdrop-blur px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <JoinButton />
      </div>
    </div>
  );
}
