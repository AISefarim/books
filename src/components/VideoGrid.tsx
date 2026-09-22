import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { VideoCard } from './VideoCard';
import { PlayCircle, Folder, Plus, ArrowLeft, CheckSquare, Square, Upload, FolderPlus, ChevronRight } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function getFolderHierarchy(item: { folder?: string; subfolder?: string }) {
  if (item.subfolder && item.subfolder.trim()) {
    return {
      folder: (item.folder || '').trim(),
      subfolder: item.subfolder.trim()
    };
  }
  const folderStr = (item.folder || '').trim();
  if (folderStr.includes('/')) {
    const parts = folderStr.split('/').map(s => s.trim()).filter(Boolean);
    return {
      folder: parts[0] || '',
      subfolder: parts.slice(1).join(' / ') || ''
    };
  }
  return {
    folder: folderStr,
    subfolder: ''
  };
}

interface VideoGridProps {
  videos: Video[];
  isLoading: boolean;
  isAdmin: boolean;
  onEdit: (video: Video) => void;
  onDelete: (id: string) => void;
  onSelectVideo: (video: Video) => void;
  onReorder?: (reorderedVideos: Video[]) => void;
  onFolderReorder?: (reorderedFolders: string[]) => void;
  onMoveToFolder?: (videoId: string, newFolder: string, newSubfolder?: string) => void;
  categoryThumbnails?: Record<string, string>;
  folderThumbnails?: Record<string, string>;
  folderOrder?: string[];
  onUpdateFolderThumbnail?: (folder: string, file: File) => void;
  savedVideoIds?: string[];
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
  disableFolders?: boolean;
  mediaLabel?: 'Video' | 'Audio' | 'Podcast' | 'Media';
}

function SortableVideoWrapper({ video, isAdmin, onEdit, onDelete, onSelectVideo, categoryThumbnail, isSaved, onToggleSave, isSelected, onToggleSelect }: any) {
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
    <div ref={setNodeRef} style={style} className="relative group/wrapper">
      {isAdmin && onToggleSelect && (
        <div 
          className="absolute top-4 right-4 z-[60] bg-slate-900/90 backdrop-blur rounded-lg p-1.5 shadow-sm border border-slate-700 cursor-pointer hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-indigo-600"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(video.id);
          }}
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-indigo-600" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </div>
      )}
      <div className={isSelected ? 'ring-4 ring-indigo-500/50 rounded-[1.5rem] scale-95 transition-transform' : 'transition-transform'}>
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
    </div>
  );
}

function getMediaBreakdownText(mediaItems: Video[], mediaLabel = 'Media') {
  const videoCount = mediaItems.filter(v => v.type !== 'audio').length;
  const podcastCount = mediaItems.filter(v => v.type === 'audio').length;
  if (videoCount > 0 && podcastCount > 0) {
    return `${videoCount} ${videoCount === 1 ? 'Video' : 'Videos'} • ${podcastCount} ${podcastCount === 1 ? 'Podcast' : 'Podcasts'}`;
  }
  if (videoCount > 0) {
    return `${videoCount} ${videoCount === 1 ? 'Video' : 'Videos'}`;
  }
  if (podcastCount > 0) {
    return `${podcastCount} ${podcastCount === 1 ? 'Podcast' : 'Podcasts'}`;
  }
  return `0 ${mediaLabel}s`;
}

