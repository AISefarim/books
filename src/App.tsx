import { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { ShoppingCart, CheckCircle, AlertCircle, Search, PlayCircle, MessageCircle } from 'lucide-react';

import { db, storage, auth } from './lib/firebase';
import { Book, Video } from './types';
import { Navbar } from './components/Navbar';
import { AdminPanel } from './components/AdminPanel';
import { BookGrid } from './components/BookGrid';
import { FeaturedBooks } from './components/FeaturedBooks';
import { BookDetails } from './components/BookDetails';
import { VideoGrid } from './components/VideoGrid';
import { VideoDetails } from './components/VideoDetails';
import { LoginModal } from './components/LoginModal';
import { EpubReader } from './components/EpubReader';
import { ConfirmModal } from './components/ConfirmModal';
import { EditBookModal } from './components/EditBookModal';
import { SiteSettingsModal } from './components/SiteSettingsModal';
import { AddToHomescreen } from './components/AddToHomescreen';

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeTab, setActiveTab] = useState<'sefarim' | 'videos'>('sefarim');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
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
      const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const bookDocs = allDocs
        .filter(d => d.id !== '_site_settings_' && !d.isSettingsDoc && d.type !== 'video')
        .map(d => d as Book);
        
      bookDocs.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setBooks(bookDocs);
      setIsLoading(false);

      const videoDocs = allDocs
        .filter(d => d.type === 'video')
        .map(d => d as unknown as Video);
        
      videoDocs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setVideos(videoDocs);

      // Check for shared links
      const params = new URLSearchParams(window.location.search);
      const sharedBookId = params.get('book');
      const sharedVideoId = params.get('video');
      
      if (sharedBookId) {
        const bookToOpen = bookDocs.find(b => b.id === sharedBookId);
        if (bookToOpen) {
          setSelectedBook(bookToOpen);
          setActiveTab('sefarim');
        }
      } else if (sharedVideoId) {
        const videoToOpen = videoDocs.find(v => v.id === sharedVideoId);
        if (videoToOpen) {
          setSelectedVideo(videoToOpen);
          setActiveTab('videos');
        }
      }
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

  const handleVideoDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', id));
        showStatus('Video deleted successfully.', 'success');
      } catch (e: any) {
        showStatus(`Delete Error: ${e.message}`, 'error');
      }
    }
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

  const handleDownload = async (url: string, title: string, bookId: string) => {
    try {
      // Increment download count
      updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', bookId), {
        downloadCount: increment(1)
      }).catch(err => console.error("Failed to increment download count", err));

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

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sharedBookId = params.get('book');
      const sharedVideoId = params.get('video');
      
      if (sharedBookId) {
        const bookToOpen = books.find(b => b.id === sharedBookId);
        if (bookToOpen) {
          setSelectedBook(bookToOpen);
          setActiveTab('sefarim');
        }
      } else if (sharedVideoId) {
        const videoToOpen = videos.find(v => v.id === sharedVideoId);
        if (videoToOpen) {
          setSelectedVideo(videoToOpen);
          setActiveTab('videos');
        }
      } else {
        setSelectedBook(null);
        setSelectedVideo(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [books, videos]);

  const handleHome = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setReadingBook(null);
    setSelectedBook(null);
    setSelectedVideo(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
    const url = new URL(window.location.href);
    url.searchParams.set('book', book.id);
    url.searchParams.delete('video');
    window.history.pushState({}, '', url.toString());
  };

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
    const url = new URL(window.location.href);
    url.searchParams.set('video', video.id);
    url.searchParams.delete('book');
    window.history.pushState({}, '', url.toString());
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

  const predefinedVideoCategories = ["AI Daf", "AI Parasha", "AI Mishnah", "AI Rambam", "AI Tanach"];
  const videoCategories = Array.from(new Set([...predefinedVideoCategories, ...videos.map(v => v.category)])).sort();
  const filteredVideos = videos.filter(v => {
    const matchesCategory = selectedCategory ? v.category === selectedCategory : true;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchLower === '' || v.title.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const featuredBooks = books.filter(b => b.isFeatured);

  const bannerUrl = siteSettings.bannerUrl || "https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Sales Banner */}
      <div className="bg-indigo-900 text-white py-3 px-4 sticky top-0 z-50 shadow-lg text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-300" /> JOIN OUR WHATSAPP COMMUNITY
          </p>
          <a
            href={bannerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-indigo-900 px-8 py-1.5 rounded-full text-sm font-black hover:scale-105 transition-all uppercase shadow-md"
          >
            Join Now
          </a>
        </div>
      </div>

      <Navbar isAdmin={isAdmin} onToggleAdmin={handleToggleAdmin} onHome={handleHome} logoUrl={siteSettings.logoUrl} />

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

        {!selectedBook && !selectedVideo && (
          <div className="flex justify-center mb-8">
            <div className="bg-slate-200/50 p-1 rounded-full inline-flex">
              <button
                onClick={() => { setActiveTab('sefarim'); handleHome(); }}
                className={`px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
                  activeTab === 'sefarim' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sefarim
              </button>
              <button
                onClick={() => { setActiveTab('videos'); handleHome(); }}
                className={`px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
                  activeTab === 'videos' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Videos
              </button>
            </div>
          </div>
        )}

        {isAdmin && <AdminPanel onStatusMessage={showStatus} onOpenSettings={() => setShowSettingsModal(true)} activeTab={activeTab} />}

        {selectedBook ? (
          <BookDetails
            book={selectedBook}
            onBack={handleHome}
            onRead={(url) => {
              setReadingBook(selectedBook);
              updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', selectedBook.id), {
                readCount: increment(1)
              }).catch(err => console.error("Failed to increment read count", err));
            }}
            onDownload={(url, title) => handleDownload(url, title, selectedBook.id)}
          />
        ) : selectedVideo ? (
          <VideoDetails
            video={selectedVideo}
            relatedVideos={videos.filter(v => v.category === selectedVideo.category && v.id !== selectedVideo.id)}
            onBack={handleHome}
            onSelectVideo={handleVideoSelect}
            categoryThumbnail={siteSettings.videoCategoryThumbnails?.[selectedVideo.category]}
          />
        ) : activeTab === 'sefarim' ? (
          <>
            {!isLoading && featuredBooks.length > 0 && !searchQuery && !selectedCategory && (
              <FeaturedBooks 
                books={featuredBooks} 
                onRead={(url) => {
                  const book = books.find(b => b.epub === url);
                  if (book) {
                    setReadingBook(book);
                    updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', book.id), {
                      readCount: increment(1)
                    }).catch(err => console.error("Failed to increment read count", err));
                  }
                }}
                onDownload={(url, title) => {
                  const book = books.find(b => b.epub === url);
                  if (book) handleDownload(url, title, book.id);
                }}
                onSelect={handleBookSelect}
              />
            )}

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
                if (book) {
                  setReadingBook(book);
                  updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', book.id), {
                    readCount: increment(1)
                  }).catch(err => console.error("Failed to increment read count", err));
                }
              }}
              onDownload={(url, title) => {
                const book = books.find(b => b.epub === url);
                if (book) handleDownload(url, title, book.id);
              }}
              onSelectBook={handleBookSelect}
            />
          </>
        ) : (
          <>
            {!isLoading && (
              <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search videos..."
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
                  {videoCategories.map(cat => (
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

            {!searchQuery && !selectedCategory ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videoCategories.map(cat => (
                  <div 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="bg-white rounded-[2rem] p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col group cursor-pointer"
                  >
                    <div className="aspect-square rounded-xl bg-indigo-50 flex items-center justify-center relative overflow-hidden mb-4 group-hover:bg-indigo-100 transition-colors">
                      {siteSettings.videoCategoryThumbnails?.[cat] ? (
                        <img src={siteSettings.videoCategoryThumbnails[cat]} alt={cat} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <PlayCircle className="w-12 h-12 text-indigo-300 group-hover:text-indigo-500 transition-colors group-hover:scale-110 duration-300" />
                      )}
                    </div>
                    <h3 className="font-black text-xl text-slate-800 text-center uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">{cat}</h3>
                    <p className="text-center text-slate-400 text-sm font-medium mt-2">
                      {videos.filter(v => v.category === cat).length} videos
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <VideoGrid
                videos={filteredVideos}
                isLoading={isLoading}
                isAdmin={isAdmin}
                onDelete={handleVideoDelete}
                onSelectVideo={handleVideoSelect}
              />
            )}
          </>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 text-center border-t border-slate-200/60 mt-8">
        <p className="text-slate-400 text-sm font-medium max-w-2xl mx-auto leading-relaxed">
          <span className="font-bold text-slate-500">Please note:</span> These sefarim are generated using AI and have not been vetted by rabbinic authorities. We do not make any profit from the sale of physical books; they are printed and sold strictly at cost.
        </p>
      </footer>

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
      <AddToHomescreen />
    </div>
  );
}
