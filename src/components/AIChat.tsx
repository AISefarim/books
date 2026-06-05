import React, { useState } from 'react';
import { Bot, ExternalLink, Loader2, X } from 'lucide-react';

interface AIChatProps {
  onClose: () => void;
}

export function AIChat({ onClose }: AIChatProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const notebookLmUrl = "https://notebooklm.google.com/notebook/3a789646-d038-4b69-a393-67822b005fd7";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-5xl h-[85vh] flex flex-col bg-white rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-50 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-700">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-800 leading-tight">AI Assistant Chatbot</h2>
              <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mt-0.5">Highly sophisticated AI answers based solely on our books</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a 
              href={notebookLmUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-100 rounded-full text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-slate-50 transition-all shadow-sm"
            >
              Open in New Tab <ExternalLink className="w-3 h-3" />
            </a>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 relative bg-slate-50">
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
    </div>
  );
}
