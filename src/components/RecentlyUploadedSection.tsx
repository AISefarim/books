import React, { useState } from 'react';
import { Clock, Sparkles, Play, Bookmark, Share2, Check, MessageCircle, Edit2, Trash2, Eye, Star, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Video } from '../types';
import { hasDeviceWatched } from '../lib/deviceTracker';

interface RecentlyUploadedSectionProps {
  videos: Video[];
  isAdmin: boolean;
  onEdit: (video: Video) => void;
  onDelete: (id: string) => void;
  onSelectVideo: (video: Video) => void;
  categoryThumbnails?: Record<string, string>;
  savedVideoIds?: string[];
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
  onViewAll?: () => void;
}

export function RecentlyUploadedSection({
  videos,
  isAdmin,
  onEdit,
  onDelete,
  onSelectVideo,
  categoryThumbnails,
  savedVideoIds = [],
  onToggleSave,
  onViewAll
}: RecentlyUploadedSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Show only 5 most recent uploads, without distinction between videos and podcasts
  const displayedItems = videos.slice(0, 5);

  const handleShare = async (e: React.MouseEvent, video: Video) => {
    e.stopPropagation();
    const url = `${window.location.origin}/v/${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(video.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const handleWhatsAppShare = (e: React.MouseEvent, video: Video) => {
    e.stopPropagation();
    const duration = video.duration || '~18–22 min';
    const seriesLabel = [video.category, video.folder, video.subfolder].filter(Boolean).join(' • ');
    const url = `${window.location.origin}/v/${video.id}`;
    const message = `🎙️ *AI Sefarim: ${video.title}*\n\n${seriesLabel ? `📁 *Series:* ${seriesLabel}\n` : ''}⏱️ *Duration:* ${duration}\n\n▶️ *Listen/Watch now on AI Sefarim:*\n${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!displayedItems || displayedItems.length === 0) return null;

  return (
    <section className="mb-8 bg-slate-900/50 rounded-2xl p-4 sm:p-5 border border-slate-800/80 shadow-lg relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" /> Recently Uploaded
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">The newest shiurim, newest first</p>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-0.5 shrink-0"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* List Content: 5 items in a responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 relative z-10">
        {displayedItems.map((video, idx) => {
          const isSaved = savedVideoIds.includes(video.id);
          const isCopied = copiedId === video.id;
          const thumbnail = categoryThumbnails?.[video.category];
          const rank = idx + 1;

          return (
            <div
              key={video.id}
              onClick={() => onSelectVideo(video)}
              className="group cursor-pointer bg-slate-950/80 hover:bg-slate-900/90 rounded-xl p-2.5 sm:p-3 border border-slate-800/60 hover:border-slate-700 transition-all duration-200 flex items-center gap-3"
            >
              {/* Thumbnail / Icon with Play overlay */}
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-800/90 shrink-0 flex items-center justify-center group/thumb">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={video.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-emerald-400">
                    <Play className="w-5 h-5 fill-current ml-0.5 opacity-80" />
                  </div>
                )}

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Middle: Title & one quiet meta line */}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-100 group-hover:text-emerald-400 text-[14px] leading-snug line-clamp-2 transition-colors">
                  {video.title}
                </h4>
                <p className="mt-1 text-[11px] text-slate-400 font-medium truncate">
                  {video.category.replace(/^AI /, '')}
                  {' · '}{new Date(video.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {video.duration ? ` · ${video.duration}` : ''}
                  {hasDeviceWatched(video.id) && (
                    <span className="text-emerald-400 font-semibold"> · <CheckCircle2 className="inline w-3 h-3 -mt-0.5" /> Viewed</span>
                  )}
                </p>
              </div>

              {/* Action Buttons on Right */}
              <div className="flex items-center gap-1 shrink-0 -mr-1" onClick={e => e.stopPropagation()}>
                {/* Save to library */}
                {onToggleSave && (
                  <button
                    onClick={(e) => onToggleSave(video.id, e)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isSaved
                        ? 'text-emerald-400 bg-emerald-950/60'
                        : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900'
                    }`}
                    title={isSaved ? "Saved in Library" : "Save to Library"}
                    aria-label="Save to Library"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-emerald-400' : ''}`} />
                  </button>
                )}

                {/* WhatsApp Share for all uploads */}
                <button
                  onClick={(e) => handleWhatsAppShare(e, video)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#25D366] hover:bg-slate-900 transition-all hidden sm:block"
                  title="Share to WhatsApp"
                  aria-label="Share to WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>

                {/* Copy link */}
                <button
                  onClick={(e) => handleShare(e, video)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-all"
                  title="Copy Link"
                  aria-label="Copy Link"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                </button>

                {/* Admin edit/delete */}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => onEdit(video)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDelete(video.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
