import { useState, useRef, useEffect, useMemo, memo } from 'react';
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
  { label: 'Ascending to Shamayim…', aside: '(where the Cloud lives. Both of them.)' },
  { label: 'Entering the cloud, like Moshe…', aside: '(Shemot 24:18. His trip took 40 days, ours about 40 seconds.)' },
  { label: 'No bread, no water, like Moshe…', aside: '(Shemot 34:28. You, however, are allowed a snack.)' },
  { label: 'וַיֵּרֶד AI Sefarim בֶּעָנָן…', aside: '(Shemot 34:5, with one small edit)' },
  { label: 'Almost down…', aside: '(the descent is always the slower part)' },
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
      setTimeout(() => setStage(1), 14000),
      setTimeout(() => setStage(2), 22000),
      setTimeout(() => setStage(3), 32000),
      setTimeout(() => setStage(4), 48000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const atSummit = launched && stage <= 2;
  const pos = atSummit ? { left: '63%', top: '19%' } : { left: '17%', top: '83%' };
  const duration = stage === 0 ? '13s' : stage === 3 ? '16s' : '3s';

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
          <g className={`transition-opacity duration-1000 ${stage === 1 || stage === 2 ? 'opacity-100' : 'opacity-70'}`}>
            <ellipse cx="74" cy="9" rx="15" ry="4.5" fill="#e0e7ff" fillOpacity="0.22" />
            <ellipse cx="64" cy="11" rx="9" ry="3.5" fill="#e0e7ff" fillOpacity="0.18" />
            <ellipse cx="85" cy="11" rx="8" ry="3" fill="#e0e7ff" fillOpacity="0.16" />
          </g>
        </svg>
        <div
          className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full bg-amber-300 shadow-[0_0_10px_2px_rgba(252,211,77,0.75)] transition-all ease-in-out motion-reduce:transition-none"
          style={{ ...pos, transitionDuration: duration }}
        >
          <div className={`absolute inset-0 rounded-full bg-amber-300/60 ${stage === 1 || stage === 2 ? 'animate-ping' : 'opacity-0'}`} />
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
    punch: 'He stayed silent for seven years. You can survive a loading bar.',
    source: 'Bava Kamma 117a',
  },
  {
    title: 'Perspective',
    body: 'The Mishnah holds up the entire request for rain 15 days so the last pilgrim can walk home from Jerusalem to the Euphrates.',
    punch: 'The rain waited two weeks for the slowest traveler. Your answer is only running a little late.',
    source: 'Mishnah Ta\u2019anit 10a',
  },
  {
    title: 'Perspective',
    body: 'Honi saw a man planting a carob tree that would take seventy years to bear fruit, sat down to eat, and fell asleep for seventy years.',
    punch: 'Please don\u2019t doze off. The last guy woke up in a different century.',
    source: 'Ta\u2019anit 23a',
  },
  {
    title: 'Perspective',
    body: 'Too poor to pay the doorkeeper, Hillel climbed onto the roof of the beit midrash to hear the lesson, and the snow buried him there until morning.',
    punch: 'You, at least, are waiting somewhere with Wi-Fi.',
    source: 'Yoma 35b',
  },
  {
    title: 'Perspective',
    body: 'Mashiach sits at the gates of Rome among the lepers, unwrapping and rewrapping one bandage at a time, so he is ready the moment he is called.',
    punch: 'He\u2019s been on hold forever, with no hold music. You have us.',
    source: 'Sanhedrin 98a',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Shimon bar Yochai hid in a cave for twelve years, living on carobs and spring water, learning Torah with his son.',
    punch: 'Twelve years with carobs and a spring. You have snacks within reach.',
    source: 'Shabbat 33b',
  },
  {
    title: 'Perspective',
    body: 'A man bet 400 zuz that he could make Hillel lose his temper, and kept interrupting his Friday bath with silly questions. Hillel answered every one patiently.',
    punch: 'Someone lost 400 zuz trying to rush Hillel. Don\u2019t be that guy.',
    source: 'Shabbat 31a',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Preida taught every lesson 400 times to one slow student. One day the student still did not understand, so he taught it 400 times more.',
    punch: 'Good news: we only explain it once.',
    source: 'Eruvin 54b',
  },
  {
    title: 'Perspective',
    body: 'The great synagogue of Alexandria was so vast that an attendant waved a cloth so the people at the back knew when to answer Amen.',
    punch: 'We\u2019d wave a cloth at you, but this is mostly a text box.',
    source: 'Sukkah 51b',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Akiva was forty years old and had learned nothing, until he watched water wear a hole in solid rock and decided to begin.',
    punch: 'Water took years to carve a rock. We\u2019re asking for about as long as it takes to pour a drink.',
    source: 'Avot DeRabbi Natan 6',
  },
  {
    title: 'Perspective',
    body: 'Moshe stayed on Har Sinai forty days and forty nights, without bread or water, to receive the Torah.',
    punch: 'Forty days without a snack. You can make it to the answer.',
    source: 'Shemot 34:28',
  },
  {
    title: 'Perspective',
    body: 'Yaakov worked seven years for Rachel, and they seemed to him like a few days because he loved her.',
    punch: 'Seven years felt like days to him. Let\u2019s see how a minute feels to you.',
    source: 'Bereshit 29:20',
  },
  {
    title: 'Perspective',
    body: 'Yosef sat in prison two more full years because the chief cupbearer forgot him.',
    punch: 'Two extra years because someone forgot him. Don\u2019t worry, we haven\u2019t forgotten you.',
    source: 'Bereshit 41:1 with Rashi',
  },
  {
    title: 'Perspective',
    body: 'Choni drew a circle, stood inside it, and told Hashem he would not move until He had mercy on His children. The rain came.',
    punch: 'Please stay inside the circle. In this case, that means this tab.',
    source: 'Ta\u2019anit 23a',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Akiva left home for twelve years to learn Torah. When he returned with twelve thousand students, Rachel sent him back for twelve more.',
    punch: 'Rachel said, \u201cGo learn twelve more years.\u201d We\u2019re saying, \u201cGive us a sec.\u201d',
    source: 'Ketubot 62b\u201363a',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Elazar ben Charsom\u2019s father left him a thousand villages and a thousand ships. He took a sack of flour on his shoulder and went from town to town to learn Torah.',
    punch: 'He carried flour for the sake of Torah. You\u2019re holding a phone.',
    source: 'Yoma 35b',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Chiya planted flax, wove nets, caught deer, and wrote Chumashim on their hides, all so that children could be taught Torah.',
    punch: 'Rabbi Chiya hunted deer for parchment. We just search a library for you.',
    source: 'Bava Metzia 85b',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Yehoshua ben Chananya\u2019s mother carried his cradle to the beit midrash, so the words of Torah would enter his ears from the first days of his life.',
    punch: 'That\u2019s early childhood education. You\u2019re getting Torah delivered straight to your screen.',
    source: 'Yerushalmi Yevamot 1:6',
  },
  {
    title: 'Perspective',
    body: 'Moshe sat in the back of Rabbi Akiva\u2019s class, could not follow the discussion, and felt faint. Then he heard it was a halachah given to Moshe at Sinai, and relaxed.',
    punch: 'Moshe didn\u2019t follow the shiur either at first. It\u2019s okay to be a step behind.',
    source: 'Menachot 29b',
  },
  {
    title: 'Perspective',
    body: 'Hillel came to Eretz Yisrael at forty, learned for forty years, and then led Israel for forty years.',
    punch: 'Forty years to learn it all. Our search takes less than one minute.',
    source: 'Sifrei Devarim 357',
  },
  {
    title: 'Perspective',
    body: 'When Moshe was asked a new question by those who were impure at Pesach, he said, \u201cStand, and I will hear what Hashem commands concerning you.\u201d',
    punch: 'Moshe said \u201cstand\u201d and then waited for the answer. Standing is optional here.',
    source: 'Bamidbar 9:8',
  },
  {
    title: 'Perspective',
    body: 'Shmuel ran to Eli three times in the night, sure that Eli had called him, before they understood that it was Hashem.',
    punch: 'Three false alarms. This one is real, so keep your eyes on the screen.',
    source: 'Shmuel I 3:5\u201310',
  },
  {
    title: 'Perspective',
    body: 'David was anointed king as a young man, and then waited years, much of it on the run from Shaul, before he actually took the throne.',
    punch: 'David waited years for a crown. You\u2019re waiting for the coronation of one answer.',
    source: 'Shmuel I 16:13; Shmuel II 5:4',
  },
  {
    title: 'Perspective',
    body: 'Esther fasted for three days before she dared go in to the king.',
    punch: 'Three days of fasting. You\u2019re only fasting from the answer.',
    source: 'Esther 4:16',
  },
  {
    title: 'Perspective',
    body: 'Chana prayed so long and so quietly at the Mishkan that Eli thought she was drunk.',
    punch: 'Relax. Nobody thinks you\u2019re drunk, you\u2019re only loading.',
    source: 'Berachot 31a',
  },
  {
    title: 'Perspective',
    body: 'Noach sent out a dove, waited seven days, sent it again, waited seven more, and sent it a third time.',
    punch: 'Noach waited a week at a time with no signal. You have a loading wheel.',
    source: 'Bereshit 8:8\u201312',
  },
  {
    title: 'Perspective',
    body: 'Miriam stood at a distance by the river to see what would happen to her baby brother.',
    punch: 'She watched the river. You get to watch a spinner.',
    source: 'Shemot 2:4',
  },
  {
    title: 'Perspective',
    body: 'Because of the spies, Bnei Yisrael wandered in the desert for forty years, one year for each day the spies had toured the land.',
    punch: 'Forty years in the desert with no GPS. Your answer is on its way, with directions.',
    source: 'Bamidbar 14:33',
  },
  {
    title: 'Perspective',
    body: 'The Arizal taught in Tzfat for only about two years before he passed away at 38, and Rabbi Chaim Vital wrote down what he learned from him.',
    punch: 'Two years of teaching, and we can search it before your coffee cools.',
    source: 'Shivchei HaAri',
  },
  {
    title: 'Perspective',
    body: 'Rabbi Yosef Karo spent decades writing the Beit Yosef, collecting every opinion on every halachah before writing the Shulchan Aruch.',
    punch: 'He spent decades writing it. We only need a moment to find your page.',
    source: 'Hakdamat HaBeit Yosef',
  },
  {
    title: 'Perspective',
    body: 'The Ben Ish Chai taught halachah to the people of Baghdad week by week, parshah by parshah, over two years, and that is how his halachos were collected.',
    punch: 'He did it one parshah at a time. We do it one question at a time.',
    source: 'Ben Ish Chai, Years 1 and 2',
  },
];

