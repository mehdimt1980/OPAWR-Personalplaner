// @ts-nocheck

import React from 'react';
import { Staff, CustomTime } from '../../types';
import { Search, Timer, Trash2, Clock } from 'lucide-react';
import { timeToMinutes } from '../../services/planningService';

interface SpecialTimesTabProps {
    staffList: Staff[];
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    customTimes: Record<string, CustomTime>;
    onTimeChange: (id: string, start: string, end: string) => void;
    currentDate: string;
}

export const SpecialTimesTab: React.FC<SpecialTimesTabProps> = ({
    staffList, searchTerm, setSearchTerm, customTimes, onTimeChange, currentDate
}) => {
    return (
        <div className="h-full flex flex-col gap-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-3">
                <Timer size={20} className="shrink-0" />
                <span>Individuelle Arbeitszeiten für den <strong>{currentDate}</strong>. (z.B. Teilzeit-Kräfte)</span>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Nach Name suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-10 space-y-2">
                {staffList
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(staff => {
                        const time = customTimes[staff.id] || { start: '', end: '' };
                        const hasTime = !!(time.start && time.end);
                        const isShort = hasTime && (timeToMinutes(time.end) - timeToMinutes(time.start) + (timeToMinutes(time.end) < timeToMinutes(time.start) ? 1440 : 0)) < 450;
                        return (
                            <div key={staff.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${staff.isSaalleitung ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{staff.name.substring(0, 2)}</div>
                                    <span className="font-bold text-slate-700">{staff.name}</span>
                                    {isShort && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">Teilzeit</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="time" value={time.start} onChange={(e) => onTimeChange(staff.id, e.target.value, time.end)} className="border border-slate-300 rounded px-2 py-1 text-sm w-24" />
                                    <span className="text-slate-400">-</span>
                                    <input type="time" value={time.end} onChange={(e) => onTimeChange(staff.id, time.start, e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-24" />
                                    {hasTime && <button onClick={() => onTimeChange(staff.id, '', '')} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>}
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};


