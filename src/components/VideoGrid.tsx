import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { VideoCard } from './VideoCard';
import { PlayCircle, Folder, Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
  onMoveToFolder?: (videoId: string, newFolder: string) => void;
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

export const FolderDropZone: React.FC<{ folder: string }> = ({ folder }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder_${folder}`,
    data: { type: 'folder', folder }
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`px-4 py-3 rounded-xl border-2 flex items-center gap-2 font-bold transition-all ${
        isOver ? 'border-indigo-500 bg-indigo-50 text-indigo-700 scale-105' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      <Folder className={`w-4 h-4 ${isOver ? 'text-indigo-500' : 'text-slate-400'}`} /> 
      {folder || 'Main Directory'}
    </div>
  );
}

export function VideoGrid({ videos, isLoading, isAdmin, onEdit, onDelete, onSelectVideo, onReorder, onMoveToFolder, categoryThumbnails, savedVideoIds = [], onToggleSave }: VideoGridProps) {
  const [items, setItems] = useState(videos);
  const [newFolderInput, setNewFolderInput] = useState('');

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

    if (!over) return;

    if (over.data.current?.type === 'folder') {
      const folderName = over.data.current.folder;
      if (onMoveToFolder) {
        onMoveToFolder(String(active.id), folderName);
      }
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex) as Video[];
      setItems(newItems);
      if (onReorder) {
        onReorder(newItems);
      }
    }
  };

  const folders = (Array.from(new Set(items.map(v => v.folder || ''))) as string[]).sort();

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

  // Group items by folder
  const groupedItems = items.reduce((acc, video) => {
    const folder = video.folder || '';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(video);
    return acc;
  }, {} as Record<string, Video[]>);

  const gridContent = (
    <div className="space-y-12">
      {folders.map((folder) => (
        <div key={`group_${folder}`}>
          {folders.length > 1 && (
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
              <Folder className="w-5 h-5 text-indigo-500" />
              {folder || 'Main Directory'}
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {groupedItems[folder].map((video) => (
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
        </div>
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
          {isAdmin && onMoveToFolder && (
            <div className="mb-8 p-4 bg-slate-100 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-3 text-sm font-bold text-slate-500 uppercase tracking-widest">
                <span>Drag Videos Here to organize</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {folders.map(f => (
                  <FolderDropZone key={f} folder={f} />
                ))}
                
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={newFolderInput}
                    onChange={(e) => setNewFolderInput(e.target.value)}
                    placeholder="New folder..."
                    className="w-32 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {newFolderInput && (
                    <FolderDropZone folder={newFolderInput} />
                  )}
                </div>
              </div>
            </div>
          )}
          {gridContent}
        </SortableContext>
      </DndContext>
    );
  }

  return gridContent;
}
