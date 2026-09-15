import React, { useState, useRef } from 'react';
import { X, Save, Loader2, UploadCloud } from 'lucide-react';
import { Book } from '../types';

interface EditBookModalProps {
  book: Book;
  onSave: (id: string, updatedData: Partial<Book>, newEpubFile?: File) => Promise<void>;
  onClose: () => void;
}

export function EditBookModal({ book, onSave, onClose }: EditBookModalProps) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [desc, setDesc] = useState(book.desc);
  const [category, setCategory] = useState(book.category || '');
  const [series, setSeries] = useState(book.series || '');
  const [buyLink, setBuyLink] = useState(book.buyLink || '');
  const [order, setOrder] = useState(book.order?.toString() || '');
  const [isFeatured, setIsFeatured] = useState(book.isFeatured || false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasNewFile, setHasNewFile] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedData: Partial<Book> = {
        title,
        author,
        desc,
        category,
        series: series.trim(),
        buyLink,
        isFeatured,
      };
      
      const parsedOrder = order ? parseInt(order, 10) : undefined;
      if (parsedOrder !== undefined && !isNaN(parsedOrder)) {
        updatedData.order = parsedOrder;
      }

      const newEpubFile = fileInputRef.current?.files?.[0];

      await onSave(book.id, updatedData, newEpubFile);
      onClose();
    } catch (error) {
      console.error("Failed to save book", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-100">Edit Sefer</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Author</label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Halacha, Machshava"
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Series (Folder)</label>
              <input
                type="text"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="e.g. Harry Potter, The Rambam Series"
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Rank Order (1 is highest)</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="e.g. 1, 2, 3... (Leave blank for default)"
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Physical Copy URL</label>
              <input
                type="url"
                value={buyLink}
                onChange={(e) => setBuyLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Replace EPUB File (Optional)</label>
            <div className="relative bg-slate-950 p-4 rounded-2xl border-2 border-slate-800 flex items-center justify-center group hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
              <span className={`text-xs font-black uppercase tracking-widest ${hasNewFile ? 'text-emerald-600' : 'text-slate-400'}`}>
                {hasNewFile ? 'NEW FILE SELECTED ✅' : 'CHOOSE NEW EPUB (OPTIONAL)'}
              </span>
              <input
                type="file"
                ref={fileInputRef}
                accept=".epub"
                onChange={() => setHasNewFile(!!fileInputRef.current?.files?.length)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Description</label>
            <textarea
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium resize-none"
            />
          </div>

          <div className="flex items-center gap-3 ml-2">
            <input
              type="checkbox"
              id="isFeatured"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isFeatured" className="text-sm font-bold text-slate-200 cursor-pointer">
              Feature this book at the top of the page
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-5 h-5" /> Save Changes</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
