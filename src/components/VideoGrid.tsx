import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { VideoCard } from './VideoCard';
import { PlayCircle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VideoGridProps {
  videos: Video[];
  isLoading: boolean;
  isAdmin: boolean;
  onEdit: (video: Video) => void;
  onDelete: (id: string) => void;
  onSelectVideo: (video: Video) => void;
  onReorder?: (reorderedVideos: Video[]) => void;
  categoryThumbnails?: Record<string, string>;
  savedVideoIds?: string[];
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
}

function SortableVideoWrapper({ video, isAdmin, onEdit, onDelete, onSelectVideo, categoryThumbnail, isSaved, onToggleSave }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <VideoCard
        video={video}
        isAdmin={isAdmin}
        onEdit={() => onEdit(video)}
        onDelete={onDelete}
        onSelect={() => onSelectVideo(video)}
        categoryThumbnail={categoryThumbnail}
        dragHandleProps={{ ...attributes, ...listeners }}
        isSaved={isSaved}
        onToggleSave={onToggleSave}
      />
    </div>
  );
}

export function VideoGrid({ videos, isLoading, isAdmin, onEdit, onDelete, onSelectVideo, onReorder, categoryThumbnails, savedVideoIds = [], onToggleSave }: VideoGridProps) {
  const [items, setItems] = useState(videos);

  useEffect(() => {
    setItems(videos);
  }, [videos]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex) as Video[];
      setItems(newItems);
      if (onReorder) {
        onReorder(newItems);
      }
    }
  };

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

  const gridContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((video) => (
        isAdmin && onReorder ? (
          <SortableVideoWrapper
            key={video.id}
            video={video}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onDelete={onDelete}
            onSelectVideo={onSelectVideo}
            categoryThumbnail={categoryThumbnails?.[video.category]}
            isSaved={savedVideoIds.includes(video.id)}
            onToggleSave={onToggleSave}
          />
        ) : (
          <VideoCard
            key={video.id}
            video={video}
            isAdmin={isAdmin}
            onEdit={() => onEdit(video)}
            onDelete={onDelete}
            onSelect={() => onSelectVideo(video)}
            categoryThumbnail={categoryThumbnails?.[video.category]}
            isSaved={savedVideoIds.includes(video.id)}
            onToggleSave={onToggleSave}
          />
        )
      ))}
    </div>
  );

  if (isAdmin && onReorder) {
    return (
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={items.map(v => v.id)}
          strategy={rectSortingStrategy}
        >
          {gridContent}
        </SortableContext>
      </DndContext>
    );
  }

  return gridContent;
}
