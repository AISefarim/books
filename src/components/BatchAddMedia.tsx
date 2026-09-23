import React, { useState } from 'react';
import { Layers, AlertTriangle, Check, Copy, Share2, MessageCircle, ArrowLeft, Loader2, Sparkles, Folder, Tag } from 'lucide-react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BatchAddMediaProps {
  existingCategories: string[];
  onStatusMessage: (message: string, type: 'success' | 'error') => void;
  onSuccess?: () => void;
}

interface ParsedEpisode {
  lineNumber: number;
  category: string;
  title: string;
  link: string;
  folder: string;
}

interface CreatedEpisode {
  id: string;
  category: string;
  title: string;
  url: string;
  folder: string;
}

export function formatBatchWhatsAppMessage(title: string, category: string, folder: string, id: string): string {
  const seriesLabel = [category, folder].filter(Boolean).join(' • ');
  return `🎙️ *AI Sefarim: ${title}*

${seriesLabel ? `📁 *Series:* ${seriesLabel}\n` : ''}🎧 *Listen now on AI Sefarim:*
https://aisefarim.com/v/${id}`;
}

export function BatchAddMedia({ existingCategories, onStatusMessage, onSuccess }: BatchAddMediaProps) {
  const [inputText, setInputText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Unrecognized category confirmation state
  const [categoryWarning, setCategoryWarning] = useState<{
    unrecognized: string[];
    parsedItems: ParsedEpisode[];
  } | null>(null);

  // Results screen state
  const [resultsByCat, setResultsByCat] = useState<Record<string, CreatedEpisode[]> | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [copiedCat, setCopiedCat] = useState<string | null>(null);

  const parseLines = (text: string): { items: ParsedEpisode[]; error: string | null } => {
    const lines = text.split('\n');
    const items: ParsedEpisode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed) continue; // skip empty lines

      const parts = trimmed.split('|').map(s => s.trim());
      const lineNum = i + 1;

      if (parts.length < 3 || parts.length > 4) {
        return {
          items: [],
          error: `Line ${lineNum} is malformed: "${trimmed}". Expected "Category | Title | Link" (or "Category | Title | Link | Folder").`
        };
      }

      const [category, title, link, folder = ''] = parts;

      if (!category) {
        return { items: [], error: `Line ${lineNum} is missing a Category.` };
      }
      if (!title) {
        return { items: [], error: `Line ${lineNum} is missing a Title.` };
      }
      if (!link) {
        return { items: [], error: `Line ${lineNum} is missing a Link URL.` };
      }

      items.push({
        lineNumber: lineNum,
        category,
        title,
        link,
        folder
      });
    }

    if (items.length === 0) {
      return { items: [], error: 'Please enter at least one episode line to publish.' };
    }

    return { items, error: null };
  };

  const executePublish = async (items: ParsedEpisode[]) => {
    setIsPublishing(true);
    setErrorMessage(null);
    setCategoryWarning(null);

    try {
      const colRef = collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim');
      const baseTimestamp = Date.now();

      // Chunk in case of large batches (> 400 items, Firestore limit is 500 per batch)
      const chunkSize = 400;
      const created: CreatedEpisode[] = [];

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((item, index) => {
          const newDocRef = doc(colRef);
          const docData = {
            title: item.title,
            url: item.link,
            category: item.category,
            folder: item.folder || '',
            subfolder: '',
            createdAt: baseTimestamp + (i + index),
            views: 0,
            type: 'video'
          };
          batch.set(newDocRef, docData);
          created.push({
            id: newDocRef.id,
            category: item.category,
            title: item.title,
            url: item.link,
            folder: item.folder || ''
          });
        });

        await batch.commit();
      }

      // Group created items by category
      const grouped: { [category: string]: CreatedEpisode[] } = {};
      created.forEach(ep => {
        if (!grouped[ep.category]) {
          grouped[ep.category] = [];
        }
        grouped[ep.category].push(ep);
      });

      setResultsByCat(grouped);

      let copyNotice = '';
      if (created.length === 1) {
        const singleMsg = formatBatchWhatsAppMessage(created[0].title, created[0].category, created[0].folder, created[0].id);
        try {
          await navigator.clipboard.writeText(singleMsg);
          copyNotice = ' Share info automatically copied to clipboard!';
        } catch (clipErr) {
          console.warn('Clipboard write error:', clipErr);
        }
      } else if (created.length > 1) {
        const allMsg = created.map(ep => formatBatchWhatsAppMessage(ep.title, ep.category, ep.folder, ep.id)).join('\n\n────────────────\n\n');
        try {
          await navigator.clipboard.writeText(allMsg);
          copyNotice = ' All share messages copied to clipboard!';
        } catch (clipErr) {
          console.warn('Clipboard write error:', clipErr);
        }
      }

      onStatusMessage(`Successfully published ${created.length} episode${created.length === 1 ? '' : 's'}!${copyNotice}`, 'success');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Batch publish error:', err);
      setErrorMessage(`Publish failed: ${err.message || String(err)}`);
      onStatusMessage(`Publish failed: ${err.message}`, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStartPublish = () => {
    setErrorMessage(null);
    const { items, error } = parseLines(inputText);

    if (error) {
      setErrorMessage(error);
      return;
    }

    // Check categories against existing categories (case-sensitive exact match)
    const unrecognized = Array.from(
      new Set(items.map(i => i.category).filter(cat => !existingCategories.includes(cat)))
    );

    if (unrecognized.length > 0) {
      // Warn user and ask for confirmation
      setCategoryWarning({
        unrecognized,
        parsedItems: items
      });
      return;
    }

    // All categories match; proceed directly
    executePublish(items);
  };

  const handleCopySingleMessage = async (ep: CreatedEpisode) => {
    const msg = formatBatchWhatsAppMessage(ep.title, ep.category, ep.folder, ep.id);
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedItemId(ep.id);
      setTimeout(() => setCopiedItemId(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyCategoryMessages = async (category: string, episodes: CreatedEpisode[]) => {
    const combined = episodes
      .map(ep => formatBatchWhatsAppMessage(ep.title, ep.category, ep.folder, ep.id))
      .join('\n\n────────────────\n\n');

    try {
      await navigator.clipboard.writeText(combined);
      setCopiedCat(category);
      setTimeout(() => setCopiedCat(null), 2500);
    } catch (err) {
      console.error('Failed to copy category', err);
    }
  };

  // If results are available, show the Results Screen
  if (resultsByCat) {
    const categoriesList = Object.entries(resultsByCat) as [string, CreatedEpisode[]][];
    const totalPublished = categoriesList.reduce((acc, [, list]) => acc + list.length, 0);

    return (
      <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-indigo-500/30 text-slate-100 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 mb-8 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Check className="w-3.5 h-3.5" /> Batch Published
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {totalPublished} Episode{totalPublished === 1 ? '' : 's'} Created
              </span>
            </div>
            <h3 className="text-2xl font-black tracking-tight text-white">
              WhatsApp Share Links Ready
            </h3>
          </div>

          <button
            type="button"
            onClick={() => {
              setResultsByCat(null);
              setInputText('');
              setErrorMessage(null);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-indigo-600/30"
          >
            <ArrowLeft className="w-4 h-4" /> Batch Add More
          </button>
        </div>

        <div className="space-y-10">
          {categoriesList.map(([category, episodes]) => {
            const isCatCopied = copiedCat === category;

            return (
              <div key={category} className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">{category}</h4>
                      <p className="text-xs text-slate-400 font-bold">
                        {episodes.length} Episode{episodes.length === 1 ? '' : 's'} in this category
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCategoryMessages(category, episodes)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                    title="Copy all WhatsApp messages in this category at once"
                  >
                    {isCatCopied ? (
                      <>
                        <Check className="w-4 h-4" /> Copied All ({episodes.length})!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy all for this category
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {episodes.map(ep => {
                    const message = formatBatchWhatsAppMessage(ep.title, ep.category, ep.folder, ep.id);
                    const isCopied = copiedItemId === ep.id;

                    return (
                      <div
                        key={ep.id}
                        className="bg-slate-950 rounded-2xl p-4 border border-slate-800/80 flex flex-col justify-between gap-3 shadow-inner hover:border-indigo-500/30 transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono text-slate-400 truncate">
                              ID: {ep.id}
                            </span>
                            {ep.folder && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-500/20">
                                <Folder className="w-3 h-3 text-indigo-400" />
                                {ep.folder}
                              </span>
                            )}
                          </div>
                          <h5 className="font-bold text-slate-100 text-sm leading-snug">
                            {ep.title}
                          </h5>
                          <a
                            href={`https://aisefarim.com/v/${ep.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:underline font-mono block truncate"
                          >
                            https://aisefarim.com/v/{ep.id}
                          </a>
                        </div>

                        {/* WhatsApp Message Preview Box */}
                        <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-line leading-relaxed select-all">
                          {message}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCopySingleMessage(ep)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold transition-all border border-slate-700 active:scale-95"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy WhatsApp Message</span>
                              </>
                            )}
                          </button>

                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 transition-all flex items-center justify-center active:scale-95"
                            title="Directly send to WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4 fill-current" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 mt-6 text-slate-100">
      {/* Category confirmation modal / overlay */}
      {categoryWarning && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 max-w-lg w-full p-6 sm:p-8 rounded-3xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-xl font-black text-white">Unrecognized Category Warning</h4>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                The following {categoryWarning.unrecognized.length === 1 ? 'category does' : 'categories do'} not match any existing video category exactly:
              </p>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2">
              {categoryWarning.unrecognized.map(cat => (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 font-mono">"{cat}"</span>
                  <span className="text-[11px] text-slate-400 font-medium">New category (check for typos)</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3 text-[11px] text-slate-300">
              <span className="font-bold text-slate-200">Existing Categories: </span>
              {existingCategories.join(', ')}
            </div>

            <p className="text-xs text-slate-400">
              If this is intentional, you can proceed and create this category. If it is a typo, cancel and fix it before publishing.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCategoryWarning(null)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase tracking-wider transition-all"
              >
                Cancel & Fix Typo
              </button>
              <button
                type="button"
                onClick={() => executePublish(categoryWarning.parsedItems)}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
              >
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header and explanation */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="text-xl font-black text-white">Batch Add Episodes</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-900/60 text-indigo-300 border border-indigo-500/30">
            Multi-Line
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Paste multiple episodes below — one per line. We will validate every line, check for category typos, and write them in a single batch to Firestore.
        </p>
      </div>

      {/* Format Helper Card */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 mb-6 space-y-2">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block">
          Required Format (Pipe Separated):
        </span>
        <div className="bg-slate-950 rounded-xl p-3 font-mono text-xs text-indigo-300 border border-slate-800 space-y-1">
          <div>Category | Title | Link</div>
          <div className="text-slate-400 text-[11px]">Category | Title | Link | Folder <span className="text-slate-400 font-sans italic">(optional 4th part)</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
          <span className="font-bold text-slate-400">Known Categories:</span>
          {existingCategories.slice(0, 8).map(c => (
            <span key={c} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
              {c}
            </span>
          ))}
          {existingCategories.length > 8 && <span className="text-[10px] text-slate-400">+{existingCategories.length - 8} more</span>}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs font-bold animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="block font-black uppercase tracking-wider text-rose-400">Malformed Line Detected</span>
            <p className="font-mono text-slate-200">{errorMessage}</p>
            <p className="text-[11px] text-slate-400">Nothing has been published yet. Please fix this line and try again.</p>
          </div>
        </div>
      )}

      {/* Textarea */}
      <div className="space-y-2 mb-6">
        <label className="text-xs font-black uppercase tracking-widest text-slate-400 block">
          Episodes Input:
        </label>
        <textarea
          rows={10}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder={`AI Daf | Bava Metzia 2a: Two Holding a Garment | https://youtu.be/example1 | Bava Metzia\nAI Daf | Bava Metzia 2b: Dividing the Value | https://youtu.be/example2 | Bava Metzia\nAI Parasha | Parashat Bereshit: In the Beginning | https://youtu.be/example3 | Torah\nAI Rambam | Hilchot Yesodei HaTorah 1:1 | https://youtu.be/example4`}
          className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-100 font-mono text-xs sm:text-sm placeholder:text-slate-400 outline-none leading-relaxed transition-all"
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs text-slate-400 font-bold">
          {inputText.split('\n').filter(s => s.trim()).length} line{inputText.split('\n').filter(s => s.trim()).length === 1 ? '' : 's'} entered
        </span>

        <button
          type="button"
          disabled={isPublishing || !inputText.trim()}
          onClick={handleStartPublish}
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 active:scale-95 transition-all cursor-pointer"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Publishing All...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Publish All
            </>
          )}
        </button>
      </div>
    </div>
  );
}
