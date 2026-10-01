import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const WORKER_URL =
  (import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev';
const ENDPOINT = `${WORKER_URL.replace(/\/$/, '')}/admin/agent`;

type Mode = 'speech' | 'research' | 'custom';
type Source = { n: number; book: string; excerpt?: string; bookUrl?: string };
type Result = { parts: { title: string; answer: string }[]; sources: Source[] };

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: 'speech', label: 'Speech', blurb: 'Write a speech from a topic, or paste a draft and make it awesome. Always hook + wow factor + landing.' },
  { id: 'research', label: 'Research dump', blurb: 'Four parallel deep searches (Gemara/Midrash, halachah, Kabbalah, Chassidut/mussar) merged into one big raw-material dump. Takes about 4 minutes.' },
  { id: 'custom', label: 'Custom', blurb: 'Any task over the whole library, at whatever length it needs.' },
];

function md(text: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        h1: ({ children }) => <h2 className="text-lg font-black text-slate-100 mt-6 mb-2">{children}</h2>,
        h2: ({ children }) => <h2 className="text-lg font-black text-slate-100 mt-6 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-black text-amber-300 mt-5 mb-1.5">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-black text-slate-200 mt-4 mb-1">{children}</h4>,
        strong: ({ children }) => <strong className="font-bold text-slate-50">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-amber-400/50 pl-3 my-3 text-slate-300">{children}</blockquote>,
        hr: () => <hr className="border-slate-700/60 my-4" />,
        a: ({ href, children }) => {
          const m = href?.match(/^#cite-(\d+)$/);
          if (m) {
            return (
              <a
                href={`#src-${m[1]}`}
                className="inline-flex items-center justify-center min-w-4 h-4 px-1 mx-0.5 -translate-y-0.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-black align-super no-underline"
              >
                {m[1]}
              </a>
            );
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{children}</a>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function toMarkdown(r: Result): string {
  const body = r.parts.map((p) => (r.parts.length > 1 ? `# ${p.title}\n\n${p.answer}` : p.answer)).join('\n\n---\n\n');
  const src = r.sources.map((s) => `${s.n}. ${s.book}${s.bookUrl ? ` - ${s.bookUrl}` : ''}`).join('\n');
  return `${body}\n\n---\n\n## Sources\n\n${src}\n`.replace(/\[(\d+)\]\(#cite-\d+\)/g, '[$1]');
}

const field = 'w-full rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-400 outline-none px-3 py-2 text-sm text-slate-100 placeholder-slate-500';

export default function StudioPage() {
  const [key, setKey] = useState(() => {
    try { return localStorage.getItem('studioKey') || ''; } catch { return ''; }
  });
  const [mode, setMode] = useState<Mode>('speech');
  const [topic, setTopic] = useState('');
  const [draft, setDraft] = useState('');
  const [occasion, setOccasion] = useState('Shabbat drasha');
  const [audience, setAudience] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [tone, setTone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = 'Studio';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [busy]);

  const canRun = key.trim() && !busy && (topic.trim() || (mode === 'speech' && draft.trim()));

  async function run() {
    setBusy(true); setError(''); setResult(null); setElapsed(0);
    try { localStorage.setItem('studioKey', key.trim()); } catch { /* ignore */ }
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key.trim() },
        body: JSON.stringify({ mode, topic, draft: mode === 'speech' ? draft : undefined, occasion, audience, minutes, tone, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('Wrong admin key.');
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-black text-white">Studio <span className="text-xs font-bold text-slate-500 align-middle ml-2">admin</span></h1>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Admin key"
            autoComplete="off"
            className={`${field} !w-44`}
          />
        </div>

        <div className="flex gap-2 mb-2 flex-wrap">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${mode === m.id ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mb-4">{MODES.find((m) => m.id === mode)!.blurb}</p>

        <div className="space-y-3">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={mode === 'custom' ? 6 : 3}
            placeholder={mode === 'speech' ? 'Topic or request (optional if you paste a draft). e.g. Parashat Lech Lecha: teshuvah of Terach' : mode === 'research' ? 'Topic to mine the whole library for' : 'What should the agent do?'}
            className={field}
          />
          {mode === 'speech' && (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              placeholder="Paste an existing draft here to have it made awesome (keeps your voice and stories, adds a hook and wow factor, checks sources against the library). Leave empty to write from scratch."
              className={field}
            />
          )}
          {mode === 'speech' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Occasion" className={field} />
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience" className={field} />
              <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tone" className={field} />
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input type="number" min={2} max={60} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${field} !w-20`} /> min
              </label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra instructions (optional)" className={`${field} col-span-2 sm:col-span-4`} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={run}
            disabled={!canRun}
            className="px-6 py-2.5 rounded-full bg-amber-400 text-slate-900 font-black text-sm disabled:opacity-40 hover:bg-amber-300 transition-colors"
          >
            {busy ? 'Working...' : mode === 'speech' ? (draft.trim() ? 'Make it awesome' : 'Write speech') : mode === 'research' ? 'Run research dump' : 'Run'}
          </button>
          {busy && (
            <>
              <span className="text-sm text-slate-400 tabular-nums">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
              <button onClick={() => abortRef.current?.abort()} className="text-xs text-slate-500 hover:text-slate-300 underline">cancel</button>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {result && (
          <div className="mt-8">
            <div className="flex gap-2 mb-4">
              <button
                onClick={async () => { await navigator.clipboard.writeText(toMarkdown(result)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold hover:border-slate-500"
              >
                {copied ? 'Copied' : 'Copy all'}
              </button>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(new Blob([toMarkdown(result)], { type: 'text/markdown' }));
                  const a = document.createElement('a');
                  a.href = url; a.download = `studio-${mode}-${new Date().toISOString().slice(0, 10)}.md`; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold hover:border-slate-500"
              >
                Download .md
              </button>
            </div>
            {result.parts.map((p, i) => (
              <section key={i} className="mb-8">
                {result.parts.length > 1 && <h2 className="text-xl font-black text-white border-b border-slate-700 pb-2 mb-3">{p.title}</h2>}
                <div className="text-[15px] text-slate-300">{md(p.answer)}</div>
              </section>
            ))}
            <h2 className="text-lg font-black text-white border-b border-slate-700 pb-2 mb-3">Sources ({result.sources.length})</h2>
            <ol className="space-y-1.5 text-sm">
              {result.sources.map((s) => (
                <li key={s.n} id={`src-${s.n}`} className="flex gap-2">
                  <span className="text-indigo-300 font-black w-6 text-right shrink-0">{s.n}</span>
                  {s.bookUrl ? (
                    <a href={s.bookUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{s.book} (read the book)</a>
                  ) : (
                    <span>{s.book}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
