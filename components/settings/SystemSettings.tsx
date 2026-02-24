// @ts-nocheck

import React from 'react';
import { TimelineConfig, CsvMappingConfig } from '../../types';
import { Activity, Hash, Plus, X, Save } from 'lucide-react';

interface SystemSettingsProps {
    timeline: TimelineConfig;
    csvMapping: CsvMappingConfig;
    onTimelineChange: (field: 'startHour' | 'endHour', value: string) => void;
    onAddCsvKeyword: (cat: keyof CsvMappingConfig, word: string) => void;
    onRemoveCsvKeyword: (cat: keyof CsvMappingConfig, word: string) => void;
    onSave: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ 
    timeline, csvMapping, onTimelineChange, onAddCsvKeyword, onRemoveCsvKeyword, onSave 
}) => {
    return (
        <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2"><Activity size={16} /> Zeitleiste (Stunden)</h4>
                <div className="flex items-center gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Startzeit</label>
                        <input type="number" value={timeline.startHour} onChange={e => onTimelineChange('startHour', e.target.value)} className="w-16 border rounded px-2 py-1 text-sm font-mono text-center" min="0" max="23" />
                    </div>
                    <div className="h-px w-8 bg-slate-300 mt-5"></div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endzeit</label>
                        <input type="number" value={timeline.endHour} onChange={e => onTimelineChange('endHour', e.target.value)} className="w-16 border rounded px-2 py-1 text-sm font-mono text-center" min="0" max="23" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800 border-b pb-1 flex items-center gap-2"><Hash size={16} /> CSV Spalten-Erkennung</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: 'date', label: 'Datum' },
                        { key: 'time', label: 'Startzeit' },
                        { key: 'endTime', label: 'Endzeit' },
                        { key: 'room', label: 'Saal' },
                        { key: 'dept', label: 'Fachabteilung' },
                        { key: 'procedure', label: 'Eingriff' }
                    ].map(({ key, label }) => (
                        <div key={key} className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">{label}</div>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(csvMapping[key as keyof CsvMappingConfig] || []).map((k: string) => (
                                    <div key={k} className="bg-slate-100 px-2 py-1 rounded text-xs font-mono flex items-center gap-1 border border-slate-200">
                                        {k}
                                        <button onClick={() => onRemoveCsvKeyword(key as any, k)} className="text-slate-400 hover:text-red-500"><X size={10} /></button>
                                    </div>
                                ))}
                            </div>
                            <input type="text" className="w-full border rounded px-2 py-1 text-xs" placeholder="Hinzufügen..." onKeyDown={e => { if(e.key === 'Enter') { onAddCsvKeyword(key as any, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
                <button onClick={onSave} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"><Save size={18} /> Speichern</button>
            </div>
        </div>
    );
};

