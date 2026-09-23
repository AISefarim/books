import React, { useState, useRef } from 'react';
import { Plus, Image as ImageIcon, Loader2, Settings, Video as VideoIcon, Headphones, Layers, Check, Copy, MessageCircle, X } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { compressImage } from '../lib/imageUtils';
import { Video, Book, Audio } from '../types';
import { BatchAddMedia } from './BatchAddMedia';

interface AdminPanelProps {
  onStatusMessage: (message: string, type: 'success' | 'error') => void;
  onOpenSettings: () => void;
  activeTab: 'sefarim' | 'videos' | 'podcasts' | 'library' | 'images' | 'audio' | 'media';
  videoCategories: string[];
  videos?: Video[];
  books?: Book[];
  audios?: Audio[];
  triggerAddBookToSeries?: { series: string, timestamp: number } | null;
  currentCategory?: string | null;
}

export function AdminPanel({ onStatusMessage, onOpenSettings, activeTab, videoCategories, videos = [], books = [], audios = [], triggerAddBookToSeries, currentCategory }: AdminPanelProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('single');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ label: '', percent: 0 });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  const [mediaPublishType, setMediaPublishType] = useState<'video' | 'podcast'>('video');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [newFolderInput, setNewFolderInput] = useState('');
  const [selectedSubfolder, setSelectedSubfolder] = useState('_none_');
  const [newSubfolderInput, setNewSubfolderInput] = useState('');
  const [selectedVideoCat, setSelectedVideoCat] = useState(currentCategory || '');
  const [newVideoCatInput, setNewVideoCatInput] = useState('');
  
  const [selectedBookSeries, setSelectedBookSeries] = useState('_none_');
  const [newBookSeriesInput, setNewBookSeriesInput] = useState('');

  const [lastPublishedShareInfo, setLastPublishedShareInfo] = useState<{
    title: string;
    shareUrl: string;
    shareMessage: string;
    type: 'video' | 'podcast';
    autoCopied: boolean;
  } | null>(null);
  const [copiedShareInfo, setCopiedShareInfo] = useState(false);

  React.useEffect(() => {
    if (triggerAddBookToSeries) {
      if (activeTab === 'sefarim') {
        setIsFormVisible(true);
        setSelectedBookSeries(triggerAddBookToSeries.series);
      }
    }
  }, [triggerAddBookToSeries, activeTab]);

  React.useEffect(() => {
    if (currentCategory && currentCategory !== 'Top Rated') {
      setSelectedVideoCat(currentCategory);
      setSelectedFolder('');
      setSelectedSubfolder('_none_');
    }
  }, [currentCategory]);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const epubInputRef = useRef<HTMLInputElement>(null);

  const allMediaCategories = Array.from(new Set([
    ...videoCategories,
    ...videos.map(v => (v.category || '').trim()),
    ...audios.map(a => (a.category || '').trim())
  ])).filter(Boolean) as string[];

  const effectiveCategory = selectedVideoCat === 'new' 
    ? newVideoCatInput.trim() 
    : selectedVideoCat.trim();

  const allMediaItems = [...videos, ...(audios as unknown as Video[])];

  // ONLY show folders that belong to the selected category!
  const categoryMediaFolders = Array.from(new Set(
    allMediaItems
      .filter(item => {
        if (!effectiveCategory) return false;
        return (item.category || '').trim().toLowerCase() === effectiveCategory.toLowerCase();
      })
      .map(v => (v.folder || '').trim())
  )).filter(Boolean) as string[];

  const currentEffectiveFolder = selectedFolder === 'new' ? newFolderInput.trim() : (selectedFolder === '_none_' ? '' : selectedFolder.trim());

  const existingSubfolders = Array.from(
    new Set(
      allMediaItems
        .filter(i => {
          const matchCat = !effectiveCategory || (i.category || '').trim().toLowerCase() === effectiveCategory.toLowerCase();
          const matchFolder = (i.folder || '').trim() === currentEffectiveFolder;
          return matchCat && matchFolder && i.subfolder;
        })
        .map(i => (i.subfolder || '').trim())
    )
  ).filter(Boolean) as string[];

  const bookSeriesList = Array.from(new Set(books.map(b => b.series || ''))).filter(s => s !== '') as string[];
  const formRef = useRef<HTMLFormElement>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCoverPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadWithProgress = (file: File, path: string, label: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      setProgress({ label, percent: 0 });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress({ label, percent: Math.round(percent) });
        },
        (error) => {
          console.error('Storage Error:', error);
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err) {
            console.error('Download URL Error:', err);
            reject(err);
          }
        }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const coverFile = coverInputRef.current?.files?.[0];
    const epubFile = epubInputRef.current?.files?.[0];

    if (!coverFile || !epubFile) {
      onStatusMessage('Please select both Sefer and Cover image!', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const category = formData.get('category') as string;
    const desc = formData.get('desc') as string;
    const buyLink = formData.get('buyLink') as string;
    const orderStr = formData.get('order') as string;
    const order = orderStr ? parseInt(orderStr, 10) : undefined;

    const seriesStateValue = selectedBookSeries === 'new' ? newBookSeriesInput : selectedBookSeries;
    const finalSeries = seriesStateValue === '_none_' ? '' : seriesStateValue.trim();

    try {
      const timestamp = Date.now();
      const compressedCover = await compressImage(coverFile, 600, 0.8);
      const coverPath = `sefarim/cover_${timestamp}_${compressedCover.name}`;
      const epubPath = `sefarim/epub_${timestamp}_${epubFile.name}`;

      const coverUrl = await uploadWithProgress(compressedCover, coverPath, 'Uploading Cover...');
      const epubUrl = await uploadWithProgress(epubFile, epubPath, 'Uploading Sefer...');

      const docData: any = {
        title,
        author,
        category: category || 'Uncategorized',
        series: finalSeries,
        desc,
        buyLink,
        cover: coverUrl,
        epub: epubUrl,
        coverPath,
        epubPath,
        createdAt: timestamp,
        type: 'sefer',
      };

      if (order !== undefined && !isNaN(order)) {
        docData.order = order;
      }

      await addDoc(collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim'), docData);

      onStatusMessage('Sefer published successfully to the cloud!', 'success');
      formRef.current?.reset();
      setCoverPreview(null);
      setSelectedBookSeries('_none_');
      setNewBookSeriesInput('');
      if (epubInputRef.current) epubInputRef.current.value = '';
      setIsFormVisible(false);
    } catch (err: any) {
      console.error('Master Upload Error Details:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      onStatusMessage(`Cloud Error: ${err.message}. Check if 'Storage' is enabled in Firebase console.`, 'error');
    } finally {
      setIsUploading(false);
      setProgress({ label: '', percent: 0 });
    }
  };

  const handleMediaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string)?.trim();
    const url = (formData.get('url') as string)?.trim();
    const finalCategory = selectedVideoCat === 'new' ? newVideoCatInput.trim() : selectedVideoCat.trim();
    const orderStr = formData.get('order') as string;
    const order = orderStr ? parseInt(orderStr, 10) : undefined;
    const duration = (formData.get('duration') as string)?.trim();

    if (!title || !url) {
      onStatusMessage(`Please enter both title and link URL!`, 'error');
      setIsUploading(false);
      return;
    }

    if (!finalCategory) {
      onStatusMessage(`Please select or enter a Category!`, 'error');
      setIsUploading(false);
      return;
    }

    const folderStateValue = selectedFolder === 'new' ? newFolderInput : selectedFolder;
    const finalFolder = folderStateValue === '_none_' ? '' : folderStateValue.trim();

    let finalSubfolder = '';
    if (finalFolder) {
      const subfolderStateValue = selectedSubfolder === 'new' ? newSubfolderInput : selectedSubfolder;
      finalSubfolder = subfolderStateValue === '_none_' ? '' : subfolderStateValue.trim();
    }

    try {
      const timestamp = Date.now();
      const docData: any = {
        title,
        url,
        category: finalCategory,
        folder: finalFolder,
        subfolder: finalSubfolder,
        createdAt: timestamp,
        views: 0,
        type: mediaPublishType === 'podcast' ? 'audio' : 'video',
        ...(duration ? { duration } : {})
      };

      if (order !== undefined && !isNaN(order)) {
        docData.order = order;
      }

      const docRef = await addDoc(collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim'), docData);

      const seriesLabel = [finalCategory, finalFolder, finalSubfolder].filter(Boolean).join(' • ');
      const shareUrl = `https://aisefarim.com/v/${docRef.id}`;
      const durationLine = duration ? `⏱️ *Duration:* ${duration}\n\n` : '';
      const shareMessage = `🎙️ *AI Sefarim: ${title}*

${seriesLabel ? `📁 *Series:* ${seriesLabel}\n\n` : ''}${durationLine}🎧 *Listen now on AI Sefarim:*
${shareUrl}`;

      let autoCopied = false;
      try {
        await navigator.clipboard.writeText(shareMessage);
        autoCopied = true;
      } catch (clipErr) {
        console.warn('Clipboard write error:', clipErr);
      }

      setLastPublishedShareInfo({
        title,
        shareUrl,
        shareMessage,
        type: mediaPublishType,
        autoCopied
      });

      const label = mediaPublishType === 'podcast' ? 'Podcast' : 'Video';
      onStatusMessage(
        autoCopied
          ? `${label} published! Share info copied to clipboard.`
          : `${label} published successfully!`,
        'success'
      );
      formRef.current?.reset();
      setSelectedVideoCat(currentCategory || '');
      setNewVideoCatInput('');
      setSelectedFolder('');
      setNewFolderInput('');
      setSelectedSubfolder('_none_');
      setNewSubfolderInput('');
      setIsFormVisible(false);
    } catch (err: any) {
      console.error('Media upload error:', err);
      onStatusMessage(`Error: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-16">
      <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-indigo-50">
        {lastPublishedShareInfo && (
          <div className="mb-8 p-6 rounded-3xl bg-slate-950 border border-emerald-500/40 shadow-xl relative animate-in fade-in slide-in-from-top-3 duration-300">
            <button
              type="button"
              onClick={() => setLastPublishedShareInfo(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <span>{lastPublishedShareInfo.type === 'podcast' ? 'Podcast' : 'Video'} Published!</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {lastPublishedShareInfo.autoCopied ? 'Copied to Clipboard' : 'Share Ready'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 font-medium truncate max-w-md">
                    {lastPublishedShareInfo.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(lastPublishedShareInfo.shareMessage);
                    setCopiedShareInfo(true);
                    setTimeout(() => setCopiedShareInfo(false), 2000);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 border border-slate-700"
                >
                  {copiedShareInfo ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Re-Copy Share Info</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(lastPublishedShareInfo.shareMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              </div>
            </div>

            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-line leading-relaxed select-all">
              {lastPublishedShareInfo.shareMessage}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black text-slate-50 uppercase italic tracking-tighter">Publishing Portal</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSettings}
              className="bg-slate-800 text-slate-200 px-4 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-700 transition-all"
              title="Site Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (isFormVisible && entryMode === 'batch') {
                  setIsFormVisible(false);
                } else {
                  setIsFormVisible(true);
                  setEntryMode('batch');
                }
              }}
              className={`px-5 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg text-xs uppercase tracking-wider ${
                isFormVisible && entryMode === 'batch'
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-4 h-4" /> Batch Add
            </button>
            <button
              onClick={() => {
                if (isFormVisible && entryMode === 'single') {
                  setIsFormVisible(false);
                } else {
                  setIsFormVisible(true);
                  setEntryMode('single');
                }
              }}
              className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg text-xs uppercase tracking-wider ${
                isFormVisible && entryMode === 'single'
                  ? 'bg-indigo-700 text-white shadow-indigo-100 ring-2 ring-indigo-400'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
              }`}
            >
              <Plus className="w-5 h-5" /> New {activeTab === 'sefarim' ? 'Sefer' : 'Media'}
            </button>
          </div>
        </div>

        {isFormVisible && entryMode === 'batch' && (
          <BatchAddMedia
            existingCategories={allMediaCategories}
            onStatusMessage={onStatusMessage}
          />
        )}

        {isFormVisible && entryMode === 'single' && activeTab !== 'sefarim' && (
          <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 max-w-sm mx-auto mb-6">
            <button
              type="button"
              onClick={() => {
                setMediaPublishType('video');
                setSelectedFolder('');
                setSelectedSubfolder('_none_');
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                mediaPublishType === 'video'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <VideoIcon className="w-4 h-4" /> Video
            </button>
            <button
              type="button"
              onClick={() => {
                setMediaPublishType('podcast');
                setSelectedFolder('');
                setSelectedSubfolder('_none_');
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                mediaPublishType === 'podcast'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Headphones className="w-4 h-4" /> Podcast
            </button>
          </div>
        )}

        {isFormVisible && entryMode === 'single' && activeTab === 'sefarim' && (
          <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6 p-8 bg-slate-950 rounded-3xl border border-slate-800">
            <div className="lg:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Sefer Cover</label>
              <div className="aspect-[3/4] rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group shadow-inner">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-slate-300">
                    <ImageIcon className="w-12 h-12 mb-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Select Image</span>
                  </div>
                )}
                <input
                  type="file"
                  ref={coverInputRef}
                  onChange={handleCoverChange}
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="lg:col-span-2 space-y-5">
              <input
                name="title"
                required
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-lg bg-slate-900"
                placeholder="Title (*כותרת*)"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:col-span-2">
                <input
                  name="author"
                  required
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-slate-900"
                  placeholder="Author (*מחבר*)"
                />
                <input
                  name="category"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-slate-900"
                  placeholder="Category (e.g. Halacha)"
                />
                <div className="space-y-3">
                  <select
                    name="series_select"
                    value={selectedBookSeries}
                    onChange={(e) => setSelectedBookSeries(e.target.value)}
                    className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-slate-900 appearance-none"
                  >
                    <option value="" disabled>Select Series... (Optional)</option>
                    <option value="_none_">No Series (Standalone)</option>
                    {bookSeriesList.map(seriesItem => (
                      <option key={seriesItem} value={seriesItem}>{seriesItem}</option>
                    ))}
                    <option value="new">+ Create New Series</option>
                  </select>
                  
                  {selectedBookSeries === 'new' && (
                    <input
                      name="new_series"
                      required
                      value={newBookSeriesInput}
                      onChange={(e) => setNewBookSeriesInput(e.target.value)}
                      className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-slate-900 animate-in slide-in-from-top-2"
                      placeholder="Enter new series name"
                      autoFocus
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  name="buyLink"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-slate-900"
                  placeholder="Physical Copy URL"
                />
                <input
                  name="order"
                  type="number"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-slate-900"
                  placeholder="Rank Order (1 is highest)"
                />
              </div>
              <textarea
                name="desc"
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all h-24 resize-none font-medium bg-slate-900"
                placeholder="Describe the Sefer..."
              ></textarea>

              <div className="grid grid-cols-1 gap-4">
                <div className="relative bg-slate-900 p-4 rounded-2xl ring-1 ring-slate-200 flex items-center justify-center group hover:bg-indigo-50 transition-colors">
                  <span className={`text-xs font-black uppercase tracking-widest ${epubInputRef.current?.files?.length ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {epubInputRef.current?.files?.length ? 'READY FOR CLOUD ✅' : 'UPLOAD EPUB'}
                  </span>
                  <input
                    type="file"
                    ref={epubInputRef}
                    onChange={(e) => { 
                      // Force a re-render by updating a dummy state so the label updates
                      setProgress({ label: '', percent: 0 }); 
                    }}
                    accept=".epub"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>{progress.label}</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress.percent}%` }}></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> SYNCING...
                  </>
                ) : (
                  'Publish to ספריה'
                )}
              </button>
            </div>
          </form>
        )}

        {isFormVisible && entryMode === 'single' && activeTab !== 'sefarim' && (
          <form ref={formRef} onSubmit={handleMediaSubmit} className="grid grid-cols-1 gap-8 mt-6 p-8 bg-slate-950 rounded-3xl border border-slate-800">
            <div className="space-y-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-1">
                  Publishing {mediaPublishType === 'podcast' ? 'Podcast' : 'Video'}
                </span>
                <input
                  name="title"
                  required
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold text-lg bg-slate-900 text-slate-100"
                  placeholder={mediaPublishType === 'podcast' ? "Podcast Episode Title" : "Video Title"}
                />
              </div>

              <input
                name="url"
                required
                type="url"
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 placeholder:text-slate-500"
                placeholder={mediaPublishType === 'podcast' ? "Podcast Link URL (Spotify, Apple Podcasts, YouTube, MP3...)" : "Video Link (NotebookLM, YouTube, Google Drive...)"}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Category</label>
                  <select
                    required
                    value={selectedVideoCat}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedVideoCat(val);
                      setSelectedFolder('');
                      setNewFolderInput('');
                      setSelectedSubfolder('_none_');
                      setNewSubfolderInput('');
                    }}
                    className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select Category...</option>
                    {allMediaCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="new">+ Create New Category</option>
                  </select>

                  {selectedVideoCat === 'new' && (
                    <input
                      name="new_category"
                      required
                      value={newVideoCatInput}
                      onChange={(e) => {
                        setNewVideoCatInput(e.target.value);
                        setSelectedFolder('');
                        setSelectedSubfolder('_none_');
                      }}
                      className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 animate-in slide-in-from-top-2"
                      placeholder="Enter new category name..."
                      autoFocus
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Folder</label>
                  <select
                    name="folder_select"
                    value={selectedFolder}
                    onChange={(e) => {
                      setSelectedFolder(e.target.value);
                      setSelectedSubfolder('_none_');
                    }}
                    disabled={!effectiveCategory}
                    className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!effectiveCategory ? (
                      <option value="" disabled>Select Category first...</option>
                    ) : (
                      <>
                        <option value="" disabled>Select Folder... (Optional)</option>
                        <option value="_none_">No Folder (Top-level in {effectiveCategory})</option>
                        {categoryMediaFolders.map(folder => (
                          <option key={folder} value={folder}>{folder}</option>
                        ))}
                        <option value="new">+ Create New Folder</option>
                      </>
                    )}
                  </select>

                  {selectedFolder === 'new' && (
                    <input
                      name="new_folder"
                      required
                      value={newFolderInput}
                      onChange={(e) => setNewFolderInput(e.target.value)}
                      className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 animate-in slide-in-from-top-2"
                      placeholder={`Enter new folder name in ${effectiveCategory}`}
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {selectedFolder && selectedFolder !== '_none_' && (
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Subfolder (Optional)</label>
                  <select
                    name="subfolder_select"
                    value={selectedSubfolder}
                    onChange={(e) => setSelectedSubfolder(e.target.value)}
                    className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 appearance-none cursor-pointer"
                  >
                    <option value="_none_">No Subfolder (Root of {currentEffectiveFolder || 'Folder'})</option>
                    {existingSubfolders.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    <option value="new">+ Create New Subfolder</option>
                  </select>
                  {selectedSubfolder === 'new' && (
                    <input
                      name="new_subfolder"
                      required
                      value={newSubfolderInput}
                      onChange={(e) => setNewSubfolderInput(e.target.value)}
                      className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 animate-in slide-in-from-top-2"
                      placeholder="Enter new subfolder name"
                      autoFocus
                    />
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Duration Estimate (Optional)
                </label>
                <input
                  name="duration"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100 placeholder:text-slate-500"
                  placeholder="e.g. 18 min, ~20–25 min"
                />
              </div>

              <input
                name="order"
                type="number"
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-700 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-bold bg-slate-900 text-slate-100"
                placeholder="Rank Order (1 is highest, optional)"
              />

              <button
                type="submit"
                disabled={isUploading}
                className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> SAVING...
                  </>
                ) : (
                  `Publish ${mediaPublishType === 'podcast' ? 'Podcast' : 'Video'}`
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
