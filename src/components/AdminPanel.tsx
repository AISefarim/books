import React, { useState, useRef } from 'react';
import { Plus, Image as ImageIcon, Loader2, Settings } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

interface AdminPanelProps {
  onStatusMessage: (message: string, type: 'success' | 'error') => void;
  onOpenSettings: () => void;
  activeTab: 'sefarim' | 'videos';
}

export function AdminPanel({ onStatusMessage, onOpenSettings, activeTab }: AdminPanelProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ label: '', percent: 0 });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const epubInputRef = useRef<HTMLInputElement>(null);
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

    try {
      const timestamp = Date.now();
      const coverPath = `sefarim/cover_${timestamp}_${coverFile.name}`;
      const epubPath = `sefarim/epub_${timestamp}_${epubFile.name}`;

      const coverUrl = await uploadWithProgress(coverFile, coverPath, 'Uploading Cover...');
      const epubUrl = await uploadWithProgress(epubFile, epubPath, 'Uploading Sefer...');

      const docData: any = {
        title,
        author,
        category: category || 'Uncategorized',
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

  const handleVideoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const url = formData.get('url') as string;
    const category = formData.get('category') as string;

    try {
      const timestamp = Date.now();
      const docData = {
        title,
        url,
        category,
        createdAt: timestamp,
        views: 0,
        type: 'video'
      };

      await addDoc(collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim'), docData);

      onStatusMessage('Video published successfully!', 'success');
      formRef.current?.reset();
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
              <Plus className="w-5 h-5" /> New {activeTab === 'sefarim' ? 'Sefer' : 'Video'}
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
              <div className="grid grid-cols-2 gap-4">
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
              <select
                name="category"
                required
                className="w-full p-4 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold bg-white appearance-none"
              >
                <option value="">Select Category...</option>
                <option value="AI Daf">AI Daf</option>
                <option value="AI Parasha">AI Parasha</option>
                <option value="AI Mishnah">AI Mishnah</option>
                <option value="AI Rambam">AI Rambam</option>
                <option value="AI Tanach">AI Tanach</option>
              </select>

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
      </div>
    </div>
  );
}
