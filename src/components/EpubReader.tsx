import { useEffect, useRef, useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import ePub, { Rendition } from 'epubjs';

interface EpubReaderProps {
  url: string;
  onClose: () => void;
}

export function EpubReader({ url, onClose }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!viewerRef.current) return;

    const book = ePub(url);
    const newRendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
    });

    newRendition.display().then(() => {
      setIsLoading(false);
    });

    setRendition(newRendition);

    return () => {
      newRendition.destroy();
      book.destroy();
    };
  }, [url]);

  const handlePrev = () => {
    rendition?.prev();
  };

  const handleNext = () => {
    rendition?.next();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl h-[95vh] mx-auto rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-black text-slate-800 flex items-center gap-2 tracking-tighter uppercase italic">
            <BookOpen className="w-5 h-5 text-indigo-600" /> Reading View
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 bg-white relative">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 animate-pulse bg-white z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
              <span className="font-black text-[10px] text-slate-300 uppercase tracking-[0.4em]">Preparing Digital *ספר*...</span>
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
