import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Layers, Landmark, MessageSquareText, Sparkles } from 'lucide-react';
import { DAF_API } from '../lib/daf';

// Sits at the very top of the Sefarim tab: today's Super Daf, one tap away.
export function SuperDafHero({ onOpen }: { onOpen: () => void }) {
  const [current, setCurrent] = useState<{ ref: string; date: string } | null>(null);

  useEffect(() => {
    fetch(`${DAF_API}/current`).then((r) => r.json()).then((d) => { if (d && d.ref) setCurrent({ ref: d.ref, date: d.date }); }).catch(() => {});
  }, []);

  const dateLabel = current?.date ? new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  return (
    <section className="mb-8 sm:mb-10">
      <button
        onClick={onOpen}
        className="group relative w-full text-left overflow-hidden rounded-[2rem] border border-indigo-400/30 bg-slate-900 shadow-[0_20px_60px_-25px_rgba(99,102,241,0.55)] hover:border-indigo-300/50 transition-all"
      >
        {/* parchment edge + glow */}
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#f5efe3]/10 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none animate-drift" />
        <div className="absolute -bottom-28 right-10 w-80 h-80 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 border border-indigo-400/30 px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-indigo-200">
              <Sparkles className="w-3.5 h-3.5" /> Super Daf · Daf Yomi
            </div>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter text-slate-50 leading-[1.05]">
              {current ? current.ref : 'Today’s daf'}
              <span className="block text-indigo-300 text-lg sm:text-xl font-bold tracking-tight mt-1">{dateLabel ? `for ${dateLabel}` : 'ready every evening for the next day'}</span>
            </h2>
            <p className="mt-3 text-slate-300 font-medium max-w-2xl leading-relaxed text-sm sm:text-base">
              The whole daf, sugya by sugya, with Rashi and Tosafot translated beside the Gemara, Mesivta-style notes from the Rishonim and Acharonim, the Rambam’s reading, the practical halacha — and a chavruta to ask when you get lost. Every word sourced.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: BookOpen, label: 'Rashi & Tosafot translated' },
                { icon: Layers, label: 'Basic or Intensive' },
                { icon: Landmark, label: 'Rambam & Halacha' },
                { icon: MessageSquareText, label: 'Ask when lost' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700 px-3 py-1 text-[11px] font-bold text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-indigo-300" /> {label}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 flex lg:flex-col items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 group-hover:bg-indigo-500 text-white px-6 py-3.5 text-sm font-black uppercase tracking-wider shadow-xl shadow-indigo-600/30 transition-all group-active:scale-95">
              Open the daf <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">Free · iPad & phone</span>
          </div>
        </div>
      </button>
    </section>
  );
}
