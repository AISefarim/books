import { useCallback, useEffect, useState } from 'react';
import LiveAnalytics from './LiveAnalytics';
import { Loader2, Lock, RefreshCw, Users, CalendarDays, Infinity as InfinityIcon, ScrollText } from 'lucide-react';

// /stats - private Super Daf readership numbers, behind a simple PIN
// (remembered in this browser); the worker checks it and locks out guessers.
// Counts are unique PEOPLE (salted IP hashes), not page loads.

const WORKER_URL = (import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev';
const ENDPOINT = `${WORKER_URL.replace(/\/$/, '')}/admin/dafstats`;

type Stats = { today: number; thisMonth: number; allTime: number; perDay: { day: string; people: number }[]; perDaf: { ref: string; people: number }[]; perSource?: { src: string; people: number }[] };

export default function DafStatsPage() {
  const [key, setKey] = useState(() => { try { return localStorage.getItem('statsPin') || ''; } catch { return ''; } });
  const [draft, setDraft] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (k: string) => {
    if (!k) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${ENDPOINT}?days=30`, { headers: { 'x-stats-pin': k } });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || `Error ${res.status}`); if (res.status === 401) { setKey(''); try { localStorage.removeItem('statsPin'); } catch { /* ignore */ } } return; }
      setStats(d);
    } catch { setErr('Could not reach the server.'); } finally { setBusy(false); }
  }, []);

  useEffect(() => { load(key); }, [key, load]);

  if (!key) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <form onSubmit={(e) => { e.preventDefault(); const k = draft.trim(); try { localStorage.setItem('statsPin', k); } catch { /* ignore */ } setKey(k); }} className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="flex items-center gap-2 font-black text-lg"><Lock className="w-5 h-5 text-indigo-300" /> Super Daf stats</p>
          <p className="mt-1 text-sm text-slate-400">Enter your PIN.</p>
          <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="mt-4 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-center text-2xl tracking-[0.4em] outline-none focus:border-indigo-400" placeholder="••••••" aria-label="PIN" />
          {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
          <button className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 font-black">Open</button>
        </form>
      </div>
    );
  }

  const max = Math.max(1, ...(stats?.perDay || []).map((d) => d.people));
  const days = [...(stats?.perDay || [])].reverse();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 sm:px-8 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <ScrollText className="w-6 h-6 text-indigo-300" />
          <h1 className="text-2xl font-black tracking-tight">Super Daf readers</h1>
          <button onClick={() => load(key)} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold hover:bg-slate-800">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh</button>
        </div>
        <p className="mt-1 text-sm text-slate-400">Unique people who opened Super Daf (the Daf page or any daf). A person counts once per day, however many times they open it. Days follow New York time.</p>
        {err && <p className="mt-4 text-rose-300">{err}</p>}
        <LiveAnalytics pin={key} />

        {!stats ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[{ l: 'Today', v: stats.today, i: Users }, { l: 'This month', v: stats.thisMonth, i: CalendarDays }, { l: 'All time', v: stats.allTime, i: InfinityIcon }].map(({ l, v, i: Icon }) => (
                <div key={l} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400"><Icon className="w-3.5 h-3.5" /> {l}</p>
                  <p className="mt-1 text-3xl sm:text-4xl font-black tabular-nums">{v.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <h2 className="mt-8 mb-3 text-sm font-black uppercase tracking-wider text-slate-400">People per day · last 30 days</h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-end gap-1 h-40">
                {days.map((d) => (
                  <div key={d.day} className="group relative flex-1 flex flex-col justify-end h-full">
                    <div className="rounded-t bg-indigo-500 group-hover:bg-indigo-400 min-h-[2px]" style={{ height: `${(d.people / max) * 100}%` }} />
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold opacity-0 group-hover:opacity-100">{d.day.slice(5)} · {d.people}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{days[0]?.day.slice(5)}</span><span>today</span></div>
            </div>

            {!!stats.perSource?.length && (
              <>
                <h2 className="mt-8 mb-3 text-sm font-black uppercase tracking-wider text-slate-400">People from tagged links · all time</h2>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 divide-y divide-slate-800">
                  {stats.perSource.map((d) => (
                    <div key={d.src} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="font-bold">?src={d.src}</span>
                      <span className="ml-auto tabular-nums font-black">{d.people.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h2 className="mt-8 mb-3 text-sm font-black uppercase tracking-wider text-slate-400">People per daf · all time</h2>
            {stats.perDaf.length === 0 ? <p className="text-slate-500 text-sm">No daf opens recorded yet.</p> : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 divide-y divide-slate-800">
                {stats.perDaf.map((d) => (
                  <a key={d.ref} href={`/daf/${d.ref.replace(/ (\d+)$/, '/$1').replace(/ /g, '_')}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/60">
                    <span className="font-bold">{d.ref}</span>
                    <span className="ml-auto tabular-nums font-black">{d.people.toLocaleString()}</span>
                  </a>
                ))}
              </div>
            )}
            <p className="mt-8 text-xs text-slate-600">Counting started Oct 5, 2026. No IP addresses are stored, only anonymous salted hashes.</p>
          </>
        )}
      </div>
    </div>
  );
}
