// Super Mishnah: the worker endpoints and URL <-> ref mapping.
export const MISHNAH_API =
  ((import.meta as any).env?.VITE_CHAT_WORKER_URL || 'https://aisefarim-chat.abrahamserouya.workers.dev') + '/mishnah';

// "Mishnah Berakhot 1" -> "/mishnah/Berakhot/1"; "Pirkei Avot 2" -> "/mishnah/Avot/2"
export function mishnahPath(ref: string): string {
  const m = ref.trim().match(/^(?:Mishnah |Pirkei )?(.+?)\s+(\d+)$/);
  return m ? `/mishnah/${encodeURIComponent(m[1].replace(/ /g, '_'))}/${m[2]}` : '/mishnah';
}

// "/mishnah/Berakhot/1" -> "Mishnah Berakhot 1"
export function refFromMishnahPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'mishnah' || !parts[1] || !parts[2]) return null;
  const t = decodeURIComponent(parts[1]).replace(/_/g, ' ');
  return /^avot$/i.test(t) ? `Pirkei Avot ${parts[2]}` : `Mishnah ${t} ${parts[2]}`;
}
