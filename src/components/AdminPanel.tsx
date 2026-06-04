import React, { useState, useRef } from 'react';
import { Plus, Image as ImageIcon, Loader2, Settings } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { compressImage } from '../lib/imageUtils';
import { Video, Book } from '../types';

interface AdminPanelProps {
  onStatusMessage: (message: string, type: 'success' | 'error') => void;
  onOpenSettings: () => void;
  activeTab: 'sefarim' | 'videos' | 'library' | 'images' | 'audio' | 'ai';
  videoCategories: string[];
  videos?: Video[];
  books?: Book[];
  triggerAddBookToSeries?: { series: string, timestamp: number } | null;
}

export function AdminPanel({ onStatusMessage, onOpenSettings, activeTab, videoCategories, videos = [], books = [], triggerAddBookToSeries }: AdminPanelProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ label: '', percent: 0 });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  const [selectedFolder, setSelectedFolder] = useState('');
  const [newFolderInput, setNewFolderInput] = useState('');
  const [selectedVideoCat, setSelectedVideoCat] = useState('');
  
  const [selectedBookSeries, setSelectedBookSeries] = useState('_none_');
  const [newBookSeriesInput, setNewBookSeriesInput] = useState('');

  React.useEffect(() => {
    if (triggerAddBookToSeries) {
      if (activeTab === 'sefarim') {
        setIsFormVisible(true);
        setSelectedBookSeries(triggerAddBookToSeries.series);
      }
    }
  }, [triggerAddBookToSeries, activeTab]);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const epubInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const videoFolders = Array.from(new Set(videos.filter(v => !selectedVideoCat || v.category === selectedVideoCat).map(v => v.folder || ''))).filter(f => f !== '') as string[];
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

  const handleAudioSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const audioFile = audioInputRef.current?.files?.[0];
    if (!audioFile) {
      onStatusMessage('Please select an audio file (MP3)!', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const folder = formData.get('folder') as string;
    
    const folderStateValue = selectedFolder === 'new' ? newFolderInput : selectedFolder;
    const finalFolder = folderStateValue === '_none_' ? '' : folderStateValue.trim();

    try {
      const timestamp = Date.now();
      const audioPath = `audio/${timestamp}_${audioFile.name}`;
      
      const audioUrl = await uploadWithProgress(audioFile, audioPath, 'Uploading Audio...');

      const docData: any = {
        title,
        url: audioUrl,
        category,
        folder: finalFolder,
        createdAt: timestamp,
        type: 'audio',
        audioPath
      };

      await addDoc(collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim'), docData);

      onStatusMessage('Audio published successfully!', 'success');
      formRef.current?.reset();
      if (audioInputRef.current) audioInputRef.current.value = '';
      setSelectedFolder('');
      setNewFolderInput('');
      setIsFormVisible(false);
    } catch (err: any) {
      console.error(err);
      onStatusMessage(`Error: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const url = formData.get('url') as string;
    const category = formData.get('category') as string;
    const folder = formData.get('folder') as string;
    const orderStr = formData.get('order') as string;
    const order = orderStr ? parseInt(orderStr, 10) : undefined;

    const folderStateValue = selectedFolder === 'new' ? newFolderInput : selectedFolder;
    const finalFolder = folderStateValue === '_none_' ? '' : folderStateValue.trim();

    try {
      const timestamp = Date.now();
      const docData: any = {
        title,
        url,
        category,
        folder: finalFolder,
        createdAt: timestamp,
        views: 0,
        type: 'video'
      };

      if (order !== undefined && !isNaN(order)) {
        docData.order = order;
      }

      await addDoc(collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim'), docData);

      onStatusMessage('Video published successfully!', 'success');
      formRef.current?.reset();
      setSelectedFolder('');
      setNewFolderInput('');
      setIsFormVisible(false);
    } catch (err: any) {
      console.error('Video Upload Error:', err);
      onStatusMessage(`Error: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-16">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-indigo-50">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Publishing Portal</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSettings}
              className="bg-slate-100 text-slate-700 px-4 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-200 transition-all"
              title="Site Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsFormVisible(!isFormVisible)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" /> New {activeTab === 'sefarim' ? 'Sefer' : activeTab === 'videos' ? 'Video' : 'Image'}
            </button>
          </div>
        </div>

        {isFormVisible && activeTab === 'sefarim' && (
          <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6 p-8 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="lg:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Sefer Cover</label>
              <div className="aspect-[3/4] rounded-2xl bg-white border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group shadow-inner">
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
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-lg bg-white"
                placeholder="Title (*כותרת*)"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:col-span-2">
                <input
                  name="author"
                  required
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white"
                  placeholder="Author (*מחבר*)"
                />
                <input
                  name="category"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white"
                  placeholder="Category (e.g. Halacha)"
                />
                <div className="space-y-3">
                  <select
                    name="series_select"
                    value={selectedBookSeries}
                    onChange={(e) => setSelectedBookSeries(e.target.value)}
                    className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white appearance-none"
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
                      className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white animate-in slide-in-from-top-2"
                      placeholder="Enter new series name"
                      autoFocus
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  name="buyLink"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white"
                  placeholder="Physical Copy URL"
                />
                <input
                  name="order"
                  type="number"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white"
                  placeholder="Rank Order (1 is highest)"
                />
              </div>
              <textarea
                name="desc"
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all h-24 resize-none font-medium bg-white"
                placeholder="Describe the Sefer..."
              ></textarea>

              <div className="grid grid-cols-1 gap-4">
                <div className="relative bg-white p-4 rounded-2xl ring-1 ring-slate-200 flex items-center justify-center group hover:bg-indigo-50 transition-colors">
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
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress.percent}%` }}></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {isFormVisible && activeTab === 'videos' && (
          <form ref={formRef} onSubmit={handleVideoSubmit} className="grid grid-cols-1 gap-8 mt-6 p-8 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="space-y-5">
              <input
                name="title"
                required
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-lg bg-white"
                placeholder="Video Title"
              />
              <input
                name="url"
                required
                type="url"
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white"
                placeholder="NotebookLM Link (e.g. https://notebooklm.google.com/...)"
              />
              <div className="grid grid-cols-2 gap-4">
                <select
                  name="category"
                  required
                  value={selectedVideoCat}
                  onChange={(e) => setSelectedVideoCat(e.target.value)}
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white appearance-none"
                >
                  <option value="">Select Category...</option>
                  {videoCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                
                <div className="space-y-3">
                  <select
                    name="folder_select"
                    required
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white appearance-none"
                  >
                    <option value="" disabled>Select Folder...</option>
                    <option value="_none_">No Folder (Grid View)</option>
                    {videoFolders.map(folder => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                    <option value="new">+ Create New Folder</option>
                  </select>
                  
                  {selectedFolder === 'new' && (
                    <input
                      name="new_folder"
                      required
                      value={newFolderInput}
                      onChange={(e) => setNewFolderInput(e.target.value)}
                      className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white animate-in slide-in-from-top-2"
                      placeholder="Enter new folder name"
                      autoFocus
                    />
                  )}
                </div>
              </div>
              <input
                name="order"
                type="number"
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white"
                placeholder="Rank Order (1 is highest)"
              />

              <button
                type="submit"
                disabled={isUploading}
                className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> SAVING...
                  </>
                ) : (
                  'Publish Video'
                )}
              </button>
            </div>
          </form>
        )}

        {isFormVisible && activeTab === 'audio' && (
          <form ref={formRef} onSubmit={handleAudioSubmit} className="grid grid-cols-1 gap-8 mt-6 p-8 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="space-y-5">
              <input
                name="title"
                required
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-lg bg-white"
                placeholder="Audio Title"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  name="category"
                  className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white"
                  placeholder="Category (Optional)"
                />
                
                <div className="space-y-3">
                  <select
                    name="folder_select"
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white appearance-none"
                  >
                    <option value="" disabled>Select Folder... (Optional)</option>
                    <option value="_none_">No Folder (Standalone track)</option>
                    {videoFolders.map(folder => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                    <option value="new">+ Create New Folder</option>
                  </select>
                  
                  {selectedFolder === 'new' && (
                    <input
                      name="new_folder"
                      required
                      value={newFolderInput}
                      onChange={(e) => setNewFolderInput(e.target.value)}
                      className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white animate-in slide-in-from-top-2"
                      placeholder="Enter new folder name"
                      autoFocus
                    />
                  )}
                </div>
              </div>

              <div className="relative bg-white p-4 rounded-2xl ring-1 ring-slate-200 flex items-center justify-center group hover:bg-indigo-50 transition-colors">
                <span className={`text-xs font-black uppercase tracking-widest ${audioInputRef.current?.files?.length ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {audioInputRef.current?.files?.length ? 'READY TO UPLOAD ✅' : 'UPLOAD MP3 FILE'}
                </span>
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={() => { 
                    setProgress({ label: '', percent: 0 }); 
                  }}
                  accept="audio/mp3,audio/mpeg,audio/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> {progress.label || 'UPLOADING...'} {progress.percent > 0 ? `${Math.round(progress.percent)}%` : ''}
                  </>
                ) : (
                  'Publish Audio'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
