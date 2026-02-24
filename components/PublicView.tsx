// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Room, Staff, Assignment, ShiftType, AppConfig } from '../types';
import { loadPlan, loadStaffList, getLastActiveDate, loadRoomConfig, loadAppConfig } from '../services/storageService';
import { BUILD_INITIAL_ROOMS } from '../services/dataService';
import { DEMO_DATE, DEFAULT_APP_CONFIG } from '../constants';
import { StaffCard } from './StaffCard';
import { Clock, Activity, ShieldCheck, Calendar } from 'lucide-react';
import { getDepartmentHeaderClass } from '../utils/colors';

export const PublicView: React.FC = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [date, setDate] = useState<string>(DEMO_DATE);
    const [staffShifts, setStaffShifts] = useState<Record<string, ShiftType>>({});
    const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
    const [loading, setLoading] = useState(true);

    // 1. Clock Ticker
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 2. Data Polling (Every 30s)
    useEffect(() => {
        fetchData();
        const pollTimer = setInterval(fetchData, 30000); // 30s refresh
        return () => clearInterval(pollTimer);
    }, []);

    const fetchData = async () => {
        // Determine date to show (either last active, or today)
        // For Public View, usually showing "Today" or the last actively worked on date is best.
        // We'll use the lastActiveDate from storage to stay in sync with the manager.
        const lastDate = getLastActiveDate() || new Date().toLocaleDateString('de-DE');
        setDate(lastDate);

        // Load Staff
        const loadedStaff = await loadStaffList();
        const safeStaffList = loadedStaff || [];
        setStaffList(safeStaffList);

        // Load Room Config
        const roomConfig = await loadRoomConfig();

        // Load App Config (for shifts)
        const loadedAppConfig = await loadAppConfig();
        if (loadedAppConfig) setAppConfig(loadedAppConfig);

        // Load Plan
        const plan = await loadPlan(lastDate);
        if (plan) {
            if (plan.operations && plan.operations.length > 0) {
                // Pass loaded roomConfig (or undefined if null)
                setRooms(BUILD_INITIAL_ROOMS(plan.operations, roomConfig || undefined));
            } else {
                setRooms(BUILD_INITIAL_ROOMS([], roomConfig || undefined));
            }
            setAssignments(plan.assignments);
            setStaffShifts(plan.staffShifts || {});
        } else {
            setRooms(BUILD_INITIAL_ROOMS([], roomConfig || undefined));
            setAssignments([]);
        }
        setLoading(false);
    };

    // Merge Shifts into Staff objects for display
    const getStaffWithShifts = (id: string) => {
        const staff = staffList.find(s => s.id === id);
        if (!staff) return null;
        
        const currentShift = staffShifts[staff.id] || 'T1';
        
        return {
            ...staff,
            currentShift: currentShift,
            // FIX: Derive isSick directly from the shift for this specific day.
            // This ensures the TV view matches the App view exactly, 
            // ignoring any stale global sickness flags.
            isSick: currentShift === 'SICK' 
        };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <Activity className="animate-pulse mr-3" />
                <span className="text-xl font-light tracking-wider">Lade OP-Plan...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col overflow-hidden">
            {/* Top Header */}
            <header className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-6">
                     <h1 className="text-2xl font-bold tracking-tight">OP-Personalplaner</h1>
                     <div className="h-8 w-px bg-slate-700"></div>
                     <div className="flex items-center gap-2 text-blue-200 bg-slate-800 px-4 py-2 rounded-lg">
                        <Calendar size={20} />
                        <span className="text-xl font-mono font-bold">{date}</span>
                     </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end mr-4">
                         <span className="text-[10px] uppercase tracking-widest text-slate-400">Aktuelle Zeit</span>
                         <span className="text-3xl font-mono font-bold leading-none">
                            {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                         </span>
                    </div>
                    <div className="bg-green-500 w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                </div>
            </header>

            {/* Grid Content */}
            <main className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {rooms.map(room => {
                         const assignment = assignments.find(a => a.roomId === room.id);
                         const assignedStaffIds = assignment ? assignment.staffIds : [];
                         const headerClass = getDepartmentHeaderClass(room.primaryDepts[0] || 'UCH');

                         return (
                            <div key={room.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[380px]">
                                <div className={`p-4 border-b ${headerClass} flex justify-between items-center`}>
                                    <h2 className="text-2xl font-bold">{room.name}</h2>
                                    <span className="bg-white/40 backdrop-blur-md px-2 py-1 rounded text-sm font-bold border border-black/5">
                                        {room.primaryDepts.join(', ')}
                                    </span>
                                </div>
                                
                                <div className="flex-1 p-4 bg-slate-50/50 overflow-y-auto">
                                    {assignedStaffIds.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 italic text-lg">
                                            Nicht belegt
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {assignedStaffIds.map((id, idx) => {
                                                const staff = getStaffWithShifts(id);
                                                if (!staff) return null;
                                                
                                                return (
                                                    <div key={id} className="relative">
                                                        {/* Role Label */}
                                                        {idx === 0 && (
                                                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full mr-2 hidden xl:block">
                                                                <ShieldCheck className="text-amber-500 opacity-50" size={20} />
                                                            </div>
                                                        )}
                                                        <StaffCard 
                                                            staff={staff} 
                                                            readOnly={true} // Disable interactions
                                                            compact={false}
                                                            shiftConfig={appConfig.shifts}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Footer with OP Count */}
                                <div className="p-3 bg-white border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Activity size={14} /> {room.operations.length} Operationen
                                    </span>
                                    <span className="font-mono text-xs">
                                        {room.operations.length > 0 ? `Start: ${room.operations[0].time}` : ''}
                                    </span>
                                </div>
                            </div>
                         );
                    })}
                </div>
            </main>
        </div>
    );
};

