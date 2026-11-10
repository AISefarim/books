import React, { useState } from 'react';
import { ArrowLeft, Share2, Check, ExternalLink, PlayCircle, Play, Calendar, Eye, Star, MessageSquare, Send, Bookmark, Headphones, MessageCircle, BookOpen, Smartphone, CheckCircle2, Clock, Zap, ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { updateDoc, doc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Video, Book } from '../types';
import type { SeriesNeighbors } from '../lib/seriesOrder';
import { AudioPlayer } from './AudioPlayer';
import { dafRefForMedia, dafPath } from '../lib/daf';
import { useReadyDafs } from '../lib/useReadyDafs';
import { PodcastSocialCard } from './PodcastSocialCard';
import { LearningGamificationBanner } from './LearningGamificationBanner';
import { getDeviceWatchStats, recordDeviceWatch, hasDeviceWatched, calculateMediaPoints } from '../lib/deviceTracker';

interface VideoDetailsProps {
  video: Video;
  relatedVideos: Video[];
  /** where this shiur sits in its series */
  nav?: SeriesNeighbors;
  onBack: () => void;
  onSelectVideo: (video: Video) => void;
  categoryThumbnails?: Record<string, string>;
  folderThumbnails?: Record<string, string>;
  isSaved?: boolean;
  onToggleSave?: (id: string, e?: React.MouseEvent) => void;
  onOpenWhatsAppShare?: () => void;
  linkedBook?: Book | null;
  onSelectBook?: (book: Book) => void;
  onReadBook?: (epubUrl: string, book: Book) => void;
}

export function VideoDetails({
  video,
  relatedVideos,
  nav,
  onBack,
  onSelectVideo,
  categoryThumbnails,
  folderThumbnails,
  isSaved,
  onToggleSave,
  onOpenWhatsAppShare,
  linkedBook,
  onSelectBook,
  onReadBook
}: VideoDetailsProps) {
  const [copied, setCopied] = useState(false);
  const readyDafs = useReadyDafs();
  const dafRef = dafRefForMedia(video);
  const hasSuperDaf = !!dafRef && readyDafs.has(dafRef);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [hasRated, setHasRated] = useState(() => {
    return localStorage.getItem(`rated_video_${video.id}`) === 'true';
  });
  
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Device watch count tracking (total videos/podcasts combined watched by this device)
  const [deviceStats, setDeviceStats] = useState(() => getDeviceWatchStats());

  React.useEffect(() => {
    // Record this watch on this device
    const updated = recordDeviceWatch(video.id, video);
    setDeviceStats(updated);

    const handleDeviceWatchUpdated = () => {
      setDeviceStats(getDeviceWatchStats());
    };

    window.addEventListener('device-watch-updated', handleDeviceWatchUpdated);
    window.addEventListener('ai-sefarim-stats-updated', handleDeviceWatchUpdated);
    return () => {
      window.removeEventListener('device-watch-updated', handleDeviceWatchUpdated);
      window.removeEventListener('ai-sefarim-stats-updated', handleDeviceWatchUpdated);
    };
  }, [video.id]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [video.id]);

  const handleRate = async (rating: number) => {
    if (hasRated) return;
    setHasRated(true);
    localStorage.setItem(`rated_video_${video.id}`, 'true');
    try {
      await updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', video.id), {
        ratingsSum: increment(rating),
        ratingsCount: increment(1)
      });
    } catch (e) {
      console.error("Error rating video", e);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', video.id), {
        comments: arrayUnion({
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          name: commentName.trim() || 'Anonymous',
          text: commentText.trim(),
          createdAt: Date.now()
        })
      });
      setCommentText('');
    } catch (error) {
      console.error("Error submitting comment", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const currentRating = video.ratingsCount ? (video.ratingsSum! / video.ratingsCount).toFixed(1) : 'New';

  const getCategoryEmoji = (category: string | undefined) => {
    if (!category) return '▶️';
    if (category.toLowerCase().includes('daf')) return '📖';
    if (category.toLowerCase().includes('parasha')) return '📜';
    if (category.toLowerCase().includes('mishnah')) return '📚';
    if (category.toLowerCase().includes('rambam')) return '⚖️';
    if (category.toLowerCase().includes('tanach')) return '🕎';
    return '▶️';
  };

  const getPodcastShareMessage = () => {
    const duration = video.duration || '~18–22 min';
    const seriesLabel = [video.category, video.folder, video.subfolder].filter(Boolean).join(' • ');
    const url = `${window.location.origin}/v/${video.id}`;

    return `🎙️ *AI Sefarim Podcast: ${video.title}*

${seriesLabel ? `📁 *Series:* ${seriesLabel}\n` : ''}⏱️ *Duration:* ${duration}

🎧 *Listen now on AI Sefarim:*
${url}`;
  };

  const handleShareToWhatsApp = () => {
    const message = getPodcastShareMessage();
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/v/${video.id}`;
    let shareTitle = `${video.category}: ${video.title}`;
    let shareText = `${getCategoryEmoji(video.category)} ${video.category}: ${video.title}\n\n${url}`;

    if (video.type === 'audio') {
      shareTitle = `AI Sefarim Podcast: ${video.title}`;
      shareText = getPodcastShareMessage();
    }
    
    // Use native share menu if available (great for mobile WhatsApp/iMessage)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: url
        });
        return; // Success!
      } catch (err) {
        // Fall back to clipboard copy if user cancels or share fails
        console.log('Share API failed or was cancelled, falling back to clipboard.');
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const inSeries = !!nav && nav.index !== -1 && (nav.series.length > 1 || !!nav.prev || !!nav.next);
  const nextEpisode = nav?.next;
  const upNextVideo = nextEpisode ?? relatedVideos.find(v => v.id !== video.id);
  const otherRelated = relatedVideos.filter(v => v.id !== video.id && v.id !== upNextVideo?.id).slice(0, 8);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800 transition-all font-black uppercase tracking-widest text-sm bg-slate-900 px-6 py-3.5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-700/60 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Library
        </button>
      </div>

      {hasSuperDaf && (
        <a href={`${dafPath(dafRef!)}?podcast=${video.id}`} className="group mb-8 block rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 p-6 md:p-8 shadow-[0_25px_60px_-20px_rgba(99,102,241,0.8)] ring-1 ring-white/10 hover:brightness-110 transition-all">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <div className="text-5xl md:text-6xl">📖</div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] md:text-xs font-black uppercase tracking-[0.2em] text-indigo-100">Super Daf · {dafRef}</p>
              <p className="mt-1 text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">Learn this daf in Super Daf</p>
              <p className="mt-1.5 text-sm md:text-base text-indigo-100 font-medium">The Gemara with Rashi, Tosafot, numbered notes, the Rambam and the halacha — with this episode playing inside.</p>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-indigo-700 px-6 py-4 text-sm md:text-base font-black uppercase tracking-wider shadow-xl group-hover:translate-x-0.5 transition-transform">Open Super Daf →</span>
          </div>
        </a>
      )}

      <div className={`bg-slate-900 rounded-[3rem] p-5 md:p-12 shadow-xl border border-slate-800 ${inSeries ? "mb-4 md:mb-6" : "mb-16"} flex flex-col md:flex-row gap-4 md:gap-8 items-center`}>
        {/* Left side: Thumbnail / Graphic */}
        {video.type !== 'audio' ? (
          <div 
            onClick={() => {
              window.open(video.url, '_blank');
            }}
            className="hidden md:flex md:w-1/3 aspect-square rounded-[2rem] bg-indigo-950/40 items-center justify-center overflow-hidden shadow-inner border border-slate-700 relative group block cursor-pointer"
          >
            {((video.folder && folderThumbnails?.[video.folder]) || categoryThumbnails?.[video.category]) ? (
              <img src={(video.folder && folderThumbnails?.[video.folder]) || categoryThumbnails?.[video.category]} alt={video.folder || video.category} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <div className="w-16 h-16 bg-slate-900/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-all duration-300">
                  <Play className="w-8 h-8 text-indigo-400 fill-indigo-400 ml-1" />
               </div>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => {
              window.open(video.url, '_blank');
            }}
            className="hidden md:flex md:w-1/3 aspect-square rounded-[2rem] bg-indigo-950/40 items-center justify-center overflow-hidden shadow-inner border border-indigo-500/30 relative group cursor-pointer"
          >
            {((video.folder && folderThumbnails?.[video.folder]) || categoryThumbnails?.[video.category]) ? (
              <img src={(video.folder && folderThumbnails?.[video.folder]) || categoryThumbnails?.[video.category]} alt={video.folder || video.category} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 bg-indigo-600/20 text-indigo-400 rounded-3xl flex items-center justify-center mb-4 border border-indigo-500/30 shadow-lg shadow-indigo-900/40 group-hover:scale-110 transition-transform">
                  <Headphones className="w-10 h-10" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-indigo-300">Podcast Episode</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="w-16 h-16 bg-indigo-600/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-all duration-300 text-white">
                <ExternalLink className="w-7 h-7" />
              </div>
            </div>
          </div>
        )}

        {/* Right side: Info and Actions */}
        <div className="flex flex-col gap-4 md:gap-6 w-full md:w-2/3">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-indigo-950/60 text-indigo-400 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-indigo-500/30">
                {video.category || (video.type === 'audio' ? 'Podcast' : 'General')}
              </span>
              {video.duration && (
                <span className="text-slate-300 text-xs font-bold flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{video.duration}</span>
                </span>
              )}
              {(() => {
                const isPodcast = video.type === 'audio';
                const calc = calculateMediaPoints(video.type || 'video', video.duration, deviceStats.todayWatchCount >= 1 ? 1 : 0);
                return (
                  <>
                    {isPodcast && calc.isPodcastBonus && (
                      <span 
                        className="text-[11px] font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30 flex items-center gap-1 shadow-sm"
                        title={`Longer podcast duration (${calc.durationMinutes} min) awards higher base points!`}
                      >
                        <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Longer Shiur: +{calc.basePoints} pts</span>
                      </span>
                    )}
                    {deviceStats.todayWatchCount >= 1 && (
                      <span 
                        className="text-[11px] font-black text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1 shadow-sm"
                        title="1.2x multiplier applied for 2nd+ video/podcast watched today"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
                        <span>1.2x Daily Bonus Active</span>
                      </span>
                    )}
                  </>
                );
              })()}
              <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(video.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              {video.views !== undefined && (
                <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span>{video.views} views</span>
                  {video.views >= 50 && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1 shadow-sm">
                      🔥 Trending Shiur
                    </span>
                  )}
                  {video.views >= 20 && video.views < 50 && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-500/30 flex items-center gap-1 shadow-sm">
                      ⭐ Popular
                    </span>
                  )}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {((video.folder && folderThumbnails?.[video.folder]) || categoryThumbnails?.[video.category]) && (
                <img src={(video.folder && folderThumbnails?.[video.folder]) || categoryThumbnails?.[video.category]} alt="" className="md:hidden w-16 h-16 shrink-0 rounded-xl object-cover border border-slate-700" />
              )}
              <h1 className="text-2xl md:text-5xl font-black text-slate-50 tracking-tight leading-tight">
                {video.title}
              </h1>
            </div>
          </div>

          {video.type === 'audio' && (
            <div className="w-full mt-4">
              <AudioPlayer 
                url={video.url} 
                title={video.title} 
                onNext={upNextVideo ? () => onSelectVideo(upNextVideo) : undefined}
                onPlay={() => {
                  const updated = recordDeviceWatch(video.id, video);
                  setDeviceStats(updated);
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 md:pt-2">
            {video.type !== 'audio' && (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  const updated = recordDeviceWatch(video.id, video);
                  setDeviceStats(updated);
                }}
                className="w-full md:w-auto md:self-start bg-indigo-600 text-white px-8 py-4 md:py-5 rounded-2xl text-lg md:text-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl active:scale-95 group"
              >
                <Play className="w-7 h-7 fill-current group-hover:scale-110 transition-transform" /> Play Now
              </a>
            )}
            <div className="flex gap-2">
              {video.type === 'audio' ? (
                <>
                  <SmallAction onClick={handleShareToWhatsApp} title="Share this episode to WhatsApp with show notes" icon={<MessageCircle className="w-4 h-4" />} label="Share" />
                  <SmallAction onClick={handleShare} title="Copy the episode info" icon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />} label={copied ? 'Copied' : 'Copy'} />
                </>
              ) : (
                <SmallAction onClick={handleShare} title="Share this shiur" icon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />} label={copied ? 'Copied' : 'Share'} />
              )}
              {onOpenWhatsAppShare && (
                <SmallAction onClick={onOpenWhatsAppShare} title="Share our WhatsApp community with friends" icon={<MessageCircle className="w-4 h-4 text-[#25D366] fill-[#25D366]" />} label="Invite" />
              )}
              {onToggleSave && (
                <SmallAction onClick={(e) => onToggleSave(video.id, e)} title={isSaved ? 'Saved' : 'Save for later'} active={isSaved} icon={<Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />} label={isSaved ? 'Saved' : 'Save'} />
              )}
            </div>
          </div>
        </div>
      </div>

      {inSeries && nav && <SeriesNav nav={nav} onSelect={onSelectVideo} />}

      <div className="mb-16 -mt-10">
        <LearningGamificationBanner
          compact
          totalWatchedCount={deviceStats.totalWatchedCount}
          currentMediaCounts={true}
          currentMediaType={video.type === 'audio' ? 'podcast' : 'video'}
        />
      </div>

      {/* Read This In The Book Section */}
      {linkedBook && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 rounded-[2.5rem] p-6 md:p-8 shadow-xl border border-indigo-500/20 mb-16 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-500">
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-6">
            <div 
              onClick={() => onSelectBook ? onSelectBook(linkedBook) : onReadBook?.(linkedBook.epub, linkedBook)}
              className="w-24 sm:w-28 shrink-0 aspect-[3/4] rounded-2xl overflow-hidden shadow-xl border border-white/10 group cursor-pointer hover:scale-105 transition-transform duration-300"
            >
              <img 
                src={linkedBook.cover} 
                alt={linkedBook.title} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="flex-1 flex flex-col justify-between text-center sm:text-left">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold uppercase tracking-wider mb-2.5">
                  <BookOpen className="w-3.5 h-3.5" /> Read This In The Book
                </span>
                <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                  {linkedBook.title}
                </h4>
                {linkedBook.author && (
                  <p className="text-xs sm:text-sm text-indigo-200/90 font-bold uppercase tracking-wider mt-1">
                    By {linkedBook.author}
                  </p>
                )}
                {linkedBook.desc && (
                  <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                    {linkedBook.desc}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                {onSelectBook && (
                  <button
                    onClick={() => onSelectBook(linkedBook)}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" /> View Sefer Details
                  </button>
                )}
                {onReadBook && linkedBook.epub && (
                  <button
                    onClick={() => onReadBook(linkedBook.epub, linkedBook)}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition-all border border-slate-700 flex items-center gap-2"
                  >
                    Read Online
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Podcast WhatsApp & Social Audio Card */}
      {video.type === 'audio' && (
        <div id="podcast-social-card" className="mb-16 max-w-4xl mx-auto">
          <PodcastSocialCard video={video} />
        </div>
      )}

      {/* Ratings and Comments Section */}
      <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 mb-16 max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-slate-800">
          <div>
             <h3 className="text-xl font-black text-slate-50 flex items-center gap-2 tracking-tight">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> 
                {currentRating} Rating
             </h3>
             <p className="text-slate-400 text-sm mt-1">{video.ratingsCount || 0} reviews</p>
          </div>
          <div className="flex items-center gap-1">
             {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  disabled={hasRated}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    hasRated 
                      ? 'cursor-default opacity-50' 
                      : 'hover:bg-slate-950 active:scale-95'
                  }`}
                >
                  <Star 
                    className={`w-6 h-6 transition-all ${
                       (hoveredStar || (video.ratingsCount ? Math.round(video.ratingsSum! / video.ratingsCount) : 0)) >= star
                         ? 'text-amber-400 fill-amber-400'
                         : 'text-slate-200'
                    }`} 
                  />
                </button>
             ))}
          </div>
        </div>

        <div className="space-y-6">
           <h3 className="font-bold text-slate-50 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              Comments ({video.comments?.length || 0})
           </h3>
           
           <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Your name (optional)" 
                value={commentName}
                onChange={e => setCommentName(e.target.value)}
                className="w-full md:w-64 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
              <div className="relative">
                <textarea 
                  placeholder="Share your thoughts on this Daf..." 
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 min-h-[100px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
                />
                <button 
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className="absolute bottom-4 right-4 bg-indigo-600 text-white rounded-xl p-2 md:px-4 md:py-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                >
                  <span className="hidden md:block">Post Comment</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>
           </form>

           <div className="mt-8 space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {(!video.comments || video.comments.length === 0) ? (
                 <p className="text-slate-400 text-sm text-center py-8">Be the first to share your thoughts!</p>
              ) : (
                 [...video.comments].sort((a, b) => b.createdAt - a.createdAt).map(comment => (
                   <div key={comment.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 fade-in">
                      <div className="flex justify-between items-baseline mb-2">
                         <span className="font-bold text-slate-50">{comment.name}</span>
                         <span className="text-xs text-slate-400 font-medium">
                           {new Date(comment.createdAt).toLocaleDateString()}
                         </span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                   </div>
                 ))
              )}
           </div>
        </div>
      </div>

      {/* Up Next Spotlight Card */}
      {upNextVideo && (
        <div className="mt-16 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-200 fill-mode-both">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-50 uppercase tracking-tighter flex items-center gap-3">
              <PlayCircle className="w-6 h-6 text-indigo-500" /> {nextEpisode ? 'Next in this series' : video.type === 'audio' ? 'Suggested Shiur' : 'Up Next'}
            </h3>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
              {relatedVideos.length} Related
            </span>
          </div>

          <div 
            onClick={() => onSelectVideo(upNextVideo)}
            className="group cursor-pointer bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl hover:shadow-indigo-500/20 transition-all duration-500 border border-slate-800 flex flex-col md:flex-row min-h-[300px]"
          >
            {/* Background blur layer */}
            {((upNextVideo.folder && folderThumbnails?.[upNextVideo.folder]) || categoryThumbnails?.[upNextVideo.category]) && (
                <div className="absolute inset-0 opacity-20 hidden md:block">
                  <img src={(upNextVideo.folder && folderThumbnails?.[upNextVideo.folder]) || categoryThumbnails?.[upNextVideo.category]} alt="" className="w-full h-full object-cover blur-3xl opacity-50" />
                </div>
            )}
            
            {/* Left Image Area */}
            <div className="w-full md:w-5/12 lg:w-4/12 relative bg-black shrink-0 overflow-hidden aspect-video md:aspect-auto">
                {((upNextVideo.folder && folderThumbnails?.[upNextVideo.folder]) || categoryThumbnails?.[upNextVideo.category]) ? (
                  <img src={(upNextVideo.folder && folderThumbnails?.[upNextVideo.folder]) || categoryThumbnails?.[upNextVideo.category]} alt={upNextVideo.folder || upNextVideo.category} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                ) : (
                   <div className="w-full h-full flex items-center justify-center bg-indigo-900/60 "><PlayCircle className="w-20 h-20 text-indigo-400 opacity-50" /></div>
                )}
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-slate-900/90" />
                 
                 <div className="absolute inset-0 flex md:items-end justify-center items-center pb-0 md:pb-8 md:pl-8 md:justify-start">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/90 backdrop-blur-md text-white flex items-center justify-center transform group-hover:scale-110 shadow-xl transition-transform duration-300">
                      <Play className="w-8 h-8 fill-current ml-1" />
                    </div>
                 </div>
            </div>

            {/* Right Content Area */}
            <div className="p-8 md:p-12 flex flex-col justify-center relative z-10 text-white w-full">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-indigo-500/30">
                    {upNextVideo.category}
                  </span>
                </div>
                <h4 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight mb-6 group-hover:text-indigo-200 transition-colors">
                  {upNextVideo.title}
                </h4>
                <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-400 uppercase tracking-widest mt-auto">
                  <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {new Date(upNextVideo.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {upNextVideo.views !== undefined && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                      <span className="flex items-center gap-2"><Eye className="w-4 h-4" /> {upNextVideo.views} views</span>
                    </>
                  )}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid for remaining items */}
      {otherRelated.length > 0 && (
        <div className="mt-12 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-300 fill-mode-both">
          <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest mb-6">
            {video.type === 'audio' ? 'More Audio Shiurim' : 'More to Watch'}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {otherRelated.map((v, idx) => (
              <div 
                key={v.id}
                onClick={() => onSelectVideo(v)}
                className="group cursor-pointer flex flex-col bg-transparent animate-in slide-in-from-bottom-4 fade-in fill-mode-both"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 mb-4 shadow-md group-hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1">
                  {((v.folder && folderThumbnails?.[v.folder]) || categoryThumbnails?.[v.category]) ? (
                    <img 
                      src={(v.folder && folderThumbnails?.[v.folder]) || categoryThumbnails?.[v.category]} 
                      alt={v.folder || v.category} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-900/40">
                      <PlayCircle className="w-12 h-12 text-indigo-300 opacity-50" />
                    </div>
                  )}
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-14 h-14 rounded-full bg-slate-900/20 backdrop-blur-md flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all duration-300">
                      <Play className="w-6 h-6 text-white fill-white ml-1" />
                    </div>
                  </div>
                  
                  {/* Duration/Category badge bottom right */}
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-white/10">
                    {v.category}
                  </div>
                </div>
                
                <h4 className="font-bold text-slate-50 group-hover:text-indigo-600 transition-colors line-clamp-2 text-base leading-snug mb-2">
                  {v.title}
                </h4>
                
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mt-auto">
                  <span>{new Date(v.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {v.views !== undefined && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{v.views}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeriesNav({ nav, onSelect }: { nav: SeriesNeighbors; onSelect: (v: Video) => void }) {
  const { series, index, name, prev, next, prevSection, nextSection } = nav;
  const [open, setOpen] = useState(false);
  const listRef = React.useRef<HTMLOListElement>(null);
  React.useEffect(() => {
    const box = listRef.current;
    const cur = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (box && cur) box.scrollTop = cur.offsetTop - box.clientHeight / 2 + cur.clientHeight / 2;
  }, [open, index]);
  const pct = Math.round(((index + 1) / series.length) * 100);
  // "up to date" only when this device has played every episode of the series, not just because this is the newest
  const missed = series.filter((v, i) => i !== index && !hasDeviceWatched(v.id)).length;

  return (
    <nav aria-label="Series navigation" className="mb-16 rounded-[2rem] border border-indigo-200/30 bg-indigo-950 p-4 md:p-8 shadow-lg">
      <div className="mb-3 md:mb-5">
        {series[index]?.category && series[index].category !== name && (
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">{series[index].category}</p>
        )}
        <h2 className="mt-0.5 text-xl md:text-3xl text-slate-50 leading-tight">{name}</h2>
        <div className="mt-2 md:mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-indigo-800 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-sm font-semibold text-slate-300 tabular-nums">Episode {index + 1} of {series.length}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row-reverse gap-2 md:gap-3">
        {next ? (
          <button
            type="button"
            onClick={() => onSelect(next)}
            className="md:flex-1 flex items-center gap-4 rounded-2xl bg-indigo-600 px-4 py-3 md:px-5 md:py-4 text-left text-white shadow-md hover:bg-indigo-700 active:scale-[0.99] transition-all"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-wider opacity-85">
                {nextSection ? `Next section · ${nextSection}` : 'Next episode'}
              </span>
              <span className="mt-0.5 block text-base md:text-lg font-semibold leading-snug">{next.title}</span>
            </span>
            <span className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
              <ChevronRight className="h-6 w-6" />
            </span>
          </button>
        ) : (
          <div className="md:flex-1 flex items-center gap-3 rounded-2xl border border-dashed border-indigo-200/40 px-4 py-2.5 md:px-5 md:py-4 text-slate-300">
            {missed === 0 ? <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 shrink-0 text-emerald-500" /> : <Clock className="h-5 w-5 md:h-6 md:w-6 shrink-0 text-indigo-400" />}
            <span className="text-sm md:text-base leading-snug">
              {missed === 0 ? "You're up to date: you've heard every episode in this series." : `This is the latest episode so far. You haven't heard ${missed} earlier ${missed === 1 ? 'episode' : 'episodes'} yet.`}
            </span>
          </div>
        )}
        {prev && (
          <button
            type="button"
            onClick={() => onSelect(prev)}
            className="md:flex-1 flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 md:px-5 md:py-4 text-left text-slate-100 hover:bg-slate-800 active:scale-[0.99] transition-all"
          >
            <span className="shrink-0 flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-full bg-slate-800">
              <ChevronLeft className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                {prevSection ? `Previous section · ${prevSection}` : 'Previous episode'}
              </span>
              <span className="mt-0.5 block text-sm md:text-lg font-semibold leading-snug">{prev.title}</span>
            </span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="mt-2 md:mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 md:py-3.5 text-sm md:text-base font-semibold text-slate-200 hover:bg-slate-800"
      >
        <ListOrdered className="h-5 w-5" /> {open ? 'Hide the episode list' : `See all ${series.length} episodes`}
      </button>
      {open && (
        <ol ref={listRef} className="mt-3 max-h-96 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 divide-y divide-slate-800 relative">
          {series.map((v, i) => (
            <li key={v.id}>
              <button
                type="button"
                aria-current={i === index ? 'true' : undefined}
                onClick={() => i !== index && onSelect(v)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left text-base transition-colors ${
                  i === index ? 'bg-indigo-900 text-indigo-300 font-semibold cursor-default' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="w-7 shrink-0 text-right tabular-nums text-slate-500">{i + 1}</span>
                <span className="min-w-0 flex-1 leading-snug">{v.title}</span>
                {i === index && <span className="shrink-0 mt-0.5 text-[11px] font-bold uppercase tracking-wider">Playing</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

function SmallAction({ onClick, icon, label, title, active }: {
  onClick: (e: React.MouseEvent) => void; icon: React.ReactNode; label: string; title?: string; active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl border px-3 md:px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
        active ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-950 text-slate-200 border-slate-700 hover:bg-slate-800'
      }`}
    >
      {icon} {label}
    </button>
  );
}