function shuffledOrder(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}



const LOADING_EXPLANATION_HEADLINE = "This takes longer than a typical search engine.";
const LOADING_EXPLANATION_DETAIL =
  "Super Agent is sifting through hundreds of thousands of pages of Torah literature, spanning 3,339 years back to Sinai — not just matching keywords.";

const Markdown = memo(function Markdown({ text, sources, onOpenSource }: { text: string; sources?: Source[]; onOpenSource: (s: Source) => void }) {
  const onCiteClick = (n: number) => {
    const src = sources?.find((s) => s.n === n);
    if (src) onOpenSource(src);
  };
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
});

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
// disappears before it can be read. Books and media get separate rows.
function ShowcaseRow({ label, items, tall }: { label: string; items: ShowcaseItem[]; tall: boolean }) {
  const [count, setCount] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => Math.min(c + 1, items.length)), 8000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  return (
    <div className="mt-2.5">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1.5 flex gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1">
        {items.slice(0, count).map((it) => (
          <a
            key={it.key}
            href={it.href}
            target="_blank"
            rel="noopener noreferrer"
            className="animate-in fade-in slide-in-from-right-2 duration-700 group shrink-0 w-[88px] sm:w-[96px]"
          >
            <div className={`relative ${tall ? 'aspect-[3/4]' : 'aspect-video'} rounded-lg overflow-hidden bg-slate-800 border border-slate-700/60 group-hover:border-indigo-400/60 transition-colors flex items-center justify-center`}>
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

function LibraryShowcase({ books, media, thumbs }: { books: Book[]; media: MediaItem[]; thumbs: Record<string, string> }) {
  const { bookItems, mediaItems } = useMemo(() => {
    const bookItems: ShowcaseItem[] = shuffled(books.filter((b) => b.cover && b.title)).slice(0, 6).map((b) => ({
      key: 'b' + b.id, href: `/b/${b.id}`, title: b.title, kind: 'Book', img: b.cover,
    }));
    const mediaItems: ShowcaseItem[] = shuffled(media.filter((m) => m.title)).slice(0, 6).map((m) => ({
      key: 'm' + m.id, href: `/v/${m.id}`, title: m.title, kind: m.type === 'audio' ? 'Podcast' : 'Video', img: thumbs[m.category],
    }));
    return { bookItems, mediaItems };
  // Deliberately keyed on availability only: re-picking on every parent render (the page counter ticks every 110ms) would reshuffle the tiles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length > 0, media.length > 0]);

  if (bookItems.length === 0 && mediaItems.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-700/40">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Learn it yourself, from the library <span className="text-emerald-400">· all free</span></p>
      <ShowcaseRow label="Books" items={bookItems} tall />
      <ShowcaseRow label="Videos & podcasts" items={mediaItems} tall={false} />
    </div>
  );
}

const SHELF_FALLBACK = ['Zohar', 'Etz Chaim', 'Shulchan Aruch', 'Mishneh Torah', 'Yalkut Yosef', 'Ben Ish Chai', 'Kaf HaChayim', 'Nahar Shalom', 'Pardes Rimonim', 'Halacha Yomit'];

// A "now scanning" ticker: one library title swaps in every ~1.3s with a
// pulsing dot. Purely visual motion that shows the scale of the shelves.
function ShelfScanner({ titles }: { titles: string[] }) {
  const list = useMemo(() => {
    const t = titles.filter(Boolean);
    return shuffled(t.length >= 6 ? t : SHELF_FALLBACK);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titles.length > 0]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 1300);
    return () => clearInterval(id);
  }, []);
  const title = list[i % list.length];
  return (
    <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400 min-w-0">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="shrink-0 font-bold uppercase tracking-wide text-slate-500">Scanning</span>
      <span key={i} className="truncate text-slate-200 font-semibold animate-in fade-in slide-in-from-bottom-1 duration-300">{title}</span>
    </div>
  );
}

const SAGE_QUOTES: { he: string; en: string; who: string }[] = [
  { he: 'אֵיזֶהוּ חָכָם? הַלּוֹמֵד מִכָּל אָדָם', en: 'Who is wise? One who learns from every person.', who: 'Ben Zoma, Avot 4:1' },
  { he: 'אֵיזֶהוּ גִבּוֹר? הַכּוֹבֵשׁ אֶת יִצְרוֹ', en: 'Who is strong? One who conquers his inclination.', who: 'Ben Zoma, Avot 4:1' },
  { he: 'אֵיזֶהוּ עָשִׁיר? הַשָּׂמֵחַ בְּחֶלְקוֹ', en: 'Who is rich? One who is happy with his portion.', who: 'Ben Zoma, Avot 4:1' },
  { he: 'אֵיזֶהוּ מְכֻבָּד? הַמְכַבֵּד אֶת הַבְּרִיּוֹת', en: 'Who is honored? One who honors others.', who: 'Ben Zoma, Avot 4:1' },
  { he: 'עֲשֵׂה לְךָ רַב, וּקְנֵה לְךָ חָבֵר, וֶהֱוֵי דָן אֶת כָּל הָאָדָם לְכַף זְכוּת', en: 'Make for yourself a rav, acquire for yourself a friend, and judge every person favorably.', who: 'Yehoshua ben Perachya, Avot 1:6' },
  { he: 'אִם אֵין אֲנִי לִי מִי לִי, וּכְשֶׁאֲנִי לְעַצְמִי מָה אֲנִי, וְאִם לֹא עַכְשָׁיו אֵימָתָי', en: 'If I am not for myself, who will be for me? If I am only for myself, what am I? And if not now, when?', who: 'Hillel, Avot 1:14' },
  { he: 'אַל תֹּאמַר לִכְשֶׁאִפָּנֶה אֶשְׁנֶה, שֶׁמָּא לֹא תִפָּנֶה', en: 'Do not say "when I have time I will study," lest you never have time.', who: 'Hillel, Avot 2:4' },
  { he: 'אַל תָּדִין אֶת חֲבֵרְךָ עַד שֶׁתַּגִּיעַ לִמְקוֹמוֹ', en: 'Do not judge your fellow until you reach his place.', who: 'Hillel, Avot 2:4' },
  { he: 'אֱמֹר מְעַט וַעֲשֵׂה הַרְבֵּה, וֶהֱוֵי מְקַבֵּל אֶת כָּל הָאָדָם בְּסֵבֶר פָּנִים יָפוֹת', en: 'Say little and do much, and receive every person with a cheerful face.', who: 'Shammai, Avot 1:15' },
  { he: 'לֹא עָלֶיךָ הַמְּלָאכָה לִגְמֹר, וְלֹא אַתָּה בֶן חוֹרִין לִבָּטֵל מִמֶּנָּה', en: 'It is not up to you to finish the work, but you are not free to desist from it.', who: 'Rabbi Tarfon, Avot 2:16' },
  { he: 'הֱוֵי מִתַּלְמִידָיו שֶׁל אַהֲרֹן, אוֹהֵב שָׁלוֹם וְרוֹדֵף שָׁלוֹם', en: 'Be among the students of Aharon: loving peace and pursuing peace.', who: 'Hillel, Avot 1:12' },
  { he: 'הֱוֵי זָהִיר בְּמִצְוָה קַלָּה כְּבַחֲמוּרָה, שֶׁאֵין אַתָּה יוֹדֵעַ מַתַּן שְׂכָרָן שֶׁל מִצְוֹת', en: 'Be as careful with a light mitzvah as with a severe one, for you do not know the reward of the mitzvot.', who: 'Rabbi Yehuda HaNasi, Avot 2:1' },
  { he: 'סְיָג לַחָכְמָה שְׁתִיקָה', en: 'Silence is a fence for wisdom.', who: 'Rabbi Akiva, Avot 3:13' },
  { he: 'חָבִיב אָדָם שֶׁנִּבְרָא בְצֶלֶם', en: 'Beloved is man, for he was created in the image of God.', who: 'Rabbi Akiva, Avot 3:14' },
  { he: 'עַל שְׁלשָׁה דְבָרִים הָעוֹלָם עוֹמֵד: עַל הַתּוֹרָה, וְעַל הָעֲבוֹדָה, וְעַל גְּמִילוּת חֲסָדִים', en: 'On three things the world stands: on Torah, on avodah, and on acts of kindness.', who: 'Shimon HaTzaddik, Avot 1:2' },
  { he: 'הַיּוֹם קָצָר, וְהַמְּלָאכָה מְרֻבָּה, וְהַפּוֹעֲלִים עֲצֵלִים, וְהַשָּׂכָר הַרְבֵּה, וּבַעַל הַבַּיִת דּוֹחֵק', en: 'The day is short, the work is great, the workers are lazy, the reward is great, and the Master of the house is pressing.', who: 'Rabbi Tarfon, Avot 2:15' },
  { he: 'דַּע מַה לְּמַעְלָה מִמְּךָ: עַיִן רוֹאָה, וְאֹזֶן שׁוֹמַעַת, וְכָל מַעֲשֶׂיךָ בַסֵּפֶר נִכְתָּבִין', en: 'Know what is above you: an eye that sees, an ear that hears, and all your deeds are written in a book.', who: 'Rabbi Yehuda HaNasi, Avot 2:1' },
];

function SageQuote() {
  const [i, setI] = useState(() => Math.floor(Math.random() * SAGE_QUOTES.length));
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % SAGE_QUOTES.length), 9000);
    return () => clearInterval(id);
  }, []);
  const q = SAGE_QUOTES[i];
  return (
    <div key={i} className="animate-in fade-in duration-500 rounded-xl border border-indigo-400/25 bg-indigo-500/5 p-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-indigo-300">Words of the Sages</p>
      <p className="mt-1.5 text-base font-bold text-indigo-100 leading-snug" lang="he" dir="rtl">{q.he}</p>
      <p className="text-xs text-slate-200 leading-snug mt-1.5">{q.en}</p>
      <p className="text-[11px] text-indigo-300/70 italic mt-1">{q.who}</p>
    </div>
  );
}

