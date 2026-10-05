import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { BookOpen, Video, Headphones, ScrollText, ArrowRight } from 'lucide-react';
import { db } from '../lib/firebase';

// /join - the landing page for "join our WhatsApp community" ads. Standalone
// (no library download) so it opens instantly from an ad. The invite link is
// the same one the site uses, editable in the admin site settings.

const FALLBACK_URL = 'https://chat.whatsapp.com/DHPBDYcQ2J6KIYvJbLMrvr';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.49-8.41" /></svg>
);

export default function JoinPage() {
  const [url, setUrl] = useState(FALLBACK_URL);

  useEffect(() => {
    document.title = 'Join AI Sefarim on WhatsApp';
    getDoc(doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_'))
      .then((s) => { const u = s.exists() ? (s.data() as any).bannerUrl : null; if (typeof u === 'string' && u.startsWith('https://')) setUrl(u); })
      .catch(() => {});
  }, []);

  const perks = [
    { icon: BookOpen, title: 'New sefarim', text: 'The Zohar, the Arizal, Chassidut and Tanach, free to read and download.' },
    { icon: Video, title: 'Daily video shiurim', text: 'Short, clear shiurim on the daf, Tanach, the Rambam, the parasha and the Zohar.' },
    { icon: Headphones, title: 'Podcast episodes', text: 'Listen on the go, wherever you are.' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#0C1022] text-slate-100 px-5 py-10 sm:py-16">
      <div className="max-w-xl mx-auto">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">AI Sefarim</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">Torah learning, straight to your WhatsApp.</h1>
        <p className="mt-4 text-lg text-slate-300 leading-relaxed">Join the free AI Sefarim WhatsApp community and get new sefarim, daily video shiurim and podcast episodes as soon as they're out.</p>

        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 text-lg font-black shadow-[0_20px_50px_-20px_rgba(16,185,129,0.7)]">
          <WhatsAppIcon className="w-6 h-6" /> Join on WhatsApp
        </a>
        <p className="mt-2 text-center text-sm text-slate-400">Completely free. Leave anytime.</p>

        <div className="mt-10 space-y-3">
          {perks.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <span className="shrink-0 w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5 text-white" /></span>
              <div>
                <p className="font-black">{title}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <a href="/daf" className="mt-6 flex items-center gap-4 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 hover:bg-indigo-500/15 p-4">
          <span className="shrink-0 w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center"><ScrollText className="w-5 h-5 text-white" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-black">Learning Daf Yomi?</p>
            <p className="text-sm text-slate-400 leading-relaxed">Super Daf explains today's daf sugya by sugya, with Rashi, Tosafot, the Rambam and halacha.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-300 shrink-0" />
        </a>

        <p className="mt-10 text-center text-sm text-slate-500"><a href="/" className="font-bold text-slate-300 hover:text-white">aisefarim.com</a> · Free Torah learning for everyone</p>
      </div>
    </div>
  );
}
