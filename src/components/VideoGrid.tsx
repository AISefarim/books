import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { VideoCard } from './VideoCard';
import { PlayCircle, Folder, Plus, ArrowLeft, CheckSquare, Square, Upload } from 'lucide-react';
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
  folderThumbnails?: Record<string, string>;
  onUpdateFolderThumbnail?: (folder: string, file: File) => void;
  savedVideoIds?: string[];
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
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
          className="absolute top-4 right-4 z-[60] bg-white/90 backdrop-blur rounded-lg p-1.5 shadow-sm border border-slate-200 cursor-pointer hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-indigo-600"
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

export function VideoGrid({ videos, isLoading, isAdmin, onEdit, onDelete, onSelectVideo, onReorder, onMoveToFolder, categoryThumbnails, folderThumbnails, onUpdateFolderThumbnail, savedVideoIds = [], onToggleSave }: VideoGridProps) {
  const [items, setItems] = useState(videos);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [newFolderInput, setNewFolderInput] = useState('');

  useEffect(() => {
    setItems(videos);
  }, [videos]);
  
  // Clear selection when folder changes
  useEffect(() => {
    setSelectedVideos([]);
  }, [selectedFolder]);

  const folders = (Array.from(new Set(items.map(v => v.folder || ''))) as string[]).filter(f => f !== '').sort();
  const allFolders = folders;

  const currentFolderItems = items.filter(v => (v.folder || '') === (selectedFolder || ''));

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

    if (active.id !== over.id) {
      const oldIndex = currentFolderItems.findIndex((item) => item.id === active.id);
      const newIndex = currentFolderItems.findIndex((item) => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newCurrentItems = arrayMove(currentFolderItems, oldIndex, newIndex) as Video[];
        // Merge back into all items to preserve order of other folders
        const otherItems = items.filter(v => (v.folder || '') !== (selectedFolder || ''));
        const newItems = [...newCurrentItems, ...otherItems];
        setItems(newItems);
        if (onReorder) {
          onReorder(newItems);
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

  // Folder Level View + Loose Videos
  if (selectedFolder === null) {
    const looseVideos = items.filter(v => !(v.folder || ''));
    
    return (
      <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
        {allFolders.length > 0 && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {allFolders.map(f => {
                const count = items.filter(v => (v.folder || '') === f).length;
                const displayName = f;
                const hasThumbnail = !!folderThumbnails?.[f];
                
                return (
                  <div 
                    key={f}
                    onClick={() => setSelectedFolder(f)}
                    className={`bg-white rounded-[2rem] aspect-square p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-100 cursor-pointer hover:-translate-y-2 transition-all duration-300 flex flex-col ${hasThumbnail ? 'items-start justify-end text-left' : 'items-center justify-center text-center'} group relative overflow-hidden`}
                  >
                    {isAdmin && onUpdateFolderThumbnail && (
                      <div className="absolute top-4 right-4 z-20">
                        <label 
                          className="cursor-pointer bg-white/90 backdrop-blur-md hover:bg-indigo-600 hover:text-white text-slate-500 p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
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
                      <div className="absolute inset-0 z-0">
                        <img src={folderThumbnails[f]} alt={displayName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 z-0 bg-slate-50/50 group-hover:bg-indigo-50/10 transition-colors duration-500"></div>
                    )}
                    
                    {!hasThumbnail && (
                      <div className="relative z-10 w-24 h-24 mb-6 bg-indigo-50/80 backdrop-blur rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500 border border-indigo-100/50 group-hover:border-indigo-600 shadow-inner">
                        <Folder className="w-10 h-10 text-indigo-400 group-hover:text-white transition-colors duration-300" />
                      </div>
                    )}
                    
                    <div className={`relative z-10 w-full ${hasThumbnail ? 'mt-auto' : ''}`}>
                      <h3 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight px-1 ${hasThumbnail ? 'text-white' : 'text-slate-800'}`}>
                        {displayName}
                      </h3>
                      <p className={`text-xs font-bold mt-3 uppercase tracking-widest inline-block px-4 py-1.5 rounded-full backdrop-blur-sm ${hasThumbnail ? 'text-white/90 bg-white/20 hover:bg-white/30' : 'text-slate-500 bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-600'} transition-colors`}>
                        {count} {count === 1 ? 'Video' : 'Videos'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {looseVideos.length > 0 && (
          <div>
            {allFolders.length > 0 && <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight px-4 mb-6 border-l-4 border-indigo-500 rounded-sm">Other Videos</h3>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {looseVideos.map(video => (
                <div key={video.id} className="relative group/wrapper">
                  {isAdmin && (
                    <div 
                      className="absolute top-4 right-4 z-[60] bg-white/90 backdrop-blur rounded-lg p-1.5 shadow-sm border border-slate-200 cursor-pointer hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-indigo-600 opacity-0 group-hover/wrapper:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Bulk select would go here if we want to enable it for root view
                      }}
                    >
                      {/* Selection UI omitted for root view to keep it simple, but we still apply hover wrapper */}
                    </div>
                  )}
                  <VideoCard
                    video={video}
                    isAdmin={isAdmin}
                    onEdit={() => onEdit(video)}
                    onDelete={onDelete}
                    onSelect={() => onSelectVideo(video)}
                    categoryThumbnail={categoryThumbnails?.[video.category]}
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

  // Videos inside a selected folder
  const gridContent = (
    <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-3xl">
        <button 
          onClick={() => setSelectedFolder(null)}
          className="px-5 py-2.5 bg-white text-slate-600 rounded-full font-black uppercase tracking-widest text-xs hover:bg-slate-100 hover:text-slate-900 transition-colors border-2 border-slate-200 flex items-center gap-2 shadow-sm shrink-0 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> All Folders
        </button>
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight px-2 border-l-2 border-slate-200">
          {selectedFolder || 'Other'}
        </h2>
        <div className="flex-1"></div>
        {isAdmin && selectedVideos.length > 0 && (
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm shrink-0">
             <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">{selectedVideos.length} Selected</span>
             <button
               onClick={() => setSelectedVideos(currentFolderItems.map(v => v.id))}
               className="text-[10px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest px-3"
             >Select All</button>
          </div>
        )}
        {isAdmin && selectedVideos.length === 0 && (
          <div className="shrink-0">
            <button
               onClick={() => setSelectedVideos(currentFolderItems.map(v => v.id))}
               className="text-[10px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2.5 rounded-full shadow-sm hover:shadow"
            >Select All</button>
          </div>
        )}
      </div>

      {currentFolderItems.length === 0 ? (
        <div className="py-20 text-center">
          <div className="bg-slate-50 p-12 rounded-3xl border border-slate-100 inline-block border-dashed">
            <Folder className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">This folder is empty</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
          {currentFolderItems.map((video) => (
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
                isSelected={selectedVideos.includes(video.id)}
                onToggleSelect={handleToggleSelect}
              />
            ) : (
              <div key={video.id} className="relative group/wrapper">
                 {isAdmin && (
                    <div 
                      className="absolute top-4 right-4 z-[60] bg-white/90 backdrop-blur rounded-lg p-1.5 shadow-sm border border-slate-200 cursor-pointer hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-indigo-600 opacity-0 group-hover/wrapper:opacity-100"
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
                      categoryThumbnail={categoryThumbnails?.[video.category]}
                      isSaved={savedVideoIds.includes(video.id)}
                      onToggleSave={onToggleSave}
                    />
                  </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {isAdmin && selectedVideos.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 p-2 pr-4 pl-2 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 z-[100] animate-in slide-in-from-bottom-8 fade-in">
           <div className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm whitespace-nowrap">{selectedVideos.length} Selected</div>
           
           <div className="flex items-center gap-3">
             <span className="text-slate-400 text-xs font-bold uppercase tracking-widest hidden sm:block whitespace-nowrap">Move to</span>
             <select 
               className="bg-slate-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-w-[160px] sm:min-w-[200px]"
               value=""
               onChange={(e) => {
                 const targetFolder = e.target.value;
                 if (targetFolder === '_create_new_') {
                   const promptFolder = prompt("Enter new folder name:");
                   if (promptFolder && promptFolder.trim() && onMoveToFolder) {
                     selectedVideos.forEach(id => {
                       onMoveToFolder(id, promptFolder.trim());
                     });
                     setSelectedVideos([]);
                   }
                   e.target.value = '';
                 } else if (targetFolder === '_remove_folder_' && onMoveToFolder) {
                   // Move to grid
                   selectedVideos.forEach(id => {
                     onMoveToFolder(id, '');
                   });
                   setSelectedVideos([]);
                 } else if (targetFolder && onMoveToFolder) {
                   // Move items
                   selectedVideos.forEach(id => {
                     onMoveToFolder(id, targetFolder);
                   });
                   setSelectedVideos([]);
                 }
               }}
             >
               <option value="" disabled>Choose Folder...</option>
               {allFolders.filter(f => f !== (selectedFolder || '')).map(f => (
                 <option key={f} value={f}>{f}</option>
               ))}
               <option value="_remove_folder_">Move to Grid (Remove from folder)</option>
               <option value="_create_new_">✨ New Folder...</option>
             </select>
           </div>
           
           <button 
             onClick={() => setSelectedVideos([])} 
             className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0"
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
        collisionDetection={pointerWithin}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={currentFolderItems.map(v => v.id)}
          strategy={rectSortingStrategy}
        >
          {gridContent}
        </SortableContext>
      </DndContext>
    );
  }

  return gridContent;
}
