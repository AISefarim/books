// Super Tanach: the worker endpoints and URL <-> ref mapping.
export const TANACH_API =
  ((import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev') + '/tanach';

// "Genesis 12" -> "/tanach/Genesis/12"; "I Samuel 3" -> "/tanach/I_Samuel/3"
export function tanachPath(ref: string): string {
  const m = ref.trim().match(/^(.+?)\s+(\d+)$/);
  return m ? `/tanach/${encodeURIComponent(m[1].replace(/ /g, '_'))}/${m[2]}` : '/tanach';
}

// "/tanach/Genesis/12" -> "Genesis 12"
export function refFromTanachPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'tanach' || !parts[1] || !parts[2]) return null;
  return `${decodeURIComponent(parts[1]).replace(/_/g, ' ')} ${parts[2]}`;
}
