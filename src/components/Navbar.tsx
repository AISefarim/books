import { BookOpen, Video, Library, MessageCircle, Headphones, Share2 } from 'lucide-react';

interface NavbarProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onHome: () => void;
  logoUrl?: string;
  activeTab: 'sefarim' | 'videos' | 'podcasts' | 'library' | 'audio';
  onTabChange: (tab: 'sefarim' | 'videos' | 'podcasts' | 'library' | 'audio') => void;
  whatsappUrl?: string;
  totalBooks?: number;
  totalVideos?: number;
  totalPodcasts?: number;
  onOpenWhatsAppShare?: () => void;
}

export function Navbar({ isAdmin, onToggleAdmin, onHome, logoUrl, activeTab, onTabChange, whatsappUrl, totalBooks = 0, totalVideos = 0, totalPodcasts = 0, onOpenWhatsAppShare }: NavbarProps) {
  return (
    <nav className="bg-slate-900/85 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
        {/* Logo Section */}
        <div 
          className="flex items-center gap-3 cursor-pointer group self-start md:self-auto pr-24 md:pr-0 shrink-0"
          onClick={() => {
            onHome();
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Site Logo" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
          ) : (
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-50 tracking-tighter group-hover:text-indigo-400 transition-colors leading-tight">AI SEFARIM</h1>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-700 pr-1.5 sm:pr-2">
                <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
                {totalBooks.toLocaleString()} <span className="hidden sm:inline">Sefarim</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-700 pr-1.5 sm:pr-2">
                <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
                {totalVideos.toLocaleString()} <span className="hidden sm:inline">Videos</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
                {totalPodcasts.toLocaleString()} <span className="hidden sm:inline">Podcasts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Navigation - Center */}
        <div className="bg-slate-800/80 backdrop-blur p-1 rounded-full flex self-stretch md:self-auto shadow-inner border border-slate-700 overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => {
              onTabChange('sefarim');
              onHome();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 sm:px-4 md:px-5 lg:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'sefarim' 
                ? 'bg-indigo-600 text-white shadow-[0_2px_12px_-2px_rgba(99,102,241,0.5)] ring-1 ring-indigo-400/40 scale-[1.02]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 scale-95'
            }`}
          >
            <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            Sefarim
          </button>
          <button
            onClick={() => {
              onTabChange('videos');
              onHome();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 sm:px-4 md:px-5 lg:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'videos' 
                ? 'bg-indigo-600 text-white shadow-[0_2px_12px_-2px_rgba(99,102,241,0.5)] ring-1 ring-indigo-400/40 scale-[1.02]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 scale-95'
            }`}
          >
            <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            Videos
          </button>
          <button
            onClick={() => {
              onTabChange('podcasts');
              onHome();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 sm:px-4 md:px-5 lg:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'podcasts' || activeTab === 'audio'
                ? 'bg-indigo-600 text-white shadow-[0_2px_12px_-2px_rgba(99,102,241,0.5)] ring-1 ring-indigo-400/40 scale-[1.02]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 scale-95'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            Podcasts
          </button>
        </div>

        {/* Action Buttons Section */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {whatsappUrl && (
            <>
              <div className="relative group">
                <div className="absolute inset-0 bg-[#25D366] rounded-xl animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative px-4 py-2 bg-[#25D366] text-white hover:bg-[#1fa14b] rounded-xl font-bold transition-all text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#25D366]/30 hover:shadow-[#25D366]/50 hover:-translate-y-0.5 active:scale-95 uppercase tracking-wide border border-white/20"
                >
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  Join WhatsApp
                </a>
              </div>

              {onOpenWhatsAppShare && (
                <button
                  type="button"
                  onClick={onOpenWhatsAppShare}
                  className="px-3.5 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl font-bold transition-all text-xs sm:text-sm flex items-center gap-1.5 border border-emerald-500/30 hover:border-emerald-500/50 hover:-translate-y-0.5 active:scale-95 uppercase tracking-wide"
                  title="Share WhatsApp Community with friends"
                >
                  <Share2 className="w-4 h-4" />
                  Invite Friends
                </button>
              )}
            </>
          )}
          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className="px-3.5 py-2 bg-rose-500/10 text-rose-400 rounded-xl font-bold hover:bg-rose-500/20 transition-all text-xs sm:text-sm border border-rose-500/30 shadow-sm relative z-10"
            >
              Logout
            </button>
          )}
        </div>
        
        {/* Mobile quick actions */}
        <div className="md:hidden absolute top-3 right-4 flex items-center gap-1.5">
          {whatsappUrl && (
            <>
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

              {onOpenWhatsAppShare && (
                <button
                  type="button"
                  onClick={onOpenWhatsAppShare}
                  className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-full border border-emerald-500/30 active:scale-95"
                  title="Share WhatsApp Group with friends"
                  aria-label="Invite friends to WhatsApp group"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          {isAdmin && (
             <button onClick={onToggleAdmin} className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-full border border-rose-500/30 relative z-10">
               Logout
             </button>
          )}
        </div>
      </div>
    </nav>
  );
}
