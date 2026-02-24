// @ts-nocheck

import React from 'react';
import { Download, Upload, Users, CalendarDays } from 'lucide-react';

interface ImportExportTabProps {
    onDownloadStaffTemplate: () => void;
    onDownloadShiftTemplate: () => void;
    onStaffImportClick: () => void;
    onShiftImportClick: () => void;
}

export const ImportExportTab: React.FC<ImportExportTabProps> = ({
    onDownloadStaffTemplate, onDownloadShiftTemplate, onStaffImportClick, onShiftImportClick
}) => {
    return (
        <div className="h-full max-w-3xl mx-auto w-full space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 text-center shadow-sm flex flex-col">
                    <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full mx-auto mb-4 flex items-center justify-center"><Users size={24} /></div>
                    <h3 className="font-bold text-slate-900 mb-2">Mitarbeiter-Stammdaten</h3>
                    <div className="space-y-2 mt-auto">
                        <button onClick={onDownloadStaffTemplate} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"><Download size={16} /> Vorlage</button>
                        <button onClick={onStaffImportClick} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium"><Upload size={16} /> Importieren</button>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-purple-200 text-center shadow-sm flex flex-col">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center"><CalendarDays size={24} /></div>
                    <h3 className="font-bold text-slate-900 mb-2">Dienstplan (Woche)</h3>
                    <div className="space-y-2 mt-auto">
                        <button onClick={onDownloadShiftTemplate} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"><Download size={16} /> Vorlage</button>
                        <button onClick={onShiftImportClick} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"><Upload size={16} /> Importieren</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