const QUIZ: { q: string; a: string }[] = [
  { q: "Hillel could not afford the entrance fee to the beit midrash. How did he listen to Shemaya and Avtalyon?", a: "He climbed onto the roof and listened at the skylight, until snow covered the skylight three cubits high. They found him, washed and oiled him, and sat him by a bonfire (Yoma 35b)." },
  { q: "A potential convert asked Hillel to teach him the whole Torah while standing on one foot. What did Hillel answer?", a: "“What is hateful to you, do not do to your fellow. That is the whole Torah; the rest is commentary. Go and learn” (Shabbat 31a)." },
  { q: "Why, according to the Gemara, did the halacha follow Beit Hillel and not Beit Shammai?", a: "Beit Hillel were agreeable and forbearing, and they taught the words of Beit Shammai alongside their own, even before their own (Eruvin 13b)." },
  { q: "How does the Gemara say Rabbi Akiva’s 24,000 students died, and why?", a: "A bad death, because they did not treat one another with proper respect (Yevamot 62b)." },
  { q: "By tradition, at what age did Rabbi Akiva begin to learn Torah, and what first inspired him?", a: "At 40; he noticed water slowly carving a hole in a hard stone (Avot DeRabbi Natan)." },
  { q: "Four sages entered the Pardes in the Gemara. Which one left unharmed?", a: "Rabbi Akiva. Ben Azzai died, Ben Zoma lost his mind, and Acher became a heretic (Chagigah 14b)." },
  { q: "Rabbi Shimon bar Yochai hid from the Romans in a cave with his son. What sustained them?", a: "A carob tree and a spring of water. They stayed 12 years (Shabbat 33b)." },
  { q: "How did Rabban Yochanan ben Zakkai leave besieged Jerusalem to meet Vespasian?", a: "Carried out as if he had died (Avot DeRabbi Natan 4 says in a coffin). He asked Vespasian for Yavneh and its sages (Gittin 56a–b)." },
  { q: "Which story of a mistaken party invitation does the Gemara link to the destruction of the Second Temple?", a: "Kamtza and Bar Kamtza (Gittin 55b–56a)." },
  { q: "In the ‘Oven of Akhnai’ story, how did the sages respond when a heavenly voice sided with Rabbi Eliezer?", a: "Rabbi Yehoshua said “Lo bashamayim hi,” the Torah is not in heaven, so we follow the majority (Bava Metzia 59b)." },
  { q: "Honi HaMe’agel is the sage who slept for how long?", a: "Seventy years (Taanit 23a)." },
  { q: "Which two famous sages, Shemaya and Avtalyon, were according to the Gemara descended from the Assyrian king Sancheriv?", a: "They descended from converts of the line of Sancheriv (Gittin 57b)." },
  { q: "According to the Gemara, which great Tanna descended from a convert who was Emperor Nero?", a: "Rabbi Meir (Gittin 56a)." },
  { q: "Who, according to the Gemara, was so worthy that the Torah could have been given through him had Moshe not come first?", a: "Ezra HaSofer (Sanhedrin 21b)." },
  { q: "Which Navi is identified by the Gemara with the God-fearing steward who hid 100 prophets in caves?", a: "Ovadyah, who served in Achav’s house (Sanhedrin 39b)." },
  { q: "Which book of Tanach never mentions Hashem’s Name, and what is the theme of that hiddenness?", a: "Megillat Esther. Hashem’s presence is hidden throughout (hester panim), yet the whole story shows His hand." },
  { q: "What is the difference between Tannaim and Amoraim?", a: "Tannaim are the sages of the Mishnah; Amoraim are the sages of the Gemara." },
  { q: "Which Amora is traditionally credited with beginning the editing of the Babylonian Talmud?", a: "Rav Ashi, head of the academy at Sura." },
  { q: "Which Mishnah teaches that saving one life is like saving an entire world?", a: "Sanhedrin 4:5, explaining why Adam was created as a single person." },
  { q: "Where does the Rambam present his Thirteen Principles of Faith?", a: "In his Commentary on the Mishnah, Sanhedrin chapter 10 (Perek Chelek)." },
  { q: "Why did the Rambam write his Iggeret Teiman?", a: "To strengthen the Jews of Yemen in the face of persecution and a false messianic claim." },
  { q: "Why is the Mishneh Torah also called “Yad HaChazakah”?", a: "“Yad” (yud-dalet) equals 14, the number of its books." },
  { q: "Where is the Rambam buried?", a: "Tiberias, by long-standing tradition." },
  { q: "In what language did the Rambam originally write the Moreh Nevuchim?", a: "Judeo-Arabic: Arabic written in Hebrew letters. Rabbi Shmuel ibn Tibbon translated it into Hebrew." },
  { q: "Which Tanach manuscript, identified with the Ben Asher codex the Rambam relied on, was kept for centuries in Aram Soba?", a: "The Aleppo Codex (Keter Aram Tzova)." },
  { q: "What happened to the Aleppo Codex in the 1947 riots in Aleppo?", a: "The Great Synagogue was burned in the 1947 riots. The codex later reached Israel in 1958, with about 40% of its pages missing." },
  { q: "What is the system of Arabic musical modes that Aleppo Jews use to organize the Shabbat services and pizmonim?", a: "The maqamat (singular: maqam), with a different maqam assigned to each week." },
  { q: "What does Kol Nidrei accomplish at the start of Yom Kippur?", a: "It annuls vows made between a person and Hashem, not vows between people." },
  { q: "What is the story of the “Maggid Meisharim”?", a: "An angelic mentor, the personified Mishnah, whom Maran Yosef Karo recorded visiting him over about 50 years (published as Maggid Meisharim, 1646)." },
  { q: "What is the Rema’s gloss on the Shulchan Aruch called, and what does the name mean?", a: "The Mapah, “the tablecloth,” laid over Maran’s “set table.”" },
  { q: "Maran Yosef Karo’s method for deciding halacha was to follow whichever view two of which three authorities agreed on?", a: "The Rif, the Rambam, and the Rosh." },
  { q: "In which city did Maran Yosef Karo pass away?", a: "Tzfat, in 1575." },
  { q: "Which verse inspired the names of the Ben Ish Chai and his responsa Rav Pe’alim?", a: "II Shmuel 23:20: “ben ish chai rav pe’alim,” describing Benayahu ben Yehoyada." },
  { q: "How is the Ben Ish Chai’s halachic work organized?", a: "By the weekly parsha, across two years of weekly derashot." },
  { q: "Which parts of the Shulchan Aruch does the Kaf HaChayim cover?", a: "Orach Chayim, and part of Yoreh Deah." },
  { q: "Rabbeinu Gershom banned polygamy. Was his edict accepted by every Jewish community?", a: "No. It was adopted by Ashkenazi communities, but many Sephardic and Eastern communities did not take it on in the same way." },
  { q: "Rashi’s commentary is printed in “Rashi script.” What is surprising about the name?", a: "Rashi never wrote in it. It is based on a 15th-century Sephardic semi-cursive hand, used by early printers for his commentary." },
  { q: "Which 1475 printing is the first dated Hebrew book we know of?", a: "Rashi’s commentary on the Chumash, printed in Reggio di Calabria, Italy." },
  { q: "Who printed the first complete Babylonian Talmud with the standard page layout, and was he Jewish?", a: "Daniel Bomberg in Venice, in the early 1520s, and he was Christian." },
  { q: "In which city was the Ramban ordered by the king into a public disputation in 1263?", a: "Barcelona, against the convert Pablo Christiani." },
  { q: "In which Italian cities was the Zohar first printed?", a: "Mantua and Cremona, 1558–1560." },
  { q: "Which sage does tradition hold wrote the Zohar, and where is his hillula celebrated?", a: "Rabbi Shimon bar Yochai, on Lag BaOmer at Meron." },
  { q: "Idra Rabba and Idra Zuta in the Zohar appear in which two parshiyot?", a: "Idra Rabba in Naso, and Idra Zuta in Ha’azinu." },
  { q: "What did the kabbalists of Tzfat do in the fields on Friday afternoon?", a: "They went out to the fields to welcome Shabbat as a bride or queen, the custom reflected in Lecha Dodi, which Rabbi Shlomo Alkabetz composed in Tzfat." },
  { q: "Which famous author of Lecha Dodi was the Ramak’s brother-in-law?", a: "Rabbi Shlomo Alkabetz." },
  { q: "The Arizal passed away young. How old was he?", a: "37 or 38 (c. 1534–1572)." },
  { q: "Who recorded most of the Arizal’s teachings, since he wrote very little himself?", a: "His students, chiefly Rabbi Chaim Vital." },
  { q: "Where was the Cairo Genizah, and what was found there?", a: "In the Ben Ezra Synagogue in Fustat (Old Cairo): hundreds of thousands of fragments, including autograph fragments of the Rambam." },
  { q: "The Chida’s Birkei Yosef is a commentary on what?", a: "The Shulchan Aruch." },
  { q: "What is the Shach, and what does the abbreviation stand for?", a: "A commentary on the Shulchan Aruch (Yoreh Deah and Choshen Mishpat) by Rabbi Shabtai HaKohen: Siftei Kohen." },
  { q: "Which Mishnaic masechet is almost entirely ethical teachings, and in which order is it?", a: "Pirkei Avot, in Nezikin." },
  { q: "Which masechet of the Bavli has the most dapim?", a: "Bava Batra. That counts pages (dapim), not words." },
  { q: "According to tradition, how did Antigonus of Socho’s teaching about serving without expecting reward lead to the Sadducees?", a: "His students are said to have misread it as meaning there is no reward, and so founded the Sadducee and Boethusian sects (Avot DeRabbi Natan)." },
  { q: "Which sage’s teaching is “Make for yourself a rav, acquire a friend, and judge everyone favorably”?", a: "Yehoshua ben Perachya (Avot 1:6)." },
  { q: "From which sage did the Nesiim, the leaders of the Jewish people after the Temple, descend?", a: "Hillel." },
  { q: "In which Temple chamber did the Great Sanhedrin sit?", a: "Lishkat HaGazit, the Chamber of Hewn Stone." },
  { q: "Which famous Torah commentator was born in Troyes, and what was his real name?", a: "Rashi, Rabbi Shlomo Yitzchaki." },
  { q: "What does “Teiku” stand for, in the traditional reading?", a: "“Tishbi yetaretz kushyot ve’abayot”: Eliyahu the Tishbite will resolve questions and difficulties." },
  { q: "Who is the author of Yalkut Yosef, and how is he related to Hacham Ovadia Yosef?", a: "Rabbi Yitzchak Yosef, his son." },
];

