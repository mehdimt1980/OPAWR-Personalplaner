
import React from 'react';
import { Play, Download, Upload, Trash2 } from 'lucide-react';

interface BackupSettingsProps {
    onSeed: () => void;
    onDownload: () => void;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({ onSeed, onDownload, onUpload, onClear }) => {
    return (
        <div className="space-y-4 max-w-xl mx-auto">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <Play size={16} /> Initialisierung
                </h4>
                <p className="text-xs text-blue-700 mb-3">
                    Reset auf Standard-Werte (Seed Data). Dies überschreibt existierende Einstellungen und Personal.
                </p>
                <button onClick={onSeed} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm transition-colors">
                    Standard-Daten laden
                </button>
            </div>

            <button onClick={onDownload} className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition shadow-sm group">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2 rounded text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Download size={18} /></div>
                    <div className="text-left"><span className="block text-sm font-bold">Backup herunterladen</span></div>
                </div>
            </button>

            <div className="relative">
                <input type="file" accept=".json" onChange={onUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition shadow-sm group">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-50 p-2 rounded text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors"><Upload size={18} /></div>
                        <div className="text-left"><span className="block text-sm font-bold">Backup wiederherstellen</span></div>
                    </div>
                </div>
            </div>

            <button onClick={onClear} className="w-full flex items-center justify-between px-4 py-3 bg-white border border-red-100 rounded-lg hover:bg-red-50 hover:border-red-300 transition mt-8 group">
                <div className="flex items-center gap-3">
                    <div className="bg-red-50 p-2 rounded text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors"><Trash2 size={18} /></div>
                    <div className="text-left"><span className="block text-sm font-bold text-red-700">Datenbank leeren</span></div>
                </div>
            </button>
        </div>
    );
};
