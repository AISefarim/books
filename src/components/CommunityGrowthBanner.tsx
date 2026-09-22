import React from 'react';
import { MessageCircle, Share2, Users, Sparkles, BookOpen, Video, Headphones, Heart } from 'lucide-react';

interface CommunityGrowthBannerProps {
  whatsappUrl: string;
  onOpenShareModal: () => void;
}

export function CommunityGrowthBanner({ whatsappUrl, onOpenShareModal }: CommunityGrowthBannerProps) {
  if (!whatsappUrl) return null;

  return (
    <section 
      aria-label="WhatsApp Community Growth"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-12"
    >
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border border-emerald-500/20 shadow-2xl p-6 sm:p-10 md:p-12">
        {/* Background ambient accents */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
          {/* Left Text Block */}
          <div className="max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Grow Our Torah Community</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight mb-4">
              Share the Light with Your Friends & Chavrusas
            </h2>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 font-medium">
              Help us connect more learners across the globe. By sharing our WhatsApp community, your friends and study partners receive instant access to new sefarim drops, daily video shiurim, and podcast episodes.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3 text-xs font-bold text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Free Sefarim
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <Video className="w-3.5 h-3.5 text-rose-400" /> Daily Shiurim
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <Headphones className="w-3.5 h-3.5 text-amber-400" /> Audio Podcasts
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <Users className="w-3.5 h-3.5 text-emerald-400" /> Active Learners
              </span>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={onOpenShareModal}
              className="w-full sm:w-auto lg:w-64 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all group"
            >
              <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Share with Friends</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto lg:w-64 px-6 py-4 bg-slate-800/90 hover:bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 border border-slate-700 hover:border-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all group"
            >
              <MessageCircle className="w-5 h-5 text-[#25D366] fill-[#25D366] group-hover:scale-110 transition-transform" />
              <span>Join WhatsApp Group</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
