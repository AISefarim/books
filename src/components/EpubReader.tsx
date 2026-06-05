import { useEffect, useRef, useState } from 'react';
import { X, BookOpen, Download, AlertCircle, Maximize, Minimize } from 'lucide-react';
import ePub, { Rendition } from 'epubjs';
import { Book } from '../types';

interface EpubReaderProps {
  book: Book;
  onClose: () => void;
}

export function EpubReader({ book, onClose }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!viewerRef.current) return;

    setIsLoading(true);
    setError(null);

    const epubBook = ePub(book.epub);
    const newRendition = epubBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
    });

    newRendition.display().then(() => {
      setIsLoading(false);
    }).catch((err) => {
      console.error("EPUB Load Error:", err);
      setError("Failed to load the book directly in the browser. This is usually due to Firebase Storage CORS settings. Please download the book to read it.");
      setIsLoading(false);
    });

    setRendition(newRendition);

    return () => {
      try {
        newRendition.destroy();
        epubBook.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [book.epub]);

  const handlePrev = () => {
    rendition?.prev();
  };

  const handleNext = () => {
    rendition?.next();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-white flex flex-col w-full h-full">
      <div className="px-6 py-4 flex justify-between items-center bg-white/80 backdrop-blur-sm shadow-sm z-20 border-b border-transparent hover:border-slate-100 transition-colors">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors group">
            <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
          <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
          <h3 className="font-black text-slate-800 flex items-center gap-2 tracking-tighter uppercase italic line-clamp-1">
            {book.title}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors hidden sm:block"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <a
            href={book.epub}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Download eBook
          </a>
        </div>
      </div>
      
      <div className="flex-1 bg-[#F9F7F1] relative overflow-hidden flex justify-center w-full">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 animate-pulse bg-white z-10 w-full h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
            <span className="font-black text-[10px] text-slate-400 uppercase tracking-[0.4em]">Preparing Digital *ספר*...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white z-10 p-8 text-center w-full h-full">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
            <h4 className="font-black text-xl text-slate-800 uppercase tracking-tight">Reader Unavailable</h4>
            <p className="text-slate-500 font-medium max-w-md">{error}</p>
            <a
              href={book.epub}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Download className="w-5 h-5" /> Download EPUB
            </a>
          </div>
        )}
        <div className="w-full max-w-5xl h-full flex z-0 relative">
          <div ref={viewerRef} className="w-full h-full"></div>
          
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-600 rounded-full shadow-sm hover:shadow-md transition-all backdrop-blur-md opacity-30 hover:opacity-100 hidden sm:block"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/50 hover:bg-white text-slate-600 rounded-full shadow-sm hover:shadow-md transition-all backdrop-blur-md opacity-30 hover:opacity-100 hidden sm:block"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="sm:hidden p-4 border-t border-slate-100 flex justify-between bg-white items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-20">
        <button
          onClick={handlePrev}
          className="px-6 py-3 bg-slate-50 border border-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-slate-50 border border-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}
