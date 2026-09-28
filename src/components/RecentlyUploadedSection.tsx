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
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-100 uppercase tracking-tight">
                Recently Uploaded
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> 5 Most Recent
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Latest uploads added to the library in chronological order
            </p>
          </div>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-all flex items-center gap-1.5 shadow-sm self-start sm:self-auto shrink-0 active:scale-95"
          >
            <span>View Grid ({videos.length})</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
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
              className="group cursor-pointer bg-slate-950/80 hover:bg-slate-900/90 rounded-xl p-2.5 sm:p-3 border border-slate-800/80 hover:border-slate-700 transition-all duration-200 flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              {/* Rank Index */}
              <div className="shrink-0 w-6 text-center">
                <span className={`text-xs font-black font-mono ${rank <= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  #{rank}
                </span>
              </div>

              {/* Thumbnail / Icon with Play overlay */}
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-800/90 shrink-0 flex items-center justify-center group/thumb">
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

              {/* Middle: Title & Metadata */}
              <div className="flex-1 min-w-0 pr-1">
                <h4 className="font-bold text-slate-100 group-hover:text-emerald-400 text-xs sm:text-sm leading-snug truncate transition-colors">
                  {video.title}
                </h4>

                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {/* Category Pill - uniform styling */}
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-900 text-slate-300 border-slate-700/80">
                    {video.category}
                  </span>

                  {/* Watched on this device indicator */}
                  {hasDeviceWatched(video.id) && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Watched
                    </span>
                  )}

                  {/* Series / Folder */}
                  {video.folder && (
                    <span className="text-[10px] text-slate-400 font-medium truncate max-w-[100px] hidden sm:inline-block">
                      {video.folder}
                    </span>
                  )}

                  {/* Duration */}
                  {video.duration && (
                    <span className="text-[10px] text-emerald-400 font-semibold hidden sm:inline-block">
                      • {video.duration}
                    </span>
                  )}

                  {/* Upload Date */}
                  <span className="text-[10px] text-slate-400 font-medium">
                    • {new Date(video.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>

                  {/* Views */}
                  {video.views !== undefined && (
                    <span className="text-[10px] text-slate-400 items-center gap-1 hidden md:inline-flex">
                      <Eye className="w-3 h-3 text-slate-500" /> {video.views}
                    </span>
                  )}

                  {/* Ratings */}
                  {video.ratingsCount ? (
                    <span className="text-[10px] text-amber-400 font-bold items-center gap-0.5 hidden md:inline-flex">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {(video.ratingsSum! / video.ratingsCount).toFixed(1)}
                    </span>
                  ) : null}
                </div>
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
