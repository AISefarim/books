import React, { useState } from 'react';
import { Trash2, Share2, Check, PlayCircle, Edit2 } from 'lucide-react';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onSelect: () => void;
  categoryThumbnail?: string;
}

export function VideoCard({ video, isAdmin, onEdit, onDelete, onSelect, categoryThumbnail }: VideoCardProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <div 
      className="bg-white rounded-[2rem] p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col group cursor-pointer"
      onClick={onSelect}
    >
      <div className="aspect-square rounded-xl bg-indigo-50 flex items-center justify-center relative overflow-hidden mb-4 group-hover:bg-indigo-100 transition-colors">
        {categoryThumbnail ? (
          <>
            <img src={categoryThumbnail} alt={video.category} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
              <PlayCircle className="w-12 h-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 drop-shadow-md" />
            </div>
          </>
        ) : (
          <PlayCircle className="w-12 h-12 text-indigo-300 group-hover:text-indigo-500 transition-colors group-hover:scale-110 duration-300" />
        )}
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-white/90 backdrop-blur text-indigo-700 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-sm">
            {video.category}
          </span>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="font-bold text-lg leading-tight text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
            {video.title}
          </h3>
          {isAdmin && (
            <div className="flex gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="text-slate-300 hover:text-indigo-500 transition-colors p-2 bg-slate-50 hover:bg-indigo-50 rounded-full"
                title="Edit Video"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
                className="text-slate-300 hover:text-rose-500 transition-colors p-2 bg-slate-50 hover:bg-rose-50 rounded-full"
                title="Delete Video"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
          <span className="text-xs font-medium text-slate-400">
            {new Date(video.createdAt).toLocaleDateString()}
          </span>
          <button
            onClick={handleShare}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-2 bg-slate-50 hover:bg-indigo-50 rounded-full"
            title="Copy Share Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
