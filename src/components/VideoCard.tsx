import React, { useState } from 'react';
import { Trash2, Share2, Check, PlayCircle, Edit2, GripVertical, Play, Eye, Star } from 'lucide-react';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onSelect: () => void;
  categoryThumbnail?: string;
  dragHandleProps?: Record<string, any>;
}

export function VideoCard({ video, isAdmin, onEdit, onDelete, onSelect, categoryThumbnail, dragHandleProps }: VideoCardProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/v/${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  // Elegantly separate title text from trailing numbers to highlight perfectly
  const renderTitle = (title: string) => {
    const match = title.match(/^(.*?)(\d+.*)?$/);
    if (match && match[2]) {
      return (
        <span className="group-hover:text-indigo-600 transition-colors">
          <span className="text-slate-800 group-hover:text-indigo-600 font-bold">{match[1].trim()}</span>
          <span className="ml-1.5 text-indigo-500 font-black tracking-tight text-xl bg-indigo-50 px-2 py-0.5 rounded-md inline-block -my-1">{match[2]}</span>
        </span>
      );
    }
    return <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{title}</span>;
  };

  return (
    <div 
      className="bg-white rounded-[1.5rem] p-3.5 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col group cursor-pointer"
      onClick={onSelect}
    >
      <div className="aspect-square rounded-[1rem] bg-slate-50 flex items-center justify-center relative overflow-hidden mb-4 border border-slate-100/50">
        
        {categoryThumbnail ? (
          <>
            <img 
              src={categoryThumbnail} 
              alt={video.category} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 z-0" 
            />

            {/* Bright, Airy Play Overlay - No dark muddy colors */}
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center z-10 duration-300">
               <div className="bg-white/95 p-4 rounded-full shadow-2xl scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 ease-out">
                 <Play className="w-8 h-8 text-indigo-600 fill-indigo-600 ml-1" />
               </div>
            </div>
            
            {/* Clean Category Pill */}
            <div className="absolute top-3 right-3 z-30">
              <span className="bg-white/95 backdrop-blur-md text-indigo-700 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200/50">
                {video.category}
              </span>
            </div>
          </>
        ) : (
          <div className="relative z-20 flex flex-col items-center">
            <PlayCircle className="w-12 h-12 text-indigo-300 group-hover:text-indigo-500 transition-colors group-hover:scale-110 duration-300" />
          </div>
        )}

        {isAdmin && dragHandleProps && (
          <div 
            {...dragHandleProps}
            className="absolute top-3 left-3 z-40 p-2 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-slate-200/60 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none text-slate-400 hover:text-indigo-600 hover:bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
      </div>
      
      <div className="flex-1 flex flex-col px-1">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="text-lg leading-tight line-clamp-2">
            {renderTitle(video.title)}
          </div>
          {isAdmin && (
            <div className="flex gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="text-slate-300 hover:text-indigo-500 transition-colors p-1.5 bg-slate-50 hover:bg-indigo-50 rounded-lg"
                title="Edit Video"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
                className="text-slate-300 hover:text-rose-500 transition-colors p-1.5 bg-slate-50 hover:bg-rose-50 rounded-lg"
                title="Delete Video"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
            {video.views !== undefined && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block"></span>
                <span className="flex items-center gap-1.5 text-indigo-400"><Eye className="w-3.5 h-3.5" />{video.views}</span>
              </>
            )}
            {video.ratingsCount ? (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block"></span>
                <span className="flex items-center gap-1 text-amber-500 font-black"><Star className="w-3.5 h-3.5 fill-amber-500" />{(video.ratingsSum! / video.ratingsCount).toFixed(1)}</span>
              </>
            ) : null}
          </div>
          <button
            onClick={handleShare}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-2 -mr-2 rounded-full hover:bg-slate-50"
            title="Copy Share Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
