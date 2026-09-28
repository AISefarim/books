import React from 'react';
import { Video } from '../types';
import { Play, Sparkles, Folder, Clock, Share2, Upload, Star, ChevronRight, Video as VideoIcon, Headphones, Check } from 'lucide-react';

interface FeaturedCategorySeriesProps {
  seriesName: string;
  category: string;
  episodes: Video[];
  thumbnail?: string;
  isAdmin: boolean;
  onSelectVideo: (video: Video) => void;
  onExploreSeries: (seriesName: string) => void;
  onUnfeature?: () => void;
  onUpdateThumbnail?: (folderKey: string, file: File) => void;
}

export function parseMinutesFromDuration(durationStr?: string): number {
  if (!durationStr) return 0;
  const cleaned = durationStr.trim().toLowerCase();
  
  // Format "HH:MM:SS" or "MM:SS"
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    }
    if (parts.length === 2) {
      return parts[0] + parts[1] / 60;
    }
  }
  
  // Match "X hr Y min" or "X min"
  const hrMatch = cleaned.match(/(\d+)\s*(h|hr|hour|hours)/);
  const minMatch = cleaned.match(/(\d+)\s*(m|min|minute|minutes)/);
  
  let total = 0;
  if (hrMatch) total += parseInt(hrMatch[1], 10) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  
  if (total > 0) return total;
  
  const numOnly = parseInt(cleaned, 10);
  if (!isNaN(numOnly) && numOnly > 0) {
    return numOnly;
  }
  return 0;
}

export function extractEpisodeNumber(title?: string): number | null {
  if (!title) return null;
  // Match "X of Y" (e.g. "Bereshit 1 of 14", "Bereshit 10 of 14")
  const ofMatch = title.match(/(\d+)\s*(?:of|\/)\s*\d+/i);
  if (ofMatch) return parseInt(ofMatch[1], 10);
  
  const epMatch = title.match(/(?:episode|ep|part|daf|aliyat)\s*(\d+)/i);
  if (epMatch) return parseInt(epMatch[1], 10);

  const numPrefix = title.match(/^(\d+)[\.\s\-]/);
  if (numPrefix) return parseInt(numPrefix[1], 10);

  return null;
}

export function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  }
  return `${mins} min`;
}

