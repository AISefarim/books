import { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Send, BookOpen, Loader2, X, ExternalLink, Download, Trash2, MessageCircle, MessageSquare, ArrowLeft, Copy, Check, FileText, UserPlus, Video, Headphones, ShieldAlert, Gift, Compass } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { Book, Video as MediaItem } from '../types';

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

const ASCENT_STAGES = [
  { label: 'Ascending to the Cloud…', aside: '(the one with the servers)' },
  { label: 'Receiving the sources…', aside: '(40 days, condensed)' },
  { label: 'Descending with the answer…', aside: '(carrying it carefully)' },
  { label: 'Almost down…', aside: '(the last stretch is the slowest)' },
];

// Starts on mount (the loading card mounts when a question is sent): climbs to
// the cloud, pauses there, then comes back down. Real duration is unknowable,
// so the last stage just holds near the base until the answer replaces it.
function AscentIndicator() {
  const [stage, setStage] = useState(0);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setLaunched(true), 60),
      setTimeout(() => setStage(1), 16000),
      setTimeout(() => setStage(2), 28000),
      setTimeout(() => setStage(3), 46000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const atSummit = launched && (stage === 0 || stage === 1);
  const pos = atSummit ? { left: '63%', top: '19%' } : { left: '17%', top: '83%' };
  const duration = stage === 0 ? '15s' : stage === 2 ? '16s' : '3s';

  return (
    <div className="flex items-center gap-3.5 mt-3">
      <div className="relative shrink-0 w-[112px] h-[64px]">
        <svg viewBox="0 0 112 64" className="absolute inset-0 w-full h-full" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="ascent-mtn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#818cf8" stopOpacity="0.28" />
              <stop offset="1" stopColor="#1e293b" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path d="M2 62 L34 26 L46 37 L71 12 L110 62 Z" fill="url(#ascent-mtn)" stroke="#818cf8" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" />
          <path d="M19 54 L34 38 L47 46 L71 22" stroke="#a5b4fc" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" strokeLinecap="round" />
          <g className={`transition-opacity duration-1000 ${stage === 1 ? 'opacity-100' : 'opacity-70'}`}>
            <ellipse cx="74" cy="9" rx="15" ry="4.5" fill="#e0e7ff" fillOpacity="0.22" />
            <ellipse cx="64" cy="11" rx="9" ry="3.5" fill="#e0e7ff" fillOpacity="0.18" />
            <ellipse cx="85" cy="11" rx="8" ry="3" fill="#e0e7ff" fillOpacity="0.16" />
          </g>
        </svg>
        <div
          className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full bg-amber-300 shadow-[0_0_10px_2px_rgba(252,211,77,0.75)] transition-all ease-in-out motion-reduce:transition-none"
          style={{ ...pos, transitionDuration: duration }}
        >
          <div className={`absolute inset-0 rounded-full bg-amber-300/60 ${stage === 1 ? 'animate-ping' : 'opacity-0'}`} />
        </div>
      </div>
      <div key={stage} className="animate-in fade-in slide-in-from-bottom-1 duration-500 min-w-0">
        <p className="text-sm font-bold text-slate-200 leading-snug">{ASCENT_STAGES[stage].label}</p>
        <p className="text-xs text-slate-500 italic leading-snug">{ASCENT_STAGES[stage].aside}</p>
      </div>
    </div>
  );
}

// Shown while the reader waits anyway - the dead time is a chance to explain
// what AI Sefarim actually is (and put the wait in perspective), not just to
// say "still searching." Historical travel-time facts are kept general
// ("a sage," "a she'eilah") rather than naming specific unverified
// rabbi-to-rabbi exchanges - the journeys themselves are well-documented,
// the framing shouldn't invent history to make a point.
const LIBRARY_FACTS: { icon: typeof BookOpen; text: string }[] = [
  { icon: BookOpen, text: 'Nearly 100 sefarim in the library — most translated into English for the very first time' },
  { icon: Gift, text: 'Every book, video, and podcast on AI Sefarim is completely free' },
  { icon: Video, text: 'Hundreds of videos and podcasts, with new ones added regularly' },
  { icon: Headphones, text: 'Daily podcasts covering Daf Yomi, Tanach, Rambam, the Zohar, and more' },
  { icon: BookOpen, text: 'Open the Zohar and Zohar Chadash and search them in plain English, right alongside the rest of the library' },
  { icon: Sparkles, text: 'The Kitvei HaAri are here: Etz Chaim, Pri Etz Chaim, Sha\u2019ar HaKavanot, Sha\u2019ar HaGilgulim, Sha\u2019ar Ruach HaKodesh, and more' },
  { icon: BookOpen, text: 'Ask how the Zohar and the Arizal explain the same verse, mitzvah, or tefillah, and see both side by side' },
  { icon: Sparkles, text: 'Sha\u2019ar HaMitzvot and Sha\u2019ar HaPesukim of the Arizal, searchable by topic, verse, or mitzvah' },
  { icon: BookOpen, text: 'The Rashash\u2019s commentary on the Arizal (Nahar Shalom) is in the library, so the Kitvei HaAri come with their key interpreter' },
  { icon: Sparkles, text: 'Sha\u2019ar Ma\u2019amarei Rashbi: the Arizal\u2019s explanations of the words of Rabbi Shimon bar Yochai in the Zohar' },
  { icon: BookOpen, text: 'Pardes Rimonim of the Ramak, Shenei Luchot HaBerit, and more: the classic Kabbalah sefarim in one searchable library' },
  { icon: Sparkles, text: 'Ask about gilgulim, kavanot, the sefirot, or a passage of the Zohar, and Super Agent answers from the actual texts' },
];

