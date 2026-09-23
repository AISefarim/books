import React from 'react';
import { X, Cloud, Check, BookOpen, Smartphone, Laptop, LogOut } from 'lucide-react';
import { User } from 'firebase/auth';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  savedBooksCount: number;
  savedVideosCount: number;
}

export function SyncModal({
  isOpen,
  onClose,
  currentUser,
  onGoogleSignIn,
  onSignOut,
  savedBooksCount,
  savedVideosCount
}: SyncModalProps) {
  if (!isOpen) return null;

  const isGoogleUser = currentUser && !currentUser.isAnonymous;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5">
          <Cloud className="w-6 h-6" />
        </div>

        {isGoogleUser ? (
          <div>
            <h3 className="text-xl font-black text-white tracking-tight mb-1">
              Account Synced
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Your saved library and reading progress are actively synchronized to your Google account.
            </p>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800/80">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-10 h-10 rounded-full object-cover border border-indigo-500/30"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="text-sm font-bold text-white truncate">
                    {currentUser.displayName || 'Google User'}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="block text-base font-black text-indigo-400">{savedBooksCount}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Saved Sefarim</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="block text-base font-black text-emerald-400">{savedVideosCount}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Saved Media</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors text-center"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
                className="py-3 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-black text-white tracking-tight mb-1">
              Sync Across Devices
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Optionally sign in with Google so your library and reading position stay with you wherever you go.
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300">
                <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 mt-0.5 shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-white block font-bold">Saved Library Everywhere</strong>
                  Access all your bookmarked Sefarim, shiurim, and podcasts on any device.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300">
                <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-white block font-bold">Resume Reading Anywhere</strong>
                  Your exact EPUB page position syncs between your phone and laptop seamlessly.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300">
                <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5 shrink-0">
                  <Laptop className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-white block font-bold">Reader Preferences</strong>
                  Your preferred text size and reading theme (light, sepia, dark) are remembered.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onGoogleSignIn();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs uppercase tracking-wider transition-all shadow-xl active:scale-[0.98] mb-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign In with Google
            </button>

            <p className="text-[11px] text-center text-slate-500 font-medium">
              100% optional. You can continue reading freely without signing in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
