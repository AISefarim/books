import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface LoginModalProps {
  onLogin: (password: string) => void;
  onClose: () => void;
}

export function LoginModal({ onLogin, onClose }: LoginModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1234') {
      onLogin(password);
    } else {
      setError('Wrong Master Key!');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      <form onSubmit={handleSubmit} className="relative bg-white w-full max-w-sm p-10 rounded-[3rem] shadow-2xl border border-white">
        <div className="bg-indigo-50 w-14 h-14 rounded-[1.25rem] flex items-center justify-center text-indigo-600 mb-8 shadow-inner">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-black mb-2 uppercase italic tracking-tighter text-slate-900">Access Portal</h2>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-10">Admin Authorization Required</p>
        {error && <p className="text-rose-500 text-sm font-bold mb-4 text-center">{error}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-6 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none text-center font-black tracking-[1em] mb-4 shadow-inner"
          placeholder="••••"
          autoFocus
        />
        <button
          type="submit"
          className="w-full bg-slate-900 text-white p-6 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-indigo-600 shadow-xl transition-all active:scale-95"
        >
          Verify Key
        </button>
      </form>
    </div>
  );
}
