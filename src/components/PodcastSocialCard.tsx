import React, { useState } from 'react';
import { Headphones, Clock, Tag, MessageCircle, Copy, Check, Share2, Edit3 } from 'lucide-react';
import { Video } from '../types';

interface PodcastSocialCardProps {
  video: Video;
  onOpenDirectLink?: () => void;
  className?: string;
}

export function PodcastSocialCard({ video, onOpenDirectLink, className = '' }: PodcastSocialCardProps) {
  const [duration, setDuration] = useState<string>(video.duration || '~18–22 min');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const episodeUrl = `${window.location.origin}/v/${video.id}`;
  const seriesLabel = [video.category, video.folder, video.subfolder].filter(Boolean).join(' • ');

  // Generate WhatsApp formatted text without topics section
  const generateWhatsAppMessage = () => {
    return `🎙️ *AI Sefarim Podcast: ${video.title}*

${seriesLabel ? `📁 *Series:* ${seriesLabel}\n` : ''}⏱️ *Duration:* ${duration}

🎧 *Listen now on AI Sefarim:*
${episodeUrl}`;
  };

  const handleShareToWhatsApp = () => {
    const message = generateWhatsAppMessage();
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generateWhatsAppMessage());
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error('Failed to copy WhatsApp message', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(episodeUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy episode link', err);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 border border-indigo-500/30 shadow-2xl p-6 sm:p-8 ${className}`}>
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-900/30">
            <Headphones className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                WhatsApp & Social Audio Card
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#25D366]/20 text-emerald-400 border border-[#25D366]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-ping" />
                Live Card
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-100 tracking-tight">
              Shareable Podcast Show Card
            </h3>
          </div>
        </div>

        {/* Audio Waveform visualization */}
        <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="w-1 h-3 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1 h-5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1 h-6 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.4s]" />
          <span className="w-1 h-4 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.2s]" />
          <span className="w-1 h-2 bg-indigo-600 rounded-full animate-bounce" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1.5 hidden sm:inline">
            NotebookLM Audio
          </span>
        </div>
      </div>

      {/* Main Card Content Preview */}
      <div className="relative z-10 bg-slate-950/70 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-slate-800/80 mb-6 shadow-inner space-y-4">
        {/* Category & Duration Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-950/80 text-indigo-300 font-bold border border-indigo-500/20">
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            {seriesLabel || 'General Podcast'}
          </span>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 text-slate-300 font-bold border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {duration}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-[11px] text-slate-400 hover:text-indigo-300 transition-colors flex items-center gap-1 underline underline-offset-2 ml-1"
              title="Customize card before sharing"
            >
              <Edit3 className="w-3 h-3" /> {isEditing ? 'Done' : 'Edit Duration'}
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-xl sm:text-2xl font-black text-slate-50 tracking-tight leading-snug">
          {video.title}
        </h4>

        {/* Editing mode for duration */}
        {isEditing && (
          <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2 animate-in fade-in duration-200">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block">
              Duration Estimate:
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 18 min, ~20–25 min"
              className="w-full px-3 py-2 bg-slate-950 rounded-lg border border-slate-700 text-slate-200 text-sm font-medium focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Link preview */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-900">
          <span className="font-mono text-[11px] text-slate-400 truncate max-w-[260px] sm:max-w-md">
            🔗 {episodeUrl}
          </span>
          <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider shrink-0 ml-2">
            AI Sefarim
          </span>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Main One-Click WhatsApp Share Button */}
        <button
          type="button"
          onClick={handleShareToWhatsApp}
          className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#25D366]/20 hover:shadow-2xl hover:shadow-[#25D366]/30 active:scale-95 cursor-pointer"
        >
          <MessageCircle className="w-5 h-5 fill-slate-950" />
          <span>Share Episode to WhatsApp</span>
        </button>

        {/* Copy Formatted Text */}
        <button
          type="button"
          onClick={handleCopyMessage}
          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
          title="Copy formatted message text"
        >
          {copiedText ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-400" />
              <span>Copy Card Text</span>
            </>
          )}
        </button>

        {/* Copy Direct Link */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
          title="Copy link to this episode"
        >
          {copiedLink ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 text-slate-400" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
