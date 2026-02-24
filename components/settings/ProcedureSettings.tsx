// @ts-nocheck

import React, { useState } from 'react';
import { ProcedureRule } from '../../types';
import { Clock, Euro, Trash2, Plus, Save } from 'lucide-react';

interface ProcedureSettingsProps {
    rules: ProcedureRule[];
    departments: string[];
    onAdd: (rule: ProcedureRule) => void;
    onRemove: (idx: number) => void;
    onSave: () => void;
}

export const ProcedureSettings: React.FC<ProcedureSettingsProps> = ({ rules, departments, onAdd, onRemove, onSave }) => {
    const [keywords, setKeywords] = useState('');
    const [revenue, setRevenue] = useState(2500);
    const [duration, setDuration] = useState(60);
    const [priority, setPriority] = useState<'HIGH'|'MEDIUM'|'LOW'>('MEDIUM');
    const [dept, setDept] = useState('');

    const handleAdd = () => {
        if (!keywords.trim()) return;
        onAdd({
            keywords: keywords.split(',').map(k => k.trim()).filter(k => !!k),
            durationMinutes: duration,
            revenue,
            priority,
            requiredDept: dept || undefined
        });
        setKeywords('');
        setDept('');
    };

    return (
        <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded text-xs text-emerald-800">
                Diese Regeln bestimmen die Umsatzschätzung und Dauer von Eingriffen. Das System nutzt diese Daten für die intelligente Umplanung (Smart Rescheduling).
            </div>

            <div className="grid grid-cols-1 gap-3">
                {rules.map((rule, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between group hover:border-emerald-300 transition-colors">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${rule.priority === 'HIGH' ? 'bg-purple-100 text-purple-700 border-purple-200' : rule.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {rule.priority}
                                </span>
                                {rule.requiredDept && (
                                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                        Req: {rule.requiredDept}
                                    </span>
                                )}
                                <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
                                    <span className="flex items-center gap-1"><Clock size={12}/> {rule.durationMinutes}m</span>
                                    <span className="flex items-center gap-1"><Euro size={12}/> {rule.revenue}</span>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 font-medium truncate" title={rule.keywords.join(', ')}>
                                Keywords: <span className="text-slate-700">{rule.keywords.join(', ')}</span>
                            </div>
                        </div>
                        <button onClick={() => onRemove(idx)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Plus size={14} /> Neue Regel hinzufügen</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Keywords (Komma-getrennt)</label>
                        <input type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="z.B. tep, prothese" value={keywords} onChange={e => setKeywords(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Umsatz (€)</label>
                        <input type="number" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" value={revenue} onChange={e => setRevenue(parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Dauer (Min)</label>
                        <input type="number" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Priorität</label>
                        <select className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" value={priority} onChange={e => setPriority(e.target.value as any)}>
                            <option value="HIGH">Hoch (Prio)</option>
                            <option value="MEDIUM">Mittel</option>
                            <option value="LOW">Niedrig</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Zwang (Dept)</label>
                        <select className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" value={dept} onChange={e => setDept(e.target.value)}>
                            <option value="">- Optional -</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2 flex items-end">
                        <button onClick={handleAdd} disabled={!keywords} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded text-sm disabled:opacity-50">Hinzufügen</button>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
                <button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"><Save size={18} /> Speichern</button>
            </div>
        </div>
    );
};

