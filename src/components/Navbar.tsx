import { BookOpen, Video, Library } from 'lucide-react';

interface NavbarProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onHome: () => void;
  logoUrl?: string;
  activeTab: 'sefarim' | 'videos';
  onTabChange: (tab: 'sefarim' | 'videos') => void;
}

export function Navbar({ isAdmin, onToggleAdmin, onHome, logoUrl, activeTab, onTabChange }: NavbarProps) {
  return (
    <nav className="bg-white/80 backdrop-blur-md border-b sticky top-[52px] z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Logo Section */}
        <div 
          className="flex items-center gap-4 cursor-pointer group self-start md:self-auto"
          onClick={() => {
            onHome();
          }}
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

        {/* Global Navigation - Center */}
        <div className="bg-slate-100/80 backdrop-blur p-1 rounded-full flex self-stretch md:self-auto shadow-inner border border-slate-200">
          <button
            onClick={() => {
              onTabChange('sefarim');
              onHome();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'sefarim' 
                ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            <Library className="w-4 h-4" />
            Sefarim
          </button>
          <button
            onClick={() => {
              onTabChange('videos');
              onHome();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'videos' 
                ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            <Video className="w-4 h-4" />
            Videos
          </button>
        </div>

        {/* Admin Section */}
        <button
          onClick={onToggleAdmin}
          className="hidden md:block px-5 py-2.5 bg-slate-50 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all text-sm border border-slate-200"
        >
          {isAdmin ? 'Logout Admin' : 'Admin Login'}
        </button>
        
        {/* Mobile quick admin toggle (hidden visually but clickable for admin) */}
        {!isAdmin && (
           <div className="md:hidden absolute top-4 right-4 w-12 h-12 rounded-full opacity-0 cursor-pointer" onClick={onToggleAdmin}></div>
        )}
        {isAdmin && (
           <button onClick={onToggleAdmin} className="md:hidden absolute top-4 right-4 text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
             Log Out
           </button>
        )}
      </div>
    </nav>
  );
}
