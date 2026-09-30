import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, BookOpen, Loader2, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

const LOADING_MESSAGES = [
  'Searching 3,300+ years of expansive, infinitely deep Torah material…',
  'Cross-referencing Mishnah, Gemara, Rambam, and the Zohar…',
  'Digging through Bavli, Yerushalmi, and the Poskim…',
  'Consulting the Arizal, the Baalei Mussar, and the Acharonim…',
  'Tracing a single sugya across the Rishonim and Acharonim…',
  'Weighing the Shulchan Aruch against the Beit Yosef, Rambam, and the Zohar…',
];

const LOADING_EXPLANATION =
  "This can take a little longer than a typical search engine — Super Agent is sifting through nearly 1,000 dense primary texts of our Mesorah, not just matching keywords.";

function flashSource(msgIndex: number, n: number) {
  const el = document.getElementById(`source-${msgIndex}-${n}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('source-flash');
  setTimeout(() => el.classList.remove('source-flash'), 1400);
}

function Markdown({ text, onCiteClick }: { text: string; onCiteClick: (n: number) => void }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        h1: ({ children }) => <h3 className="text-base font-black text-slate-100 mt-4 mb-2">{children}</h3>,
        h2: ({ children }) => <h3 className="text-base font-black text-slate-100 mt-4 mb-2">{children}</h3>,
        h3: ({ children }) => <h4 className="text-sm font-black text-slate-200 mt-3 mb-1.5">{children}</h4>,
        strong: ({ children }) => <strong className="font-bold text-slate-100">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        hr: () => <hr className="border-slate-700/60 my-3" />,
        a: ({ href, children }) => {
          const citeMatch = href?.match(/^#cite-(\d+)$/);
          if (citeMatch) {
            const n = Number(citeMatch[1]);
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onCiteClick(n);
                }}
                className="inline-flex items-center justify-center w-4 h-4 mx-0.5 -translate-y-0.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-black align-super transition-colors"
                aria-label={`Open source ${n}`}
              >
                {n}
              </button>
            );
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              {children}
            </a>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  function toggleSource(key: string) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    setLoadingMsgIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
    const id = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2800);
    return () => clearInterval(id);
  }, [isLoading]);

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
      <style>{`
        @keyframes sourceFlash { 0%, 100% { background-color: rgba(99,102,241,0.08); } 50% { background-color: rgba(99,102,241,0.35); } }
        .source-flash { animation: sourceFlash 0.7s ease-in-out 2; }
      `}</style>

      <div className="text-center mb-6 sm:mb-8 px-1">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-500/30 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by the AI Sefarim library
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-50 tracking-tighter leading-tight mb-3">
          Meet Your Super Agent
        </h1>
        <p className="text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
          Hundreds of sources, fully indexed and instantly searchable &mdash; from the <span className="text-indigo-400 font-bold">Mishnah</span> to the present day.
          Every tractate of <span className="text-indigo-400 font-bold">Gemara</span>, all of the <span className="text-indigo-400 font-bold">Rambam</span>, the complete <span className="text-indigo-400 font-bold">Beit Yosef</span> and <span className="text-indigo-400 font-bold">Shulchan Aruch</span>,
          the full <span className="text-indigo-400 font-bold">Arizal</span>, the Zohar, and every AI Sefarim book &mdash; 3,300 years of Torah, one question away.
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
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 sm:px-5 py-3.5 ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-[0_2px_12px_-2px_rgba(99,102,241,0.5)]'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-200'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="text-[15px]">
                  <Markdown
                    text={m.content}
                    onCiteClick={(n) => {
                      toggleSource(`${i}-${n}`);
                      flashSource(i, n);
                    }}
                  />
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{m.content}</p>
              )}

              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Sources &mdash; tap to read the actual text
                  </p>
                  {m.sources.map((s) => {
                    const key = `${i}-${s.n}`;
                    const isOpen = expandedSources.has(key);
                    return (
                      <div key={s.n} id={`source-${i}-${s.n}`} className="rounded-lg -mx-2 px-2 py-1.5 transition-colors">
                        <button
                          onClick={() => toggleSource(key)}
                          className="w-full flex items-start gap-2 text-xs text-slate-400 hover:text-slate-200 text-left"
                        >
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black shrink-0 mt-0.5">
                            {s.n}
                          </span>
                          <span className="flex items-start gap-1.5 flex-1">
                            <BookOpen className="w-3 h-3 mt-0.5 text-indigo-400 shrink-0" />
                            <span className="font-semibold text-slate-300">{s.book}</span>
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {isOpen && s.excerpt && (
                          <blockquote className="mt-2 ml-6 pl-3 border-l-2 border-indigo-500/40 text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap font-serif italic">
                            {s.excerpt}
                            {s.excerpt.length >= 1200 && '…'}
                          </blockquote>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl px-5 py-3.5 max-w-[92%] sm:max-w-[85%] text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span key={loadingMsgIndex} className="animate-in fade-in duration-300">
                  {LOADING_MESSAGES[loadingMsgIndex]}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700/40 leading-relaxed">
                {LOADING_EXPLANATION}
              </p>
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
