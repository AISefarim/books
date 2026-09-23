import React, { useState, useEffect } from 'react';
import { Book as BookIcon, Folder, ArrowLeft, Upload, BookOpen, Edit3, Download, Share2, Sparkles } from 'lucide-react';
import { Book } from '../types';
import { BookCard } from './BookCard';
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

export const isZoharSeries = (name: string): boolean => {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return (
    n === 'zohar hakadosh (sabbagh edition)' ||
    (n.includes('zohar') && n.includes('sabbagh')) ||
    n.includes('zohar hakadosh')
  );
};

interface BookGridProps {
  books: Book[];
  isLoading: boolean;
  isAdmin: boolean;
  onEdit: (book: Book) => void;
  onDelete: (id: string, coverPath: string, epubPath: string) => void;
  onRead: (epubUrl: string) => void;
  onDownload: (epubUrl: string, title: string) => void;
  onSelectBook: (book: Book) => void;
  savedBookIds?: string[];
  onToggleSave?: (id: string) => void;
  seriesThumbnails?: Record<string, string>;
  onUpdateSeriesThumbnail?: (series: string, file: File) => void;
  onAddBookToSeries?: (series: string) => void;
  onAddExistingBookToSeries?: (series: string) => void;
  onReorder?: (books: Book[]) => void;
  searchQuery?: string;
  onRenameSeries?: (oldName: string, newName: string) => void;
  seriesOrder?: string[];
  onSeriesReorder?: (series: string[]) => void;
  onDownloadSeries?: (seriesName: string) => void;
  onShareSeries?: (seriesName: string) => void;
  onSeriesSelectChange?: (seriesName: string | null) => void;
  activeSeries?: string | null;
}

function SortableSeriesWrapper({ seriesName, isProminent, children }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `series-${seriesName}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative h-full ${isProminent ? 'col-span-1 sm:col-span-2 lg:col-span-2' : ''}`}>
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 left-2 z-[60] bg-slate-900/90 backdrop-blur-md p-2 rounded-xl shadow-lg cursor-grab hover:bg-slate-900 text-slate-400 hover:text-indigo-600 border border-slate-700"
        title="Drag to reorder series"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </div>
      {children}
    </div>
  );
}

function SortableBookWrapper({ book, isAdmin, onEdit, onDelete, onRead, onDownload, onSelect, isSaved, onToggleSave }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: book.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 left-2 z-[60] bg-slate-900/90 backdrop-blur-md p-2 rounded-xl shadow-lg cursor-grab hover:bg-slate-900 text-slate-400 hover:text-indigo-600 border border-slate-700"
        title="Drag to reorder"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </div>
      <BookCard 
        book={book} 
        isAdmin={isAdmin} 
        onEdit={onEdit} 
        onDelete={onDelete} 
        onRead={onRead} 
        onDownload={onDownload} 
        onSelect={onSelect} 
        isSaved={isSaved} 
        onToggleSave={onToggleSave} 
      />
    </div>
  );
}