const QuizCard = memo(function QuizCard() {
  const [order] = useState(() => shuffled(QUIZ.map((_, k) => k)));
  const [n, setN] = useState(0);
  const [shown, setShown] = useState(false);
  const item = QUIZ[order[n % order.length]];
  return (
    <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300">Quick quiz · no cheating</p>
      <p key={n} className="text-sm font-bold text-slate-100 mt-1 animate-in fade-in duration-300">{item.q}</p>
      {shown ? (
        <p className="text-xs text-emerald-200 mt-1.5 leading-snug animate-in fade-in slide-in-from-bottom-1 duration-300">{item.a}</p>
      ) : null}
      <div className="mt-2 flex gap-2">
        {!shown ? (
          <button type="button" onClick={() => setShown(true)} className="text-[11px] font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-200 rounded-full px-3 py-1 active:scale-95 transition-all">Reveal answer</button>
        ) : (
          <button type="button" onClick={() => { setShown(false); setN((x) => x + 1); }} className="text-[11px] font-bold text-slate-200 border border-slate-600 hover:bg-slate-800 rounded-full px-3 py-1 active:scale-95 transition-all">Next question</button>
        )}
      </div>
    </div>
  );
});

const DVARIM: { title: string; body: string; source: string }[] = [
  { title: "Why does the Torah begin with Creation?", body: "Rashi opens the Torah with a question: it could have started with the first mitzvah to the nation, “HaChodesh hazeh lachem.” Why Creation? Because if the nations ever say, “You stole this land,” Israel can answer: the whole earth belongs to the Holy One, who created it and gave it to whom He saw fit. Our claim is not only history. It is the opening line of the Torah.", source: "Rashi on Bereishit 1:1" },
  { title: "The blueprint behind the world", body: "The Midrash asks why the Torah opens with “Bereishit.” Rabbi Hoshaya answers: when a king builds a palace, he does not build from his own head. The builder consults plans and diagrams. So too, the Holy One looked into the Torah and created the world, and “reshit” is the Torah itself. The Torah is not a book about the world. It is the plan the world was built from.", source: "Bereishit Rabbah 1:1" },
  { title: "Everything that happened to the Avot is a sign", body: "Ramban offers a principle for all the stories of Avraham, Yitzchak and Yaakov: “Whatever has happened to the patriarchs is a sign to the children.” That is why the Torah narrates their journeys and the digging of wells at such length. What looks like travel detail is a preview of what would later happen to their descendants.", source: "Ramban on Bereishit 12:6" },
  { title: "Is life without death “very good”?", body: "On “and behold, it was very good,” Rabbi Meir’s Torah read, “and behold, death is good.” Rabbi Yochanan explains why death was decreed even for the righteous: as long as they live, they are in a constant battle with their evil inclination. When they die, they rest.", source: "Bereishit Rabbah 9:5" },
  { title: "Why was dominion listed in that order?", body: "The Torah says humans will rule over the fish, the birds and the animals. The Kli Yakar notices that the word for ruling, “veyirdu,” can also mean “descend.” If a person is not worthy, he descends and cannot control even the animals near him. Later, for Noach and for David, the order is reversed and the language is of fear and authority: when we are worthy, we rule not only the animals but even the birds, and even the fish hidden in the sea.", source: "Kli Yakar on Bereishit 1:26" },
  { title: "The shepherd and the thirsty kid", body: "The Midrash says a kid ran away from Moshe in the wilderness. He chased it until it reached a pool, where the kid stopped to drink. Moshe said, “I did not know you were running because of thirst. You must be tired,” and carried it on his shoulder. Hashem said: if you show such compassion to a flesh-and-blood flock, by your life, you will shepherd My flock, Israel.", source: "Shemot Rabbah 2:2" },
  { title: "One man, one heart", body: "At Sinai, the Torah says Israel “camped” in the singular. Rashi explains: as one man with one heart. All the other encampments were marked by complaints and disputes. The Torah follows right after. Torah is received together, not alone.", source: "Rashi on Shemot 19:2" },
  { title: "Sinai was meant to make us immortal", body: "Sforno explains “a kingdom of priests and a holy nation” at Sinai: Israel would teach all humanity to call in Hashem’s name, and “holy” means enduring forever. He adds that Hashem’s intention at Sinai was to give Israel the status Adam had before he sinned, and that the Golden Calf undid it, as the stripping of the ornaments received at Horev (Shemot 33:6) hints.", source: "Sforno on Shemot 19:6" },
  { title: "The Torah of three", body: "A Galilean preacher stood before Rav Chisda and said: “Blessed is the Merciful One who gave a threefold Torah (Torah, Prophets, Writings) to a threefold nation (Kohanim, Levites, Israelites), through a third-born (Moshe, after Aharon and Miriam), on the third day, in the third month.” Even the numbers of Sinai carry a message.", source: "Shabbat 88a" },
  { title: "Why repeat a mitzvah they already did?", body: "The Zohar asks why the command of Pesach is given again in the second year, in the wilderness of Sinai, when it was already commanded in Egypt. Rabbi Abba answers: Israel might have thought it was only for that one year in Egypt. So Hashem renewed it, to establish it for all generations.", source: "Zohar, Beha’alotcha 152a" },
  { title: "What stands between us and doing His will?", body: "After his prayer, Rabbi Alexandri would say: “Master of the Universe, it is revealed before You that our will is to do Your will. And what prevents us? The yeast in the dough, and the subjugation to the kingdoms.” The Sages did not blame circumstances alone. They named the yeast inside, the evil inclination, as the first obstacle.", source: "Berachot 17a" },
  { title: "How do you come to love Hashem?", body: "The Rambam asks: what is the path to love and awe of Hashem? When a person contemplates His wondrous and great works and sees His infinite wisdom, he is moved to love Him and long to know Him. Then, reflecting further, he recoils in awe, feeling small before perfect knowledge. Love and awe are not forced. They grow from looking carefully at the world.", source: "Rambam, Yesodei HaTorah 2:2" },
  { title: "Love Hashem with both inclinations", body: "“You shall love Hashem your God with all your heart.” The Mishnah teaches that “with all your heart” means with both of your inclinations, the good and the evil. Not only the easy part of us. Even the drive that pulls us the wrong way can be turned toward serving Hashem.", source: "Mishnah Berachot 9:5" },
  { title: "Another person’s honor as your own", body: "Rabbi Elazar ben Shammua taught: let the honor of your student be as dear to you as your own, and the honor of your colleague as the awe of your teacher, and the awe of your teacher as the awe of Heaven. Respect is a ladder, and it starts with how we treat the people beside and below us.", source: "Pirkei Avot 4:12" },
  { title: "The carob tree", body: "Honi saw a man planting a carob tree, which takes seventy years to bear fruit. He asked: “Will you live to eat from it?” The man answered: “I found a world with carob trees. As my fathers planted for me, so I plant for my children.” Much of what we enjoy was planted by someone who never saw the fruit.", source: "Taanit 23a" },
  { title: "A world created for me", body: "The Mishnah gives several reasons humanity began with one person. One: each of us is obligated to say, “The world was created for me.” Whoever sustains one soul is credited as if he sustained an entire world. Every individual carries that weight and that dignity.", source: "Mishnah Sanhedrin 4:5" },
  { title: "What is true teshuvah?", body: "The Rambam teaches that complete teshuvah is when someone has the chance to repeat the sin, the opportunity is in their hands, and they abstain, because of teshuvah, not out of fear or weakness. Change is measured not when it is easy but when the old choice is available again.", source: "Rambam, Hilchot Teshuvah 2:1" },
  { title: "Learning from everyone", body: "Rabbi Chanina said: I have learned much from my teachers, more from my colleagues, and from my students most of all. Teaching is itself a form of learning. Explaining something forces us to understand it, and every student’s question opens a door we had not seen.", source: "Taanit 7a" },
  { title: "A calling that begins with love", body: "Every time Hashem spoke to Moshe, the Torah says He first “called” (Vayikra). Rashi explains that calling is a language of affection, the same word used for the angels calling to one another. Before any command, before any instruction, there is warmth. The Torah teaches that the way Hashem addresses us comes before what He says to us.", source: "Rashi on Vayikra 1:1" },
  { title: "Lech lecha: for your own good", body: "Hashem tells Avraham “lech lecha,” go from your land. Rashi reads the extra word “lecha” as: for your benefit, for your good. There I will make you a great nation, and here you cannot have children. The journey that felt like losing everything was, in fact, the route to everything he wanted.", source: "Rashi on Bereishit 12:1" },
  { title: "Was Noach really righteous?", body: "The Torah calls Noach “righteous in his generation.” Rashi brings two views. Some read it as praise: if he was righteous even in a corrupt generation, how much more so in a righteous one. Others read it as criticism: only in his generation was he considered righteous; in Avraham’s generation he would have been nothing special. Rashi leaves both readings standing, a lesson in how carefully a person is weighed.", source: "Rashi on Bereishit 6:9" },
  { title: "Avraham, Avraham", body: "At the Akeidah, the angel calls out “Avraham, Avraham.” Rashi explains that the repetition of his name is an expression of affection. At the hardest moment of Avraham’s life, the call that stops him does not come as a rebuke. It comes with love.", source: "Rashi on Bereishit 22:11" },
  { title: "Prepare the food first", body: "On “Let the earth sprout,” the Meshech Chochma recalls the Sages’ teaching to be like Hashem: as He is compassionate and gracious, so you be. Creation shows it. In the first three days Hashem prepared the plants and the lights, and only then created the living creatures. So too, he cites Rabbi Eliezer HaKappar in the Yerushalmi: a person should not acquire an animal or a bird unless he has first arranged food for it.", source: "Meshech Chochma on Bereishit 1:11" },
  { title: "Who recognizes greatness first?", body: "“The man Moshe was very great in the eyes of Pharaoh’s servants and in the eyes of the people.” The Meshech Chochma explains that honor comes two ways: from true wisdom and noble conduct, or from strange wonders that people mistake for something divine. Moshe’s honor began with Pharaoh’s wise servants, who examined his wisdom, humility and concern for others, and only afterward spread to the people.", source: "Meshech Chochma on Shemot 11:3" },
  { title: "A stranger in a strange land", body: "Moshe named his son Gershom: “I was a stranger in a foreign land.” The Meshech Chochma sees in this Moshe’s bond with his people. Though he grew up in Pharaoh’s house and married into Yitro’s family, he felt like a stranger in Midian and regarded Egypt, where his people lived, as his own land. His pain for them was so great that he did not even name a son for the one who saved him from Pharaoh’s sword.", source: "Meshech Chochma on Shemot 18:3" },
  { title: "Wrestling with the evil inclination", body: "The Baal HaTanya compares the struggle with our evil nature to two people wrestling: the lazy and sluggish one is thrown easily, even if he is stronger. So the evil inclination cannot be beaten with heaviness born of sadness and a heart dulled like stone, but with the alacrity that comes from joy and a heart free of worry. Sadness has no virtue in itself. The gain is the true joy that follows genuine remorse.", source: "Tanya, Likkutei Amarim ch. 26" },
  { title: "Why we love each other", body: "The Tanya builds love of a fellow Jew on the soul, not the body. All of Israel have one Father, and their souls come from one source in the One G-d, so they are called true brothers. Only the bodies are separate. Love that rests on the body depends on something passing. This, he says, is Hillel’s “this is the whole Torah”: raise the soul above the body.", source: "Tanya, Likkutei Amarim ch. 32" },
  { title: "A part of G-d above", body: "The Tanya teaches that the Jewish soul is truly a part of G-d above. The Zohar says, “He who blows, blows from within him”: a breath carries something of a person’s innermost vitality. And just as a child comes from the mind of his father, so, as an anthropomorphism, each Jewish soul is derived from Hashem’s thought and wisdom.", source: "Tanya, Likkutei Amarim ch. 2" },
  { title: "Find the good point", body: "Rebbe Nachman teaches: judge everyone favorably. Even someone completely wicked, search for the bit of good in him, the place where he is not wicked, for how could it be that he never once did a mitzvah? By finding it and judging him favorably, you actually move him from the scale of guilt to the scale of merit and can bring him to teshuvah. This is “In yet a little, the wicked is not” (Tehillim 37:10).", source: "Likutei Moharan 282" },
  { title: "A great mitzvah to be happy", body: "Rebbe Nachman writes: “It is a great mitzvah to always be happy,” and to work hard to push away gloom. He ties joy to the ten types of song that give life to the ten pulses, and teaches that when the joy is flawed, illness can follow. In the future, he says, joy will grow so great that Hashem Himself will lead the tzaddikim in a circle dance.", source: "Likutei Moharan II, 24" },
];

