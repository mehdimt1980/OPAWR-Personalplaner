
import React, { useState } from 'react';
import { ShiftDef } from '../../types';
import { Plus, Trash2, ArrowRight, Save } from 'lucide-react';

interface ShiftSettingsProps {
    shifts: Record<string, ShiftDef>;
    onShiftChange: (code: string, field: keyof ShiftDef, value: any) => void;
    onRemoveShift: (code: string) => void;
    onAddShift: (code: string) => void;
    onSave: () => void;
}

const SHIFT_COLORS = [
    { label: 'Slate (Standard)', value: 'bg-slate-100 text-slate-600' },
    { label: 'Blue (Früh)', value: 'bg-blue-100 text-blue-700' },
    { label: 'Orange (Spät)', value: 'bg-orange-100 text-orange-700 border-orange-200' },
    { label: 'Indigo (Nacht)', value: 'bg-indigo-900 text-indigo-100' },
    { label: 'Purple (24h)', value: 'bg-purple-100 text-purple-700 border-purple-200' },
    { label: 'Green (Kurz)', value: 'bg-green-100 text-green-700 border-green-200' },
    { label: 'Red (Krank)', value: 'bg-red-100 text-red-600' },
    { label: 'Teal (Ruf)', value: 'bg-teal-100 text-teal-700 border-teal-200' },
];

export const ShiftSettings: React.FC<ShiftSettingsProps> = ({ shifts, onShiftChange, onRemoveShift, onAddShift, onSave }) => {
    const [newShiftCode, setNewShiftCode] = useState('');

    const handleAdd = () => {
        if (!newShiftCode.trim()) return;
        onAddShift(newShiftCode.trim().toUpperCase());
        setNewShiftCode('');
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded text-xs text-blue-800">
                Definieren Sie die Schichtkürzel, Zeiten und Farben. Markieren Sie "Einplanbar", damit Mitarbeiter mit dieser Schicht der Auto-Zuweisung zur Verfügung stehen.
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr className="whitespace-nowrap">
                            <th className="p-3 w-20">Code</th>
                            <th className="p-3 w-32">Label</th>
                            <th className="p-3 min-w-[220px]">Zeiten</th>
                            <th className="p-3 w-40">Farbe / Stil</th>
                            <th className="p-3 text-center w-24">Erholung</th>
                            <th className="p-3 text-center w-24">Einplanbar</th>
                            <th className="p-3 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Object.entries(shifts).map(([code, def]) => (
                            <tr key={code} className="hover:bg-slate-50">
                                <td className="p-3 font-mono font-bold text-slate-700">{code}</td>
                                <td className="p-3">
                                    <input 
                                        type="text" value={def.label} 
                                        onChange={e => onShiftChange(code, 'label', e.target.value)}
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                                    />
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-1.5">
                                        <input 
                                            type="time" 
                                            value={def.start} 
                                            onChange={e => onShiftChange(code, 'start', e.target.value)}
                                            className="border border-slate-300 rounded px-2 py-1 text-xs w-24 text-slate-700"
                                        />
                                        <ArrowRight size={12} className="text-slate-300" />
                                        <input 
                                            type="time" 
                                            value={def.end} 
                                            onChange={e => onShiftChange(code, 'end', e.target.value)}
                                            className="border border-slate-300 rounded px-2 py-1 text-xs w-24 text-slate-700"
                                        />
                                    </div>
                                </td>
                                <td className="p-3">
                                    <select 
                                        value={SHIFT_COLORS.find(c => c.value === def.color)?.value || def.color}
                                        onChange={e => onShiftChange(code, 'color', e.target.value)}
                                        className={`w-full border rounded px-2 py-1 text-xs ${def.color}`}
                                    >
                                        {SHIFT_COLORS.map(c => (
                                            <option key={c.value} value={c.value} className="bg-white text-slate-800">{c.label}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-3 text-center">
                                    <input 
                                        type="checkbox" checked={def.requiresRecovery} 
                                        onChange={e => onShiftChange(code, 'requiresRecovery', e.target.checked)}
                                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                    />
                                </td>
                                <td className="p-3 text-center">
                                    <input 
                                        type="checkbox" checked={def.isAssignable} 
                                        onChange={e => onShiftChange(code, 'isAssignable', e.target.checked)}
                                        className="w-4 h-4 rounded text-green-600 cursor-pointer"
                                    />
                                </td>
                                <td className="p-3 text-right">
                                    <button onClick={() => onRemoveShift(code)} className="text-slate-300 hover:text-red-500 p-1" title="Löschen">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap gap-3 items-center bg-slate-100 p-3 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase">Neue Schicht:</span>
                <input 
                    type="text" 
                    value={newShiftCode} 
                    onChange={e => setNewShiftCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Kürzel"
                    className="border border-slate-300 rounded px-3 py-1.5 text-sm uppercase font-bold focus:ring-2 focus:ring-blue-500 outline-none w-24"
                />
                <button onClick={handleAdd} className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-700 flex items-center gap-1">
                    <Plus size={16} /> Hinzufügen
                </button>
            </div>

            <div className="pt-4 border-t flex justify-end">
                <button onClick={onSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"><Save size={18} /> Konfiguration speichern</button>
            </div>
        </div>
    );
};