const WAIT_CARDS = [
  {
    title: 'Perspective',
    body: 'Rav Kahana sat silent while Rabbi Yochanan demoted him to the seventh row, because Rav had made him promise seven years of not arguing.',
    punch: 'So you can wait 45 seconds while we scan all of Jewish thought.',
    source: 'Bava Kamma 117a',
  },
  {
    title: 'Perspective',
    body: 'The Mishnah holds up the entire request for rain 15 days so the last pilgrim can walk home from Jerusalem to the Euphrates.',
    punch: 'So you can wait 45 seconds while we scan all of Jewish thought.',
    source: 'Mishnah Ta\u2019anit 10a',
  },
];



const LOADING_EXPLANATION_HEADLINE = "This takes longer than a typical search engine.";
const LOADING_EXPLANATION_DETAIL =
  "Super Agent is sifting through hundreds of thousands of pages of Torah literature, spanning 3,339 years back to Sinai — not just matching keywords.";

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

const NO_BOOKS: Book[] = [];
const NO_MEDIA: MediaItem[] = [];
const NO_THUMBS: Record<string, string> = {};

type ShowcaseItem = { key: string; href: string; title: string; kind: 'Book' | 'Video' | 'Podcast'; img?: string };

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Dead time is a captive audience: surface real books and media from the
// library. Tiles are only ever appended (never rotated out) so nothing
// disappears before it can be read.
function LibraryShowcase({ books, media, thumbs }: { books: Book[]; media: MediaItem[]; thumbs: Record<string, string> }) {
  const items = useMemo<ShowcaseItem[]>(() => {
    const bookItems: ShowcaseItem[] = shuffled(books.filter((b) => b.cover && b.title)).slice(0, 5).map((b) => ({
      key: 'b' + b.id, href: `/b/${b.id}`, title: b.title, kind: 'Book', img: b.cover,
    }));
    const mediaItems: ShowcaseItem[] = shuffled(media.filter((m) => m.title)).slice(0, 5).map((m) => ({
      key: 'm' + m.id, href: `/v/${m.id}`, title: m.title, kind: m.type === 'audio' ? 'Podcast' : 'Video', img: thumbs[m.category],
    }));
    const out: ShowcaseItem[] = [];
    for (let i = 0; i < Math.max(bookItems.length, mediaItems.length); i++) {
      if (bookItems[i]) out.push(bookItems[i]);
      if (mediaItems[i]) out.push(mediaItems[i]);
    }
    return out;
  // Deliberately keyed on availability only: re-picking on every parent render (the page counter ticks every 110ms) would reshuffle the tiles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length > 0, media.length > 0]);

  const [count, setCount] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => Math.min(c + 1, items.length)), 8000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-700/40">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Meanwhile, from the library <span className="text-emerald-400">· all free</span></p>
      <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1">
        {items.slice(0, count).map((it) => (
          <a
            key={it.key}
            href={it.href}
            target="_blank"
            rel="noopener noreferrer"
            className="animate-in fade-in slide-in-from-right-2 duration-700 group shrink-0 w-[88px] sm:w-[96px]"
          >
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-slate-800 border border-slate-700/60 group-hover:border-indigo-400/60 transition-colors flex items-center justify-center">
              {it.img ? (
                <img src={it.img} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
              ) : it.kind === 'Podcast' ? (
                <Headphones className="w-6 h-6 text-indigo-400" />
              ) : (
                <Video className="w-6 h-6 text-indigo-400" />
              )}
              {it.kind !== 'Book' && (
                <span className="absolute bottom-1 left-1 bg-slate-900/90 text-indigo-300 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">
                  {it.kind}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-tight text-slate-300 line-clamp-2 group-hover:text-indigo-300 transition-colors">{it.title}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

export function ChatPage({ onExit, books = NO_BOOKS, media = NO_MEDIA, categoryThumbnails = NO_THUMBS }: { onExit: () => void; books?: Book[]; media?: MediaItem[]; categoryThumbnails?: Record<string, string> }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [factStart, setFactStart] = useState(0);
  const [factCount, setFactCount] = useState(1);
  const [waitCount, setWaitCount] = useState(1);
  const [docCounter, setDocCounter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setFactStart(Math.floor(Math.random() * LIBRARY_FACTS.length));
    setFactCount(1);
    setWaitCount(1);
    const waitId = setInterval(() => {
      setWaitCount((c) => Math.min(c + 1, WAIT_CARDS.length));
    }, 20000);
    const id = setInterval(() => {
      setFactCount((c) => Math.min(c + 1, LIBRARY_FACTS.length));
    }, 7000);
    return () => {
      clearInterval(id);
      clearInterval(waitId);
    };
  }, [isLoading]);

  // A live-ticking counter, not a real progress bar - there's no way to know
  // true progress mid-search, but a static "please wait" reads as frozen and
  // people bounce. Visible motion plus a concrete, growing number both signals
  // real work happening and gives a sense of the corpus's actual scale.
  //
  // Most answers take close to a minute, so this can't just race to a fixed
  // number in a few seconds (it used to - hit its cap in ~12s). Instead each
  // tick closes a small percentage of the remaining gap to the target, which
  // decelerates naturally: fast at first, still visibly ticking a minute in,
  // without ever looking frozen at a maxed-out number.
  const DOC_COUNTER_TARGET = 340000;
  useEffect(() => {
    if (!isLoading) {
      setDocCounter(0);
      return;
    }
    const id = setInterval(() => {
      setDocCounter((n) => {
        const remaining = DOC_COUNTER_TARGET - n;
        if (remaining <= 0) return n;
        const step = Math.max(40, Math.floor(remaining * 0.005));
        return Math.min(DOC_COUNTER_TARGET, n + step);
      });
    }, 110);
    return () => clearInterval(id);
  }, [isLoading]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
    <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto flex flex-col">
      <div className="absolute top-24 -left-24 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 -right-24 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
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
          Ask anything and Super Agent searches an entire Torah library on <span className="font-black text-slate-100">AI Sefarim</span> &mdash; hundreds of sources, fully indexed and instantly searchable &mdash;
          to ground its answer in the actual texts, from the <span className="text-indigo-400 font-bold">Mishnah</span> to the present day.
          Every tractate of <span className="text-indigo-400 font-bold">Gemara</span>, all of the <span className="text-indigo-400 font-bold">Rambam</span>, the complete <span className="text-indigo-400 font-bold">Beit Yosef</span> and <span className="text-indigo-400 font-bold">Shulchan Aruch</span>,
          the full <span className="text-indigo-400 font-bold">Arizal</span>, the Zohar, and every AI Sefarim book &mdash; 3,300 years of Torah, one question away.
        </p>
        <p className="sm:hidden text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
          Super Agent searches an entire Torah library on <span className="font-black text-slate-300">AI Sefarim</span> to ground its answers in the actual texts &mdash; Mishnah to modern day, Gemara, Rambam, Beit Yosef, Shulchan Aruch, the Arizal &amp; more.
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
          <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="hidden sm:flex shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 items-center justify-center mt-1 shadow-md shadow-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[96%] sm:max-w-[85%] rounded-2xl px-3.5 sm:px-5 py-3 sm:py-3.5 ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-[0_2px_12px_-2px_rgba(99,102,241,0.5)]'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-200 shadow-sm'
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
                      className="w-full flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 text-left rounded-lg px-2 py-1.5 -mx-2 transition-all bg-slate-900/40 hover:bg-slate-700/40 border border-transparent hover:border-slate-600/50"
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
          <div className="flex items-start gap-2 justify-start">
            <div className="hidden sm:flex relative shrink-0 w-7 h-7 items-center justify-center mt-1">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 animate-ping opacity-40" />
              <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
            </div>
            <div className="relative max-w-[96%] sm:max-w-[85%] rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-500/70 via-purple-500/50 to-indigo-500/70 animate-glow-pulse">
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-drift" />
              <div className="absolute -bottom-10 -right-6 w-28 h-28 bg-purple-500/20 rounded-full blur-3xl pointer-events-none animate-drift" style={{ animationDelay: '2s' }} />
              <div className="relative bg-slate-900 rounded-[calc(1rem-1.5px)] px-4 sm:px-5 py-3.5 sm:py-4 text-slate-400 text-sm overflow-hidden">
                <Sparkles className="absolute top-3 right-6 w-3 h-3 text-indigo-400/70 animate-float-up pointer-events-none" style={{ animationDelay: '0s' }} />
                <Sparkles className="absolute top-8 right-16 w-2.5 h-2.5 text-purple-400/70 animate-float-up pointer-events-none" style={{ animationDelay: '1.1s' }} />
                <Sparkles className="absolute top-5 right-28 w-2 h-2 text-indigo-300/60 animate-float-up pointer-events-none" style={{ animationDelay: '2.2s' }} />

                <p className="text-base sm:text-lg font-black text-indigo-300 leading-snug">
                  {LOADING_EXPLANATION_HEADLINE}
                </p>

                <div className="mt-2.5 flex items-baseline gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400 mb-0.5" />
                  <span className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                    {docCounter.toLocaleString()}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-indigo-400 uppercase tracking-wide">
                    pages checked so far
                  </span>
                </div>

                <div className="mt-2 h-1 w-full rounded-full bg-slate-800 overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-shimmer-sweep" />
                </div>

                <AscentIndicator />

                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  {LOADING_EXPLANATION_DETAIL}
                </p>

                {WAIT_CARDS.slice(0, waitCount).map((card) => (
                  <div key={card.source} className="animate-in fade-in slide-in-from-bottom-2 duration-700 mt-3.5 rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-3.5 shadow-[0_0_24px_-10px_rgba(251,191,36,0.6)]">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-amber-300 shrink-0" />
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-300">{card.title}</span>
                    </div>
                    <p className="mt-2 text-[13px] sm:text-sm text-slate-200 leading-relaxed">{card.body}</p>
                    <p className="mt-2 text-sm sm:text-base font-black text-amber-200">{card.punch}</p>
                    <p className="mt-1.5 text-[11px] text-amber-300/70 italic">{card.source}</p>
                  </div>
                ))}

                <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-2">
                  {Array.from({ length: factCount }, (_, k) => LIBRARY_FACTS[(factStart + k) % LIBRARY_FACTS.length]).map((fact, k) => {
                    const FactIcon = fact.icon;
                    return (
                      <div key={k} className="animate-in fade-in slide-in-from-bottom-1 duration-500 flex items-start gap-2">
                        <FactIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300 text-xs leading-relaxed">{fact.text}</span>
                      </div>
                    );
                  })}
                </div>

                <LibraryShowcase books={books} media={media} thumbs={categoryThumbnails} />

                <div className="mt-3 pt-3 border-t border-slate-700/40 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(WHATSAPP_GROUP_URL, '_blank')}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#25D366] hover:bg-[#1fa14b] rounded-full px-3 py-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-current" />
                    Join our WhatsApp community
                  </button>
                </div>

                <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500/80 shrink-0 mt-0.5" />
                  <span>Super Agent is AI, not a rabbi - always confirm practical halachah with a qualified rav.</span>
                </div>
              </div>
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
        className="sticky bottom-2 sm:bottom-4 flex items-end gap-2 bg-slate-800/90 backdrop-blur-xl border border-slate-700 focus-within:border-indigo-500/60 rounded-3xl p-1.5 shadow-2xl focus-within:shadow-indigo-500/20 mx-1 sm:mx-0 transition-all"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 192) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !isLoading) sendQuestion(input);
            }
          }}
          placeholder="Ask anything from the library..."
          maxLength={8000}
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none bg-transparent px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none text-sm max-h-48 overflow-y-auto"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-full transition-all active:scale-95 shrink-0 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 mb-0.5"
          aria-label="Send question"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-center gap-1.5 flex-wrap">
        {messages.length > 0 && (
          <>
            <button
              onClick={() => shareToWhatsApp(buildShareMessage(messages))}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#25D366] hover:bg-[#1fa14b] rounded-full px-3 py-1.5 shadow-sm transition-all active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current" />
              WhatsApp
            </button>
            <button
              onClick={() => shareToSms(buildShareMessage(messages))}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-full px-3 py-1.5 shadow-sm transition-all active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              SMS
            </button>
            <button
              onClick={() => exportTranscript(messages)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-3 py-1.5 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Save
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
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-3 py-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {isExportingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Docs
            </button>
            <button
              onClick={() => {
                if (confirm('Clear this conversation? This cannot be undone.')) {
                  setMessages([]);
                }
              }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-rose-300 bg-slate-800/60 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/30 rounded-full px-3 py-1.5 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </>
        )}
        <button
          onClick={() => shareToWhatsApp(buildInviteMessage())}
          className="flex items-center gap-1.5 text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-full px-3.5 py-1.5 shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite a Friend
        </button>
      </div>
    </div>
  );
}
