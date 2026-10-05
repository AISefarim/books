import { useEffect, useState } from 'react';
import { ArrowRight, ScrollText } from 'lucide-react';
import { DAF_API } from '../lib/daf';

// A slim "today's daf" strip at the top of the Sefarim tab - the way into
// Super Daf now that it no longer has its own navbar tab.
export function SuperDafHero({ onOpen }: { onOpen: (ref?: string) => void }) {
  const [current, setCurrent] = useState<{ ref: string; heRef?: string; date: string } | null>(null);

  useEffect(() => {
    fetch(`${DAF_API}/current`).then((r) => r.json()).then((d) => { if (d && d.ref) setCurrent(d); }).catch(() => {});
  }, []);

  const dateLabel = current?.date ? new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : '';

  return (
    <button
      onClick={() => onOpen(current?.ref)}
      className="group w-full text-left rounded-2xl border border-indigo-400/30 bg-gradient-to-r from-indigo-600/20 via-slate-900 to-slate-900 hover:border-indigo-300/50 transition-all px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4 shadow-[0_10px_30px_-18px_rgba(99,102,241,0.7)]"
    >
      <span className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
        <ScrollText className="w-5 h-5 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-indigo-300">Today's daf · Super Daf{dateLabel ? ` · ${dateLabel}` : ''}</span>
        <span className="block truncate text-base sm:text-lg font-black text-slate-50 leading-tight">
          {current ? current.ref : 'Daf Yomi'}
          <span className="hidden sm:inline text-slate-400 font-semibold text-sm ml-2">Rashi, Tosafot, notes, Rambam & halacha — sugya by sugya</span>
        </span>
      </span>
      <span className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white px-3 sm:px-4 py-2 text-xs font-black uppercase tracking-wider">
        <span className="hidden sm:inline">Learn it</span> <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  );
}
