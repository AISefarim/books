import React, { useState } from 'react';
import { ArrowLeft, Share2, Check, ExternalLink, PlayCircle } from 'lucide-react';
import { Video } from '../types';

interface VideoDetailsProps {
  video: Video;
  relatedVideos: Video[];
  onBack: () => void;
  onSelectVideo: (video: Video) => void;
}

export function VideoDetails({ video, relatedVideos, onBack, onSelectVideo }: VideoDetailsProps) {
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

      <div className="bg-white rounded-[3rem] p-6 md:p-12 shadow-xl border border-slate-100 mb-12">
        <div className="flex flex-col gap-8">
          
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

          <div className="w-full aspect-video bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl relative">
            <iframe 
              src={video.url} 
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            ></iframe>
            {/* Fallback overlay if iframe is blocked by NotebookLM (which is likely) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-slate-900/10">
              {/* We keep it transparent so if iframe works, it's visible. If blocked, it might show a sad face, so we add a button below anyway */}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl hover:shadow-2xl active:scale-95"
            >
              <ExternalLink className="w-5 h-5" /> Open in NotebookLM
            </a>
            
            <button
              onClick={handleShare}
              className="bg-slate-50 text-slate-700 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 transition-all border border-slate-200 shadow-sm active:scale-95"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Share2 className="w-5 h-5" />} 
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
                <div className="aspect-video rounded-xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                  <PlayCircle className="w-10 h-10 text-indigo-300 group-hover:text-indigo-500 transition-colors group-hover:scale-110 duration-300" />
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
