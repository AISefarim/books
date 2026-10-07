import type { CSSProperties, ReactNode } from 'react';
import { sefariaUrl, superDafSpot, goToSpot } from '../lib/daf';

// Text written for Super Daf: [refs] become small citation chips, **phrase**
// marks a note's key phrase, and Ashkenazi spellings read the Sephardi way.
// Styles: .sd-cite and .sd-key, set by the page that uses it.

const SEPHARDI: [RegExp, string][] = [
  [/\bmachlokes\b/g, 'machloket'], [/\bMachlokes\b/g, 'Machloket'], [/\bmachlokesim\b/gi, 'machlokot'],
  [/\bShabbos\b/g, 'Shabbat'], [/\bshabbos\b/g, 'Shabbat'], [/\bsafeik\b/g, 'safek'], [/\bSafeik\b/g, 'Safek'],
  [/\bbeis din\b/gi, 'bet din'], [/\bmitzvos\b/g, 'mitzvot'], [/\bTosfos\b/g, 'Tosafot'],
];
export const sephardi = (s: string) => SEPHARDI.reduce((t, [re, to]) => t.replace(re, to), s);
export const plain = (s?: string) => sephardi(String(s || '').replace(/\*\*/g, '').replace(/\*([^*\n]+)\*/g, '$1'));

// "[Rashi on Bekhorot 17a:3:1, Kessef Mishneh on Mishneh Torah, Firstlings 5:1:2]"
// -> separate chips with short names.
export function shortRef(r: string) {
  let m;
  if ((m = r.match(/^(.+?) on Mishneh Torah, [^\d]*?(\d[\d:]*)$/))) return `${m[1]} ${m[2]}`;
  if ((m = r.match(/^Mishneh Torah, (.+)$/))) return `Rambam, ${m[1]}`;
  if ((m = r.match(/^(.+?) on [A-Z][A-Za-z' ]+? (\d+[ab]?[\d:]*)$/))) return `${m[1]} ${m[2]}`;
  if ((m = r.match(/^(.+?) on [^\d]+? (\d+[ab]?(?::\d+)+)$/))) return `${m[1]} ${m[2]}`; // "X on Torah, Leviticus 27:32:1"
  if ((m = r.match(/^[A-Z][A-Za-z' ]+? (\d+[ab]:[\d:]+(?:-[\dab:]+)?)$/))) return `Gemara ${m[1]}`;
  return r;
}
function splitRefs(inner: string): string[] {
  // a ref ends in a number ("5:1", "17a:3"); split after it at a comma or semicolon
  return inner.split(/(?<=\d[ab]?)\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean);
}
// Hebrew inside English text, set in the Hebrew font and isolated so its
// punctuation doesn't jump around.
const HE_FONT = "'Frank Ruhl Libre', 'David Libre', 'Noto Serif Hebrew', serif";
const HE_RUN = /[\u05D0-\u05EA]/;
function HebrewRuns({ text }: { text: string }) {
  if (!HE_RUN.test(text)) return <>{text}</>;
  const bits = text.split(/([\u0590-\u05FF](?:[\u0590-\u05FF\s״׳"'־-]*[\u0590-\u05FF״׳])?)/g);
  return <>{bits.map((b, i) => (i % 2 ? <bdi key={i} lang="he" dir="rtl" style={{ fontFamily: HE_FONT, fontSize: '1.07em' }}>{b}</bdi> : b))}</>;
}

// A citation: to its place in Super Daf when there is one, else to Sefaria.
export function CiteLink({ r, className, style, children }: { r: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const spot = superDafSpot(r);
  if (spot) return <a href={spot.path} className={className} style={style} title={`${r} - open in Super Daf`} onClick={(e) => goToSpot(e, spot)}>{children}</a>;
  return <a href={sefariaUrl(r)} target="_blank" rel="noopener noreferrer" className={className} style={style} title={`${r} - on Sefaria`} onClick={(e) => e.stopPropagation()}>{children}</a>;
}

export function RefText({ text, className }: { text: string; className?: string }) {
  const keys = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  if (keys.length > 1) return <span className={className}>{keys.map((k, i) => /^\*\*[^*]+\*\*$/.test(k) ? <strong key={i} className="sd-key"><RefText text={k.slice(2, -2)} /></strong> : <RefText key={i} text={k} />)}</span>;
  // *term* is italic (Hebrew stays upright - italic Hebrew reads badly)
  const ems = String(text || '').split(/(\*[^*\n]+\*)/g);
  if (ems.length > 1) return <span className={className}>{ems.map((k, i) => /^\*[^*\n]+\*$/.test(k) ? (HE_RUN.test(k) ? <RefText key={i} text={k.slice(1, -1)} /> : <em key={i}><RefText text={k.slice(1, -1)} /></em>) : <RefText key={i} text={k} />)}</span>;
  const parts = String(text || '').split(/(\[[^\[\]]{3,500}\])/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]$/);
        if (m && /\d/.test(m[1])) {
          const refs = splitRefs(m[1]).filter((r) => /\d/.test(r));
          return (
            <span key={i} className="whitespace-nowrap">
              {refs.map((r, k) => <CiteLink key={k} r={r} className="sd-cite">{shortRef(r)}</CiteLink>)}
            </span>
          );
        }
        return <span key={i}><HebrewRuns text={sephardi(p)} /></span>;
      })}
    </span>
  );
}
