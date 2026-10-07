// Site analytics: page views, clicks on buttons and links, engaged time and scroll depth.
// Batched and sent to the worker (/daf/a), which stores them without raw IPs.
// No text people type is ever recorded: only the labels of buttons and links they press.

const ENDPOINT = (((import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev') as string).replace(/\/$/, '') + '/daf/a';

type Ev = { type: string; t: number; path?: string; label?: string; value?: number; ref?: string; src?: string; device?: string };

let queue: Ev[] = [];
let started = false;
let lastPath = '';
let lastActive = Date.now();
const maxScroll = new Map<string, number>();
const sentScroll = new Map<string, number>();

const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

function sessionId(): string {
  return safe(() => {
    let s = sessionStorage.getItem('aSid');
    if (!s) { s = Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36); sessionStorage.setItem('aSid', s); }
    return s;
  }, 'nostore-' + Math.random().toString(36).slice(2, 10));
}

function source(): string {
  return safe(() => {
    const q = new URLSearchParams(location.search).get('src');
    if (q && /^[a-z0-9-]{1,24}$/i.test(q)) { sessionStorage.setItem('dafSrc', q.toLowerCase()); return q.toLowerCase(); }
    return sessionStorage.getItem('dafSrc') || '';
  }, '');
}

const device = () => (innerWidth < 768 ? 'phone' : innerWidth < 1024 ? 'tablet' : 'desktop');
const path = () => decodeURIComponent(location.pathname).slice(0, 120) || '/';

function push(e: Omit<Ev, 't'>) {
  queue.push({ ...e, t: Date.now() });
  if (queue.length >= 40) flush();
}

function flushScroll() {
  for (const [p, v] of maxScroll) if ((sentScroll.get(p) || 0) < v) { sentScroll.set(p, v); queue.push({ type: 'scroll', t: Date.now(), path: p, value: v }); }
}

export function flush(beacon = false) {
  flushScroll();
  if (!queue.length) return;
  const body = JSON.stringify({ sid: sessionId(), events: queue.splice(0, 60) });
  try {
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' })); return; }
    fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch { /* ignore */ }
}

function onRoute() {
  const p = path();
  if (p === lastPath) return;
  flushScroll();
  const first = !lastPath;
  lastPath = p;
  let ref = '';
  if (first) ref = safe(() => (document.referrer && new URL(document.referrer).host !== location.host ? new URL(document.referrer).host : ''), '');
  push({ type: 'view', path: p, ref, src: source(), device: device() });
}

function labelOf(el: Element): string {
  const a = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-track') || '';
  const text = a || (el.textContent || '');
  return text.replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** Record a named action (for things that aren't a plain button press). */
export function track(type: 'click' | 'open' | 'ask' | 'share' | 'tab', label: string, value?: number) {
  push({ type, path: path(), label: label.slice(0, 60), value });
}

export function startAnalytics() {
  if (started || typeof window === 'undefined') return;
  started = true;
  onRoute();
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: any[]) { const r = orig.apply(this, args as any); setTimeout(onRoute, 0); return r; } as any;
  }
  addEventListener('popstate', () => setTimeout(onRoute, 0));
  document.addEventListener('click', (e) => {
    lastActive = Date.now();
    const el = (e.target as Element | null)?.closest?.('button, a, [role="tab"], [role="button"], summary');
    if (!el) return;
    const label = labelOf(el);
    if (!label) return;
    const href = el.tagName === 'A' ? (el as HTMLAnchorElement).getAttribute('href') || '' : '';
    push({ type: 'click', path: path(), label: href && /^https?:/.test(href) && !href.includes(location.host) ? `↗ ${label}` : label });
  }, true);
  document.addEventListener('scroll', (e) => {
    lastActive = Date.now();
    const t = e.target as any;
    const el: HTMLElement = t === document || !t?.scrollHeight ? document.documentElement : t;
    if (el.scrollHeight < el.clientHeight + 200) return;
    const pct = Math.min(100, Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100));
    const p = path();
    if (pct > (maxScroll.get(p) || 0)) maxScroll.set(p, pct);
  }, { capture: true, passive: true });
  for (const ev of ['keydown', 'touchstart', 'mousemove']) addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true });
  // engaged time: 15s ticks while the tab is visible and someone touched it in the last minute
  setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - lastActive < 60000) push({ type: 'engage', path: path(), value: 15 }); }, 15000);
  setInterval(() => flush(), 10000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  addEventListener('pagehide', () => flush(true));
}
