// @ts-nocheck

import React, { useState, useEffect, useMemo } from 'react';
import { Staff, ShiftType } from '../types';
import { getWeekDates, addDays, parseDate, formatDate, isStaffOnVacation } from '../services/planningService';
import { loadRoster, updateStaffShift } from '../services/storageService';
import { ChevronLeft, ChevronRight, CalendarDays, Search, ArrowLeft, Filter, Upload } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';

interface WeeklyRosterProps {
    currentDate?: string;
    staffList: Staff[];
    onBack: () => void;
    isEmbedded?: boolean;
    onImport?: () => void;
    onShiftUpdate?: (date: string, staffId: string, shift: ShiftType) => void;
}

export const WeeklyRoster: React.FC<WeeklyRosterProps> = ({ currentDate = new Date().toLocaleDateString('de-DE'), staffList, onBack, isEmbedded = false, onImport, onShiftUpdate }) => {
    const { appConfig } = usePlan();
    const shiftConfig = appConfig.shifts;
    
    const [weekStartStr, setWeekStartStr] = useState(currentDate);
    const [weekDates, setWeekDates] = useState<string[]>([]);
    const [shiftData, setShiftData] = useState<Record<string, Record<string, ShiftType>>>({}); // Date -> StaffId -> Shift
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<'ALL' | 'OTA' | 'MFA' | 'Leitung'>('ALL');

    // Initialize Week
    useEffect(() => {
        const dates = getWeekDates(weekStartStr);
        setWeekDates(dates);
        fetchWeekData(dates);
    }, [weekStartStr]);

    const fetchWeekData = async (dates: string[]) => {
        setLoading(true);
        const data: Record<string, Record<string, ShiftType>> = {};
        
        // Parallel fetch for speed - explicitly loading ROSTER data from Mongo
        await Promise.all(dates.map(async (date) => {
            const roster = await loadRoster(date);
            data[date] = roster?.shifts || {};
        }));

        setShiftData(data);
        setLoading(false);
    };

    const handlePrevWeek = () => {
        const current = parseDate(weekStartStr);
        setWeekStartStr(formatDate(addDays(current, -7)));
    };

    const handleNextWeek = () => {
        const current = parseDate(weekStartStr);
        setWeekStartStr(formatDate(addDays(current, 7)));
    };

    const handleShiftChange = async (date: string, staffId: string, shift: ShiftType) => {
        // Optimistic update
        setShiftData(prev => ({
            ...prev,
            [date]: {
                ...prev[date],
                [staffId]: shift
            }
        }));

        // Propagate to parent (Sync with App context)
        if (onShiftUpdate) {
            onShiftUpdate(date, staffId, shift);
        }

        // Save directly to Mongo Rosters collection
        await updateStaffShift(date, staffId, shift);
    };

    const filteredStaff = useMemo(() => {
        return staffList.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = filterRole === 'ALL' 
                ? true 
                : filterRole === 'Leitung' 
                    ? s.isSaalleitung 
                    : s.role.includes(filterRole); // Simple string match for role
            return matchesSearch && matchesRole;
        });
    }, [staffList, searchTerm, filterRole]);

    // Sort staff: Leads first, then name
    const sortedStaff = useMemo(() => {
        return [...filteredStaff].sort((a, b) => {
            if (a.isSaalleitung && !b.isSaalleitung) return -1;
            if (!a.isSaalleitung && b.isSaalleitung) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [filteredStaff]);

    // Helper for ISO week number
    const getWeekNumber = (d: Date): number => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return weekNo;
    };

    return (
        <div className={`h-full flex flex-col bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 ${!isEmbedded ? 'rounded-xl shadow-sm border border-slate-200' : ''}`}>
            {/* Header */}
            <div className={`p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 ${isEmbedded ? 'rounded-t-xl' : ''}`}>
                <div className="flex items-center gap-4">
                    {!isEmbedded && (
                        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-600">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <CalendarDays size={20} className="text-blue-600" />
                            Wochenplan
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            {weekDates[0]} - {weekDates[6]}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button onClick={handlePrevWeek} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-slate-700 px-2 w-24 text-center">KW {getWeekNumber(parseDate(weekStartStr))}</span>
                    <button onClick={handleNextWeek} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* Import Button */}
                    {onImport && (
                        <button 
                            onClick={onImport}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                            title="Dienstplan CSV Importieren"
                        >
                            <Upload size={14} />
                            <span className="hidden sm:inline">Import</span>
                        </button>
                    )}

                    <div className="relative flex-1 md:w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Suchen..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="relative">
                        <select 
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value as any)}
                            className="appearance-none pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="ALL">Alle</option>
                            <option value="Leitung">Leitung</option>
                            <option value="OTA">OTA</option>
                            <option value="MFA">MFA</option>
                        </select>
                        <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50 relative">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-slate-400">
                        Lade Daten...
                    </div>
                ) : (
                    <table className="w-full border-collapse">
                        <thead className="bg-white sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-3 text-left text-xs font-bold text-slate-500 border-b border-r border-slate-200 min-w-[200px] sticky left-0 bg-white z-30">Mitarbeiter</th>
                                {weekDates.map((date, idx) => {
                                    const isToday = date === currentDate;
                                    const [d, m] = date.split('.');
                                    const dayName = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][parseDate(date).getDay()];
                                    return (
                                        <th key={date} className={`p-2 text-center border-b border-slate-200 min-w-[100px] ${isToday ? 'bg-blue-50 border-b-blue-500' : ''}`}>
                                            <div className={`text-[10px] font-bold uppercase ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{dayName}</div>
                                            <div className={`text-sm font-bold ${isToday ? 'text-blue-800' : 'text-slate-700'}`}>{d}.{m}.</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStaff.map(staff => (
                                <tr key={staff.id} className="bg-white hover:bg-slate-50 border-b border-slate-100 group">
                                    <td className="p-2 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${staff.isSaalleitung ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {staff.name.substring(0, 2)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-slate-800 truncate">{staff.name}</div>
                                                <div className="text-[10px] text-slate-400 truncate">{staff.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {weekDates.map(date => {
                                        const currentShift = shiftData[date]?.[staff.id] || 'T1'; // Default assumption if no data
                                        const shiftInfo = shiftConfig[currentShift];
                                        const isOnVacation = isStaffOnVacation(staff, date);
                                        const isWeekend = parseDate(date).getDay() === 0 || parseDate(date).getDay() === 6;
                                        
                                        // Determine display style
                                        let bgClass = 'bg-white';
                                        let textClass = 'text-slate-700';
                                        let borderClass = 'border-slate-200';
                                        
                                        if (isOnVacation) {
                                            bgClass = 'bg-amber-50';
                                            textClass = 'text-amber-600';
                                            borderClass = 'border-amber-200';
                                        } else if (currentShift === 'OFF' || currentShift === 'RECOVERY') {
                                            bgClass = 'bg-slate-100';
                                            textClass = 'text-slate-400';
                                        } else if (shiftInfo) {
                                            // Extract basic colors from Tailwind classes string if possible, or just map logic
                                            if (currentShift.startsWith('BD')) { bgClass = 'bg-purple-50'; textClass = 'text-purple-700'; borderClass = 'border-purple-100'; }
                                            else if (currentShift === 'N') { bgClass = 'bg-indigo-50'; textClass = 'text-indigo-700'; borderClass = 'border-indigo-100'; }
                                            else { bgClass = 'bg-white'; textClass = 'text-slate-700'; }
                                        }

                                        if (isWeekend && currentShift === 'T1' && !isOnVacation) {
                                             // Visual cue for default weekend
                                             bgClass = 'bg-slate-50/50';
                                             textClass = 'text-slate-400';
                                        }

                                        return (
                                            <td key={date} className="p-1 text-center border-r border-slate-100 last:border-r-0">
                                                {isOnVacation ? (
                                                    <div className="text-[10px] font-bold text-amber-500 flex items-center justify-center gap-1 h-8 bg-amber-50 rounded border border-amber-100 cursor-not-allowed">
                                                        Urlaub
                                                    </div>
                                                ) : (
                                                    <select 
                                                        value={currentShift}
                                                        onChange={(e) => handleShiftChange(date, staff.id, e.target.value as ShiftType)}
                                                        className={`w-full h-8 text-xs font-bold text-center rounded border appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${bgClass} ${textClass} ${borderClass}`}
                                                    >
                                                        {Object.entries(shiftConfig).map(([code, cfg]) => (
                                                            <option key={code} value={code}>{cfg.label}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