function SortableFolderWrapper({ folder, items, folderThumbnails, isAdmin, onUpdateFolderThumbnail, onSelectFolder, mediaLabel = 'Media' }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  const folderItems = items.filter((v: any) => getFolderHierarchy(v).folder === folder);
  const displayName = folder;
  const hasThumbnail = !!folderThumbnails?.[folder];

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div 
        onClick={() => onSelectFolder(folder)}
        className="group cursor-pointer flex flex-col h-full"
      >
        <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-slate-950 mb-4 shadow-sm border border-slate-800 group-hover:shadow-2xl group-hover:-translate-y-2 hover:border-indigo-100 transition-all duration-300">
          {isAdmin && (
            <div 
              {...listeners} 
              onClick={(e) => e.stopPropagation()} 
              className="absolute top-4 left-4 z-[60] bg-slate-900/90 backdrop-blur rounded-lg p-1.5 shadow-sm border border-slate-700 cursor-grab hover:scale-110 transition-all text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
              title="Drag to reorder"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </div>
          )}
          {isAdmin && onUpdateFolderThumbnail && (
            <div className="absolute top-4 right-4 z-[60]">
              <label 
                className="cursor-pointer bg-slate-900/90 backdrop-blur-md hover:bg-indigo-600 hover:text-white text-slate-400 p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
                title="Upload Folder Cover"
              >
                <Upload className="w-5 h-5" />
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) onUpdateFolderThumbnail(folder, e.target.files[0]);
                  }} 
                />
              </label>
            </div>
          )}
          
          {hasThumbnail ? (
            <img src={folderThumbnails[folder]} alt={displayName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none" />
          ) : (
            <div className="absolute inset-0 bg-slate-950/50 group-hover:bg-indigo-50/10 transition-colors duration-500 pointer-events-none flex items-center justify-center">
              <div className="w-24 h-24 bg-indigo-50/80 backdrop-blur rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500 border border-indigo-100/50 group-hover:border-indigo-600 shadow-inner">
                <Folder className="w-10 h-10 text-indigo-400 group-hover:text-white transition-colors duration-300 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
        
        <div className="px-2">
          <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors break-words hyphens-auto">
            {displayName}
          </h3>
          <p className="text-xs font-bold mt-2 uppercase tracking-widest text-slate-400">
            {getMediaBreakdownText(folderItems, mediaLabel)}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SubfolderCardProps {
  key?: React.Key;
  folder: string;
  subfolder: string;
  items?: Video[];
  count: number;
  thumbnail?: string;
  isAdmin: boolean;
  mediaLabel: string;
  onSelect: () => void;
  onUpdateThumbnail?: (folderKey: string, file: File) => void;
}

function SubfolderCard({
  folder,
  subfolder,
  items,
  count,
  thumbnail,
  isAdmin,
  mediaLabel,
  onSelect,
  onUpdateThumbnail
}: SubfolderCardProps) {
  return (
    <div 
      onClick={onSelect}
      className="group cursor-pointer flex flex-col h-full text-left"
    >
      <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-slate-950 mb-4 shadow-sm border border-slate-800 group-hover:shadow-2xl group-hover:-translate-y-2 hover:border-indigo-500/50 transition-all duration-300">
        {isAdmin && onUpdateThumbnail && (
          <div className="absolute top-4 right-4 z-[60]">
            <label 
              className="cursor-pointer bg-slate-900/90 backdrop-blur-md hover:bg-indigo-600 hover:text-white text-slate-400 p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              title="Upload Subfolder Cover"
            >
              <Upload className="w-5 h-5" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files?.[0]) onUpdateThumbnail(`${folder}/${subfolder}`, e.target.files[0]);
                }} 
              />
            </label>
          </div>
        )}
        
        {thumbnail ? (
          <img src={thumbnail} alt={subfolder} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none" />
        ) : (
          <div className="absolute inset-0 bg-slate-950/50 group-hover:bg-indigo-500/10 transition-colors duration-500 pointer-events-none flex items-center justify-center">
            <div className="w-20 h-20 bg-indigo-950/70 backdrop-blur rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500 border border-indigo-500/30 group-hover:border-indigo-600 shadow-inner">
              <Folder className="w-9 h-9 text-indigo-400 group-hover:text-white transition-colors duration-300 pointer-events-none" />
            </div>
          </div>
        )}
      </div>
      
      <div className="px-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">
          <FolderPlus className="w-3 h-3" />
          <span>Subfolder</span>
        </div>
        <h3 className="text-xl font-black text-slate-100 tracking-tight leading-tight group-hover:text-indigo-400 transition-colors break-words hyphens-auto">
          {subfolder}
        </h3>
        <p className="text-xs font-bold mt-1.5 uppercase tracking-widest text-slate-400">
          {items && items.length > 0 ? getMediaBreakdownText(items, mediaLabel) : `${count} ${count === 1 ? mediaLabel : `${mediaLabel}s`}`}
        </p>
      </div>
    </div>
  );
}

