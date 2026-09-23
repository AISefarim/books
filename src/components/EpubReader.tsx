import { useEffect, useRef, useState } from 'react';
import { X, BookOpen, Download, AlertCircle, Maximize, Minimize } from 'lucide-react';
import ePub, { Rendition } from 'epubjs';
import { Book } from '../types';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

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
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('epub-font-size')) || 100);
  const [theme, setTheme] = useState(() => localStorage.getItem('epub-theme') || 'light');
  const [showControls, setShowControls] = useState(true);
  const toggleControls = () => setShowControls(v => !v);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!rendition) return;
    rendition.themes.register('light', { body: { background: '#F9F7F1', color: '#1a1a1a' } });
    rendition.themes.register('sepia', { body: { background: '#f4ecd8', color: '#3b2f2f' } });
    rendition.themes.register('dark', { body: { background: '#1a1a1a', color: '#e5e5e5' } });
    rendition.themes.select(theme);
    rendition.themes.fontSize(`${fontSize}%`);
  }, [rendition, theme, fontSize]);

  useEffect(() => {
    localStorage.setItem('epub-font-size', String(fontSize));
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      const userRef = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'users', auth.currentUser.uid);
      setDoc(userRef, { fontSize, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    }
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('epub-theme', theme);
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      const userRef = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'users', auth.currentUser.uid);
      setDoc(userRef, { theme, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    }
  }, [theme]);

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

    const savedCfi = localStorage.getItem(`epub-progress-${book.id}`);

    newRendition.display(savedCfi || undefined).then(() => {
      setIsLoading(false);
    }).catch((err) => {
      console.error("EPUB Load Error:", err);
      setError("Failed to load the book directly in the browser. This is usually due to Firebase Storage CORS settings. Please download the book to read it.");
      setIsLoading(false);
    });

    newRendition.on('relocated', (location: any) => {
      if (location?.start?.cfi) {
        localStorage.setItem(`epub-progress-${book.id}`, location.start.cfi);
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          const userRef = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'users', auth.currentUser.uid);
          setDoc(userRef, {
            readingProgress: {
              [book.id]: location.start.cfi
            },
            updatedAt: Date.now()
          }, { merge: true }).catch(() => {});
        }
      }
    });

    setRendition(newRendition);
    newRendition.on('click', toggleControls);

    return () => {
      try {
        newRendition.destroy();
        epubBook.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [book.epub, book.id]);

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
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] flex flex-col w-full h-full transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#1a1a1a]' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-[#F9F7F1]'
      }`}
    >
      <div className={`absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-center z-20 transition-opacity duration-300 bg-gradient-to-b from-black/20 to-transparent pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto">
          <button onClick={onClose} className="p-2 sm:p-3 text-white hover:bg-slate-900/20 rounded-full transition-colors group backdrop-blur-sm shadow-sm" aria-label="Close">
            <X className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform drop-shadow" />
          </button>
          <div className="bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-lg border border-white/20">
            <h3 className="font-black text-slate-100 text-xs sm:text-sm flex items-center tracking-tighter uppercase italic line-clamp-1 max-w-[120px] sm:max-w-xs">
              {book.title}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto">
          <button
            onClick={() => setFontSize(f => Math.max(70, f - 10))}
            className="p-2 text-white hover:bg-slate-900/20 rounded-full transition-colors backdrop-blur-sm font-black text-xs min-w-[32px] drop-shadow"
            title="Smaller text"
          >
            A-
          </button>
          <button
            onClick={() => setFontSize(f => Math.min(200, f + 10))}
            className="p-2 text-white hover:bg-slate-900/20 rounded-full transition-colors backdrop-blur-sm font-black text-xs min-w-[32px] drop-shadow"
            title="Larger text"
          >
            A+
          </button>
          <button
            onClick={() => setTheme(t => t === 'light' ? 'sepia' : t === 'sepia' ? 'dark' : 'light')}
            className="p-2 text-white hover:bg-slate-900/20 rounded-full transition-colors backdrop-blur-sm text-sm drop-shadow"
            title="Change theme"
          >
            {theme === 'light' ? '☀️' : theme === 'sepia' ? '📖' : '🌙'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-white hover:bg-slate-900/20 rounded-full transition-colors hidden sm:block backdrop-blur-sm drop-shadow"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <a
            href={book.epub}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg border border-indigo-500/50"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download eBook</span><span className="sm:hidden">Get</span>
          </a>
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden flex justify-center w-full h-full pt-0">
        {isLoading && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-6 animate-pulse z-10 w-full h-full ${
              theme === 'dark' ? 'bg-[#1a1a1a]' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-[#F9F7F1]'
            }`}
          >
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
            <span className="font-black text-[10px] text-slate-400 uppercase tracking-[0.4em]">Preparing Digital *ספר*...</span>
          </div>
        )}
        {error && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 p-8 text-center w-full h-full ${
              theme === 'dark' ? 'bg-[#1a1a1a]' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-[#F9F7F1]'
            }`}
          >
            <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
            <h4 className="font-black text-xl text-slate-100 uppercase tracking-tight">Reader Unavailable</h4>
            <p className="text-slate-400 font-medium max-w-md">{error}</p>
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
        <div onClick={toggleControls} className="w-full max-w-[1200px] h-full flex z-0 relative pt-16 sm:pt-20 pb-16 sm:pb-0 px-2 sm:px-12">
          <div ref={viewerRef} className="w-full h-full"></div>
          
          <button
            onClick={handlePrev}
            className={`absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-slate-900/50 hover:bg-slate-900 text-slate-300 rounded-full shadow-md hover:shadow-lg transition-all transition-opacity duration-300 backdrop-blur-md opacity-0 hover:opacity-100 sm:opacity-30 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 z-20 -ml-5 sm:ml-0 group ${showControls ? '' : ' opacity-0 pointer-events-none'}`}
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={handleNext}
            className={`absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-slate-900/50 hover:bg-slate-900 text-slate-300 rounded-full shadow-md hover:shadow-lg transition-all transition-opacity duration-300 backdrop-blur-md opacity-0 hover:opacity-100 sm:opacity-30 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 z-20 -mr-5 sm:mr-0 group ${showControls ? '' : ' opacity-0 pointer-events-none'}`}
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`sm:hidden absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-full shadow-xl border border-slate-800 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={handlePrev}
          className="px-6 py-2 bg-slate-800 text-slate-200 rounded-full font-black text-xs uppercase tracking-wider hover:bg-slate-700 transition-all focus:bg-indigo-100"
        >
          Previous
        </button>
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-slate-800 text-slate-200 rounded-full font-black text-xs uppercase tracking-wider hover:bg-slate-700 transition-all focus:bg-indigo-100"
        >
          Next
        </button>
      </div>
    </div>
  );
}