const DvarTorah = memo(function DvarTorah() {
  const [order] = useState(() => shuffled(DVARIM.map((_, k) => k)));
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(false);
  const d = DVARIM[order[n % order.length]];
  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full min-h-[48px] text-left flex items-center justify-between gap-3 touch-manipulation cursor-pointer">
        <span className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-wider text-amber-300">30-second Dvar Torah · tap to read</span>
          <span className="block text-sm font-bold text-slate-100 mt-0.5">{d.title}</span>
        </span>
        <span className="shrink-0 text-[11px] font-black text-amber-950 bg-amber-300 rounded-full px-3 py-1.5">{open ? 'Close' : 'Read'}</span>
      </button>
      {open && (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          <p className="mt-2 text-xs sm:text-[13px] text-slate-200 leading-relaxed">{d.body}</p>
          <p className="mt-1.5 text-[11px] text-amber-300/70 italic">{d.source}</p>
          <button type="button" onClick={() => { setOpen(false); setN((x) => x + 1); }} className="mt-2 text-[11px] font-bold text-slate-200 border border-slate-600 hover:bg-slate-800 rounded-full px-3 py-1 active:scale-95 transition-all">Another one</button>
        </div>
      )}
    </div>
  );
});

const LEARN_NUDGES = [
  'It is great to rely on me for answers, but you can learn all of this for yourself. The sefarim I am quoting are in the library, free, and many are translated into English.',
  'I can point you to the passage, but nothing beats opening the sefer. Every book on AI Sefarim is free to read.',
  'Do not just take my word for it. Tap any source under an answer and read the original. That is how you start to learn it yourself.',
  'Prefer to listen? There are hundreds of free videos and daily podcasts on Daf Yomi, Tanach, Rambam, the Zohar and more.',
  'Think of me as a study partner, not a replacement. The goal is for you to open the book and learn it for yourself.',
];

