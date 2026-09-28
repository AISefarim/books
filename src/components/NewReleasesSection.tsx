import React, { useState } from 'react';
import { Sparkles, BookOpen, Bookmark, Share2, Check, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Book } from '../types';

interface NewReleasesSectionProps {
  books: Book[];
  isAdmin: boolean;
  onEdit: (book: Book) => void;
  onDelete: (id: string, coverPath: string, epubPath: string) => void;
  onRead: (epubUrl: string) => void;
  onDownload: (epubUrl: string, title: string) => void;
  onSelectBook: (book: Book) => void;
  savedBookIds?: string[];
  onToggleSave?: (id: string) => void;
  onViewAll?: () => void;
}

export function NewReleasesSection({
  books,
  isAdmin,
  onEdit,
  onDelete,
  onRead,
  onDownload: _onDownload,
  onSelectBook,
  savedBookIds = [],
  onToggleSave,
  onViewAll
}: NewReleasesSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Show only 5 most recent books to take up minimal screen real estate
  const recent5 = books.slice(0, 5);

  const handleShare = async (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    const url = `${window.location.origin}/b/${book.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(book.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  if (!recent5 || recent5.length === 0) return null;

  return (
    <section className="mb-8 bg-slate-900/40 rounded-2xl p-3.5 sm:p-4 border border-slate-800/80 shadow-md relative overflow-hidden">
      {/* Subtle warm glow background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header - Compact single-line bar */}
      <div className="relative z-10 flex items-center justify-between gap-3 mb-3.5 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-100 uppercase tracking-tight">
              New Releases
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
              5 Latest
            </span>
          </div>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="px-3 py-1 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-all flex items-center gap-1 shadow-sm shrink-0 active:scale-95"
          >
            <span>View Grid ({books.length})</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Compact Bookshelf: 5 books side-by-side (1 single row on desktop, swipeable on mobile) */}
      <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-5 overflow-x-auto sm:overflow-visible gap-2.5 sm:gap-3 pb-1 snap-x custom-scrollbar relative z-10">
        {recent5.map((book, idx) => {
          const isSaved = savedBookIds.includes(book.id);
          const isCopied = copiedId === book.id;
          const rank = idx + 1;

          return (
            <div
              key={book.id}
              onClick={() => onSelectBook(book)}
              className="group cursor-pointer bg-slate-950/70 hover:bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 hover:border-amber-500/40 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 w-36 sm:w-auto shrink-0 snap-start"
            >
              {/* Top part: Cover with rank badge & hover read overlay */}
              <div>
                <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800/80 shadow-inner flex items-center justify-center group/thumb">
                  {book.cover ? (
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-indigo-950/40 flex items-center justify-center text-indigo-400">
                      <BookOpen className="w-8 h-8 opacity-75" />
                    </div>
                  )}

                  {/* Rank tag in top corner */}
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono bg-slate-950/85 text-amber-400 border border-amber-500/30 backdrop-blur-sm shadow-sm">
                      #{rank}
                    </span>
                  </div>

                  {/* Read button overlay on hover */}
                  <div className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRead(book.epub);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] uppercase tracking-wider shadow-md transform scale-90 group-hover:scale-100 transition-transform flex items-center gap-1"
                    >
                      <BookOpen className="w-3 h-3" /> Read
                    </button>
                  </div>
                </div>

                {/* Book Metadata: Title & Author */}
                <h4 className="font-bold text-slate-100 group-hover:text-amber-400 text-xs leading-snug line-clamp-1 mt-2 transition-colors">
                  {book.title}
                </h4>

                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  {book.author}
                </p>
              </div>

              {/* Bottom bar: Category tag and quick actions */}
              <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-slate-800/60" onClick={e => e.stopPropagation()}>
                {book.category ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-indigo-500/20 truncate max-w-[70px]">
                    {book.category}
                  </span>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Save Bookmark */}
                  {onToggleSave && (
                    <button
                      onClick={() => onToggleSave(book.id)}
                      className={`p-1 rounded-md transition-all ${
                        isSaved ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-300'
                      }`}
                      title={isSaved ? "Saved" : "Save"}
                    >
                      <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-indigo-400' : ''}`} />
                    </button>
                  )}

                  {/* Share Link */}
                  <button
                    onClick={(e) => handleShare(e, book)}
                    className="p-1 rounded-md text-slate-500 hover:text-indigo-300 transition-all"
                    title="Share Link"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
                  </button>

                  {/* Admin controls */}
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => onEdit(book)}
                        className="p-1 rounded-md text-slate-500 hover:text-amber-300 transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDelete(book.id, book.coverPath, book.epubPath)}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