export function FeaturedCategorySeries({
  seriesName,
  category,
  episodes,
  thumbnail,
  isAdmin,
  onSelectVideo,
  onExploreSeries,
  onUnfeature,
  onUpdateThumbnail
}: FeaturedCategorySeriesProps) {
  const [copied, setCopied] = React.useState(false);

  if (!episodes || episodes.length === 0) return null;

  const sortedEpisodes = [...episodes].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      return a.order - b.order;
    }
    const epA = extractEpisodeNumber(a.title);
    const epB = extractEpisodeNumber(b.title);
    if (epA !== null && epB !== null && epA !== epB) {
      return epA - epB;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  const firstEpisode = sortedEpisodes[0];
  const secondEpisode = sortedEpisodes[1];
  const thirdEpisode = sortedEpisodes[2];

  const videoCount = sortedEpisodes.filter(v => v.type !== 'audio').length;
  const podcastCount = sortedEpisodes.filter(v => v.type === 'audio').length;
  
  let typeBreakdown = `${sortedEpisodes.length} Episodes`;
  if (videoCount > 0 && podcastCount > 0) {
    typeBreakdown = `${videoCount} Videos • ${podcastCount} Podcasts`;
  } else if (podcastCount > 0) {
    typeBreakdown = `${podcastCount} Podcast Episodes`;
  } else if (videoCount > 0) {
    typeBreakdown = `${videoCount} Video Episodes`;
  }

  // Calculate estimated total duration
  const totalMinutes = sortedEpisodes.reduce((acc, ep) => acc + parseMinutesFromDuration(ep.duration), 0);
  const formattedDuration = formatTotalDuration(totalMinutes);

  const mainCover = thumbnail || firstEpisode?.url;
  const desc = firstEpisode?.description || (firstEpisode?.topics ? (Array.isArray(firstEpisode.topics) ? firstEpisode.topics.join(' • ') : firstEpisode.topics) : `Comprehensive series in ${category}`);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/?tab=videos&category=${encodeURIComponent(category)}&folder=${encodeURIComponent(seriesName)}`;
    const shareText = `Check out the featured "${seriesName}" series in ${category} on AI Sefarim: ${shareUrl}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative mb-10 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 border-2 border-indigo-500/40 hover:border-indigo-400/60 shadow-2xl shadow-indigo-950/40 transition-all duration-500 p-6 sm:p-8 lg:p-10 group">
      {/* Ambient glowing background aura */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:bg-indigo-500/25 transition-all duration-700" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20 group-hover:bg-amber-500/15 transition-all duration-700" />
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />

      {/* Admin Quick Action Controls */}
      {isAdmin && (
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2">
          {onUpdateThumbnail && (
            <label 
              className="cursor-pointer bg-slate-900/90 backdrop-blur-md hover:bg-indigo-600 hover:text-white text-slate-300 px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 text-xs font-bold border border-slate-700 hover:border-indigo-500"
              title="Upload Series Artwork"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Series Artwork</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files?.[0]) onUpdateThumbnail(seriesName, e.target.files[0]);
                }} 
              />
            </label>
          )}

          {onUnfeature && (
            <button
              onClick={onUnfeature}
              className="bg-amber-500/20 hover:bg-rose-500/20 text-amber-300 hover:text-rose-300 px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 text-xs font-bold border border-amber-500/40 hover:border-rose-500/40"
              title="Unfeature this series"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="hidden sm:inline">Featured in {category}</span>
              <span className="sm:hidden">Featured</span>
            </button>
          )}
        </div>
      )}

      {/* Main Showcase Hero */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        {/* Left / Info Column */}
        <div className="flex-1 text-center lg:text-left space-y-4 sm:space-y-5 w-full">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/25 via-indigo-500/25 to-purple-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase tracking-widest shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              Featured Series • {category}
            </span>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-black uppercase tracking-wider">
              {podcastCount > videoCount ? (
                <>
                  <Headphones className="w-3.5 h-3.5 text-indigo-400" /> Podcast Series
                </>
              ) : (
                <>
                  <VideoIcon className="w-3.5 h-3.5 text-indigo-400" /> Video Series
                </>
              )}
            </span>

            {formattedDuration && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 text-[11px] font-bold">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formattedDuration}
              </span>
            )}
          </div>

          {/* Series Title */}
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1] drop-shadow-sm group-hover:text-indigo-200 transition-colors">
              {seriesName}
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm font-semibold uppercase tracking-widest text-indigo-300/80">
              {typeBreakdown}
            </p>
          </div>

          {/* Description */}
          {desc && (
            <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-2xl line-clamp-3 font-normal">
              {desc}
            </p>
          )}

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
            <button
              onClick={() => onSelectVideo(firstEpisode)}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:via-teal-400 hover:to-indigo-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-full bg-slate-950/20 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950 ml-0.5" />
              </div>
              <span>Start Series {firstEpisode.title ? `• Ep 1` : ''}</span>
            </button>

            <button
              onClick={() => onExploreSeries(seriesName)}
              className="px-5 py-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-sm tracking-wide border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Folder className="w-4 h-4 text-indigo-400" />
              <span>Explore All {sortedEpisodes.length} Episodes</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={handleShare}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all"
              title="Share Series"
            >
              {copied ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold px-1">
                  <Check className="w-4 h-4" /> Copied!
                </div>
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Right / 3D Visual Stack */}
        <div className="w-full sm:w-80 lg:w-96 shrink-0 flex items-center justify-center">
          <div 
            onClick={() => onSelectVideo(firstEpisode)}
            className="relative isolate w-64 sm:w-72 aspect-[4/3] sm:aspect-square group/stack cursor-pointer my-2"
          >
            {/* Third layer background card */}
            {thirdEpisode && (
              <div className="absolute inset-0 bg-slate-800 rounded-3xl translate-x-5 -translate-y-4 -z-20 border border-indigo-500/20 transition-transform duration-500 group-hover/stack:translate-x-7 group-hover/stack:-translate-y-6 rotate-6 origin-bottom-right overflow-hidden shadow-md opacity-40">
                {thumbnail ? (
                  <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-60" />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-500">Ep 3</span>
                  </div>
                )}
              </div>
            )}

            {/* Second layer middle card */}
            {secondEpisode && (
              <div className="absolute inset-0 bg-indigo-950/80 rounded-3xl translate-x-2.5 -translate-y-2 -z-10 border border-indigo-400/30 shadow-lg transition-transform duration-500 group-hover/stack:translate-x-4 group-hover/stack:-translate-y-3 rotate-3 origin-bottom-right overflow-hidden opacity-75">
                {thumbnail ? (
                  <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full bg-slate-900/90 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-400">Ep 2</span>
                  </div>
                )}
              </div>
            )}

            {/* Front main card */}
            <div className="relative w-full h-full rounded-3xl overflow-hidden bg-slate-900 shadow-2xl border-2 border-indigo-400/50 group-hover/stack:border-indigo-300 transition-all duration-500 flex items-center justify-center group-hover/stack:-translate-y-1.5 group-hover/stack:-translate-x-1.5 ring-2 ring-indigo-500/20">
              {thumbnail ? (
                <img 
                  src={thumbnail} 
                  alt={seriesName} 
                  className="w-full h-full object-cover group-hover/stack:scale-105 transition-transform duration-700 pointer-events-none" 
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-900/80 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-3 group-hover/stack:scale-110 group-hover/stack:bg-indigo-600 transition-all duration-300 shadow-inner">
                    {podcastCount > videoCount ? (
                      <Headphones className="w-10 h-10 text-indigo-300 group-hover/stack:text-white transition-colors" />
                    ) : (
                      <VideoIcon className="w-10 h-10 text-indigo-300 group-hover/stack:text-white transition-colors" />
                    )}
                  </div>
                  <span className="text-sm font-black text-white line-clamp-2">{seriesName}</span>
                  <span className="text-[11px] font-bold text-indigo-300/80 mt-1 uppercase tracking-wider">{typeBreakdown}</span>
                </div>
              )}

              {/* Play Hover Overlay */}
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover/stack:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2">
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/40 scale-90 group-hover/stack:scale-100 transition-transform duration-300">
                  <Play className="w-8 h-8 fill-slate-950 ml-1" />
                </div>
                <span className="text-xs font-black text-white uppercase tracking-wider">Play Episode 1</span>
              </div>

              {/* Episode 1 preview pill */}
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs">
                <span className="font-black text-amber-300 uppercase tracking-wider text-[10px]">EPISODE 1</span>
                {firstEpisode?.duration && (
                  <span className="text-slate-300 font-bold text-[10px]">{firstEpisode.duration}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episode Quick Rail (Shows the first 4 episodes with instant play) */}
      {sortedEpisodes.length > 1 && (
        <div className="mt-8 pt-6 border-t border-indigo-500/20">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              Series Episodes Quick-Select
            </h4>
            <button
              onClick={() => onExploreSeries(seriesName)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>View all {sortedEpisodes.length}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sortedEpisodes.slice(0, 4).map((ep, idx) => (
              <div
                key={ep.id}
                onClick={() => onSelectVideo(ep)}
                className="group/ep cursor-pointer bg-slate-900/80 hover:bg-slate-800 p-3.5 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 group-hover/ep:bg-indigo-600 border border-indigo-500/30 group-hover/ep:border-indigo-600 flex items-center justify-center shrink-0 transition-colors">
                  <Play className="w-4 h-4 text-indigo-400 group-hover/ep:text-white fill-indigo-400 group-hover/ep:fill-white ml-0.5 transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400/90 mb-0.5">
                    <span>EP {idx + 1}</span>
                    {ep.duration && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">{ep.duration}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-200 group-hover/ep:text-white truncate">
                    {ep.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
