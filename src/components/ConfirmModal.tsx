import React from 'react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onCancel}></div>
      <div className="relative bg-white w-full max-w-sm p-8 rounded-[2rem] shadow-2xl border border-white text-center">
        <h3 className="text-xl font-black mb-4 text-slate-900">Confirm Action</h3>
        <p className="text-slate-600 mb-8 font-medium">{message}</p>
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-700 p-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-rose-600 text-white p-4 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
