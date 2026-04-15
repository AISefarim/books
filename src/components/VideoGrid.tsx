import React from 'react';
import { Video } from '../types';
import { VideoCard } from './VideoCard';
import { PlayCircle } from 'lucide-react';

interface VideoGridProps {
  videos: Video[];
  isLoading: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onSelectVideo: (video: Video) => void;
}

export function VideoGrid({ videos, isLoading, isAdmin, onDelete, onSelectVideo }: VideoGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-[2rem] p-5 h-64 border border-slate-100">
            <div className="w-full aspect-video bg-slate-100 rounded-xl mb-4"></div>
            <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-100 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-10">
        <div className="col-span-full py-32 text-center animate-in fade-in">
          <div className="bg-white p-16 rounded-[4rem] shadow-sm border border-slate-100 inline-block">
            <PlayCircle className="w-16 h-16 text-slate-100 mx-auto mb-6" />
            <p className="text-slate-300 font-black uppercase italic tracking-[0.2em]">No videos yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          isAdmin={isAdmin}
          onDelete={onDelete}
          onSelect={() => onSelectVideo(video)}
        />
      ))}
    </div>
  );
}
