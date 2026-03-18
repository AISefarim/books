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
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col p-4 backdrop-blur-sm">
      <div ref={containerRef} className={`bg-white w-full mx-auto flex flex-col overflow-hidden shadow-2xl ${isFullscreen ? 'h-screen max-w-none rounded-none' : 'max-w-5xl h-[95vh] rounded-[2.5rem]'}`}>
        <div className="p-5 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-black text-slate-800 flex items-center gap-2 tracking-tighter uppercase italic line-clamp-1">
            <BookOpen className="w-5 h-5 text-indigo-600" /> {book.title}
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors hidden sm:block"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
            <a
              href={book.epub}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Download
            </a>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 bg-white relative">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 animate-pulse bg-white z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
              <span className="font-black text-[10px] text-slate-300 uppercase tracking-[0.4em]">Preparing Digital *ספר*...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white z-10 p-8 text-center">
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
          <div ref={viewerRef} className="w-full h-full"></div>
        </div>

        <div className="p-5 border-t flex justify-between bg-slate-50 items-center">
          <button
            onClick={handlePrev}
            className="px-8 py-3 bg-white border border-slate-200 rounded-2xl font-bold hover:bg-slate-100 shadow-sm transition-all"
          >
            Prev
          </button>
          <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] italic hidden sm:block">
            AI Sefarim Digital Reader
          </div>
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-white border border-slate-200 rounded-2xl font-bold hover:bg-slate-100 shadow-sm transition-all"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
