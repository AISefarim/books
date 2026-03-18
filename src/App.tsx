import { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { ShoppingCart, CheckCircle, AlertCircle, Search } from 'lucide-react';

import { db, storage, auth } from './lib/firebase';
import { Book } from './types';
import { Navbar } from './components/Navbar';
import { AdminPanel } from './components/AdminPanel';
import { BookGrid } from './components/BookGrid';
import { LoginModal } from './components/LoginModal';
import { EpubReader } from './components/EpubReader';
import { ConfirmModal } from './components/ConfirmModal';
import { EditBookModal } from './components/EditBookModal';
import { SiteSettingsModal } from './components/SiteSettingsModal';

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, coverPath: string, epubPath: string } | null>(null);
  const [siteSettings, setSiteSettings] = useState<{ bannerUrl?: string, logoUrl?: string }>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
      showStatus(`Auth Error: ${err.message}`, 'error');
    });

    const booksRef = collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim');
    const unsubscribeBooks = onSnapshot(booksRef, (snapshot) => {
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as Book))
        .filter(d => d.id !== '_site_settings_' && !d.isSettingsDoc);
      docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBooks(docs);
      setIsLoading(false);
    });

    const settingsRef = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSiteSettings(docSnap.data() as any);
      }
    });

    return () => {
      unsubscribeBooks();
      unsubscribeSettings();
    };
  }, []);

  const showStatus = (message: string, type: 'success' | 'error') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 8000);
  };

  const handleToggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLogin = (password: string) => {
    setIsAdmin(true);
    setShowLoginModal(false);
  };

  const handleDeleteRequest = (id: string, coverPath: string, epubPath: string) => {
    setItemToDelete({ id, coverPath, epubPath });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, coverPath, epubPath } = itemToDelete;
    try {
      await deleteDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', id));
      if (coverPath) await deleteObject(ref(storage, coverPath));
      if (epubPath) await deleteObject(ref(storage, epubPath));
      showStatus('Successfully removed from ספריה and Cloud.', 'success');
    } catch (e: any) {
      showStatus(`Delete Error: ${e.message}`, 'error');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleDownload = async (url: string, title: string) => {
    try {
      showStatus('Preparing file...', 'success');
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `${title}.epub`, { type: 'application/epub+zip' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title,
          files: [file]
        });
        setStatus(null);
        return;
      }
      
      // Fallback to direct download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${title}.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      setStatus(null);
    } catch (e) {
      // Fallback if fetch fails (e.g. CORS)
      window.location.href = url;
      setStatus(null);
    }
  };

  const handleEditSave = async (id: string, updatedData: Partial<Book>) => {
    try {
      await updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', id), updatedData);
      showStatus('Sefer updated successfully.', 'success');
    } catch (e: any) {
      showStatus(`Update Error: ${e.message}`, 'error');
    }
  };

  const categories = Array.from(new Set(books.map(b => b.category || 'Uncategorized'))).sort();
  const filteredBooks = books.filter(b => {
    const matchesCategory = selectedCategory ? (b.category || 'Uncategorized') === selectedCategory : true;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchLower === '' || 
      b.title.toLowerCase().includes(searchLower) || 
      b.author.toLowerCase().includes(searchLower) || 
      b.desc.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const bannerUrl = siteSettings.bannerUrl || "https://www.lulu.com/shop/a-s/rambam-hilchot-maachalot-asurot-part-1/paperback/product-v2m5m4.html";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Sales Banner */}
      <div className="bg-indigo-900 text-white py-3 px-4 sticky top-0 z-50 shadow-lg text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-300" /> WANT PHYSICAL COPIES?
          </p>
          <a
            href={bannerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-indigo-900 px-8 py-1.5 rounded-full text-sm font-black hover:scale-105 transition-all uppercase shadow-md"
          >
            Shop AI Sefarim
          </a>
        </div>
      </div>

      <Navbar isAdmin={isAdmin} onToggleAdmin={handleToggleAdmin} logoUrl={siteSettings.logoUrl} />

      <main className="max-w-7xl mx-auto p-6 lg:p-12">
        {status && (
          <div
            className={`mb-6 p-5 rounded-3xl font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-lg shadow-emerald-50'
                : 'bg-rose-50 text-rose-700 border border-rose-100 shadow-lg shadow-rose-50'
            }`}
          >
            {status.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <span>{status.message}</span>
          </div>
        )}

        {isAdmin && <AdminPanel onStatusMessage={showStatus} onOpenSettings={() => setShowSettingsModal(true)} />}

        {!isLoading && books.length > 0 && (
          <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title, author, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 shadow-sm"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full md:w-auto">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  selectedCategory === null
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        <BookGrid
          books={filteredBooks}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onEdit={setEditingBook}
          onDelete={handleDeleteRequest}
          onRead={(url) => {
            const book = books.find(b => b.epub === url);
            if (book) setReadingBook(book);
          }}
          onDownload={handleDownload}
        />
      </main>

      {itemToDelete && (
        <ConfirmModal
          message="Permanently delete this Sefer and its files from the cloud?"
          onConfirm={confirmDelete}
          onCancel={() => setItemToDelete(null)}
        />
      )}

      {showLoginModal && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {readingBook && (
        <EpubReader
          book={readingBook}
          onClose={() => setReadingBook(null)}
        />
      )}

      {editingBook && (
        <EditBookModal
          book={editingBook}
          onSave={handleEditSave}
          onClose={() => setEditingBook(null)}
        />
      )}
      {showSettingsModal && (
        <SiteSettingsModal
          currentSettings={siteSettings}
          onClose={() => setShowSettingsModal(false)}
          onStatusMessage={showStatus}
        />
      )}
    </div>
  );
}
