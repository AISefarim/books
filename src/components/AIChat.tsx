import React, { useState } from 'react';
import { Bot, ExternalLink, Loader2 } from 'lucide-react';

export function AIChat() {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const notebookLmUrl = "https://notebooklm.google.com/notebook/3a789646-d038-4b69-a393-67822b005fd7";

  return (
    <div className="w-full h-full min-h-[80vh] flex flex-col bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between p-4 px-6 border-b border-slate-50 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100/50 p-2 rounded-xl text-indigo-600">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-800">NotebookLM Study Assistant</h2>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Ask questions based on all sefarim</p>
          </div>
        </div>
        <a 
          href={notebookLmUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-100 rounded-full text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-slate-50 transition-all shadow-sm"
        >
          Open in New Tab <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      
      <div className="flex-1 relative bg-slate-50 min-h-[600px]">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
            <p className="font-bold tracking-wide uppercase text-sm">Loading AI Assistant...</p>
            <p className="text-xs mt-2 max-w-sm text-center">If it does not load, Google may be blocking the embed. Please click "Open in New Tab" above.</p>
          </div>
        )}
        <iframe
          src={notebookLmUrl}
          className="w-full h-full border-none absolute inset-0 z-10 bg-transparent"
          title="NotebookLM Assistant"
          allow="microphone"
          onLoad={() => setIframeLoaded(true)}
        />
      </div>
    </div>
  );
}
