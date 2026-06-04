import React, { useState } from 'react';
import { Book as BookIcon, Folder, ArrowLeft, Upload } from 'lucide-react';
import { Book } from '../types';
import { BookCard } from './BookCard';

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
  searchQuery?: string;
}

export function BookGrid({ books, isLoading, isAdmin, onEdit, onDelete, onRead, onDownload, onSelectBook, savedBookIds = [], onToggleSave, seriesThumbnails, onUpdateSeriesThumbnail, onAddBookToSeries, onAddExistingBookToSeries, searchQuery }: BookGridProps) {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

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
            const count = books.filter(b => (b.series || '') === seriesName).length;
            return (
              <div 
                key={seriesName}
                onClick={() => setSelectedSeries(seriesName)}
                className="group cursor-pointer flex flex-col h-full"
              >
                <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-slate-50 mb-4 shadow-sm border border-slate-100 group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 flex items-center justify-center">
                  {seriesThumbnails?.[seriesName] ? (
                    <>
                      <img src={seriesThumbnails[seriesName]} alt={seriesName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </>
                  ) : (
                    <div className="w-24 h-24 bg-indigo-50/80 backdrop-blur rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500 border border-indigo-100/50 group-hover:border-indigo-600 shadow-inner">
                      <Folder className="w-10 h-10 text-indigo-400 group-hover:text-white transition-colors duration-300 pointer-events-none" />
                    </div>
                  )}
                  
                  {isAdmin && onUpdateSeriesThumbnail && (
                    <div className="absolute top-3 right-3 z-[60]" onClick={e => e.stopPropagation()}>
                      <label className="cursor-pointer bg-white/90 backdrop-blur-md p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm border border-slate-200 flex items-center justify-center transition-colors">
                        <Upload className="w-4 h-4" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              onUpdateSeriesThumbnail(seriesName, e.target.files[0]);
                            }
                          }} 
                        />
                      </label>
                    </div>
                  )}
                </div>
                
                <div className="px-2">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">
                    {seriesName}
                  </h3>
                  <p className="text-[10px] font-bold mt-1 uppercase tracking-widest text-slate-500">
                    {count} {count === 1 ? 'Book' : 'Books'}
                  </p>
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

  const seriesBooks = selectedSeries ? books.filter(b => (b.series || '') === selectedSeries) : books;

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
    </div>
  );
}