export function BookGrid({ books, isLoading, isAdmin, onEdit, onDelete, onRead, onDownload, onSelectBook, savedBookIds = [], onToggleSave, seriesThumbnails, onUpdateSeriesThumbnail, onAddBookToSeries, onAddExistingBookToSeries, onReorder, searchQuery, onRenameSeries, seriesOrder, onSeriesReorder, onDownloadSeries, onShareSeries, onSeriesSelectChange, activeSeries = null }: BookGridProps) {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(activeSeries);
  const [items, setItems] = useState(books);

  useEffect(() => {
    setItems(books);
  }, [books]);

  const [currentSeriesOrder, setCurrentSeriesOrder] = useState<string[]>([]);

  useEffect(() => {
    if (activeSeries !== undefined) {
      setSelectedSeries(activeSeries);
    }
  }, [activeSeries]);

  const handleSeriesSelect = (series: string | null) => {
    setSelectedSeries(series);
    if (onSeriesSelectChange) {
      onSeriesSelectChange(series);
    }
  };

  useEffect(() => {
    setItems(books);
    
    // Update series order
    const currentSeriesNames = Array.from(new Set(books.map(b => b.series || ''))).filter(s => s !== '');
    let orderedNames = [...currentSeriesNames].sort((a, b) => {
      const aIsZohar = isZoharSeries(a);
      const bIsZohar = isZoharSeries(b);
      if (aIsZohar && !bIsZohar) return -1;
      if (!aIsZohar && bIsZohar) return 1;

      if (seriesOrder && seriesOrder.length > 0) {
        const indexA = seriesOrder.indexOf(a);
        const indexB = seriesOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      }
      return a.localeCompare(b);
    });
    setCurrentSeriesOrder(orderedNames);
  }, [books, seriesOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      if (String(active.id).startsWith('series-')) {
         const oldName = String(active.id).replace('series-', '');
         const newName = String(over.id).replace('series-', '');
         
         const oldIndex = currentSeriesOrder.indexOf(oldName);
         const newIndex = currentSeriesOrder.indexOf(newName);
         
         if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(currentSeriesOrder, oldIndex, newIndex) as string[];
            setCurrentSeriesOrder(newOrder);
            if (onSeriesReorder) {
               onSeriesReorder(newOrder);
            }
         }
         return;
      }

      const oldIndex = items.findIndex(v => v.id === active.id);
      const newIndex = items.findIndex(v => v.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const seriesItems = items.filter(b => (b.series || '') === selectedSeries);
        const oldSeriesIndex = seriesItems.findIndex(v => v.id === active.id);
        const newSeriesIndex = seriesItems.findIndex(v => v.id === over.id);
        
        const newSeriesItems = arrayMove(seriesItems, oldSeriesIndex, newSeriesIndex) as Book[];
        const otherItems = items.filter(b => (b.series || '') !== selectedSeries);
        const newItems = [...newSeriesItems, ...otherItems];
        
        setItems(newItems);
        if (onReorder) {
          onReorder(newSeriesItems);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        <div className="col-span-full py-20 text-center">
          <p className="text-slate-300 font-black italic uppercase tracking-widest animate-pulse">Opening ספריה...</p>
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        <div className="col-span-full py-32 text-center animate-in fade-in">
          <div className="bg-slate-900 p-16 rounded-[4rem] shadow-sm border border-slate-800 inline-block">
            <BookIcon className="w-16 h-16 text-slate-100 mx-auto mb-6" />
            <p className="text-slate-300 font-black uppercase italic tracking-[0.2em]">ספריה is empty</p>
          </div>
        </div>
      </div>
    );
  }

  const seriesNames = Array.from(new Set(books.map(b => b.series || ''))).filter(s => s !== '').sort();

  if (searchQuery) {
    return (
      <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
        <h3 className="text-xl font-black text-slate-100 tracking-tight leading-tight px-4 mb-6 border-l-4 border-indigo-500 rounded-sm">
          Search Results ({books.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onRead={onRead}
              onDownload={onDownload}
              onSelect={() => onSelectBook(book)}
              isSaved={savedBookIds.includes(book.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      </div>
    );
  }

  if (selectedSeries === null && currentSeriesOrder.length > 0) {
    const standaloneBooks = books.filter(b => !(b.series || ''));

    const renderSeriesCard = (seriesName: string) => {
      const isProminent = isZoharSeries(seriesName);
      const seriesBooks = books.filter(b => (b.series || '') === seriesName).sort((a, b) => (a.order || 0) - (b.order || 0));
      const count = seriesBooks.length;
      const book1 = seriesBooks[0];
      const book2 = seriesBooks.length > 1 ? seriesBooks[1] : null;
      const book3 = seriesBooks.length > 2 ? seriesBooks[2] : null;

      if (isProminent) {
        return (
          <div 
            onClick={() => handleSeriesSelect(seriesName)}
            className="group cursor-pointer flex flex-col sm:flex-row h-full bg-gradient-to-br from-indigo-950/85 via-slate-950 to-slate-900 rounded-[3rem] p-6 sm:p-7 shadow-2xl hover:shadow-[0_0_50px_rgba(99,102,241,0.35)] transition-all duration-500 border-2 border-indigo-500/60 hover:border-indigo-400 ring-2 ring-indigo-500/20 hover:ring-indigo-500/40 relative overflow-hidden items-center gap-6 sm:gap-8"
          >
            {/* Ambient lighting effects */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:bg-indigo-500/25 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20 group-hover:bg-amber-500/20 transition-all duration-700" />

            {/* 3D Book Stack */}
            <div className="relative isolate w-44 sm:w-52 shrink-0 my-1">
              <div className="absolute inset-0 bg-indigo-950 rounded-[2rem] translate-x-4 -translate-y-3 -z-20 border border-indigo-500/40 transition-transform duration-500 group-hover:translate-x-6 group-hover:-translate-y-5 rotate-4 origin-bottom-right overflow-hidden shadow-lg">
                {book3?.cover ? (
                  <img src={book3.cover} alt="" className="w-full h-full object-cover opacity-60" />
                ) : null}
              </div>
              <div className="absolute inset-0 bg-slate-800 rounded-[2rem] translate-x-2 -translate-y-1.5 -z-10 border border-indigo-400/40 shadow-md transition-transform duration-500 group-hover:translate-x-3.5 group-hover:-translate-y-3 rotate-2 origin-bottom-right overflow-hidden">
                {book2?.cover ? (
                  <img src={book2.cover} alt="" className="w-full h-full object-cover opacity-80" />
                ) : null}
              </div>
              
              <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-slate-900 shadow-2xl border-2 border-indigo-400/50 transition-all duration-500 flex items-center justify-center group-hover:-translate-y-1.5 group-hover:-translate-x-1.5 ring-1 ring-white/10">
                {book1?.cover || seriesThumbnails?.[seriesName] ? (
                  <>
                    <img 
                      src={book1?.cover || seriesThumbnails?.[seriesName]} 
                      alt={seriesName} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </>
                ) : (
                  <div className="w-24 h-24 bg-indigo-600/30 backdrop-blur rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500 border border-indigo-400/50 shadow-inner">
                    <BookOpen className="w-10 h-10 text-indigo-300 group-hover:text-white transition-colors duration-300 pointer-events-none" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Info and Call to Action */}
            <div className="flex-1 flex flex-col justify-between py-1 text-center sm:text-left z-10 w-full">
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest shadow-sm">
                    <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                    Featured Flagship Series
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest">
                    Sabbagh Edition
                  </span>
                </div>
                
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight group-hover:text-amber-200 transition-colors drop-shadow-sm mb-2.5">
                  {seriesName}
                </h3>
                
                <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed max-w-xl mx-auto sm:mx-0 line-clamp-2 sm:line-clamp-3 mb-4 font-normal">
                  {book1?.desc || "Authentic Holy Zohar translated and elucidated with comprehensive English commentary and sacred texts."}
                </p>
                
                <div className="flex items-center justify-center sm:justify-start gap-3 text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
                  <span className="px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-amber-300 font-black shadow-sm">
                    {count} {count === 1 ? 'Volume' : 'Volumes'} Available
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-3 border-t border-indigo-500/20">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30 group-hover:shadow-indigo-500/50">
                  <BookOpen className="w-4 h-4" /> Explore Complete Series
                </span>
                
                {isAdmin && onRenameSeries && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newName = window.prompt('Enter new series name:', seriesName);
                      if (newName && newName.trim() !== '' && newName !== seriesName) {
                        onRenameSeries(seriesName, newName.trim());
                      }
                    }}
                    className="p-2.5 bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded-xl shadow-sm border border-slate-700 transition-all ml-auto"
                    title="Rename Series"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }

      return (
        <div 
          onClick={() => handleSeriesSelect(seriesName)}
          className="group cursor-pointer flex flex-col h-full bg-slate-950/50 rounded-[3rem] p-5 shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-800 hover:border-indigo-100 hover:bg-slate-900"
        >
          <div className="relative mb-6 mt-2 mr-3 ml-1 isolate">
            <div className="absolute inset-0 bg-slate-700 rounded-[2rem] translate-x-3 -translate-y-3 -z-20 border border-slate-300 transition-transform duration-500 group-hover:translate-x-5 group-hover:-translate-y-5 rotate-3 origin-bottom-right overflow-hidden shadow-sm">
              {book3?.cover ? (
                <img src={book3.cover} alt="" className="w-full h-full object-cover opacity-50" />
              ) : null}
            </div>
            <div className="absolute inset-0 bg-slate-800 rounded-[2rem] translate-x-1.5 -translate-y-1.5 -z-10 border border-slate-700 shadow-sm transition-transform duration-500 group-hover:translate-x-2.5 group-hover:-translate-y-2.5 rotate-1 origin-bottom-right overflow-hidden">
              {book2?.cover ? (
                <img src={book2.cover} alt="" className="w-full h-full object-cover opacity-80" />
              ) : null}
            </div>
            
            <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-slate-900 shadow-md border border-slate-800 transition-all duration-500 flex items-center justify-center group-hover:-translate-y-1 group-hover:-translate-x-1">
              {book1?.cover || seriesThumbnails?.[seriesName] ? (
                <>
                  <img src={book1?.cover || seriesThumbnails?.[seriesName]} alt={seriesName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </>
              ) : (
                <div className="w-24 h-24 bg-indigo-50/80 backdrop-blur rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500 border border-indigo-100/50 group-hover:border-indigo-600 shadow-inner">
                  <Folder className="w-10 h-10 text-indigo-400 group-hover:text-white transition-colors duration-300 pointer-events-none" />
                </div>
              )}
            </div>
          </div>
          
          <div className="px-2 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest mb-3 border border-indigo-100/50">
                  <BookOpen className="w-3 h-3" />
                  Series
                </div>
                <h3 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors break-words hyphens-auto">
                  {seriesName}
                </h3>
                <p className="text-[11px] font-bold mt-2 uppercase tracking-widest text-slate-400">
                  {count} {count === 1 ? 'Book' : 'Books'}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isAdmin && onRenameSeries && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newName = window.prompt('Enter new series name:', seriesName);
                      if (newName && newName.trim() !== '' && newName !== seriesName) {
                        onRenameSeries(seriesName, newName.trim());
                      }
                    }}
                    className="p-2 -mr-2 bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-slate-900 rounded-xl shadow-sm border border-slate-700 transition-all"
                    title="Rename Series"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
        {isAdmin && onSeriesReorder ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={currentSeriesOrder.map(s => `series-${s}`)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {currentSeriesOrder.map((seriesName) => (
                  <SortableSeriesWrapper 
                    key={`series-${seriesName}`} 
                    seriesName={seriesName}
                    isProminent={isZoharSeries(seriesName)}
                  >
                    {renderSeriesCard(seriesName)}
                  </SortableSeriesWrapper>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {currentSeriesOrder.map(seriesName => (
              <div 
                key={seriesName} 
                className={isZoharSeries(seriesName) ? 'col-span-1 sm:col-span-2 lg:col-span-2' : ''}
              >
                {renderSeriesCard(seriesName)}
              </div>
            ))}
          </div>
        )}
        
        {standaloneBooks.length > 0 && (
          <div>
            <h3 className="text-xl font-black text-slate-100 tracking-tight leading-tight px-4 mb-6 border-l-4 border-indigo-500 rounded-sm">Other Books</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {standaloneBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRead={onRead}
                  onDownload={onDownload}
                  onSelect={() => onSelectBook(book)}
                  isSaved={savedBookIds.includes(book.id)}
                  onToggleSave={onToggleSave}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const seriesBooks = (selectedSeries ? items.filter(b => (b.series || '') === selectedSeries) : items)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
      {selectedSeries && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-4 rounded-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap flex-1">
            <button 
              onClick={() => handleSeriesSelect(null)}
              className="px-5 py-2.5 bg-slate-900 text-slate-300 rounded-full font-black uppercase tracking-widest text-xs hover:bg-slate-800 hover:text-slate-50 transition-colors border-2 border-slate-700 flex items-center gap-2 shadow-sm shrink-0 w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> All Series
            </button>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight px-2 border-l-2 border-slate-700">
                {selectedSeries}
              </h2>
              {isZoharSeries(selectedSeries) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                  Featured Series • Sabbagh Edition
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:ml-auto">
              {onShareSeries && (
                <button
                  onClick={() => onShareSeries(selectedSeries)}
                  className="px-5 py-3 rounded-xl sm:rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 bg-slate-900 text-indigo-600 hover:bg-indigo-50 border-2 border-indigo-100 hover:border-indigo-200 shadow-sm w-full sm:w-fit justify-center"
                >
                  <Share2 className="w-4 h-4" /> Share Series
                </button>
              )}
              {onDownloadSeries && (
                <button
                  onClick={() => onDownloadSeries(selectedSeries)}
                  className="px-8 py-4 rounded-2xl text-sm sm:text-base font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 w-full sm:w-fit border border-white/20 hover:-translate-y-1 active:translate-y-0 justify-center transform"
                >
                  <Download className="w-6 h-6 pointer-events-none animate-bounce" /> 
                  <span className="pointer-events-none drop-shadow-md">Download Entire Series Onto Device</span>
                </button>
              )}
            </div>
          </div>
          
          {isAdmin && onAddBookToSeries && (
            <div className="flex items-center gap-3">
              {onAddExistingBookToSeries && (
                <button
                  onClick={() => onAddExistingBookToSeries(selectedSeries)}
                  className="px-5 py-2.5 bg-slate-900 text-indigo-600 rounded-full font-black uppercase tracking-widest text-xs hover:bg-slate-950 transition-colors flex items-center gap-2 border-2 border-indigo-100 shadow-sm shrink-0 w-fit"
                >
                  <BookIcon className="w-4 h-4" /> Add Existing
                </button>
              )}
              <button
                onClick={() => onAddBookToSeries(selectedSeries)}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-full font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm shadow-indigo-600/20 shrink-0 w-fit"
              >
                <Upload className="w-4 h-4" /> Upload New
              </button>
            </div>
          )}
        </div>
      )}

      {isAdmin && onReorder && selectedSeries ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={seriesBooks.map(b => b.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {seriesBooks.map((book) => (
                <SortableBookWrapper
                  key={book.id}
                  book={book}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRead={onRead}
                  onDownload={onDownload}
                  onSelect={() => onSelectBook(book)}
                  isSaved={savedBookIds.includes(book.id)}
                  onToggleSave={onToggleSave}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {seriesBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onRead={onRead}
              onDownload={onDownload}
              onSelect={() => onSelectBook(book)}
              isSaved={savedBookIds.includes(book.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
