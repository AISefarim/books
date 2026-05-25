import React, { useState } from 'react';
import { X, Search, CheckCircle2, ChevronRight } from 'lucide-react';
import { Book } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface AddExistingBookModalProps {
  series: string;
  books: Book[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddExistingBookModal({ series, books, onClose, onSuccess }: AddExistingBookModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addingBookId, setAddingBookId] = useState<string | null>(null);

  // Filter books that are NOT already in this series
  const availableBooks = books.filter(b => (b.series || '') !== series);

  const filteredBooks = availableBooks.filter(b => {
    const searchLower = searchQuery.toLowerCase();
    return searchLower === '' || b.title.toLowerCase().includes(searchLower) || b.author.toLowerCase().includes(searchLower);
  });

  const handleAddBook = async (book: Book) => {
    setAddingBookId(book.id);
    try {
      const bookRef = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', book.id);
      await updateDoc(bookRef, { series });
      onSuccess();
      // Option to let them keep adding? Let's just keep the modal open but it updates reactively.
    } catch (error) {
      console.error("Error adding book to series:", error);
    } finally {
      setAddingBookId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Add to Series</h2>
            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">{series}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search books by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 font-medium">No available books found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBooks.map((book) => (
                <div key={book.id} className="flex flex-col sm:flex-row gap-4 p-3 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all bg-white group items-center">
                  {book.cover ? (
                    <img src={book.cover} alt={book.title} className="w-16 h-20 object-cover rounded-xl shadow-sm" />
                  ) : (
                    <div className="w-16 h-20 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100/50 shadow-inner">
                      <span className="text-2xl font-black text-indigo-200">{book.title.charAt(0)}</span>
                    </div>
                  )}
                  
                  <div className="flex-1 text-center sm:text-left">
                    <h4 className="font-bold text-slate-800 line-clamp-1">{book.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold line-clamp-1">{book.author}</p>
                    {book.series && (
                      <p className="text-xs text-amber-600 mt-1 uppercase tracking-wider font-black line-clamp-1 bg-amber-50 inline-block px-2 py-0.5 rounded-md">Currently in: {book.series}</p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleAddBook(book)}
                    disabled={addingBookId === book.id}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-100 text-indigo-700 font-black uppercase tracking-widest text-xs hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:bg-indigo-50"
                  >
                    {addingBookId === book.id ? 'Adding...' : 'Add to Series'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
