import { MessageSquare, Mail, MessageCircle } from 'lucide-react';

const PHONE_DISPLAY = '908-309-2031';
const PHONE_TEL = '+19083092031';
const EMAIL_USER = 'abrahamserouya';
const EMAIL_HOST = ['gmail', 'com'].join('.');
const openEmail = () => { window.location.href = `mailto:${EMAIL_USER}@${EMAIL_HOST}`; };

export function ContactPage() {
  const card = 'group flex items-center gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900/80 transition-all active:scale-[0.99]';
  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Contact Us</p>
      <h2 className="text-3xl sm:text-4xl font-black text-slate-50 tracking-tight mb-3">We'd love to hear from you</h2>
      <p className="text-slate-400 leading-relaxed mb-8">
        Questions, corrections, suggestions for new sefarim, or interested in sponsoring? Reach out to Abraham Serouya directly.
      </p>

      <div className="flex flex-col gap-3">
        <a href={`sms:${PHONE_TEL}`} className={card}>
          <span className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-300 shrink-0"><MessageSquare className="w-6 h-6" /></span>
          <span className="min-w-0">
            <span className="block text-[11px] font-black uppercase tracking-wider text-slate-500">Text</span>
            <span className="block text-xl font-bold text-slate-50 group-hover:text-indigo-300 transition-colors">{PHONE_DISPLAY}</span>
          </span>
        </a>

        <a href={`https://wa.me/${PHONE_TEL.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className={card}>
          <span className="p-3 rounded-2xl bg-[#25D366]/15 text-[#25D366] shrink-0"><MessageCircle className="w-6 h-6" /></span>
          <span className="min-w-0">
            <span className="block text-[11px] font-black uppercase tracking-wider text-slate-500">WhatsApp</span>
            <span className="block text-xl font-bold text-slate-50 group-hover:text-indigo-300 transition-colors">Message {PHONE_DISPLAY}</span>
          </span>
        </a>

        <button type="button" onClick={openEmail} className={`${card} w-full text-left`}>
          <span className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-300 shrink-0"><Mail className="w-6 h-6" /></span>
          <span className="min-w-0">
            <span className="block text-[11px] font-black uppercase tracking-wider text-slate-500">Email</span>
            <span className="block text-xl font-bold text-slate-50 group-hover:text-indigo-300 transition-colors">Send us an email</span>
          </span>
        </button>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Prefer to talk? <a href={`tel:${PHONE_TEL}`} className="font-bold text-slate-300 hover:text-indigo-300 underline underline-offset-4">Call {PHONE_DISPLAY}</a>
      </p>
    </div>
  );
}
