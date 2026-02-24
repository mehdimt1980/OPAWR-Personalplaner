// @ts-nocheck

import React, { useState } from 'react';
import { Staff, StaffPairing } from '../../types';
import { UserCheck, Link, GraduationCap, Trash2, Plus } from 'lucide-react';

interface PairingTabProps {
    staffList: Staff[];
    pairings: StaffPairing[];
    onAdd: (s1: string, s2: string, type: 'TRAINING' | 'TANDEM') => void;
    onRemove: (id: string) => void;
}

export const PairingTab: React.FC<PairingTabProps> = ({ staffList, pairings, onAdd, onRemove }) => {
    const [s1, setS1] = useState('');
    const [s2, setS2] = useState('');
    const [type, setType] = useState<'TRAINING' | 'TANDEM'>('TRAINING');

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-900 shadow-sm flex gap-3">
                <UserCheck size={20} className="shrink-0" />
                <div>
                    <h4 className="font-bold mb-1">Mentoren & Tandems</h4>
                    <p>Verbundene Personen werden bei der Auto-Zuweisung <strong>immer gemeinsam</strong> eingeteilt.</p>
                </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Neue Kopplung</h3>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Junior/Partner A</label>
                        <select value={s1} onChange={(e) => setS1(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm bg-white">
                            <option value="">Wählen...</option>
                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="pb-3 text-slate-300"><Link size={18} /></div>
                    <div className="flex-1 w-full">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Mentor/Partner B</label>
                        <select value={s2} onChange={(e) => setS2(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm bg-white">
                            <option value="">Wählen...</option>
                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-32 p-2 border border-slate-300 rounded text-sm bg-white">
                        <option value="TRAINING">Ausbildung</option>
                        <option value="TANDEM">Tandem</option>
                    </select>
                    <button onClick={() => { onAdd(s1, s2, type); setS1(''); setS2(''); }} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm shadow-sm hover:bg-indigo-700">Koppeln</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Aktive Kopplungen ({pairings.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pairings.map(p => {
                        const m1 = staffList.find(s => s.id === p.staffId1);
                        const m2 = staffList.find(s => s.id === p.staffId2);
                        if (!m1 || !m2) return null;
                        return (
                            <div key={p._id || p.staffId1 + p.staffId2} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${p.type === 'TRAINING' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {p.type === 'TRAINING' ? <GraduationCap size={18} /> : <Link size={18} />}
                                    </div>
                                    <div className="text-sm font-bold">{m1.name} & {m2.name}</div>
                                </div>
                                <button onClick={() => onRemove(p._id || '')} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

