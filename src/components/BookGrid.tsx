import React from 'react';
import { Book as BookIcon } from 'lucide-react';
import { Book } from '../types';
import { BookCard } from './BookCard';

interface BookGridProps {
  books: Book[];
  isLoading: boolean;
  isAdmin: boolean;
  onDelete: (id: string, coverPath: string, epubPath: string) => void;
  onRead: (epubUrl: string) => void;
  onDownload: (epubUrl: string, title: string) => void;
}

export function BookGrid({ books, isLoading, isAdmin, onDelete, onRead, onDownload }: BookGridProps) {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          isAdmin={isAdmin}
          onDelete={onDelete}
          onRead={onRead}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
