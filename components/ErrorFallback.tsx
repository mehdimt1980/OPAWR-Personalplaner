
import React from 'react';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
            <AlertTriangle size={32} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Ein Fehler ist aufgetreten</h2>
          <p className="text-slate-600 text-sm max-w-xs mx-auto">
            Die Anwendung hat ein unerwartetes Problem festgestellt. Unser Technik-Team wurde automatisch benachrichtigt.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <XCircle size={14} /> Technische Details
            </div>
            <pre className="text-xs font-mono text-red-600 whitespace-pre-wrap break-words bg-white p-2 rounded border border-slate-100">
              {error.message}
            </pre>
          </div>

          <button
            onClick={resetErrorBoundary}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <RefreshCw size={20} />
            Anwendung neu laden
          </button>
        </div>
      </div>
    </div>
  );
};
