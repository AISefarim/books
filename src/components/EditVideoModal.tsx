import React, { useState } from 'react';
import { X, Save, Loader2, Video as VideoIcon, Headphones } from 'lucide-react';
import { Video, Book } from '../types';

interface EditVideoModalProps {
  video: Video;
  videoCategories: string[];
  videos?: Video[];
  books?: Book[];
  onSave: (id: string, updatedData: Partial<Video>) => Promise<void>;
  onClose: () => void;
}

export function EditVideoModal({ video, videoCategories, videos = [], books = [], onSave, onClose }: EditVideoModalProps) {
  const [mediaType, setMediaType] = useState<'video' | 'audio'>(video.type === 'audio' ? 'audio' : 'video');
  const [title, setTitle] = useState(video.title);
  const [url, setUrl] = useState(video.url);
  const [category, setCategory] = useState(video.category || '');
  const [bookId, setBookId] = useState(video.bookId || '');
  
  const videoFolders = Array.from(new Set(
    videos
      .filter(v => (v.category || '').trim().toLowerCase() === category.trim().toLowerCase())
      .map(v => (v.folder || '').trim())
  )).filter(Boolean) as string[];
  
  // Initialize folder and subfolder states
  const initialFolder = video.folder || '';
  const initialSubfolder = video.subfolder || '';

  const isExistingFolder = videoFolders.includes(initialFolder);
  const [selectedFolder, setSelectedFolder] = useState(!initialFolder ? '_none_' : (isExistingFolder ? initialFolder : 'new'));
  const [newFolderInput, setNewFolderInput] = useState(!isExistingFolder && initialFolder ? initialFolder : '');

  // Subfolders for the currently selected folder
  const currentEffectiveFolder = selectedFolder === 'new' ? newFolderInput : (selectedFolder === '_none_' ? '' : selectedFolder);
  const existingSubfolders = Array.from(
    new Set(
      videos
        .filter(v => (v.category || '').trim().toLowerCase() === category.trim().toLowerCase() && (v.folder || '').trim() === currentEffectiveFolder && v.subfolder)
        .map(v => (v.subfolder || '').trim())
    )
  ).filter(Boolean) as string[];

  const isExistingSubfolder = existingSubfolders.includes(initialSubfolder);
  const [selectedSubfolder, setSelectedSubfolder] = useState(!initialSubfolder ? '_none_' : (isExistingSubfolder ? initialSubfolder : 'new'));
  const [newSubfolderInput, setNewSubfolderInput] = useState(!isExistingSubfolder && initialSubfolder ? initialSubfolder : '');

  const [order, setOrder] = useState(video.order?.toString() || '');
  const [duration, setDuration] = useState(video.duration || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const folderStateValue = selectedFolder === 'new' ? newFolderInput : selectedFolder;
      const finalFolder = folderStateValue === '_none_' ? '' : folderStateValue.trim();

      let finalSubfolder = '';
      if (finalFolder) {
        const subfolderStateValue = selectedSubfolder === 'new' ? newSubfolderInput : selectedSubfolder;
        finalSubfolder = subfolderStateValue === '_none_' ? '' : subfolderStateValue.trim();
      }
    
      const updatedData: Partial<Video> = {
        title,
        url,
        category,
        folder: finalFolder,
        subfolder: finalSubfolder,
        type: mediaType,
        duration: duration.trim(),
        bookId: bookId.trim() || undefined,
      };
      
      const parsedOrder = order ? parseInt(order, 10) : undefined;
      if (parsedOrder !== undefined && !isNaN(parsedOrder)) {
        updatedData.order = parsedOrder;
      }

      await onSave(video.id, updatedData);
      onClose();
    } catch (error) {
      console.error("Failed to save media", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-800">
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950/50">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-1">
              Edit Media Item
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-100 flex items-center gap-2">
              {mediaType === 'audio' ? (
                <>
                  <Headphones className="w-6 h-6 text-indigo-400" /> Edit Podcast
                </>
              ) : (
                <>
                  <VideoIcon className="w-6 h-6 text-indigo-400" /> Edit Video
                </>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Media Format Switcher */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">
              Media Format
            </label>
            <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  mediaType === 'video'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <VideoIcon className="w-4 h-4" /> Video
              </button>
              <button
                type="button"
                onClick={() => setMediaType('audio')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  mediaType === 'audio'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Headphones className="w-4 h-4" /> Podcast
              </button>
            </div>
            <p className="text-[11px] text-slate-400 ml-2">
              You can switch this media item between a Video and a Podcast anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                placeholder={mediaType === 'audio' ? "Podcast Episode Title" : "Video Title"}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                placeholder={mediaType === 'audio' ? "Spotify, Apple Podcasts, MP3, etc." : "NotebookLM, YouTube, Google Drive, etc."}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Category</label>
              <select
                required
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSelectedFolder('_none_');
                  setNewFolderInput('');
                  setSelectedSubfolder('_none_');
                  setNewSubfolderInput('');
                }}
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium appearance-none"
              >
                <option value="">Select Category...</option>
                {videoCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Folder</label>
              <div className="space-y-3">
                <select
                  value={selectedFolder}
                  onChange={(e) => {
                    setSelectedFolder(e.target.value);
                    setSelectedSubfolder('_none_');
                  }}
                  className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select Folder...</option>
                  <option value="_none_">No Folder (Top-level Grid)</option>
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
                    className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium animate-in slide-in-from-top-2"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {selectedFolder !== '_none_' && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Subfolder (Optional)</label>
                <div className="space-y-3">
                  <select
                    value={selectedSubfolder}
                    onChange={(e) => setSelectedSubfolder(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium appearance-none cursor-pointer"
                  >
                    <option value="_none_">No Subfolder (Root of {currentEffectiveFolder || 'Folder'})</option>
                    {existingSubfolders.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    <option value="new">+ Create New Subfolder</option>
                  </select>

                  {selectedSubfolder === 'new' && (
                    <input
                      type="text"
                      required
                      value={newSubfolderInput}
                      onChange={(e) => setNewSubfolderInput(e.target.value)}
                      placeholder="Enter new subfolder name..."
                      className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium animate-in slide-in-from-top-2"
                      autoFocus
                    />
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Duration Estimate (Optional)</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 18 min, ~20–25 min"
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Rank Order (1 is highest)</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="e.g. 1, 2, 3... (Leave blank for default)"
                className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>

            {books && books.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Linked Sefer (Optional)</label>
                <select
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-200"
                >
                  <option value="">None (Not linked to any Sefer)</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title} {b.author ? `(${b.author})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
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
