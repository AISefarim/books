import React, { useState, useEffect } from 'react';
import { MessageCircle, Share2, X, Users, Sparkles } from 'lucide-react';

interface WhatsAppGrowthPromptProps {
  whatsappUrl: string;
  onOpenShareModal: () => void;
}

const STORAGE_KEY = 'whatsapp_growth_prompt_dismissed_at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function WhatsAppGrowthPrompt({ whatsappUrl, onOpenShareModal }: WhatsAppGrowthPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Check if previously dismissed recently
    try {
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const timePassed = Date.now() - parseInt(dismissedAt, 10);
        if (timePassed < DISMISS_DURATION_MS) {
          return;
        }
      }
    } catch {
      // Ignore storage read errors
    }

    // Delay prompt appearance by 6 seconds for a gentle visitor experience
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // Ignore storage write errors
    }
  };

  const handleQuickWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareMessage = `Shalom! Join our Torah library & shiurim WhatsApp community for daily sefarim, video classes, podcasts, and updates:\n${whatsappUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  if (!isVisible) return null;

  if (isMinimized) {
    return (
      <aside 
        aria-label="WhatsApp Community Sharing"
        className="fixed bottom-5 right-5 z-40 animate-in fade-in slide-in-from-bottom-3 duration-300"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900/95 hover:bg-slate-850 text-white rounded-2xl shadow-xl border border-emerald-500/30 backdrop-blur-md transition-all hover:scale-105 group"
          title="Share our WhatsApp Community"
        >
          <div className="w-7 h-7 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-md shadow-[#25D366]/30">
            <MessageCircle className="w-4 h-4 fill-current" />
          </div>
          <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 transition-colors">
            Share Community
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside 
      aria-label="WhatsApp Community Sharing Invitation"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[340px] sm:max-w-sm w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-5 duration-500"
    >
      <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-2xl border border-emerald-500/30 ring-1 ring-emerald-500/20 text-slate-100 relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header row with minimize & close */}
        <div className="flex items-start justify-between gap-2 mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-md shadow-[#25D366]/30 shrink-0">
              <MessageCircle className="w-4.5 h-4.5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Torah Community</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-white leading-tight">Help Grow Our Group!</h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors text-xs font-bold"
              title="Minimize"
              aria-label="Minimize prompt"
            >
              _
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="Dismiss for 7 days"
              aria-label="Dismiss prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prompt content */}
        <p className="text-xs text-slate-300 leading-relaxed mb-3.5 relative z-10">
          Know a friend, family member, or chavrusa who would love these sefarim and shiurim? Share our WhatsApp community with them!
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-2 relative z-10">
          <button
            type="button"
            onClick={onOpenShareModal}
            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share With Friends
          </button>

          <button
            type="button"
            onClick={handleQuickWhatsAppShare}
            className="py-2.5 px-3 bg-[#25D366] hover:bg-[#1fa14b] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-[#25D366]/20 transition-all active:scale-95 shrink-0"
            title="Open WhatsApp directly"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            WhatsApp
          </button>
        </div>
      </div>
    </aside>
  );
}