function LearnNudge() {
  const [i] = useState(() => Math.floor(Math.random() * LEARN_NUDGES.length));
  return (
    <div className="rounded-xl border border-sky-400/25 bg-sky-500/5 p-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-sky-300">Learn it yourself</p>
      <p className="text-xs sm:text-[13px] text-slate-200 mt-1 leading-relaxed">{LEARN_NUDGES[i]}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href="/" target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-sky-950 bg-sky-300 hover:bg-sky-200 rounded-full px-3 py-1 active:scale-95 transition-all">Browse the free library</a>
      </div>
    </div>
  );
}

// Own component so its ~4 ticks/second re-render only this number, not the
// whole chat page (every previous answer's markdown included).
const DOC_COUNTER_TARGET = 340000;
function PagesCounter() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setN((c) => {
        const remaining = DOC_COUNTER_TARGET - c;
        if (remaining <= 0) return c;
        const step = Math.max(100, Math.floor(remaining * 0.012));
        return Math.min(DOC_COUNTER_TARGET, c + step);
      });
    }, 280);
    return () => clearInterval(id);
  }, []);
  return <>{n.toLocaleString()}</>;
}

export function ChatPage({ onExit, books = NO_BOOKS, media = NO_MEDIA, categoryThumbnails = NO_THUMBS }: { onExit: () => void; books?: Book[]; media?: MediaItem[]; categoryThumbnails?: Record<string, string> }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [factStart, setFactStart] = useState(0);
  const [factCount, setFactCount] = useState(1);
  const [waitCount, setWaitCount] = useState(1);
  const [waitOrder, setWaitOrder] = useState<number[]>(() => shuffledOrder(WAIT_CARDS.length));
  const [error, setError] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isLoading && loadingRef.current) {
      loadingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
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
    setWaitOrder(shuffledOrder(WAIT_CARDS.length));
    const waitId = setInterval(() => {
      setWaitCount((c) => Math.min(c + 1, WAIT_CARDS.length));
    }, 20000);
    const id = setInterval(() => {
      setFactCount((c) => Math.min(c + 1, LIBRARY_FACTS.length));
    }, 7000);
    return () => {
      clearInterval(id);
      clearInterval(waitId);
      setWaitOrder(shuffledOrder(WAIT_CARDS.length));
    };
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
                  <Markdown text={m.content} sources={m.sources} onOpenSource={setOpenSource} />
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
          <div ref={loadingRef} className="flex items-start gap-2 justify-start scroll-mt-16">
            <div className="hidden sm:flex relative shrink-0 w-7 h-7 items-center justify-center mt-1">
                            <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
            </div>
            <div className="relative max-w-[96%] sm:max-w-[85%] rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-500/70 via-purple-500/50 to-indigo-500/70">
              <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)' }} />
              <div className="absolute -bottom-10 -right-6 w-28 h-28 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.2), transparent 70%)' }} />
              <div className="relative bg-slate-900 rounded-[calc(1rem-1.5px)] px-4 sm:px-5 py-3.5 sm:py-4 text-slate-400 text-sm overflow-hidden">

                <p className="text-base sm:text-lg font-black text-indigo-300 leading-snug">
                  {LOADING_EXPLANATION_HEADLINE}
                </p>

                <div className="mt-2.5 flex items-baseline gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400 mb-0.5" />
                  <span className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                    <PagesCounter />
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-indigo-400 uppercase tracking-wide">
                    pages checked so far
                  </span>
                </div>

                <div className="mt-2 h-1 w-full rounded-full bg-slate-800 overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-shimmer-sweep" />
                </div>

                <ShelfScanner titles={books.map((b) => b.title)} />

                <AscentIndicator />

                <div className="mt-3"><DvarTorah /></div>

                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  {LOADING_EXPLANATION_DETAIL}
                </p>

                {waitOrder.slice(0, waitCount).map((i) => WAIT_CARDS[i]).map((card) => (
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

                <div className="mt-3.5 space-y-2.5">
                  <SageQuote />
                  <QuizCard />
                  <LearnNudge />
                </div>

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
