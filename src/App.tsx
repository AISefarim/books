import { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';

import { db, storage, auth } from './lib/firebase';
import { Book } from './types';
import { Navbar } from './components/Navbar';
import { AdminPanel } from './components/AdminPanel';
import { BookGrid } from './components/BookGrid';
import { LoginModal } from './components/LoginModal';
import { EpubReader } from './components/EpubReader';
import { ConfirmModal } from './components/ConfirmModal';

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [readingUrl, setReadingUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, coverPath: string, epubPath: string } | null>(null);

  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
      showStatus(`Auth Error: ${err.message}`, 'error');
    });

    const booksRef = collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim');
    const unsubscribe = onSnapshot(booksRef, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Book));
      docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBooks(docs);
      setIsLoading(false);
    });

    return () => unsubscribe();
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

  const handleDownload = (url: string, title: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.epub`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Sales Banner */}
      <div className="bg-indigo-900 text-white py-3 px-4 sticky top-0 z-50 shadow-lg text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-300" /> WANT PHYSICAL COPIES?
          </p>
          <a
            href="https://www.lulu.com/shop/a-s/rambam-hilchot-maachalot-asurot-part-1/paperback/product-v2m5m4.html"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-indigo-900 px-8 py-1.5 rounded-full text-sm font-black hover:scale-105 transition-all uppercase shadow-md"
          >
            Shop AI Sefarim
          </a>
        </div>
      </div>

      <Navbar isAdmin={isAdmin} onToggleAdmin={handleToggleAdmin} />

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

        {isAdmin && <AdminPanel onStatusMessage={showStatus} />}

        <BookGrid
          books={books}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onDelete={handleDeleteRequest}
          onRead={setReadingUrl}
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

      {readingUrl && (
        <EpubReader
          url={readingUrl}
          onClose={() => setReadingUrl(null)}
        />
      )}
    </div>
  );
}
