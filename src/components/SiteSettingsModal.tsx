import React, { useState, useRef } from 'react';
import { X, Save, Loader2, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

interface SiteSettingsModalProps {
  currentSettings: { 
    bannerUrl?: string, 
    logoUrl?: string,
    videoCategories?: string[],
    videoCategoryThumbnails?: Record<string, string>,
    videoFolderThumbnails?: Record<string, string>,
    welcomeVideoUrl?: string
  };
  videoFolders: string[];
  onClose: () => void;
  onStatusMessage: (message: string, type: 'success' | 'error') => void;
}

export function SiteSettingsModal({ currentSettings, videoFolders, onClose, onStatusMessage }: SiteSettingsModalProps) {
  const [bannerUrl, setBannerUrl] = useState(currentSettings.bannerUrl || 'https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr');
  const [logoPreview, setLogoPreview] = useState<string | null>(currentSettings.logoUrl || null);
  const [welcomeVideoPreview, setWelcomeVideoPreview] = useState<string | null>(currentSettings.welcomeVideoUrl || null);
  const [categoryThumbnails, setCategoryThumbnails] = useState<Record<string, string>>(currentSettings.videoCategoryThumbnails || {});
  const [folderThumbnails, setFolderThumbnails] = useState<Record<string, string>>(currentSettings.videoFolderThumbnails || {});
  const [categories, setCategories] = useState<string[]>(currentSettings.videoCategories || ["AI Daf", "AI Parasha", "AI Mishnah", "AI Rambam", "AI Tanach"]);
  const [newCategory, setNewCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const welcomeVideoInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const folderInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories(categories.filter(c => c !== catToRemove));
    const newThumbnails = { ...categoryThumbnails };
    delete newThumbnails[catToRemove];
    setCategoryThumbnails(newThumbnails);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWelcomeVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWelcomeVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleCategoryThumbnailChange = (category: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCategoryThumbnails(prev => ({ ...prev, [category]: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFolderThumbnailChange = (folder: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFolderThumbnails(prev => ({ ...prev, [folder]: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalLogoUrl = currentSettings.logoUrl || '';
      const logoFile = logoInputRef.current?.files?.[0];

      if (logoFile) {
        const storageRef = ref(storage, `settings/logo_${Date.now()}_${logoFile.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, logoFile);
        finalLogoUrl = await getDownloadURL(uploadTask.ref);
      }

      let finalWelcomeVideoUrl = currentSettings.welcomeVideoUrl || '';
      const welcomeVideoFile = welcomeVideoInputRef.current?.files?.[0];

      if (welcomeVideoFile) {
        const videoStorageRef = ref(storage, `settings/welcome_video_${Date.now()}_${welcomeVideoFile.name}`);
        const videoUploadTask = await uploadBytesResumable(videoStorageRef, welcomeVideoFile);
        finalWelcomeVideoUrl = await getDownloadURL(videoUploadTask.ref);
      }

      const finalCategoryThumbnails = { ...categoryThumbnails };
      
      for (const category of categories) {
        const fileInput = categoryInputRefs.current[category];
        const file = fileInput?.files?.[0];
        if (file) {
          const storageRef = ref(storage, `settings/category_${category.replace(/\s+/g, '_')}_${Date.now()}_${file.name}`);
          const uploadTask = await uploadBytesResumable(storageRef, file);
          finalCategoryThumbnails[category] = await getDownloadURL(uploadTask.ref);
        }
      }

      const finalFolderThumbnails = { ...folderThumbnails };
      
      for (const folder of videoFolders) {
        const fileInput = folderInputRefs.current[folder];
        const file = fileInput?.files?.[0];
        if (file) {
          const storageRef = ref(storage, `settings/folder_${folder.replace(/\s+/g, '_')}_${Date.now()}_${file.name}`);
          const uploadTask = await uploadBytesResumable(storageRef, file);
          finalFolderThumbnails[folder] = await getDownloadURL(uploadTask.ref);
        }
      }

      await setDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_'), {
        bannerUrl,
        logoUrl: finalLogoUrl,
        welcomeVideoUrl: finalWelcomeVideoUrl,
        videoCategories: categories,
        videoCategoryThumbnails: finalCategoryThumbnails,
        videoFolderThumbnails: finalFolderThumbnails,
        isSettingsDoc: true
      }, { merge: true });

      onStatusMessage('Site settings updated successfully!', 'success');
      onClose();
    } catch (error: any) {
      console.error("Failed to save settings", error);
      onStatusMessage(`Settings Error: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-8">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Site Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Site Logo (Thumbnail)</label>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative shadow-inner">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoChange}
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 mb-2">Upload a square image for your site logo. This is also used as a fallback thumbnail.</p>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Choose Image
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-6">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Welcome Dashboard Video (.mp4)</label>
            <div className="flex items-center gap-6">
              <div className="w-32 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative shadow-inner">
                {welcomeVideoPreview ? (
                  <video src={welcomeVideoPreview} className="w-full h-full object-cover" muted />
                ) : (
                  <VideoIcon className="w-8 h-8 text-slate-300" />
                )}
                <input
                  type="file"
                  ref={welcomeVideoInputRef}
                  onChange={handleWelcomeVideoChange}
                  accept="video/mp4,video/webm"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 mb-2">Upload the main welcome video displayed on the dashboard.</p>
                <button
                  type="button"
                  onClick={() => welcomeVideoInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  {welcomeVideoPreview ? 'Change Video' : 'Upload Video'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-6">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Community WhatsApp URL</label>
            <input
              type="url"
              required
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
            />
            <p className="text-[11px] font-medium text-slate-400 pl-2">This is the link used for the top WhatsApp buttons.</p>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-6">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Video Folder Thumbnails (Optional)</label>
            {videoFolders.length === 0 ? (
              <p className="text-sm text-slate-400 italic ml-2 mb-4">No folders created yet. Create folders when adding or editing videos.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {videoFolders.map(folder => (
                  <div key={folder} className="flex flex-col gap-2 relative group">
                    <div className="aspect-square rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative shadow-inner">
                      {folderThumbnails[folder] ? (
                        <img src={folderThumbnails[folder]} alt={folder} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                      <input
                        type="file"
                        ref={el => folderInputRefs.current[folder] = el}
                        onChange={(e) => handleFolderThumbnailChange(folder, e)}
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 text-center uppercase tracking-widest truncate px-1">{folder || 'Other'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-6">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Video Categories & Thumbnails</label>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New Category Name..."
                className="flex-1 px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors"
              >
                Add
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {categories.map(category => (
                <div key={category} className="flex flex-col gap-2 relative group">
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(category)}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="aspect-square rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative shadow-inner">
                    {categoryThumbnails[category] ? (
                      <img src={categoryThumbnails[category]} alt={category} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                    <input
                      type="file"
                      ref={el => categoryInputRefs.current[category] = el}
                      onChange={(e) => handleCategoryThumbnailChange(category, e)}
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 text-center">{category}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
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
                <><Save className="w-5 h-5" /> Save Settings</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
