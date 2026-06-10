import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { ref, deleteObject, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { ShoppingCart, CheckCircle, AlertCircle, Search, PlayCircle, MessageCircle, Play, X, BookOpen, Star, Bookmark, Share2, Headphones } from 'lucide-react';

import { db, storage, auth } from './lib/firebase';
import { Book, Video, Audio } from './types';
import { compressImage } from './lib/imageUtils';
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
import { EditVideoModal } from './components/EditVideoModal';
import { SiteSettingsModal } from './components/SiteSettingsModal';
import { AddToHomescreen } from './components/AddToHomescreen';
import { AddExistingBookModal } from './components/AddExistingBookModal';
import { AIChat } from './components/AIChat';

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [audios, setAudios] = useState<Audio[]>([]);
  const [activeTab, setActiveTab] = useState<'sefarim' | 'videos' | 'library' | 'audio' | 'ai'>('sefarim');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, coverPath: string, epubPath: string } | null>(null);
  const [siteSettings, setSiteSettings] = useState<{ bannerUrl?: string, logoUrl?: string, videoCategories?: string[], videoCategoryThumbnails?: Record<string, string>, welcomeVideoUrl?: string, videoFolderThumbnails?: Record<string, string>, videoFolderOrder?: string[], seriesThumbnails?: Record<string, string> }>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [isPlayingWelcome, setIsPlayingWelcome] = useState(false);
  const [isDirectLinkEntry, setIsDirectLinkEntry] = useState(false);
  const [playingDirectVideo, setPlayingDirectVideo] = useState(false);
  const [savedBookIds, setSavedBookIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('savedBookIds') || '[]'); } catch { return []; }
  });
  const [savedVideoIds, setSavedVideoIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('savedVideoIds') || '[]'); } catch { return []; }
  });
  const hasCheckedSharedLink = React.useRef(false);
  const [triggerAddBookToSeries, setTriggerAddBookToSeries] = useState<{series: string, timestamp: number} | null>(null);
  const [addExistingSeriesModal, setAddExistingSeriesModal] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('savedBookIds', JSON.stringify(savedBookIds));
  }, [savedBookIds]);

  useEffect(() => {
    localStorage.setItem('savedVideoIds', JSON.stringify(savedVideoIds));
  }, [savedVideoIds]);

  const toggleSaveBook = (id: string) => {
    setSavedBookIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleSaveVideo = (id: string) => {
    setSavedVideoIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
      showStatus(`Auth Error: ${err.message}`, 'error');
    });

    const booksRef = collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim');
    const unsubscribeBooks = onSnapshot(booksRef, (snapshot) => {
      const allDocs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      
      const bookDocs = allDocs
        .filter(d => d.id !== '_site_settings_' && !d.isSettingsDoc && d.type !== 'video' && d.type !== 'image')
        .map(d => d as Book);
        
      bookDocs.sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setBooks(bookDocs);
      setIsLoading(false);

      const videoDocs = allDocs
        .filter(d => d.type === 'video')
        .map(d => d as unknown as Video);
        
      videoDocs.sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setVideos(videoDocs);

      const audioDocs = allDocs
        .filter(d => d.type === 'audio')
        .map(d => d as unknown as Audio);
        
      audioDocs.sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setAudios(audioDocs);

      // Check for shared links
      if (!hasCheckedSharedLink.current && (bookDocs.length > 0 || videoDocs.length > 0)) {
        hasCheckedSharedLink.current = true;
        const params = new URLSearchParams(window.location.search);
        let sharedBookId = params.get('book');
        let sharedVideoId = params.get('video');
        let sharedCategory = params.get('category');
        let sharedTab = params.get('tab') as 'sefarim' | 'videos' | 'library' | null;
        
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] === 'v' && pathParts[2]) {
          sharedVideoId = pathParts[2];
        } else if (pathParts[1] === 'b' && pathParts[2]) {
          sharedBookId = pathParts[2];
        } else if (pathParts[1] === 'c' && pathParts[2]) {
          sharedCategory = decodeURIComponent(pathParts[2]);
          if (pathParts[3] === 'videos') sharedTab = 'videos';
          if (pathParts[3] === 'sefarim') sharedTab = 'sefarim';
        }
        
        if (sharedBookId) {
          const bookToOpen = bookDocs.find(b => b.id === sharedBookId);
          if (bookToOpen) {
            setSelectedBook(bookToOpen);
            setActiveTab('sefarim');
            setIsDirectLinkEntry(true);
          }
        } else if (sharedVideoId) {
          const videoToOpen = videoDocs.find(v => v.id === sharedVideoId);
          if (videoToOpen) {
            setSelectedVideo(videoToOpen);
            setActiveTab('videos');
            setIsDirectLinkEntry(true);
            updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', videoToOpen.id), {
              views: increment(1)
            }).catch(err => console.error("Failed to increment video views", err));
          }
        } else if (sharedCategory) {
          setSelectedCategory(sharedCategory);
          if (sharedTab) {
            setActiveTab(sharedTab as 'sefarim' | 'videos' | 'library');
          }
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

  const handleAudioDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm('Are you sure you want to delete this audio?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', id));
        showStatus('Audio deleted successfully.', 'success');
      } catch (e: any) {
        showStatus(`Delete Error: ${e.message}`, 'error');
      }
    }
  };

  const handleUpdateSeriesThumbnail = async (series: string, file: File) => {
    try {
      showStatus('Uploading series thumbnail...', 'success');
      const compressedImage = await compressImage(file, 800, 0.8);
      const storageRef = ref(storage, `settings/series_${Date.now()}_${compressedImage.name}`);
      const uploadTask = await uploadBytesResumable(storageRef, compressedImage);
      const url = await getDownloadURL(uploadTask.ref);
      
      const newThumbnails = { ...(siteSettings.seriesThumbnails || {}), [series]: url };
      await setDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_'), {
        ...siteSettings,
        seriesThumbnails: newThumbnails
      }, { merge: true });
      
      showStatus('Series thumbnail updated!', 'success');
    } catch (err: any) {
      showStatus(`Error updating thumbnail: ${err.message}`, 'error');
    }
  };

  const handleUpdateFolderThumbnail = async (folder: string, file: File) => {
    try {
      showStatus('Uploading folder thumbnail...', 'success');
      const compressedFile = await compressImage(file, 600, 0.7);
      const storageRef = ref(storage, `settings/folder_${folder.replace(/\s+/g, '_')}_${Date.now()}_${compressedFile.name}`);
      const uploadTask = await uploadBytesResumable(storageRef, compressedFile);
      const url = await getDownloadURL(uploadTask.ref);

      const newThumbnails = { ...(siteSettings.videoFolderThumbnails || {}), [folder]: url };

      await setDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_'), {
        videoFolderThumbnails: newThumbnails,
        isSettingsDoc: true
      }, { merge: true });

      showStatus('Folder thumbnail updated!', 'success');
    } catch (err: any) {
      console.error(err);
      showStatus(`Failed to update folder thumbnail: ${err.message}`, 'error');
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
      let sharedBookId = params.get('book');
      let sharedVideoId = params.get('video');
      let sharedCategory = params.get('category');
      let sharedTab = params.get('tab');
      
      const pathParts = window.location.pathname.split('/');
      if (pathParts[1] === 'v' && pathParts[2]) {
        sharedVideoId = pathParts[2];
      } else if (pathParts[1] === 'b' && pathParts[2]) {
        sharedBookId = pathParts[2];
      } else if (pathParts[1] === 'c' && pathParts[2]) {
        sharedCategory = decodeURIComponent(pathParts[2]);
        if (pathParts[3] === 'videos') sharedTab = 'videos';
        if (pathParts[3] === 'sefarim') sharedTab = 'sefarim';
      }
      
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
      } else if (sharedCategory) {
        setSelectedCategory(sharedCategory);
        if (sharedTab) {
          setActiveTab(sharedTab as 'sefarim' | 'videos');
        }
        setSelectedBook(null);
        setSelectedVideo(null);
      } else {
        setSelectedBook(null);
        setSelectedVideo(null);
        setSelectedCategory(null);
        setIsDirectLinkEntry(false);
        setPlayingDirectVideo(false);
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
    setIsDirectLinkEntry(false);
    setPlayingDirectVideo(false);
    window.history.replaceState({}, '', '/');
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
    setIsDirectLinkEntry(false);
    setPlayingDirectVideo(false);
    const url = new URL(window.location.href);
    url.searchParams.set('book', book.id);
    url.searchParams.delete('video');
    window.history.pushState({}, '', url.toString());
    window.scrollTo(0, 0);
  };

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
    setIsDirectLinkEntry(false);
    setPlayingDirectVideo(false);
    const url = new URL(window.location.href);
    url.searchParams.set('video', video.id);
    url.searchParams.delete('book');
    window.history.pushState({}, '', url.toString());
    window.scrollTo(0, 0);

    // Increment view count in firestore
    updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', video.id), {
      views: increment(1)
    }).catch(err => console.error("Failed to increment video views", err));
  };

  const handleEditSave = async (id: string, updatedData: Partial<Book>) => {
    try {
      await updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', id), updatedData);
      showStatus('Sefer updated successfully.', 'success');
    } catch (e: any) {
      showStatus(`Update Error: ${e.message}`, 'error');
    }
  };

  const handleVideoEditSave = async (id: string, updatedData: Partial<Video>) => {
    try {
      await updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', id), updatedData);
      showStatus('Video updated successfully.', 'success');
    } catch (e: any) {
      showStatus(`Update Error: ${e.message}`, 'error');
    }
  };

  const handleBookReorder = async (reorderedBooks: Book[]) => {
    // We want to preserve their existing global orders, just swapped around.
    // 1. Find all their current orders (or default to sequential numbers if missing)
    let currentOrders = reorderedBooks.map(b => b.order ?? 0);
    // If all are 0, just assign based on current order in the whole app, 
    // or simply assign sequential numbers but push others down?
    // Let's just use sequential numbers but starting from the minimum order they had,
    // Or simpler: just give them i+1 if they don't have orders, but if they do, swap them.
    // Wait, simpler: just map them strictly by i+1 but offset by the max existing order?
    // Actually, just sorting currentOrders and applying them is best:
    currentOrders.sort((a, b) => a - b);
    
    // If they were all 0 (no orders set yet), we need a baseline. Let's just use i + 1 as fallback.
    const hasExistingOrders = currentOrders.some(o => o > 0);
    
    const updates = [];
    for (let i = 0; i < reorderedBooks.length; i++) {
      const book = reorderedBooks[i];
      const newOrder = hasExistingOrders ? currentOrders[i] : i + 1;
      
      // Force an update to order even if newOrder === book.order, because if hasExistingOrders is false,
      // book.order is 0, so it will update to i+1.
      if (book.order !== newOrder) {
        updates.push({ id: book.id, order: newOrder });
      }
    }
    
    for (const update of updates) {
      const ref = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', update.id);
      updateDoc(ref, { order: update.order }).catch(console.error);
    }
  };

  const handleVideoReorder = async (reorderedVideos: Video[]) => {
    let currentOrders = reorderedVideos.map(v => v.order ?? 0);
    currentOrders.sort((a, b) => a - b);
    const hasExistingOrders = currentOrders.some(o => o > 0);

    const updates = [];
    for (let i = 0; i < reorderedVideos.length; i++) {
      const video = reorderedVideos[i];
      const newOrder = hasExistingOrders ? currentOrders[i] : i + 1;
      if (video.order !== newOrder) {
        updates.push({ id: video.id, order: newOrder });
      }
    }
    
    // Update firestore
    for (const update of updates) {
      updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', update.id), {
        order: update.order
      }).catch(err => console.error("Failed to update order", err));
    }
  };

  const handleFolderReorder = async (reorderedFolders: string[]) => {
    try {
      showStatus('Saving folder order...', 'success');
      await setDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_'), {
        videoFolderOrder: reorderedFolders,
        isSettingsDoc: true
      }, { merge: true });
      showStatus('Folder order saved', 'success');
    } catch (err: any) {
      console.error(err);
      showStatus(`Failed to update folder order: ${err.message}`, 'error');
    }
  };

  const handleCategoryShare = async (tab: 'sefarim' | 'videos') => {
    if (!selectedCategory) return;
    const url = `${window.location.origin}/c/${encodeURIComponent(selectedCategory)}/${tab}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${selectedCategory} ${tab === 'videos' ? 'Videos' : 'Sefarim'}`,
          url: url
        });
        return;
      } catch (err) {
        console.log('Share API failed, falling back to clipboard.', err);
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus({ message: 'Category link copied to clipboard!', type: 'success' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const categories = Array.from(new Set(books.map(b => b.category || 'Uncategorized'))).sort() as string[];
  const filteredBooks = books.filter(b => {
    const matchesCategory = selectedCategory ? (b.category || 'Uncategorized') === selectedCategory : true;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchLower === '' || 
      (b.title || '').toLowerCase().includes(searchLower) || 
      (b.author || '').toLowerCase().includes(searchLower) || 
      (b.desc || '').toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  }).sort((a, b) => (b.readCount || 0) - (a.readCount || 0));

  const strictVideoCategories = siteSettings.videoCategories || ["AI Daf", "AI Parasha", "AI Mishnah", "AI Rambam", "AI Tanach"];
  const videoCategories = Array.from(new Set([...strictVideoCategories, ...videos.map(v => v.category)])).sort() as string[];
  const filteredVideos = videos.filter(v => {
    const matchesCategory = selectedCategory ? (selectedCategory === 'Top Rated' ? true : v.category === selectedCategory) : true;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchLower === '' || (v.title || '').toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const displayedVideos = [...filteredVideos];
  if (selectedCategory === 'Top Rated') {
    displayedVideos.sort((a, b) => {
      const getScore = (v: typeof a) => {
        const rating = v.ratingsCount ? v.ratingsSum! / v.ratingsCount : 0;
        const volume = (v.views || 0) + (v.ratingsCount || 0);
        // Bayesian average approximating true top rated (with 5 views/ratings as confidence threshold)
        return (volume * rating) / (volume + 5);
      };
      
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.views || 0) - (a.views || 0);
    });
  }

  const featuredBooks = books.filter(b => b.isFeatured);

  const bannerUrl = siteSettings.bannerUrl || "https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr";
  
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar 
        isAdmin={isAdmin} 
        onToggleAdmin={handleToggleAdmin} 
        onHome={handleHome} 
        logoUrl={siteSettings.logoUrl}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        whatsappUrl={bannerUrl}
        totalBooks={books.length}
        totalVideos={videos.length}
        onOpenAiChat={() => setShowAiModal(true)}
      />

      {/* Welcome Video Section (Only on main dashboard) */}
      {!selectedBook && !selectedVideo && !searchQuery && !selectedCategory && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-6 md:pt-8 pb-4">
          <div className="bg-slate-900 rounded-[1.5rem] md:rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800 shadow-indigo-900/10 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-900 to-slate-900 pointer-events-none" />
            
            {isPlayingWelcome ? (
              <div className="relative aspect-video w-full bg-black animate-in fade-in zoom-in-95 duration-500">
                <button 
                  onClick={() => setIsPlayingWelcome(false)}
                  className="absolute top-4 right-4 md:top-6 md:right-6 z-50 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/20"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                {siteSettings.welcomeVideoUrl ? (
                  <video 
                    className="absolute inset-0 w-full h-full object-contain bg-black" 
                    src={siteSettings.welcomeVideoUrl} 
                    controls 
                    autoPlay 
                    playsInline
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                     <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
                     <h3 className="text-white font-bold text-lg mb-2">Video Not Configured</h3>
                     <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                        Please click <span className="font-bold text-white">"Admin" &rarr; "Settings"</span> to upload your `.mp4` video directly to your website storage.
                     </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative px-5 py-8 sm:p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 z-10 w-full">
                 <div className="flex-1 text-center md:text-left flex flex-col items-center md:items-start w-full">
                   <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6">
                     <BookOpen className="w-3.5 h-3.5" /> Welcome to the Library
                   </div>
                   <h2 className="text-[28px] sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] sm:leading-[1.1] mb-3 md:mb-6 text-white max-w-[280px] sm:max-w-md md:max-w-none mx-auto md:mx-0">
                     Ancient wisdom,<br className="hidden md:block"/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mt-1 inline-block md:mt-0">illuminated by AI.</span>
                   </h2>
                   <p className="text-slate-300 text-sm sm:text-base md:text-lg mb-6 md:mb-8 max-w-[280px] sm:max-w-sm md:max-w-xl leading-relaxed mx-auto md:mx-0">
                     Explore an endless digital repository of sefarim and video classes, beautifully structured and enhanced by artificial intelligence.
                   </p>
                   {siteSettings.welcomeVideoUrl && (
                     <button 
                       onClick={() => setIsPlayingWelcome(true)}
                       className="bg-indigo-600 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-xl md:rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0 active:scale-95 group w-full sm:w-auto justify-center"
                     >
                       <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current group-hover:scale-110 transition-transform" /> Watch Intro
                     </button>
                   )}
                 </div>
                 
                 {siteSettings.welcomeVideoUrl && (
                   <div className="hidden md:block w-[380px] lg:w-[480px] shrink-0">
                     <div 
                       onClick={() => setIsPlayingWelcome(true)}
                       className="relative aspect-video rounded-3xl overflow-hidden cursor-pointer group shadow-2xl border border-white/10 ring-4 ring-indigo-500/10 hover:ring-indigo-500/30 transition-all transform hover:-translate-y-2 hover:shadow-indigo-500/20"
                     >
                        <div className="absolute inset-0 bg-slate-800">
                          {siteSettings.logoUrl && (
                             <img src={siteSettings.logoUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-60 group-hover:scale-105 transition-all duration-700 blur-[2px]" alt="Thumbnail" />
                          )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/60 via-transparent to-transparent mix-blend-overlay" />
                        <div className="absolute inset-0 flex items-center justify-center">
                           <div className="w-16 h-16 rounded-full bg-indigo-600/90 backdrop-blur-md border border-indigo-400/30 text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500 transition-all duration-300 shadow-2xl shadow-indigo-900">
                             <Play className="w-7 h-7 fill-current ml-1" />
                           </div>
                        </div>
                     </div>
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 lg:p-12 pt-4">
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

        {isAdmin && <AdminPanel onStatusMessage={showStatus} onOpenSettings={() => setShowSettingsModal(true)} activeTab={activeTab} videoCategories={strictVideoCategories} videos={videos} books={books} />}

        {isDirectLinkEntry && (selectedBook || selectedVideo) && (
          <div className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4">
             <div className="p-3 sm:p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4 flex-1">
                  {siteSettings.logoUrl ? (
                     <img src={siteSettings.logoUrl} alt="Logo" className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover shadow-sm shrink-0" />
                   ) : (
                     <div className="bg-indigo-600 p-2 md:p-2.5 rounded-xl text-white shadow-sm shrink-0">
                       <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                     </div>
                   )}
                   <div>
                     <h2 className="text-sm md:text-base font-black text-slate-800 leading-tight mb-0.5 tracking-tight truncate">Welcome to AI Sefarim</h2>
                     <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest truncate">Digital Library</p>
                   </div>
                </div>
                
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {siteSettings.welcomeVideoUrl && (
                     <button 
                        onClick={() => setPlayingDirectVideo(!playingDirectVideo)}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${playingDirectVideo ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95'}`}
                     >
                       <PlayCircle className="w-4 h-4 shrink-0" />
                       <span className="hidden sm:inline">{playingDirectVideo ? 'Close Video' : 'Watch Intro'}</span>
                       <span className="sm:hidden">{playingDirectVideo ? 'Close' : 'Intro'}</span>
                     </button>
                  )}
                  <button 
                    onClick={() => {
                        setIsDirectLinkEntry(false);
                        setPlayingDirectVideo(false);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
                    aria-label="Dismiss welcome message"
                  >
                    <X className="w-4 h-4 font-bold" />
                  </button>
                </div>
             </div>
             
             {playingDirectVideo && siteSettings.welcomeVideoUrl && (
                <div className="aspect-video bg-black relative border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                   <video 
                     className="absolute inset-0 w-full h-full object-contain" 
                     src={siteSettings.welcomeVideoUrl} 
                     controls 
                     autoPlay
                     playsInline
                   />
                </div>
             )}
          </div>
        )}

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
            isSaved={savedBookIds.includes(selectedBook.id)}
            onToggleSave={toggleSaveBook}
          />
        ) : selectedVideo ? (
          <VideoDetails
            video={selectedVideo}
            relatedVideos={(() => {
              const targetList = selectedVideo.type === 'audio' ? (audios as unknown as Video[]) : videos;
              const allInFolder = targetList.filter(v => (v.folder || '') === (selectedVideo.folder || ''));
              const diffCat = targetList.filter(v => (v.folder || '') !== (selectedVideo.folder || '')).filter(v => v.id !== selectedVideo.id);
              
              const sortByScore = (a: Video, b: Video) => {
                const getScore = (v: Video) => {
                  const rating = v.ratingsCount ? v.ratingsSum! / v.ratingsCount : 0;
                  const volume = (v.views || 0) + (v.ratingsCount || 0);
                  return (volume * rating) / (volume + 5);
                };
                
                const scoreA = getScore(a);
                const scoreB = getScore(b);
                
                if (scoreB !== scoreA) return scoreB - scoreA;
                return (b.views || 0) - (a.views || 0);
              };

              diffCat.sort(sortByScore);

              const currentIndex = allInFolder.findIndex(v => v.id === selectedVideo.id);
              
              let sameCatOrdered: Video[] = [];
              if (currentIndex !== -1) {
                const nextInSeries = allInFolder.slice(currentIndex + 1);
                const previousInSeries = allInFolder.slice(0, currentIndex).reverse(); // closest first if needed? No, let's just reverse so immediate previous is first
                sameCatOrdered = [...nextInSeries, ...previousInSeries];
              } else {
                sameCatOrdered = allInFolder.filter(v => v.id !== selectedVideo.id);
              }
              
              const mixed = [...sameCatOrdered, ...diffCat];
              return mixed.slice(0, 9);
            })()}
            onBack={handleHome}
            onSelectVideo={handleVideoSelect}
            categoryThumbnails={siteSettings.videoCategoryThumbnails}
            folderThumbnails={siteSettings.videoFolderThumbnails}
            isSaved={savedVideoIds.includes(selectedVideo.id)}
            onToggleSave={toggleSaveVideo}
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
              <>
                <div className="mb-6 flex flex-row gap-4 sm:gap-6 items-center justify-between bg-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto md:mx-0">
                  <div className="flex items-center gap-3 w-auto justify-start">
                    <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 shrink-0 hidden sm:block">
                      <Bookmark className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                    </div>
                    <div className="flex flex-row items-baseline gap-2 text-left">
                      <h3 className="font-black text-slate-800 text-[14px] sm:text-base leading-tight">My Library</h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block">{savedBookIds.length + savedVideoIds.length} saved items</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('library');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-auto px-4 py-1.5 sm:px-5 sm:py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all text-center border border-indigo-200 hover:border-indigo-600 shadow-sm shrink-0 whitespace-nowrap"
                  >
                    View Library
                  </button>
                </div>
                <div className="mb-10 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-96 lg:w-[28rem]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by title, author, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-32 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 shadow-sm text-ellipsis"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 text-indigo-600 rounded-xl pointer-events-none shadow-sm backdrop-blur-sm">
                     <BookOpen className="w-3.5 h-3.5 fill-indigo-200" />
                     <span className="text-[11px] font-black uppercase tracking-wider">{selectedCategory ? filteredBooks.length : books.length} Sefarim</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-center md:justify-end w-full md:w-auto">
                  {selectedCategory && (
                    <button
                      onClick={() => handleCategoryShare('sefarim')}
                      className="px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shadow-sm w-full sm:w-auto justify-center"
                    >
                      <Share2 className="w-4 h-4" /> Share Category
                    </button>
                  )}
                </div>
              </div>

              <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                <button
                   onClick={() => setSelectedCategory(null)}
                   className={`px-5 py-2.5 rounded-full whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all ${
                     selectedCategory === null 
                       ? 'bg-slate-900 text-white shadow-md' 
                       : 'bg-white text-slate-500 hover:bg-slate-100 border-2 border-slate-200'
                   }`}
                >All Sefarim</button>
                {categories.map(cat => (
                  <button
                     key={cat}
                     onClick={() => setSelectedCategory(cat)}
                     className={`px-5 py-2.5 rounded-full whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all ${
                       selectedCategory === cat 
                         ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-600 ring-offset-1' 
                         : 'bg-white text-slate-500 hover:bg-slate-100 border-2 border-slate-200'
                     }`}
                  >{cat}</button>
                ))}
              </div>
              </div>
              </>
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
              savedBookIds={savedBookIds}
              onToggleSave={toggleSaveBook}
              seriesThumbnails={siteSettings.seriesThumbnails}
              onUpdateSeriesThumbnail={handleUpdateSeriesThumbnail}
              searchQuery={searchQuery}
              onAddBookToSeries={(series) => {
                setTriggerAddBookToSeries({ series, timestamp: Date.now() });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onAddExistingBookToSeries={(series) => setAddExistingSeriesModal(series)}
              onReorder={handleBookReorder}
            />
          </>
        ) : activeTab === 'videos' ? (
          <>
            {!isLoading && (
              <>
                <div className="mb-6 flex flex-row gap-4 sm:gap-6 items-center justify-between bg-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto md:mx-0">
                  <div className="flex items-center gap-3 w-auto justify-start">
                    <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 shrink-0 hidden sm:block">
                      <Bookmark className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                    </div>
                    <div className="flex flex-row items-baseline gap-2 text-left">
                      <h3 className="font-black text-slate-800 text-[14px] sm:text-base leading-tight">My Library</h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block">{savedBookIds.length + savedVideoIds.length} saved items</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('library');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-auto px-4 py-1.5 sm:px-5 sm:py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all text-center border border-indigo-200 hover:border-indigo-600 shadow-sm shrink-0 whitespace-nowrap"
                  >
                    View Library
                  </button>
                </div>
                <div className="mb-10 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-96 lg:w-[28rem]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search videos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-32 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 shadow-sm"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 text-indigo-600 rounded-xl pointer-events-none shadow-sm backdrop-blur-sm">
                     <PlayCircle className="w-3.5 h-3.5 fill-indigo-200" />
                     <span className="text-[11px] font-black uppercase tracking-wider">{selectedCategory ? filteredVideos.length : videos.length} Videos</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-center md:justify-end w-full md:w-auto">
                  {selectedCategory && selectedCategory !== 'Top Rated' && (
                    <button
                      onClick={() => handleCategoryShare('videos')}
                      className="px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shadow-sm w-full sm:w-auto justify-center"
                    >
                      <Share2 className="w-4 h-4" /> Share Category
                    </button>
                  )}
                </div>
              </div>

              <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                <button
                   onClick={() => setSelectedCategory(null)}
                   className={`px-5 py-2.5 rounded-full whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all ${
                     selectedCategory === null 
                       ? 'bg-slate-900 text-white shadow-md' 
                       : 'bg-white text-slate-500 hover:bg-slate-100 border-2 border-slate-200'
                   }`}
                >All Videos</button>
                <button
                    onClick={() => {
                        setSelectedCategory(selectedCategory === 'Top Rated' ? null : 'Top Rated');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-5 py-2.5 rounded-full whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 border-2 ${
                      selectedCategory === 'Top Rated'
                        ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-md ring-2 ring-amber-400 ring-offset-1'
                        : 'bg-white text-amber-600 hover:bg-amber-50 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${selectedCategory === 'Top Rated' ? 'fill-amber-950 text-amber-950' : 'fill-amber-600 text-amber-600'}`} /> 
                    Top Rated
                </button>
                {videoCategories.map(cat => (
                  <button
                     key={cat}
                     onClick={() => setSelectedCategory(cat)}
                     className={`px-5 py-2.5 rounded-full whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all ${
                       selectedCategory === cat 
                         ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-600 ring-offset-1' 
                         : 'bg-white text-slate-500 hover:bg-slate-100 border-2 border-slate-200'
                     }`}
                  >{cat}</button>
                ))}
              </div>
              </div>
              </>
            )}

            {!searchQuery && !selectedCategory ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videoCategories.map(cat => (
                  <div 
                    key={cat}
                    onClick={() => {
                        setSelectedCategory(cat);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-white rounded-[2rem] p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col group cursor-pointer"
                  >
                    <div className="aspect-square rounded-xl bg-indigo-50 flex items-center justify-center relative overflow-hidden mb-4 group-hover:bg-indigo-100 transition-colors">
                      {siteSettings.videoCategoryThumbnails?.[cat] ? (
                        <img src={siteSettings.videoCategoryThumbnails[cat]} alt={cat} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
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
                videos={displayedVideos}
                isLoading={isLoading}
                isAdmin={isAdmin}
                onEdit={setEditingVideo}
                onDelete={handleVideoDelete}
                onSelectVideo={handleVideoSelect}
                onMoveToFolder={(videoId, newFolder) => {
                  updateDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', videoId), {
                    folder: newFolder,
                    order: 0
                  }).catch(err => console.error("Failed to move video to folder", err));
                }}
                onReorder={selectedCategory && selectedCategory !== 'Top Rated' ? handleVideoReorder : undefined}
                onFolderReorder={selectedCategory && selectedCategory !== 'Top Rated' ? handleFolderReorder : undefined}
                categoryThumbnails={siteSettings.videoCategoryThumbnails}
                folderThumbnails={siteSettings.videoFolderThumbnails}
                folderOrder={siteSettings.videoFolderOrder}
                onUpdateFolderThumbnail={handleUpdateFolderThumbnail}
                savedVideoIds={savedVideoIds}
                onToggleSave={toggleSaveVideo}
                disableFolders={selectedCategory === 'Top Rated'}
              />
            )}
          </>
        ) : activeTab === 'audio' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto px-4 md:px-0">
            <div className="flex items-center gap-3 w-auto justify-start mb-6">
              <Headphones className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-l border-slate-300 pl-3">Audio Library</span>
            </div>
            {/* Using VideoGrid for Audio items by casting them since they share the same structure */}
            <VideoGrid
              videos={audios as unknown as Video[]}
              isLoading={isLoading}
              isAdmin={isAdmin}
              onEdit={() => {}} // No edit modal for audio right now
              onDelete={handleAudioDelete}
              onSelectVideo={handleVideoSelect}
              mediaLabel="Audio"
            />
          </div>
        ) : activeTab === 'library' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight mb-4">
                My Library
              </h1>
              <p className="text-slate-500 font-medium">Your personal collection of saved sefarim and videos.</p>
            </div>

            <div className="space-y-16">
              <div>
                <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-100 pb-4">
                  Saved Sefarim ({savedBookIds.length})
                </h2>
                {savedBookIds.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium tracking-wide">You haven't saved any sefarim yet.</p>
                  </div>
                ) : (
                  <BookGrid
                    books={books.filter(b => savedBookIds.includes(b.id))}
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
                    savedBookIds={savedBookIds}
                    onToggleSave={toggleSaveBook}
                  />
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-100 pb-4">
                  Saved Videos ({savedVideoIds.length})
                </h2>
                {savedVideoIds.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                    <PlayCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium tracking-wide">You haven't saved any videos yet.</p>
                  </div>
                ) : (
                  <VideoGrid
                    videos={videos.filter(v => savedVideoIds.includes(v.id))}
                    isLoading={isLoading}
                    isAdmin={isAdmin}
                    onEdit={setEditingVideo}
                    onDelete={handleVideoDelete}
                    onSelectVideo={handleVideoSelect}
                    categoryThumbnails={siteSettings.videoCategoryThumbnails}
                    folderThumbnails={siteSettings.videoFolderThumbnails}
                    onUpdateFolderThumbnail={handleUpdateFolderThumbnail}
                    savedVideoIds={savedVideoIds}
                    onToggleSave={toggleSaveVideo}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 text-center border-t border-slate-200/60 mt-8 relative">
        <p className="text-slate-400 text-sm font-medium max-w-2xl mx-auto leading-relaxed">
          <span className="font-bold text-slate-500">Please note:</span> These sefarim are generated using AI and have not been vetted by rabbinic authorities. We do not make any profit from the sale of physical books; they are printed and sold strictly at cost.
        </p>
        {!isAdmin && (
          <button 
            onClick={handleToggleAdmin}
            className="mt-8 text-[10px] text-slate-300 hover:text-slate-400 pb-1 border-b border-transparent hover:border-slate-300 transition-colors uppercase tracking-[0.2em]"
          >
            Admin Login
          </button>
        )}
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

      {addExistingSeriesModal && (
        <AddExistingBookModal
          series={addExistingSeriesModal}
          books={books}
          onClose={() => setAddExistingSeriesModal(null)}
          onSuccess={() => { showStatus(`Book added to ${addExistingSeriesModal} successfully`, 'success'); }}
        />
      )}

      {editingVideo && (
        <EditVideoModal
          video={editingVideo}
          videoCategories={strictVideoCategories}
          videos={videos}
          onSave={handleVideoEditSave}
          onClose={() => setEditingVideo(null)}
        />
      )}

      {showSettingsModal && (
        <SiteSettingsModal
          currentSettings={siteSettings}
          onClose={() => setShowSettingsModal(false)}
          onStatusMessage={showStatus}
        />
      )}

      {showAiModal && (
        <AIChat onClose={() => setShowAiModal(false)} />
      )}

      <AddToHomescreen />
    </div>
  );
}
