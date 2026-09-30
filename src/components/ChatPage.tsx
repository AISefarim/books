import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, BookOpen, Loader2 } from 'lucide-react';

// Deployed Cloudflare Worker URL. Set VITE_CHAT_WORKER_URL in the AI Studio
// Secrets panel (or .env) to override without a code change.
const CHAT_WORKER_URL =
  (import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev';

interface Source {
  n: number;
  book: string;
  excerpt?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

const SUGGESTIONS = [
  'What does the Shulchan Aruch say about lighting Chanukah candles?',
  'Explain the concept of Tzimtzum according to the Arizal',
  "What is Rashi's opinion on the sin of the Golden Calf?",
  'Summarize the Rambam\'s laws of Teshuvah',
];

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const history = nextMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(CHAT_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.');
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
    } catch {
      setError('Could not reach the AI Sefarim library. Please check your connection and try again.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto flex flex-col min-h-[70vh]">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-500/30 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by the AI Sefarim library
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-50 tracking-tighter leading-tight mb-3">
          Ask the Library
        </h1>
        <p className="text-slate-400 font-medium max-w-xl mx-auto">
          Grounded answers pulled directly from Mishneh Torah, Shulchan Aruch, the Talmud, the Zohar, Kitvei Ari,
          and every AI Sefarim book &mdash; with sources you can check.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-4 mb-4">
        {messages.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendQuestion(s)}
                className="text-left p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/40 text-sm text-slate-300 hover:text-slate-100 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-[0_2px_12px_-2px_rgba(99,102,241,0.5)]'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{m.content}</p>

              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Sources</p>
                  {m.sources.map((s) => (
                    <div key={s.n} className="flex items-start gap-1.5 text-xs text-slate-400">
                      <BookOpen className="w-3 h-3 mt-0.5 text-indigo-400 shrink-0" />
                      <span className="font-semibold text-slate-300">{s.book}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl px-5 py-3.5 flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching the library&hellip;
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-rose-400 text-sm font-medium bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
        className="sticky bottom-4 flex items-center gap-2 bg-slate-800/90 backdrop-blur-xl border border-slate-700 rounded-full p-1.5 shadow-2xl"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything from the library..."
          maxLength={800}
          disabled={isLoading}
          className="flex-1 bg-transparent px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none text-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-full transition-all active:scale-95 shrink-0"
          aria-label="Send question"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