export function VideoGrid({ videos, isLoading, isAdmin, onEdit, onDelete, onSelectVideo, onReorder, onFolderReorder, onMoveToFolder, categoryThumbnails, folderThumbnails, folderOrder, onUpdateFolderThumbnail, savedVideoIds = [], onToggleSave, disableFolders, mediaLabel = 'Video' }: VideoGridProps) {
  const [items, setItems] = useState(videos);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  useEffect(() => {
    setItems(videos);
  }, [videos]);
  
  // Clear selection and subfolder when folder changes
  useEffect(() => {
    setSelectedSubfolder(null);
    setSelectedVideos([]);
  }, [selectedFolder]);

  useEffect(() => {
    setSelectedVideos([]);
  }, [selectedSubfolder]);

  const folders = disableFolders ? [] : (Array.from(new Set(items.map(v => getFolderHierarchy(v).folder))).filter(Boolean) as string[]).sort();
  let allFolders = [...folders];
  if (folderOrder && folderOrder.length > 0) {
    allFolders.sort((a, b) => {
      const idxA = folderOrder.indexOf(a);
      const idxB = folderOrder.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }

  // Items in active main folder
  const folderItems = disableFolders ? items : items.filter(v => getFolderHierarchy(v).folder === (selectedFolder || ''));

  // Subfolders inside active main folder
  const currentSubfolders = selectedFolder 
    ? (Array.from(new Set(folderItems.map(v => getFolderHierarchy(v).subfolder).filter(Boolean))) as string[]).sort()
    : [];

  // Items currently being displayed in the active list (in subfolder, direct in folder, or flat folder)
  const currentDisplayedItems = disableFolders 
    ? items 
    : selectedSubfolder 
      ? folderItems.filter(v => getFolderHierarchy(v).subfolder === selectedSubfolder)
      : currentSubfolders.length > 0
        ? folderItems.filter(v => getFolderHierarchy(v).subfolder === '')
        : folderItems;

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

  const handleFolderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = allFolders.indexOf(active.id as string);
      const newIndex = allFolders.indexOf(over.id as string);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newFolders = arrayMove(allFolders, oldIndex, newIndex);
        if (onFolderReorder) {
          onFolderReorder(newFolders);
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = currentDisplayedItems.findIndex((item) => item.id === active.id);
      const newIndex = currentDisplayedItems.findIndex((item) => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newCurrentItems = arrayMove(currentDisplayedItems, oldIndex, newIndex) as Video[];
        // Merge back into all items to preserve order of other folders
        const otherItems = items.filter(v => !currentDisplayedItems.some(c => c.id === v.id));
        const newItems = [...newCurrentItems, ...otherItems];
        setItems(newItems);
        if (onReorder) {
          onReorder(newCurrentItems);
        }
      }
    }
  };

  const handleToggleSelect = (videoId: string) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse bg-slate-900 rounded-[2rem] p-5 h-64 border border-slate-800">
            <div className="w-full aspect-video bg-slate-800 rounded-xl mb-4"></div>
            <div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-800 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-10">
        <div className="col-span-full py-32 text-center animate-in fade-in">
          <div className="bg-slate-900 p-16 rounded-[4rem] shadow-sm border border-slate-800 inline-block">
            <PlayCircle className="w-16 h-16 text-slate-100 mx-auto mb-6" />
            <p className="text-slate-300 font-black uppercase italic tracking-[0.2em]">No {mediaLabel.toLowerCase()}s yet</p>
          </div>
        </div>
      </div>
    );
  }

  // Folder Level View + Loose Videos
  if (selectedFolder === null && !disableFolders) {
    const looseVideos = items.filter(v => !getFolderHierarchy(v).folder);
    
    const foldersGrid = (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {allFolders.map(f => {
          if (isAdmin && onFolderReorder) {
            return (
              <SortableFolderWrapper
                key={f}
                folder={f}
                items={items}
                folderThumbnails={folderThumbnails}
                isAdmin={isAdmin}
                mediaLabel={mediaLabel}
                onUpdateFolderThumbnail={onUpdateFolderThumbnail}
                onSelectFolder={setSelectedFolder}
              />
            );
          }
          const folderItems = items.filter(v => getFolderHierarchy(v).folder === f);
          const displayName = f;
          const hasThumbnail = !!folderThumbnails?.[f];
          
          return (
            <div 
              key={f}
              onClick={() => setSelectedFolder(f)}
              className="group cursor-pointer flex flex-col h-full"
            >
              <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-slate-950 mb-4 shadow-sm border border-slate-800 group-hover:shadow-2xl group-hover:-translate-y-2 hover:border-indigo-100 transition-all duration-300">
                {isAdmin && onUpdateFolderThumbnail && (
                  <div className="absolute top-4 right-4 z-[60]">
                    <label 
                      className="cursor-pointer bg-slate-900/90 backdrop-blur-md hover:bg-indigo-600 hover:text-white text-slate-400 p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                      title="Upload Folder Cover"
                    >
                      <Upload className="w-5 h-5" />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => {
                          if (e.target.files?.[0]) onUpdateFolderThumbnail(f, e.target.files[0]);
                        }} 
                      />
                    </label>
                  </div>
                )}
                
                {hasThumbnail ? (
                  <img src={folderThumbnails[f]} alt={displayName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none" />
                ) : (
                  <div className="absolute inset-0 bg-slate-950/50 group-hover:bg-indigo-50/10 transition-colors duration-500 pointer-events-none flex items-center justify-center">
                    <div className="w-24 h-24 bg-indigo-50/80 backdrop-blur rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500 border border-indigo-100/50 group-hover:border-indigo-600 shadow-inner">
                      <Folder className="w-10 h-10 text-indigo-400 group-hover:text-white transition-colors duration-300 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="px-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors break-words hyphens-auto">
                  {displayName}
                </h3>
                <p className="text-xs font-bold mt-2 uppercase tracking-widest text-slate-400">
                  {getMediaBreakdownText(folderItems, mediaLabel)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );

    return (
      <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
        {allFolders.length > 0 && (
          <div>
            {isAdmin && onFolderReorder ? (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleFolderDragEnd}
              >
                <SortableContext 
                  items={allFolders}
                  strategy={rectSortingStrategy}
                >
                  {foldersGrid}
                </SortableContext>
              </DndContext>
            ) : foldersGrid}
          </div>
        )}
        
        {looseVideos.length > 0 && (
          <div>
            {allFolders.length > 0 && <h3 className="text-xl font-black text-slate-100 tracking-tight leading-tight px-4 mb-6 border-l-4 border-indigo-500 rounded-sm">Other {mediaLabel}s</h3>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {looseVideos.map(video => (
                <div key={video.id} className="relative group/wrapper">
                  <VideoCard
                    video={video}
                    isAdmin={isAdmin}
                    onEdit={() => onEdit(video)}
                    onDelete={onDelete}
                    onSelect={() => onSelectVideo(video)}
                    categoryThumbnail={
                      (video.subfolder && (folderThumbnails?.[`${video.folder}/${video.subfolder}`] || folderThumbnails?.[video.subfolder])) ||
                      (video.folder && folderThumbnails?.[video.folder]) || 
                      categoryThumbnails?.[video.category]
                    }
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Helper to render media cards
  const renderItemCards = (itemsToRender: Video[]) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
        {itemsToRender.map((video) => (
          isAdmin && onReorder ? (
            <SortableVideoWrapper
              key={video.id}
              video={video}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelectVideo={onSelectVideo}
              categoryThumbnail={
                (video.subfolder && (folderThumbnails?.[`${video.folder}/${video.subfolder}`] || folderThumbnails?.[video.subfolder])) ||
                (video.folder && folderThumbnails?.[video.folder]) || 
                categoryThumbnails?.[video.category]
              }
              isSaved={savedVideoIds.includes(video.id)}
              onToggleSave={onToggleSave}
              isSelected={selectedVideos.includes(video.id)}
              onToggleSelect={handleToggleSelect}
            />
          ) : (
            <div key={video.id} className="relative group/wrapper">
              {isAdmin && (
                <div 
                  className="absolute top-4 right-4 z-[60] bg-slate-900/90 backdrop-blur rounded-lg p-1.5 shadow-sm border border-slate-700 cursor-pointer hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-indigo-600 opacity-0 group-hover/wrapper:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(video.id);
                  }}
                >
                  {selectedVideos.includes(video.id) ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </div>
              )}
              <div className={selectedVideos.includes(video.id) ? 'ring-4 ring-indigo-500/50 rounded-[1.5rem] scale-95 transition-transform' : 'transition-transform'}>
                <VideoCard
                  video={video}
                  isAdmin={isAdmin}
                  onEdit={() => onEdit(video)}
                  onDelete={onDelete}
                  onSelect={() => onSelectVideo(video)}
                  categoryThumbnail={
                    (video.subfolder && (folderThumbnails?.[`${video.folder}/${video.subfolder}`] || folderThumbnails?.[video.subfolder])) ||
                    (video.folder && folderThumbnails?.[video.folder]) || 
                    categoryThumbnails?.[video.category]
                  }
                  isSaved={savedVideoIds.includes(video.id)}
                  onToggleSave={onToggleSave}
                />
              </div>
            </div>
          )
        ))}
      </div>
    );
  };

  // Videos inside a selected folder or subfolder
  const gridContent = (
    <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
      
      {(isAdmin || !disableFolders) && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${!disableFolders ? 'bg-slate-950 border border-slate-800 p-4 rounded-3xl' : 'justify-end mb-4'}`}>
          {!disableFolders && (
            <div className="flex flex-wrap items-center gap-3">
              {selectedSubfolder ? (
                <>
                  <button 
                    onClick={() => setSelectedSubfolder(null)}
                    className="px-4 py-2 bg-slate-900 text-slate-300 rounded-full font-black uppercase tracking-wider text-xs hover:bg-slate-800 hover:text-slate-50 transition-colors border border-slate-700 flex items-center gap-1.5 shadow-sm shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to {selectedFolder}
                  </button>
                  <div className="flex items-center gap-2 text-sm font-black">
                    <span 
                      onClick={() => setSelectedFolder(null)} 
                      className="text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors"
                    >
                      All Folders
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span 
                      onClick={() => setSelectedSubfolder(null)} 
                      className="text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors"
                    >
                      {selectedFolder}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-indigo-400 font-black">
                      {selectedSubfolder}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setSelectedFolder(null)}
                    className="px-4 py-2 bg-slate-900 text-slate-300 rounded-full font-black uppercase tracking-wider text-xs hover:bg-slate-800 hover:text-slate-50 transition-colors border border-slate-700 flex items-center gap-1.5 shadow-sm shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> All Folders
                  </button>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight px-2 border-l-2 border-slate-700">
                    {selectedFolder || 'Other'}
                  </h2>
                  {currentSubfolders.length > 0 && (
                    <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                      {currentSubfolders.length} Subfolder{currentSubfolders.length === 1 ? '' : 's'}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            {isAdmin && selectedFolder && !selectedSubfolder && onMoveToFolder && (
              <button
                onClick={() => {
                  const subName = prompt(`Enter new subfolder name in "${selectedFolder}":`);
                  if (subName && subName.trim()) {
                    setSelectedSubfolder(subName.trim());
                  }
                }}
                className="px-3.5 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 border border-indigo-500/30"
                title="Create a new subfolder"
              >
                <FolderPlus className="w-4 h-4" />
                <span>+ Subfolder</span>
              </button>
            )}

            {isAdmin && selectedVideos.length > 0 && (
              <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-2xl border border-slate-700 shadow-sm shrink-0">
                 <span className="text-xs font-black text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-3 py-1.5 rounded-xl">{selectedVideos.length} Selected</span>
                 <button
                   onClick={() => setSelectedVideos(currentDisplayedItems.map(v => v.id))}
                   className="text-[10px] font-black text-slate-400 hover:text-slate-100 uppercase tracking-widest px-3"
                 >Select All</button>
              </div>
            )}
            {isAdmin && selectedVideos.length === 0 && currentDisplayedItems.length > 0 && (
              <div className="shrink-0">
                <button
                   onClick={() => setSelectedVideos(currentDisplayedItems.map(v => v.id))}
                   className="text-[10px] font-black text-slate-400 hover:text-slate-100 uppercase tracking-widest bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-full shadow-sm hover:shadow"
                >Select All</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* When inside main folder, show Subfolders grid if any exist */}
      {selectedFolder && !selectedSubfolder && currentSubfolders.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {currentSubfolders.map(sub => {
              const subItems = folderItems.filter(v => getFolderHierarchy(v).subfolder === sub);
              const subThumbnail = folderThumbnails?.[`${selectedFolder}/${sub}`] || folderThumbnails?.[sub];
              return (
                <SubfolderCard
                  key={sub}
                  folder={selectedFolder}
                  subfolder={sub}
                  items={subItems}
                  count={subItems.length}
                  thumbnail={subThumbnail}
                  isAdmin={isAdmin}
                  mediaLabel={mediaLabel}
                  onSelect={() => setSelectedSubfolder(sub)}
                  onUpdateThumbnail={onUpdateFolderThumbnail}
                />
              );
            })}
          </div>

          {/* Standalone episodes directly in this folder without a subfolder */}
          {currentDisplayedItems.length > 0 && (
            <div className="pt-8 border-t border-slate-800">
              <h3 className="text-lg font-black text-slate-200 tracking-tight mb-6 px-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Direct / Standalone {mediaLabel}s in {selectedFolder}
              </h3>
              {renderItemCards(currentDisplayedItems)}
            </div>
          )}
        </div>
      )}

      {/* When inside a specific subfolder or flat folder with no subfolders */}
      {(selectedSubfolder || currentSubfolders.length === 0) && (
        currentDisplayedItems.length === 0 ? (
          <div className="py-20 text-center">
            <div className="bg-slate-950 p-12 rounded-3xl border border-slate-800 inline-block border-dashed">
              <Folder className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 font-bold">This folder has no {mediaLabel.toLowerCase()}s yet</p>
              {isAdmin && selectedFolder && (
                <p className="text-slate-500 text-xs mt-2">Use the publish form or bulk move to add {mediaLabel.toLowerCase()}s here.</p>
              )}
            </div>
          </div>
        ) : (
          renderItemCards(currentDisplayedItems)
        )
      )}

      {/* Floating Bulk Action Bar */}
      {isAdmin && selectedVideos.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 p-2 pr-4 pl-3 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-3 z-[100] animate-in slide-in-from-bottom-8 fade-in">
           <div className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap">
             {selectedVideos.length} Selected
           </div>
           
           <div className="flex items-center gap-2.5">
             <span className="text-slate-400 text-xs font-bold uppercase tracking-wider hidden sm:block whitespace-nowrap">
               Move to:
             </span>
             <select 
               className="bg-slate-800 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-w-[200px]"
               value=""
               onChange={(e) => {
                 const action = e.target.value;
                 if (action === '_create_new_folder_') {
                   const promptFolder = prompt("Enter new folder name:");
                   if (promptFolder && promptFolder.trim() && onMoveToFolder) {
                     selectedVideos.forEach(id => {
                       onMoveToFolder(id, promptFolder.trim(), '');
                     });
                     setSelectedVideos([]);
                   }
                   e.target.value = '';
                 } else if (action === '_create_new_subfolder_') {
                   const promptSub = prompt(`Enter new subfolder name in "${selectedFolder}":`);
                   if (promptSub && promptSub.trim() && onMoveToFolder && selectedFolder) {
                     selectedVideos.forEach(id => {
                       onMoveToFolder(id, selectedFolder, promptSub.trim());
                     });
                     setSelectedVideos([]);
                   }
                   e.target.value = '';
                 } else if (action === '_remove_all_folders_' && onMoveToFolder) {
                   selectedVideos.forEach(id => {
                     onMoveToFolder(id, '', '');
                   });
                   setSelectedVideos([]);
                 } else if (action === '_remove_subfolder_' && onMoveToFolder && selectedFolder) {
                   selectedVideos.forEach(id => {
                     onMoveToFolder(id, selectedFolder, '');
                   });
                   setSelectedVideos([]);
                 } else if (action.startsWith('subfolder:')) {
                   const sub = action.replace('subfolder:', '');
                   if (onMoveToFolder && selectedFolder) {
                     selectedVideos.forEach(id => {
                       onMoveToFolder(id, selectedFolder, sub);
                     });
                     setSelectedVideos([]);
                   }
                 } else if (action.startsWith('folder:')) {
                   const f = action.replace('folder:', '');
                   if (onMoveToFolder) {
                     selectedVideos.forEach(id => {
                       onMoveToFolder(id, f, '');
                     });
                     setSelectedVideos([]);
                   }
                 }
               }}
             >
               <option value="" disabled>Choose destination...</option>
               {selectedFolder && (
                 <optgroup label={`Subfolders in "${selectedFolder}"`}>
                   {currentSubfolders.filter(s => s !== (selectedSubfolder || '')).map(s => (
                     <option key={s} value={`subfolder:${s}`}>📁 {s}</option>
                   ))}
                   <option value="_create_new_subfolder_">✨ New Subfolder in "{selectedFolder}"...</option>
                   {selectedSubfolder && (
                     <option value="_remove_subfolder_">Move to Main Folder "{selectedFolder}"</option>
                   )}
                 </optgroup>
               )}
               <optgroup label="Main Folders">
                 {allFolders.filter(f => f !== (selectedFolder || '')).map(f => (
                   <option key={f} value={`folder:${f}`}>📁 {f}</option>
                 ))}
                 <option value="_create_new_folder_">✨ New Main Folder...</option>
                 <option value="_remove_all_folders_">Move to Root (No Folder)</option>
               </optgroup>
             </select>
           </div>
           
           <button 
             onClick={() => setSelectedVideos([])} 
             className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0 text-xs font-bold"
           >
             Cancel
           </button>
        </div>
      )}
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
          items={currentDisplayedItems.map(v => v.id)}
          strategy={rectSortingStrategy}
        >
          {gridContent}
        </SortableContext>
      </DndContext>
    );
  }

  return gridContent;
}
