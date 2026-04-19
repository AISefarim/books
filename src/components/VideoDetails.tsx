import React, { useState } from 'react';
import { ArrowLeft, Share2, Check, ExternalLink, PlayCircle, Play, Calendar, Eye } from 'lucide-react';
import { Video } from '../types';

interface VideoDetailsProps {
  video: Video;
  relatedVideos: Video[];
  onBack: () => void;
  onSelectVideo: (video: Video) => void;
  categoryThumbnail?: string;
}

export function VideoDetails({ video, relatedVideos, onBack, onSelectVideo, categoryThumbnail }: VideoDetailsProps) {
  const [copied, setCopied] = useState(false);

  const getCategoryEmoji = (category: string) => {
    if (category.toLowerCase().includes('daf')) return '📖';
    if (category.toLowerCase().includes('parasha')) return '📜';
    if (category.toLowerCase().includes('mishnah')) return '📚';
    if (category.toLowerCase().includes('rambam')) return '⚖️';
    if (category.toLowerCase().includes('tanach')) return '🕎';
    return '▶️';
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/v/${video.id}`;
    const emoji = getCategoryEmoji(video.category);
    const shareText = `${emoji} ${video.category}: ${video.title}\n\n${url}`;
    
    // Use native share menu if available (great for mobile WhatsApp/iMessage)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${video.category}: ${video.title}`,
          text: `${emoji} ${video.category}: ${video.title}`,
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

  const upNextVideo = relatedVideos[0];
  const otherRelated = relatedVideos.slice(1, 9);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest text-xs bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </button>

      <div className="bg-white rounded-[3rem] p-6 md:p-12 shadow-xl border border-slate-100 mb-16 flex flex-col md:flex-row gap-8 items-center">
        {/* Left side: Thumbnail / Graphic */}
        <div className="w-full md:w-1/3 aspect-square rounded-[2rem] bg-indigo-50 flex items-center justify-center overflow-hidden shadow-inner border-4 border-slate-50 relative group">
          {categoryThumbnail ? (
            <img src={categoryThumbnail} alt={video.category} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <PlayCircle className="w-24 h-24 text-indigo-200" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </div>

        {/* Right side: Info and Actions */}
        <div className="flex flex-col gap-6 w-full md:w-2/3">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg">
                {video.category}
              </span>
              <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(video.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              {video.views !== undefined && (
                <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5 ml-2">
                  <Eye className="w-4 h-4" />
                  {video.views} views
                </span>
              )}
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              {video.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-base md:text-lg font-black uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl hover:shadow-2xl active:scale-95 group"
            >
              <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" /> Play Now
            </a>
            
            <button
              onClick={handleShare}
              className="bg-slate-50 text-slate-700 px-8 py-4 rounded-2xl text-base md:text-lg font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-100 transition-all border border-slate-200 shadow-sm active:scale-95"
            >
              {copied ? <Check className="w-6 h-6 text-emerald-500" /> : <Share2 className="w-6 h-6" />} 
              {copied ? 'Copied!' : 'Share Video'}
            </button>
          </div>
        </div>
      </div>

      {/* Up Next Spotlight Card */}
      {upNextVideo && (
        <div className="mt-16 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-200 fill-mode-both">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
              <PlayCircle className="w-6 h-6 text-indigo-500" /> Up Next
            </h3>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
              {relatedVideos.length} Related Videos
            </span>
          </div>

          <div 
            onClick={() => onSelectVideo(upNextVideo)}
            className="group cursor-pointer bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl hover:shadow-indigo-500/20 transition-all duration-500 border border-slate-800 flex flex-col md:flex-row min-h-[300px]"
          >
            {/* Background blur layer */}
            {categoryThumbnail && (
                <div className="absolute inset-0 opacity-20 hidden md:block">
                  <img src={categoryThumbnail} alt="" className="w-full h-full object-cover blur-3xl opacity-50" />
                </div>
            )}
            
            {/* Left Image Area */}
            <div className="w-full md:w-5/12 lg:w-4/12 relative bg-black shrink-0 overflow-hidden aspect-video md:aspect-auto">
                {categoryThumbnail ? (
                  <img src={categoryThumbnail} alt={upNextVideo.category} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
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
          <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest mb-6">
            More from {video.category}
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
                  {categoryThumbnail ? (
                    <img 
                      src={categoryThumbnail} 
                      alt={v.category} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-900/40">
                      <PlayCircle className="w-12 h-12 text-indigo-300 opacity-50" />
                    </div>
                  )}
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all duration-300">
                      <Play className="w-6 h-6 text-white fill-white ml-1" />
                    </div>
                  </div>
                  
                  {/* Duration/Category badge bottom right */}
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-white/10">
                    {v.category}
                  </div>
                </div>
                
                <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 text-base leading-snug mb-2">
                  {v.title}
                </h4>
                
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-auto">
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
