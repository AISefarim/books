import React, { useState, useEffect } from 'react';
import { Book as BookIcon, Folder, ArrowLeft, Upload, BookOpen, Edit3 } from 'lucide-react';
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
        className="absolute top-2 left-2 z-[60] bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg cursor-grab hover:bg-white text-slate-400 hover:text-indigo-600 border border-slate-200"
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

export function BookGrid({ books, isLoading, isAdmin, onEdit, onDelete, onRead, onDownload, onSelectBook, savedBookIds = [], onToggleSave, seriesThumbnails, onUpdateSeriesThumbnail, onAddBookToSeries, onAddExistingBookToSeries, onReorder, searchQuery, onRenameSeries }: BookGridProps) {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [items, setItems] = useState(books);

  useEffect(() => {
    setItems(books);
  }, [books]);

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
          <div className="bg-white p-16 rounded-[4rem] shadow-sm border border-slate-100 inline-block">
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
        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight px-4 mb-6 border-l-4 border-indigo-500 rounded-sm">
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

  if (selectedSeries === null && seriesNames.length > 0) {
    const standaloneBooks = books.filter(b => !(b.series || ''));

    return (
      <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {seriesNames.map(seriesName => {
            const seriesBooks = books.filter(b => (b.series || '') === seriesName).sort((a, b) => (a.order || 0) - (b.order || 0));
            const count = seriesBooks.length;
            const book1 = seriesBooks[0];
            const book2 = seriesBooks.length > 1 ? seriesBooks[1] : null;
            const book3 = seriesBooks.length > 2 ? seriesBooks[2] : null;
            return (
              <div 
                key={seriesName}
                onClick={() => setSelectedSeries(seriesName)}
                className="group cursor-pointer flex flex-col h-full bg-slate-50/50 rounded-[3rem] p-5 shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 hover:border-indigo-100 hover:bg-white"
              >
                <div className="relative mb-6 mt-2 mr-3 ml-1 isolate">
                  <div className="absolute inset-0 bg-slate-200 rounded-[2rem] translate-x-3 -translate-y-3 -z-20 border border-slate-300 transition-transform duration-500 group-hover:translate-x-5 group-hover:-translate-y-5 rotate-3 origin-bottom-right overflow-hidden shadow-sm">
                    {book3?.coverUrl || book3?.thumbnailUrl ? (
                      <img src={book3.coverUrl || book3.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-50" />
                    ) : null}
                  </div>
                  <div className="absolute inset-0 bg-slate-100 rounded-[2rem] translate-x-1.5 -translate-y-1.5 -z-10 border border-slate-200 shadow-sm transition-transform duration-500 group-hover:translate-x-2.5 group-hover:-translate-y-2.5 rotate-1 origin-bottom-right overflow-hidden">
                    {book2?.coverUrl || book2?.thumbnailUrl ? (
                      <img src={book2.coverUrl || book2.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-80" />
                    ) : null}
                  </div>
                  
                  <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-white shadow-md border border-slate-100 transition-all duration-500 flex items-center justify-center group-hover:-translate-y-1 group-hover:-translate-x-1">
                    {book1?.coverUrl || book1?.thumbnailUrl ? (
                      <>
                        <img src={book1.coverUrl || book1.thumbnailUrl} alt={seriesName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
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
                      <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors break-words hyphens-auto">
                        {seriesName}
                      </h3>
                      <p className="text-[11px] font-bold mt-2 uppercase tracking-widest text-slate-400">
                        {count} {count === 1 ? 'Book' : 'Books'}
                      </p>
                    </div>
                    {isAdmin && onRenameSeries && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newName = window.prompt('Enter new series name:', seriesName);
                          if (newName && newName.trim() !== '' && newName !== seriesName) {
                            onRenameSeries(seriesName, newName.trim());
                          }
                        }}
                        className="p-2 -mr-2 bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-slate-200 transition-all opacity-0 group-hover:opacity-100"
                        title="Rename Series"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {standaloneBooks.length > 0 && (
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight px-4 mb-6 border-l-4 border-indigo-500 rounded-sm">Other Books</h3>
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

  const seriesBooks = selectedSeries ? items.filter(b => (b.series || '') === selectedSeries) : items;

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
      {selectedSeries && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-100 p-4 rounded-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button 
              onClick={() => setSelectedSeries(null)}
              className="px-5 py-2.5 bg-white text-slate-600 rounded-full font-black uppercase tracking-widest text-xs hover:bg-slate-100 hover:text-slate-900 transition-colors border-2 border-slate-200 flex items-center gap-2 shadow-sm shrink-0 w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> All Series
            </button>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight px-2 border-l-2 border-slate-200">
              {selectedSeries}
            </h2>
          </div>
          
          {isAdmin && onAddBookToSeries && (
            <div className="flex items-center gap-3">
              {onAddExistingBookToSeries && (
                <button
                  onClick={() => onAddExistingBookToSeries(selectedSeries)}
                  className="px-5 py-2.5 bg-white text-indigo-600 rounded-full font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors flex items-center gap-2 border-2 border-indigo-100 shadow-sm shrink-0 w-fit"
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
