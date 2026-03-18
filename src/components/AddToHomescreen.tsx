import { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';

export function AddToHomescreen() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already dismissed
    const hasDismissed = localStorage.getItem('pwaPromptDismissed');
    if (hasDismissed) return;

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show prompt for iOS after a short delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    } else {
      // Listen for Android/Chrome install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowPrompt(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwaPromptDismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      // iOS doesn't have a programmatic install, so they just read the instructions
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-5 z-[200] animate-in slide-in-from-bottom-8 fade-in duration-500">
      <button 
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex gap-4 items-start pr-6">
        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <img src="/favicon.ico" alt="App Icon" className="w-8 h-8 rounded-lg object-cover" onError={(e) => {
            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234f46e5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'/%3E%3C/svg%3E";
          }} />
        </div>
        
        <div className="flex-1">
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight mb-1">Install AI Sefarim</h4>
          
          {isIOS ? (
            <div className="text-xs text-slate-500 font-medium leading-relaxed">
              Install this app on your iPhone: tap <Share className="inline w-3 h-3 mx-1" /> and then <strong>Add to Home Screen</strong> <PlusSquare className="inline w-3 h-3 mx-1" />.
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-medium leading-relaxed mb-3">
              Add to your home screen for a faster, full-screen reading experience.
            </div>
          )}

          {!isIOS && (
            <button 
              onClick={handleInstallClick}
              className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-md"
            >
              Add to Home Screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
