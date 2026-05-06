import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Video } from '../types';

interface EditVideoModalProps {
  video: Video;
  videoCategories: string[];
  videos?: Video[];
  onSave: (id: string, updatedData: Partial<Video>) => Promise<void>;
  onClose: () => void;
}

export function EditVideoModal({ video, videoCategories, videos = [], onSave, onClose }: EditVideoModalProps) {
  const [title, setTitle] = useState(video.title);
  const [url, setUrl] = useState(video.url);
  const [category, setCategory] = useState(video.category || '');
  
  const videoFolders = Array.from(new Set(videos.filter(v => !category || v.category === category).map(v => v.folder || ''))).filter(f => f !== '') as string[];
  
  // Initialize with appropriate folder state
  const isExistingFolder = videoFolders.includes(video.folder || '');
  const [selectedFolder, setSelectedFolder] = useState((!video.folder) ? '_none_' : (isExistingFolder ? video.folder : 'new'));
  const [newFolderInput, setNewFolderInput] = useState((!isExistingFolder && video.folder) ? video.folder : '');
  
  const [order, setOrder] = useState(video.order?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
    const folderStateValue = selectedFolder === 'new' ? newFolderInput : selectedFolder;
    const finalFolder = folderStateValue === '_none_' ? '' : folderStateValue.trim();
    
      const updatedData: Partial<Video> = {
        title,
        url,
        category,
        folder: finalFolder,
      };
      
      const parsedOrder = order ? parseInt(order, 10) : undefined;
      if (parsedOrder !== undefined && !isNaN(parsedOrder)) {
        updatedData.order = parsedOrder;
      } else {
        // We can't easily delete a field with updateDoc without importing deleteField, 
        // but setting it to null or undefined might work depending on the setup.
        // For now, we'll just leave it if it's empty, or set to a high number.
      }

      await onSave(video.id, updatedData);
      onClose();
    } catch (error) {
      console.error("Failed to save video", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Edit Video</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Category</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium appearance-none"
              >
                <option value="">Select Category...</option>
                {videoCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Subfolder</label>
              <div className="space-y-3">
                <select
                  required
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select Folder...</option>
                  <option value="_none_">No Folder (Grid View)</option>
                  {videoFolders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="new">+ Create New Folder</option>
                </select>
                
                {selectedFolder === 'new' && (
                  <input
                    type="text"
                    required
                    value={newFolderInput}
                    onChange={(e) => setNewFolderInput(e.target.value)}
                    placeholder="Enter new folder name..."
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium animate-in slide-in-from-top-2"
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-2">Rank Order (1 is highest)</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="e.g. 1, 2, 3... (Leave blank for default)"
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
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
                <><Save className="w-5 h-5" /> Save Changes</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
