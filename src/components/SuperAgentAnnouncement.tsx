import { useState, useEffect } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'super_agent_announcement_seen_count';
const MAX_SHOWS = 2;
// Launch window: shown for 2 days from rollout, then this component is a
// no-op forever (safe to leave in the codebase after the window passes).
const ANNOUNCEMENT_EXPIRES_AT = '2026-10-02T00:00:00Z';

interface SuperAgentAnnouncementProps {
  onTryNow: () => void;
}

export function SuperAgentAnnouncement({ onTryNow }: SuperAgentAnnouncementProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (Date.now() >= new Date(ANNOUNCEMENT_EXPIRES_AT).getTime()) return;

    let count = 0;
    try {
      count = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
    } catch {
      // Ignore storage read errors
    }
    if (count >= MAX_SHOWS) return;

    try {
      localStorage.setItem(STORAGE_KEY, String(count + 1));
    } catch {
      // Ignore storage write errors
    }

    const timer = setTimeout(() => setIsVisible(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={() => setIsVisible(false)} />
      <div className="relative bg-slate-900 w-full max-w-md p-7 sm:p-8 rounded-[2rem] shadow-2xl border border-indigo-500/30 ring-1 ring-indigo-500/20 text-center overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 mb-3">
            Just Launched
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight leading-tight mb-3">
            Introducing Super Agent
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed mb-5">
            Ask any question &mdash; in plain English &mdash; and Super Agent searches hundreds of sources instantly:
            every tractate of Gemara, all of the Rambam, the complete Beit Yosef and Shulchan Aruch, the full
            Arizal, the Zohar, and every AI Sefarim book. Every answer comes with clickable sources, so you can
            always see exactly where it came from.
          </p>

          <button
            type="button"
            onClick={() => {
              setIsVisible(false);
              onTryNow();
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            Try Super Agent
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
