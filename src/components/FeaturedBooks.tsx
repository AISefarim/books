import React, { useState, useEffect } from 'react';
import { BookOpen, Download, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { Book } from '../types';

interface FeaturedBooksProps {
  books: Book[];
  onRead: (epubUrl: string) => void;
  onDownload: (epubUrl: string, title: string) => void;
  onSelect?: (book: Book) => void;
}

export function FeaturedBooks({ books, onRead, onDownload, onSelect }: FeaturedBooksProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (books.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % books.length);
    }, 6000); // Rotate every 6 seconds

    return () => clearInterval(interval);
  }, [books.length]);

  if (books.length === 0) return null;

  const currentBook = books[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + books.length) % books.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % books.length);
  };

  return (
    <div className="mb-16 relative bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[3rem] overflow-hidden shadow-2xl text-white">
      {/* Background blur effect */}
      <div 
        className="absolute inset-0 opacity-20 bg-cover bg-center blur-2xl scale-110 transition-all duration-1000"
        style={{ backgroundImage: `url(${currentBook.cover})` }}
      />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center p-8 md:p-12 gap-8 md:gap-16 min-h-[400px]">
        
        {/* Mobile Title & Badge (Hidden on Desktop) */}
        <div className="md:hidden flex flex-col items-center text-center space-y-4 w-full order-1">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-widest text-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Featured Sefer
          </div>
          <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white drop-shadow-lg">
            {currentBook.title}
          </h2>
        </div>

        {/* Left Content */}
        <div className="flex-1 space-y-6 text-center md:text-left order-3 md:order-1">
          <div className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-widest text-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Featured Sefer
          </div>
          
          <h2 className="hidden md:block text-5xl lg:text-6xl font-black uppercase leading-[0.9] tracking-tighter text-white drop-shadow-lg">
            {currentBook.title}
          </h2>
          
          <p className="text-indigo-200 font-bold text-lg md:text-xl uppercase tracking-widest">
            By {currentBook.author}
          </p>
          
          <p className="text-slate-300 text-sm md:text-base line-clamp-3 leading-relaxed max-w-2xl mx-auto md:mx-0">
            {currentBook.desc}
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-4">
            {currentBook.buyLink && (
              <a
                href={currentBook.buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-indigo-900 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-xl hover:shadow-2xl active:scale-95"
              >
                <ShoppingCart className="w-5 h-5" /> Buy Physical
              </a>
            )}
          </div>
        </div>
        
        {/* Right Cover Image */}
        <div className="w-64 md:w-64 lg:w-80 shrink-0 perspective-1000 order-2 md:order-2">
          <div 
            className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl transform transition-all duration-700 hover:scale-105 hover:rotate-y-12 cursor-pointer border border-white/10"
            onClick={() => onSelect ? onSelect(currentBook) : onRead(currentBook.epub)}
          >
            <img
              key={currentBook.id} // Force re-render for animation
              src={currentBook.cover}
              alt={currentBook.title}
              className="w-full h-full object-cover animate-in fade-in zoom-in duration-500"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      {books.length > 1 && (
        <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
          <button 
            onClick={handlePrev}
            className="p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-black/40 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1.5 px-4">
            {books.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
          <button 
            onClick={handleNext}
            className="p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-black/40 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
