import React, { useState } from 'react';
import { X, MessageCircle, Share2, Copy, Check, Users, ExternalLink, Sparkles } from 'lucide-react';

interface WhatsAppShareModalProps {
  whatsappUrl: string;
  onClose: () => void;
  onStatusMessage?: (message: string, type: 'success' | 'error') => void;
}

export function WhatsAppShareModal({ whatsappUrl, onClose, onStatusMessage }: WhatsAppShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'general' | 'chavrusa' | 'short'>('general');

  const templates = {
    general: `Shalom! I wanted to share this digital Torah library & shiurim WhatsApp community with you. Join us for daily sefarim, videos, podcasts, and updates:\n${whatsappUrl}`,
    chavrusa: `Hey! Check out this digital Torah library with free sefarim, daily shiurim, and podcasts. Join their WhatsApp community here:\n${whatsappUrl}`,
    short: `Join our Torah library WhatsApp group for sefarim and daily shiurim:\n${whatsappUrl}`
  };

  const currentMessage = templates[selectedTemplate];

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(currentMessage);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join our Torah WhatsApp Community',
          text: currentMessage,
          url: whatsappUrl,
        });
        if (onStatusMessage) onStatusMessage('Thanks for sharing!', 'success');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(whatsappUrl);
    setCopiedLink(true);
    if (onStatusMessage) onStatusMessage('Group link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopiedMessage(true);
    if (onStatusMessage) onStatusMessage('Invitation message copied to clipboard!', 'success');
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors border border-slate-700/50"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider w-fit mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Help Grow Our Community
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
          Invite Friends & Chavrusas
        </h2>
        
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          Spread Torah wisdom! Share our WhatsApp community with your friends, family, and study partners so they can access daily sefarim, videos, and podcasts.
        </p>

        {/* Template Selector */}
        <div className="mb-4">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
            Select Invitation Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedTemplate('general')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-center border ${
                selectedTemplate === 'general'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemplate('chavrusa')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-center border ${
                selectedTemplate === 'chavrusa'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Chavrusa
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemplate('short')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-center border ${
                selectedTemplate === 'short'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Quick Link
            </button>
          </div>
        </div>

        {/* Message Preview Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 sm:p-4 mb-6 relative group">
          <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed font-sans select-all">
            {currentMessage}
          </p>
          <button
            type="button"
            onClick={handleCopyMessage}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
          >
            {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedMessage ? 'Copied Full Message!' : 'Copy Full Message'}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Main WhatsApp Share Button */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full py-3.5 px-5 bg-[#25D366] hover:bg-[#1fa14b] text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-[#25D366]/25 hover:shadow-[#25D366]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            Share directly on WhatsApp
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Device Share or Copy */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4 text-indigo-400" />
              More Apps
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Not joined yet prompt */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Haven't joined yet?</span>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 transition-colors"
          >
            Join Group Now <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
