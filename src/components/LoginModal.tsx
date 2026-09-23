import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Loader2, X } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LoginModalProps {
  onLogin: () => void;
  onClose: () => void;
}

export function LoginModal({ onLogin, onClose }: LoginModalProps) {
  const [error, setError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setIsSigningIn(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const email = result.user?.email?.toLowerCase();

      if (email === 'abrahamserouya@gmail.com') {
        onLogin();
      } else {
        setError(`Access Denied: "${result.user?.email || 'Unknown account'}" is not authorized. Only abrahamserouya@gmail.com has administrative access.`);
        // Sign out unauthorized user and restore anonymous visitor state
        await signOut(auth);
        await signInAnonymously(auth);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Google Sign-In Error:', err);
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-slate-900 w-full max-w-md p-8 sm:p-10 rounded-[2.5rem] shadow-2xl border border-slate-700/80 text-center animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-indigo-500/10 border border-indigo-500/30 w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto mb-6 shadow-inner">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black mb-2 uppercase italic tracking-tighter text-slate-50">
          Admin Authorization
        </h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">
          Restricted Management Portal
        </p>

        <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
          Administrative access requires signing in with Google. Access is restricted to <span className="text-indigo-400 font-mono font-bold">abrahamserouya@gmail.com</span>.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-start gap-2.5 text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="w-full bg-white hover:bg-slate-100 text-slate-900 p-4 sm:p-4.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {isSigningIn ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
              <span>Verifying Identity...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-400 mt-6">
          Regular visitors remain anonymous and do not need to sign in.
        </p>
      </div>
    </div>
  );
}
