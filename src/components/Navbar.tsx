import { BookOpen } from 'lucide-react';

interface NavbarProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onHome: () => void;
  logoUrl?: string;
}

export function Navbar({ isAdmin, onToggleAdmin, onHome, logoUrl }: NavbarProps) {
  return (
    <nav className="bg-white/80 backdrop-blur-md border-b px-6 py-4 sticky top-[52px] z-40">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div 
          className="flex items-center gap-4 cursor-pointer group"
          onClick={onHome}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Site Logo" className="w-12 h-12 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
          ) : (
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter group-hover:text-indigo-600 transition-colors">AI SEFARIM</h1>
            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Digital ספריה</p>
          </div>
        </div>
        <button
          onClick={onToggleAdmin}
          className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm border border-slate-200"
        >
          {isAdmin ? 'Logout Admin' : 'Admin Login'}
        </button>
      </div>
    </nav>
  );
}
