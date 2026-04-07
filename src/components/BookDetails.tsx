import React from 'react';
import { BookOpen, Download, ShoppingCart, ChevronLeft, Share2, Check } from 'lucide-react';
import { Book } from '../types';

interface BookDetailsProps {
  book: Book;
  onBack: () => void;
  onRead: (epubUrl: string) => void;
  onDownload: (epubUrl: string, title: string) => void;
}

export function BookDetails({ book, onBack, onRead, onDownload }: BookDetailsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?book=${book.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold uppercase tracking-widest text-sm transition-colors"
      >
        <ChevronLeft className="w-5 h-5" /> Back to Library
      </button>

      <div className="relative bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[3rem] overflow-hidden shadow-2xl text-white">
        {/* Background blur effect */}
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center blur-2xl scale-110 transition-all duration-1000"
          style={{ backgroundImage: `url(${book.cover})` }}
        />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center p-8 md:p-12 gap-8 md:gap-16 min-h-[400px]">
          
          {/* Mobile Title & Badge (Hidden on Desktop) */}
          <div className="md:hidden flex flex-col items-center text-center space-y-4 w-full order-1">
            <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white drop-shadow-lg">
              {book.title}
            </h2>
          </div>

          {/* Left Content */}
          <div className="flex-1 space-y-6 text-center md:text-left order-3 md:order-1">
            
            <h2 className="hidden md:block text-5xl lg:text-6xl font-black uppercase leading-[0.9] tracking-tighter text-white drop-shadow-lg">
              {book.title}
            </h2>
            
            <p className="text-indigo-200 font-bold text-lg md:text-xl uppercase tracking-widest">
              By {book.author}
            </p>

            {book.category && (
              <span className="inline-block bg-white/10 text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/20">
                {book.category}
              </span>
            )}
            
            <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-2xl mx-auto md:mx-0">
              {book.desc}
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-4">
              <button
                onClick={() => onRead(book.epub)}
                className="bg-white text-indigo-900 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-xl hover:shadow-2xl active:scale-95"
              >
                <BookOpen className="w-5 h-5" /> Read Now
              </button>
              <button
                onClick={() => onDownload(book.epub, book.title)}
                className="bg-indigo-800/50 backdrop-blur-md text-white border border-indigo-500/30 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700/50 transition-all active:scale-95"
              >
                <Download className="w-5 h-5" /> Download
              </button>
              {book.buyLink && (
                <a
                  href={book.buyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-500 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl hover:shadow-2xl active:scale-95"
                >
                  <ShoppingCart className="w-5 h-5" /> Buy Physical
                </a>
              )}
              <button
                onClick={handleShare}
                className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/20 transition-all active:scale-95"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />} 
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>
          
          {/* Right Cover Image */}
          <div className="w-64 md:w-64 lg:w-80 shrink-0 perspective-1000 order-2 md:order-2">
            <div 
              className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl transform transition-all duration-700 hover:scale-105 hover:rotate-y-12 cursor-pointer border border-white/10"
              onClick={() => onRead(book.epub)}
            >
              <img
                src={book.cover}
                alt={book.title}
                className="w-full h-full object-cover animate-in fade-in zoom-in duration-500"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
