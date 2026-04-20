import { BookOpen, Video, Library, MessageCircle } from 'lucide-react';

interface NavbarProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onHome: () => void;
  logoUrl?: string;
  activeTab: 'sefarim' | 'videos';
  onTabChange: (tab: 'sefarim' | 'videos') => void;
  whatsappUrl?: string;
}

export function Navbar({ isAdmin, onToggleAdmin, onHome, logoUrl, activeTab, onTabChange, whatsappUrl }: NavbarProps) {
  return (
    <nav className="bg-white/85 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Logo Section */}
        <div 
          className="flex items-center gap-3 cursor-pointer group self-start md:self-auto"
          onClick={() => {
            onHome();
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Site Logo" className="w-10 h-10 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
          ) : (
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter group-hover:text-indigo-600 transition-colors leading-tight">AI SEFARIM</h1>
            <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest leading-tight">Digital ספריה</p>
          </div>
        </div>

        {/* Global Navigation - Center */}
        <div className="bg-slate-100/80 backdrop-blur p-1 rounded-full flex self-stretch md:self-auto shadow-inner border border-slate-200 w-full md:w-auto">
          <button
            onClick={() => {
              onTabChange('sefarim');
              onHome();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'sefarim' 
                ? 'bg-white text-indigo-900 shadow-[0_2px_10px_-3px_rgba(6,181,227,0.3)] ring-1 ring-slate-200/50 scale-[1.02]' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95'
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
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'videos' 
                ? 'bg-white text-indigo-900 shadow-[0_2px_10px_-3px_rgba(6,181,227,0.3)] ring-1 ring-slate-200/50 scale-[1.02]' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95'
            }`}
          >
            <Video className="w-4 h-4" />
            Videos
          </button>
        </div>

        {/* Action Buttons Section */}
        <div className="hidden md:flex items-center gap-3">
          {whatsappUrl && (
            <div className="relative group">
              <div className="absolute inset-0 bg-[#25D366] rounded-xl animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative px-5 py-2.5 bg-[#25D366] text-white hover:bg-[#1fa14b] rounded-xl font-bold transition-all text-sm flex items-center gap-2 shadow-lg shadow-[#25D366]/30 hover:shadow-[#25D366]/50 hover:-translate-y-0.5 active:scale-95 uppercase tracking-wide border border-white/20"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                Join WhatsApp
              </a>
            </div>
          )}
          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className="px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all text-sm border border-rose-200 shadow-sm relative z-10"
            >
              Logout
            </button>
          )}
        </div>
        
        {/* Mobile quick actions */}
        <div className="md:hidden absolute top-3 right-4 flex items-center gap-2">
          {whatsappUrl && (
            <div className="relative pt-[2px]">
              <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative px-3 py-1.5 bg-[#25D366] text-white rounded-full font-black transition-all text-[10px] sm:text-xs flex items-center gap-1 shadow-md shadow-[#25D366]/40 uppercase tracking-widest active:scale-95 border border-white/20"
              >
                <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                WhatsApp
              </a>
            </div>
          )}
          {isAdmin && (
             <button onClick={onToggleAdmin} className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-full border border-rose-100 relative z-10">
               Logout
             </button>
          )}
        </div>
      </div>
    </nav>
  );
}
