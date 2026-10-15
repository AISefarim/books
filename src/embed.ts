// "Embed mode": the Bnei Yitzhak synagogue app shows Super Agent in an iframe
// at /chat?src=bneiyitzhak. In that mode the page must carry no AI Sefarim
// branding at all. The flag is remembered in sessionStorage so in-frame
// navigation (which may drop the query string) keeps it.
const EMBED_KEY = 'embed_src';

let cached: boolean | null = null;

export function isBneiYitzhakEmbed(): boolean {
  if (cached !== null) return cached;
  let embed = false;
  try {
    embed = new URLSearchParams(window.location.search).get('src') === 'bneiyitzhak';
  } catch {
    embed = false;
  }
  try {
    if (embed) sessionStorage.setItem(EMBED_KEY, 'bneiyitzhak');
    else embed = sessionStorage.getItem(EMBED_KEY) === 'bneiyitzhak';
  } catch {
    // storage unavailable (private mode, blocked third-party storage in an iframe)
  }
  cached = embed;
  return embed;
}

export const EMBED_SHARE_NAME = 'Super Agent · Bnei Yitzhak';
export const EMBED_SHARE_URL = 'https://bneiyitzhak.com/super-agent';
