import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, BookOpen, Loader2, X, ExternalLink, Download, Trash2, MessageCircle, MessageSquare, ArrowLeft, Copy, Check, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Deployed Cloudflare Worker URL. Set VITE_CHAT_WORKER_URL in the AI Studio
// Secrets panel (or .env) to override without a code change.
const CHAT_WORKER_URL =
  (import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev';

interface Source {
  n: number;
  book: string;
  excerpt?: string;
  bookUrl?: string;
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
  'Opening the Zohar and the writings of the Kitvei Ari…',
  'Following a halachah from the Mishnah through the Poskim…',
  'Combing through Midrash Rabbah and the Baalei Mussar…',
  'Assembling an answer from hundreds of primary sources…',
];

const LOADING_EXPLANATION =
  "This can take a little longer than a typical search engine — Super Agent is sifting through nearly 1,000 dense primary texts of our Mesorah, not just matching keywords.";

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

function SourceModal({ source, onClose }: { source: Source; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-slate-900 w-full sm:max-w-lg max-h-[85vh] sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl border border-indigo-500/30 flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black shrink-0">
              {source.n}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <h3 className="font-black text-slate-100 text-sm truncate">{source.book}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pt-4">
          <p dir="auto" className="text-[15px] text-slate-200 leading-[1.9] whitespace-pre-wrap">
            {source.excerpt}
            {source.excerpt && source.excerpt.length >= 1200 && '…'}
          </p>
        </div>
        {source.bookUrl && (
          <div className="p-4 pt-3 border-t border-slate-800 shrink-0">
            <a
              href={source.bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Read the Full Book
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const HISTORY_KEY = 'super_agent_chat_history';

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Shared by the .txt export and the Google Docs export, so both always
// carry identical content (including the links) - built once here.
function buildTranscriptLines(messages: ChatMessage[]): string[] {
  const lines: string[] = ['AI Sefarim Super Agent - Conversation Export', new Date().toLocaleString(), ''];
  for (const m of messages) {
    lines.push(m.role === 'user' ? 'YOU:' : 'SUPER AGENT:');
    lines.push(m.role === 'assistant' ? markdownToPlainText(m.content) : m.content);
    if (m.sources && m.sources.length > 0) {
      lines.push('');
      lines.push('Sources:');
      for (const s of m.sources) {
        lines.push(`  [${s.n}] ${s.book}${s.bookUrl ? ' - ' + s.bookUrl : ''}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  lines.push(`Ask Super Agent yourself: ${SITE_URL}`);
  lines.push(`Join our WhatsApp community: ${WHATSAPP_GROUP_URL}`);
  return lines;
}

function exportTranscript(messages: ChatMessage[]) {
  const text = buildTranscriptLines(messages).join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `super-agent-chat-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Creates a real Google Doc in the SIGNED-IN VISITOR'S OWN Drive (not the
// site owner's) via the Docs API, using a fresh OAuth grant scoped to
// https://www.googleapis.com/auth/documents - the site's existing basic
// sign-in doesn't carry this scope, so this always prompts its own
// consent screen (even for an already-signed-in user) the first time.
async function exportToGoogleDocs(messages: ChatMessage[]): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/documents');
  provider.setCustomParameters({ prompt: 'consent' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) {
    throw new Error('Google did not grant Docs permission - please try again and approve the request.');
  }

  const title = `AI Sefarim Super Agent - ${new Date().toLocaleDateString()}`;
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!createRes.ok) {
    throw new Error(`Could not create the Google Doc (${createRes.status}). Make sure the Docs API is enabled for this project.`);
  }
  const doc = await createRes.json();
  const documentId = doc.documentId;

  const text = buildTranscriptLines(messages).join('\n');
  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text } }],
    }),
  });
  if (!updateRes.ok) {
    throw new Error(`Doc was created but the content couldn't be inserted (${updateRes.status}).`);
  }

  return `https://docs.google.com/document/d/${documentId}/edit`;
}

// Every WhatsApp/SMS share always ends with both of these, no matter what
// else is in the message - the site link (so the recipient can ask their
// own questions) and the community group join link.
const SITE_URL = 'https://aisefarim.com/chat';
const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr';
const MAX_SHARE_BODY = 800; // keep the Q&A itself short; the links always survive intact

// Every copy/share action, whole-conversation or single-message, ends
// with both of these - no exceptions.
function appendLinks(body: string): string {
  return `${body}\n\n🔗 Ask Super Agent yourself: ${SITE_URL}\n💬 Join our WhatsApp community: ${WHATSAPP_GROUP_URL}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trim() + '…' : text;
}

// The stored answer text has our inline "[1](#cite-1)" markdown link
// syntax baked in - fine for the in-app markdown renderer, but a plain
// WhatsApp/SMS/clipboard destination shows that literally. Reduce it to
// a plain "[1]" there.
// Converts the stored markdown answer (headers, **bold**, lists, ---
// rules, our own [n](#cite-n) citation links) into clean plain text for
// destinations with no markdown renderer at all - WhatsApp, SMS, the
// clipboard, and the .txt export. WhatsApp's own *bold* convention isn't
// used here on purpose: mixing it with SMS/file destinations that don't
// support it at all would look inconsistent, so every destination just
// gets clean, unmarked prose.
function markdownToPlainText(text: string): string {
  return text
    .replace(/\[(\d+)\]\(#cite-\d+\)/g, '[$1]') // our citation links -> plain [n]
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // any other markdown link
    .replace(/^#{1,6}\s+/gm, '') // headers
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ') // bullet lists
    .replace(/^[ \t]*\d+\.[ \t]+/gm, (m) => m) // numbered lists: leave as-is, already plain
    .replace(/^>\s?/gm, '') // blockquotes
    .replace(/^[-*_]{3,}\s*$/gm, '') // horizontal rules
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
    .replace(/__([^_]+)__/g, '$1') // __bold__
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1') // *italic*
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1') // _italic_
    .replace(/\n{3,}/g, '\n\n') // collapse the blank lines all that stripping leaves behind
    .trim();
}

function formatSourcesList(sources?: Source[]): string {
  if (!sources || sources.length === 0) return '';
  const lines = sources.map((s) => `[${s.n}] ${s.book}${s.bookUrl ? ' - ' + s.bookUrl : ''}`);
  return `\n\n*Sources:*\n${lines.join('\n')}`;
}

// A generic pitch, not tied to any specific conversation - for the small
// "invite a friend" link in the footer.
function buildInviteMessage(): string {
  return appendLinks(
    "🎙️ *AI Sefarim Super Agent*\n\nAsk anything from the Mishnah to modern day and get a real, grounded answer - every tractate of Gemara, all of the Rambam, the complete Beit Yosef and Shulchan Aruch, the full Arizal, the Zohar, and every AI Sefarim book, with sources you can check."
  );
}

function buildShareMessage(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  let body = '🎙️ *AI Sefarim Super Agent*\n\n';
  if (lastUser) body += `*Q:* ${lastUser.content}\n\n`;
  if (lastAssistant) {
    body += `*A:* ${truncate(markdownToPlainText(lastAssistant.content), MAX_SHARE_BODY)}`;
    body += formatSourcesList(lastAssistant.sources);
  }
  return appendLinks(body);
}

function buildSingleMessageText(m: ChatMessage, forSharing: boolean): string {
  const cleanContent = markdownToPlainText(m.content);
  const body = forSharing
    ? `🎙️ *AI Sefarim Super Agent*\n\n${truncate(cleanContent, MAX_SHARE_BODY)}`
    : cleanContent;
  return appendLinks(body + formatSourcesList(m.sources));
}

function shareToWhatsApp(text: string) {
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function shareToSms(text: string) {
  window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function ChatPage({ onExit }: { onExit: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    } catch {
      // Ignore storage write errors (e.g. private browsing, quota)
    }
  }, [messages]);

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto flex flex-col min-h-[75vh]">
      {openSource && <SourceModal source={openSource} onClose={() => setOpenSource(null)} />}

      <button
        onClick={onExit}
        className="sm:hidden flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 mb-3 -mt-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to AI Sefarim
      </button>

      <div className="relative text-center mb-5 sm:mb-8 px-2">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="hidden sm:inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-500/30 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by the AI Sefarim library
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-tight mb-2 sm:mb-3">
          <span className="text-slate-50">AI Sefarim </span>
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">Super Agent</span>
        </h1>
        <p className="hidden sm:block text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
          Ask anything and Super Agent searches the entire <span className="font-black text-slate-100">AI Sefarim</span> library &mdash; hundreds of sources, fully indexed and instantly searchable &mdash;
          to ground its answer in the actual texts, from the <span className="text-indigo-400 font-bold">Mishnah</span> to the present day.
          Every tractate of <span className="text-indigo-400 font-bold">Gemara</span>, all of the <span className="text-indigo-400 font-bold">Rambam</span>, the complete <span className="text-indigo-400 font-bold">Beit Yosef</span> and <span className="text-indigo-400 font-bold">Shulchan Aruch</span>,
          the full <span className="text-indigo-400 font-bold">Arizal</span>, the Zohar, and every AI Sefarim book &mdash; 3,300 years of Torah, one question away.
        </p>
        <p className="sm:hidden text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
          Super Agent searches the entire <span className="font-black text-slate-300">AI Sefarim</span> library to ground its answers in the actual texts &mdash; Mishnah to modern day, Gemara, Rambam, Beit Yosef, Shulchan Aruch &amp; the Arizal.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-3 sm:gap-4 mb-4 px-1 sm:px-0">
        {messages.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendQuestion(s)}
                className="text-left p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/40 text-sm text-slate-300 hover:text-slate-100 transition-all hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[96%] sm:max-w-[85%] rounded-2xl px-3.5 sm:px-5 py-3 sm:py-3.5 ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-[0_2px_12px_-2px_rgba(99,102,241,0.5)]'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-200'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="text-[15px]">
                  <Markdown text={m.content} onCiteClick={(n) => {
                    const src = m.sources?.find((s) => s.n === n);
                    if (src) setOpenSource(src);
                  }} />
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{m.content}</p>
              )}

              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Sources &mdash; tap to read the actual text
                  </p>
                  {m.sources.map((s) => (
                    <button
                      key={s.n}
                      onClick={() => setOpenSource(s)}
                      className="w-full flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-slate-700/30"
                    >
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black shrink-0">
                        {s.n}
                      </span>
                      <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="font-semibold text-slate-300 truncate">{s.book}</span>
                      {s.bookUrl && (
                        <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                          Full Book
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {m.role === 'assistant' && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      const ok = await copyText(buildSingleMessageText(m, false));
                      if (ok) {
                        setCopiedIndex(i);
                        setTimeout(() => setCopiedIndex(null), 1800);
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-700/40 hover:bg-slate-700 rounded-md px-2 py-1 transition-colors"
                  >
                    {copiedIndex === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedIndex === i ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => shareToWhatsApp(buildSingleMessageText(m, true))}
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 hover:text-white bg-[#25D366]/10 hover:bg-[#25D366] rounded-md px-2 py-1 transition-colors"
                  >
                    <MessageCircle className="w-3 h-3 fill-current" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => shareToSms(buildSingleMessageText(m, true))}
                    className="flex items-center gap-1 text-[10px] font-bold text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500 rounded-md px-2 py-1 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    SMS
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 max-w-[96%] sm:max-w-[85%] text-slate-400 text-sm">
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
        className="sticky bottom-2 sm:bottom-4 flex items-center gap-2 bg-slate-800/90 backdrop-blur-xl border border-slate-700 focus-within:border-indigo-500/60 rounded-full p-1.5 shadow-2xl focus-within:shadow-indigo-500/20 mx-1 sm:mx-0 transition-all"
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
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-full transition-all active:scale-95 shrink-0 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40"
          aria-label="Send question"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {messages.length > 0 && (
        <div className="mt-4 px-1 sm:px-0">
          <p className="text-center text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2.5">
            Share This Conversation
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => shareToWhatsApp(buildShareMessage(messages))}
              className="flex items-center gap-2 text-sm font-bold text-white bg-[#25D366] hover:bg-[#1fa14b] rounded-xl px-4 py-2.5 shadow-lg shadow-[#25D366]/20 transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              WhatsApp
            </button>
            <button
              onClick={() => shareToSms(buildShareMessage(messages))}
              className="flex items-center gap-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-xl px-4 py-2.5 shadow-lg shadow-sky-500/20 transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              SMS
            </button>
            <button
              onClick={() => exportTranscript(messages)}
              className="flex items-center gap-2 text-sm font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 py-2.5 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              Save Transcript
            </button>
            <button
              disabled={isExportingDoc}
              onClick={async () => {
                setIsExportingDoc(true);
                setError(null);
                try {
                  const url = await exportToGoogleDocs(messages);
                  window.open(url, '_blank');
                } catch (err: any) {
                  setError(err?.message || 'Could not export to Google Docs.');
                } finally {
                  setIsExportingDoc(false);
                }
              }}
              className="flex items-center gap-2 text-sm font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 py-2.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {isExportingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Google Docs
            </button>
            <button
              onClick={() => {
                if (confirm('Clear this conversation? This cannot be undone.')) {
                  setMessages([]);
                }
              }}
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-rose-300 bg-slate-800/60 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/30 rounded-xl px-4 py-2.5 transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-slate-800 text-center px-2">
        <button
          onClick={() => shareToWhatsApp(buildInviteMessage())}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-5 py-3 rounded-full shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-all active:scale-95"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          Invite a friend to try Super Agent
        </button>
      </div>
    </div>
  );
}
