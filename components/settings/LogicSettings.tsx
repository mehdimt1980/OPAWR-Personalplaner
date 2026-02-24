// @ts-nocheck

import React, { useState } from 'react';
import { LogicConfig, SpecialRule } from '../../types';
import { X, Plus, Trash2, Save } from 'lucide-react';

interface LogicSettingsProps {
    logic: LogicConfig;
    departments: string[];
    onAddKeyword: (cat: 'saalleitung' | 'joker' | 'mfa' | 'exclusionKeywords', word: string) => void;
    onRemoveKeyword: (cat: 'saalleitung' | 'joker' | 'mfa' | 'exclusionKeywords', word: string) => void;
    onAddSpecialRule: () => void;
    onUpdateSpecialRule: (idx: number, field: keyof SpecialRule, val: string) => void;
    onRemoveSpecialRule: (idx: number) => void;
    onSave: () => void;
}

export const LogicSettings: React.FC<LogicSettingsProps> = ({ 
    logic, departments, onAddKeyword, onRemoveKeyword, 
    onAddSpecialRule, onUpdateSpecialRule, onRemoveSpecialRule, onSave 
}) => {
    const [word, setWord] = useState('');

    return (
        <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded text-xs text-blue-800">
                Hier definieren Sie die Begriffe in der CSV, die Rollen wie "Leitung" oder "Joker" kennzeichnen.
            </div>

            <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800 border-b pb-1">CSV Parsing Keywords</h3>
                {Object.entries({
                    saalleitung: "Saalleitung Keywords",
                    joker: "Joker / Student Keywords",
                    mfa: "MFA / Arzthelfer Keywords",
                    exclusionKeywords: "Ignorieren bei Auto-Zuweisung"
                }).map(([key, label]) => (
                    <div key={key} className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2">{label}</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {(logic[key as keyof LogicConfig] as string[] || []).map((k: string) => (
                                <div key={k} className="bg-slate-100 px-2 py-1 rounded text-xs font-mono flex items-center gap-1">
                                    {k}
                                    <button onClick={() => onRemoveKeyword(key as any, k)} className="text-slate-400 hover:text-red-500"><X size={10} /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" className="flex-1 border rounded px-2 py-1 text-xs" placeholder="Hinzufügen..." onKeyDown={e => { if(e.key === 'Enter') { onAddKeyword(key as any, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800 border-b pb-1 flex items-center justify-between">
                    <span>Special Capability Rules</span>
                    <button onClick={onAddSpecialRule} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline"><Plus size={12} /> Regel hinzufügen</button>
                </h3>
                {logic.specialRules?.map((rule, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 text-xs">
                        <div className="flex-1">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Trigger</span>
                            <input type="text" value={rule.triggerDept} onChange={e => onUpdateSpecialRule(idx, 'triggerDept', e.target.value)} className="w-full border-b border-slate-300 py-1 font-bold" />
                        </div>
                        <div className="flex-1">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Benötigter Skill</span>
                            <select value={rule.requiredSkill} onChange={e => onUpdateSpecialRule(idx, 'requiredSkill', e.target.value)} className="w-full border-b border-slate-300 py-1 bg-transparent">
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Min. Level</span>
                            <select value={rule.minLevel} onChange={e => onUpdateSpecialRule(idx, 'minLevel', e.target.value)} className="w-full border-b border-slate-300 py-1 bg-transparent">
                                <option value="Expert">Expert</option>
                                <option value="Junior">Junior</option>
                            </select>
                        </div>
                        <button onClick={() => onRemoveSpecialRule(idx)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t flex justify-end">
                <button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"><Save size={18} /> Speichern</button>
            </div>
        </div>
    );
};

