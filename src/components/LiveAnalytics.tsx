import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';

// Live analytics on /stats: who is on the site now, what they open and press, where they go next.
const WORKER_URL = (import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev';
const ENDPOINT = `${WORKER_URL.replace(/\/$/, '')}/admin/analytics`;

type Row = Record<string, any>;
type A = {
  day: string; now: number;
  live: { last5min: Row; last30min: Row };
  totals: Row; hourly: Row[]; pages: Row[]; entries: Row[]; flows: Row[]; clicks: Row[];
  refs: Row[]; srcs: Row[]; devices: Row[]; places: Row[]; depth: Row[]; buckets: Row[]; recent: Row[];
};

const fmtHour = (h: number) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
const ago = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; };
const BUCKETS = ['under 10s', '10s-1m', '1-5m', '5-15m', '15m+'];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function Table({ rows, cols, empty = 'Nothing yet.' }: { rows: Row[]; cols: { k: string; label?: string; num?: boolean; fmt?: (v: any, r: Row) => React.ReactNode }[]; empty?: string }) {
  if (!rows?.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr>{cols.map((c) => <th key={c.k} className={`pb-1 text-[10px] font-bold uppercase text-slate-500 ${c.num ? 'text-right' : 'text-left'}`}>{c.label ?? ''}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((r, i) => (
          <tr key={i}>{cols.map((c) => <td key={c.k} className={`py-1.5 ${c.num ? 'text-right tabular-nums font-black' : 'pr-2 break-all'}`}>{c.fmt ? c.fmt(r[c.k], r) : r[c.k]}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LiveAnalytics({ pin }: { pin: string }) {
  const [a, setA] = useState<A | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT, { headers: { 'x-stats-pin': pin } });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || `Error ${res.status}`); return; }
      setA(d); setErr(null);
    } catch { setErr('Could not reach the server.'); }
  }, [pin]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (err) return <p className="mt-6 text-rose-300">{err}</p>;
  if (!a) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;

  const hours = Array.from({ length: 24 }, (_, h) => a.hourly.find((x) => x.hour === h) || { hour: h, people: 0, sessions: 0, views: 0 });
  const maxH = Math.max(1, ...hours.map((h) => h.people));
  const bk = BUCKETS.map((b) => ({ bucket: b, sessions: a.buckets.find((x) => x.bucket === b)?.sessions || 0 }));
  const maxB = Math.max(1, ...bk.map((b) => b.sessions));
  const t = a.totals;

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-black">Live · {a.day}</h2>
        <span className="text-xs text-slate-500">refreshes every 30s · New York time</span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'On the site now', v: a.live.last5min?.people || 0, s: 'last 5 minutes', hot: true },
          { l: 'Last 30 minutes', v: a.live.last30min?.people || 0, s: 'people' },
          { l: 'People today', v: t.people || 0, s: `${t.sessions || 0} visits · ${t.views || 0} page views` },
          { l: 'Time per visit', v: `${Math.floor((t.avgEngagedSec || 0) / 60)}:${String((t.avgEngagedSec || 0) % 60).padStart(2, '0')}`, s: `${t.pagesPerSession || 0} pages per visit · ${t.engagedMinutes || 0} min total` },
        ].map((c) => (
          <div key={c.l} className={`rounded-2xl border p-4 ${c.hot ? 'border-emerald-700 bg-emerald-950/40' : 'border-slate-800 bg-slate-900'}`}>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{c.l}</p>
            <p className="mt-1 text-3xl font-black tabular-nums">{c.v}</p>
            <p className="text-[11px] text-slate-500">{c.s}</p>
          </div>
        ))}
      </div>

      <div className="mt-3"><Card title="People per hour today">
        <div className="flex items-end gap-1 h-32">
          {hours.map((h) => (
            <div key={h.hour} className="group relative flex-1 flex flex-col justify-end h-full">
              <div className="rounded-t bg-emerald-500 group-hover:bg-emerald-400 min-h-[2px]" style={{ height: `${(h.people / maxH) * 100}%` }} />
              <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold opacity-0 group-hover:opacity-100">{fmtHour(h.hour)} · {h.people} people · {h.views} views</span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span></div>
      </Card></div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card title="Pages viewed"><Table rows={a.pages} cols={[{ k: 'path' }, { k: 'people', label: 'people', num: true }, { k: 'views', label: 'views', num: true }]} /></Card>
        <Card title="What people press"><Table rows={a.clicks} cols={[{ k: 'label' }, { k: 'people', label: 'people', num: true }, { k: 'n', label: 'presses', num: true }]} /></Card>
        <Card title="Where they go next"><Table rows={a.flows} cols={[{ k: 'fromPath', fmt: (v, r) => <span><span className="text-slate-400">{v}</span> → {r.toPath}</span> }, { k: 'n', label: 'times', num: true }]} /></Card>
        <Card title="Where they land first"><Table rows={a.entries} cols={[{ k: 'path' }, { k: 'sessions', label: 'visits', num: true }]} /></Card>
        <Card title="How long a visit lasts">
          <div className="space-y-1.5">{bk.map((b) => (
            <div key={b.bucket} className="flex items-center gap-2 text-sm"><span className="w-20 text-slate-400">{b.bucket}</span><div className="flex-1 h-3 rounded bg-slate-800"><div className="h-3 rounded bg-indigo-500" style={{ width: `${(b.sessions / maxB) * 100}%` }} /></div><span className="w-10 text-right tabular-nums font-black">{b.sessions}</span></div>
          ))}</div>
        </Card>
        <Card title="How far down they read"><Table rows={a.depth} cols={[{ k: 'path' }, { k: 'avgDepth', label: 'avg %', num: true, fmt: (v) => `${v}%` }, { k: 'sessions', label: 'visits', num: true }]} /></Card>
        <Card title="Where they are"><Table rows={a.places} cols={[{ k: 'city', fmt: (v, r) => `${v}${r.region ? ', ' + r.region : ''}${r.country && r.country !== 'US' ? ' · ' + r.country : ''}` }, { k: 'people', label: 'people', num: true }]} /></Card>
        <Card title="Devices · came from">
          <Table rows={a.devices} cols={[{ k: 'device' }, { k: 'people', label: 'people', num: true }]} />
          <div className="mt-3"><Table rows={[...a.srcs.map((s) => ({ name: `?src=${s.src}`, n: s.people })), ...a.refs.map((r) => ({ name: r.ref, n: r.sessions }))]} cols={[{ k: 'name' }, { k: 'n', num: true }]} empty="No referrers yet (WhatsApp and SMS links usually arrive without one)." /></div>
        </Card>
      </div>

      <div className="mt-3"><Card title="Latest activity">
        <Table rows={a.recent} cols={[{ k: 'ts', fmt: (v) => <span className="text-slate-500">{ago(a.now - v)}</span> }, { k: 'type' }, { k: 'label', fmt: (v, r) => v || r.path }, { k: 'city', fmt: (v, r) => <span className="text-slate-400">{v || ''}{r.device ? ' · ' + r.device : ''}</span> }]} />
      </Card></div>
    </section>
  );
}
