import React, { useState } from 'react';
import { ArrowLeft, Share2, Check, ExternalLink, PlayCircle, Play } from 'lucide-react';
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

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?video=${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest text-xs bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </button>

      <div className="bg-white rounded-[3rem] p-6 md:p-12 shadow-xl border border-slate-100 mb-12 flex flex-col md:flex-row gap-8 items-center">
        {/* Left side: Thumbnail / Graphic */}
        <div className="w-full md:w-1/3 aspect-square rounded-[2rem] bg-indigo-50 flex items-center justify-center overflow-hidden shadow-inner border-4 border-slate-50 relative group">
          {categoryThumbnail ? (
            <img src={categoryThumbnail} alt={video.category} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
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
              <span className="text-slate-400 text-sm font-medium">
                {new Date(video.createdAt).toLocaleDateString()}
              </span>
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

      {relatedVideos.length > 0 && (
        <div className="mt-16">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
            <PlayCircle className="w-6 h-6 text-indigo-500" /> Related Videos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {relatedVideos.map(v => (
              <div 
                key={v.id}
                onClick={() => onSelectVideo(v)}
                className="bg-white rounded-[2rem] p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col group cursor-pointer"
              >
                <div className="aspect-square rounded-xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors overflow-hidden">
                  {categoryThumbnail ? (
                    <img src={categoryThumbnail} alt={v.category} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <PlayCircle className="w-10 h-10 text-indigo-300 group-hover:text-indigo-500 transition-colors group-hover:scale-110 duration-300" />
                  )}
                </div>
                <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 text-sm">
                  {v.title}
                </h4>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
