import { BookOpen, Headphones, ScrollText, Sparkles, ShieldCheck, Mail } from 'lucide-react';

const sections = [
  {
    icon: BookOpen,
    title: 'Sefarim',
    body: 'A free, growing library of sefarim you can read online, many of them generated with AI. Physical copies, where offered, are printed and sold strictly at cost.',
  },
  {
    icon: Headphones,
    title: 'Shiurim',
    body: 'Daily audio shiurim: Daf Yomi, Rambam, Zohar, Tanach, Etz Chaim, Pardes Rimonim, Shaar HaKavanot and more, ready to listen to and share.',
  },
  {
    icon: ScrollText,
    title: 'Super Daf',
    body: 'A free daf reader that brings Rashi, Tosafot, notes, Rambam and halachah together, sugya by sugya.',
  },
  {
    icon: Sparkles,
    title: 'Super Agent',
    body: 'A free assistant that answers your questions from the sefarim in our library and shows you the sources. For practical halachah it keeps Sephardic and Ashkenazi practice separate.',
  },
];

export function AboutPage({ onContact }: { onContact: () => void }) {
  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">About Us</p>
      <h2 className="text-3xl sm:text-4xl font-black text-slate-50 tracking-tight mb-4">Torah learning, free and easy to reach</h2>
      <p className="text-slate-300 leading-relaxed mb-3">
        AI Sefarim is a free home for Torah learning, with sefarim, daily shiurim and learning tools in one place, built with a Sephardic outlook.
      </p>
      <p className="text-slate-300 leading-relaxed mb-3">
        It is all produced by one layman, Abraham Serouya, as a hobby. The goal is extremely high quality, accessible Torah, <span className="font-black text-slate-50">always free</span>.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-8">
        {sections.map(({ icon: Icon, title, body }) => (
          <div key={title} className="p-5 rounded-3xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-300 shrink-0"><Icon className="w-5 h-5" /></span>
              <h3 className="font-black text-slate-50 text-lg">{title}</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 rounded-3xl bg-amber-500/5 border border-amber-500/30">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0" />
          <h3 className="font-black text-amber-200">Please note</h3>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          Our sefarim, shiurim and Super Agent answers are produced with AI and have not been vetted by rabbinic authorities. They are meant to support your learning, not replace a rav. For a practical halachic question, please ask your own rabbi.
        </p>
      </div>

      <h3 className="mt-10 mb-2 text-lg font-black text-slate-50">Sources and credits</h3>
      <p className="text-sm text-slate-400 leading-relaxed">
        Many source texts come from <a className="text-indigo-300 hover:text-indigo-200 underline underline-offset-4" href="https://www.sefaria.org" target="_blank" rel="noopener noreferrer">Sefaria</a> and its contributors. The works of Rabbi Jonathan Sacks are used courtesy of Maggid Books and the Orthodox Union via Sefaria (CC-BY-NC).
      </p>

      <h3 className="mt-8 mb-2 text-lg font-black text-slate-50">Your privacy</h3>
      <p className="text-sm text-slate-400 leading-relaxed">
        Questions you ask Super Agent are saved without your name, only the question text, for up to 90 days, so we can improve it. Your saved sefarim and learning progress stay on your device unless you choose to sign in with Google to sync them.
      </p>

      <button
        type="button"
        onClick={onContact}
        className="mt-10 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-wider transition-all active:scale-95"
      >
        <Mail className="w-4 h-4" /> Contact Us
      </button>
    </div>
  );
}
