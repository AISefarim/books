import React from 'react';
import { Trash2, ExternalLink, Download, Pencil, BookOpen } from 'lucide-react';
import { Book } from '../types';

interface BookCardProps {
  key?: string | number;
  book: Book;
  isAdmin: boolean;
  onEdit: (book: Book) => void;
  onDelete: (id: string, coverPath: string, epubPath: string) => void;
  onRead: (epubUrl: string) => void;
  onDownload: (epubUrl: string, title: string) => void;
}

export function BookCard({ book, isAdmin, onEdit, onDelete, onRead, onDownload }: BookCardProps) {
  return (
    <div className="bg-white rounded-[3rem] p-5 shadow-sm hover:shadow-2xl transition-all duration-700 border border-slate-100 flex flex-col group animate-in zoom-in-95">
      <div 
        className="aspect-[3/4] rounded-[2rem] overflow-hidden relative shadow-inner bg-slate-50 cursor-pointer"
        onClick={() => onRead(book.epub)}
      >
        <img
          src={book.cover}
          alt={book.title}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-center items-center p-8 backdrop-blur-[2px]">
          <div className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
            <BookOpen className="w-4 h-4" /> Read Online
          </div>
        </div>
      </div>
      <div className="py-8 px-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-black text-2xl uppercase leading-[0.85] text-slate-800 tracking-tighter">{book.title}</h3>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(book)}
                className="text-slate-300 hover:text-indigo-500 transition-colors p-2 bg-slate-50 hover:bg-indigo-50 rounded-full"
                title="Edit Sefer"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(book.id, book.coverPath, book.epubPath)}
                className="text-slate-300 hover:text-rose-500 transition-colors p-2 bg-slate-50 hover:bg-rose-50 rounded-full"
                title="Delete Sefer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mb-6">
          <p className="text-indigo-600 font-black text-xs uppercase tracking-tighter italic opacity-70">
            By {book.author}
          </p>
          {book.category && (
            <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md">
              {book.category}
            </span>
          )}
        </div>
        <p className="text-slate-500 text-sm line-clamp-3 mb-8 font-medium leading-relaxed">{book.desc}</p>
        <div className="mt-auto pt-6 border-t border-slate-50 flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => onRead(book.epub)}
              className="flex-1 bg-indigo-600 text-white px-2 py-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" /> Read
            </button>
            <button
              onClick={() => onDownload(book.epub, book.title)}
              className="flex-1 bg-indigo-50 text-indigo-700 px-2 py-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-indigo-100 transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Download
            </button>
          </div>
          {book.buyLink && (
            <a
              href={book.buyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-slate-50 text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-slate-100 transition-all border border-slate-100 shadow-sm active:scale-95"
            >
              Physical Copy <ExternalLink className="w-4 h-4 text-slate-400" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
