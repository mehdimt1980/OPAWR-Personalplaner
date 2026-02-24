// @ts-nocheck

import React, { useMemo } from 'react';
import { Staff, ShiftType } from '../types';
import { StaffCard } from './StaffCard';
import { isStaffOnVacation, isStaffScheduled, timeToMinutes } from '../services/planningService';
import { Users, LogOut, Clock, X } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { usePlan } from '../contexts/PlanContext';

interface ResourceSidebarProps {
    unassignedStaffIds: string[];
    staffList: Staff[]; 
    staffShifts: Record<string, ShiftType>;
    currentDate: string;
    selectedStaffId: string | null;
    onSidebarClick: () => void;
    onStaffClick: (id: string) => void;
    onToggleSick: (id: string) => void;
    onShiftChange: (id: string, shift: ShiftType) => void;
    onNotify: (staff: Staff) => void;
    isOpen?: boolean; // For Tablet Drawer
    onClose?: () => void; // For Tablet Drawer
}

export const ResourceSidebar: React.FC<ResourceSidebarProps> = ({
    unassignedStaffIds,
    staffList,
    staffShifts,
    currentDate,
    selectedStaffId,
    onSidebarClick,
    onStaffClick,
    onToggleSick,
    onShiftChange,
    onNotify,
    isOpen = false,
    onClose
}) => {
    const { appConfig } = usePlan();
    const shiftConfig = appConfig.shifts;
    const departments = appConfig.departments;

    const { isOver, setNodeRef } = useDroppable({
        id: 'sidebar-bench',
        data: { type: 'bench' }
    });

    const effectiveStaffList = staffList;

    const deptStats = useMemo(() => {
        const availableStaff = effectiveStaffList.filter(s => isStaffScheduled(s, currentDate) && !s.isSick);
        const stats: Record<string, number> = {};
        departments.forEach(dept => { stats[dept] = 0; });
        availableStaff.forEach(staff => {
            Object.keys(stats).forEach(dept => {
                if (staff.skills[dept]) stats[dept]++;
            });
        });
        return stats;
    }, [effectiveStaffList, currentDate, departments]);

    const hasShortShift = (s: Staff) => {
        if (!s.currentCustomTime) return false;
        const start = timeToMinutes(s.currentCustomTime.start);
        const end = timeToMinutes(s.currentCustomTime.end);
        let duration = end - start;
        if (duration < 0) duration += 1440;
        return duration < 450; 
    };

    const isAbsent = (s: Staff) => {
        return s.isSick || isStaffOnVacation(s, currentDate) || s.currentShift === 'RECOVERY' || s.currentShift === 'OFF';
    };

    const unassignedLeads = unassignedStaffIds
        .map(id => effectiveStaffList.find(s => s.id === id))
        .filter(s => !!s && s.isSaalleitung && !isAbsent(s)) as Staff[];

    const unassignedOthers = unassignedStaffIds
        .map(id => effectiveStaffList.find(s => s.id === id))
        .filter(s => !!s && !s.isSaalleitung && !isAbsent(s)) as Staff[];
    
    const absentStaff = useMemo(() => {
        return effectiveStaffList.filter(s => isAbsent(s));
    }, [effectiveStaffList, currentDate]);

    // Responsive Class Logic
    // - Base: Flex column, background white
    // - Tablet (md/lg): Fixed position (Drawer), hidden by default (translate-x), visible if isOpen
    // - Desktop (xl): Static position (Sidebar), always visible, width 72
    const baseClasses = "flex flex-col bg-white border-l border-slate-200 shadow-sm overflow-hidden transition-transform duration-300 z-50";
    const tabletClasses = `fixed top-0 right-0 bottom-0 w-80 shadow-2xl transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;
    const desktopClasses = "xl:translate-x-0 xl:static xl:w-72 xl:h-full xl:shadow-none xl:border-l";

    return (
        <aside 
            ref={setNodeRef}
            onClick={onSidebarClick}
            className={`${baseClasses} ${tabletClasses} ${desktopClasses} ${selectedStaffId ? 'ring-2 ring-red-100 cursor-pointer border-red-200' : ''} ${isOver ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}
        >
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <Users size={16} /> Ressourcen
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{unassignedLeads.length + unassignedOthers.length}</span>
                    {/* Close Button for Tablet Drawer */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                        className="xl:hidden p-1 hover:bg-slate-200 rounded text-slate-500"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
            
            {(selectedStaffId || isOver) && (
                <div className={`p-2 text-center border-b transition-colors ${isOver ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-red-50 text-red-500 border-red-100'}`}>
                    <p className="text-[10px] font-bold flex items-center justify-center gap-1">
                        <LogOut size={12} />
                        {isOver ? 'Loslassen zum Entfernen' : 'Hier tippen zum Entfernen'}
                    </p>
                </div>
            )}

            <div className="p-2 bg-white border-b border-slate-100 grid grid-cols-3 gap-1.5">
                {Object.entries(deptStats).map(([dept, count]) => (
                    <div key={dept} className="flex flex-col items-center justify-center p-1 bg-slate-50 rounded border border-slate-100" title={`${dept} Qualifiziertes Personal`}>
                        <span className="text-[9px] font-bold text-slate-400">{dept}</span>
                        <span className={`text-xs font-bold leading-none mt-0.5 ${(count as number) > 0 ? 'text-slate-700' : 'text-red-300'}`}>{count as number}</span>
                    </div>
                ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
                {unassignedStaffIds.length === 0 && absentStaff.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Alle Mitarbeiter zugewiesen.</div>
                ) : (
                    <>
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
                                Verfügbare Saalleitung <span className="bg-slate-100 text-slate-500 px-1.5 rounded text-[10px]">{unassignedLeads.length}</span>
                            </h3>
                            <div className="space-y-2">
                                {unassignedLeads.map(staff => (
                                    <div key={staff.id} className="relative group">
                                        {hasShortShift(staff) && (
                                            <div className="absolute top-0 right-0 z-10 p-1">
                                                <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 shadow-sm">
                                                    <Clock size={10} />
                                                    {staff.currentCustomTime?.start}-{staff.currentCustomTime?.end}
                                                </span>
                                            </div>
                                        )}
                                        <StaffCard 
                                            staff={staff} 
                                            compact 
                                            isSelected={selectedStaffId === staff.id}
                                            onClick={() => onStaffClick(staff.id)}
                                            onToggleSick={onToggleSick}
                                            onShiftChange={onShiftChange}
                                            onNotify={onNotify}
                                            shiftConfig={shiftConfig}
                                        />
                                    </div>
                                ))}
                                {unassignedLeads.length === 0 && <p className="text-xs text-slate-400 italic px-1">Keine verfügbar</p>}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
                                Verfügbares Personal <span className="bg-slate-100 text-slate-500 px-1.5 rounded text-[10px]">{unassignedOthers.length}</span>
                            </h3>
                            <div className="space-y-2">
                                {unassignedOthers.map(staff => (
                                    <div key={staff.id} className="relative group">
                                        {hasShortShift(staff) && (
                                            <div className="absolute top-0 right-0 z-10 p-1">
                                                <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 shadow-sm">
                                                    <Clock size={10} />
                                                    {staff.currentCustomTime?.start}-{staff.currentCustomTime?.end}
                                                </span>
                                            </div>
                                        )}
                                        <StaffCard 
                                            staff={staff} 
                                            compact 
                                            isSelected={selectedStaffId === staff.id}
                                            onClick={() => onStaffClick(staff.id)}
                                            onToggleSick={onToggleSick}
                                            onShiftChange={onShiftChange}
                                            onNotify={onNotify}
                                            shiftConfig={shiftConfig}
                                        />
                                    </div>
                                ))}
                                {unassignedOthers.length === 0 && <p className="text-xs text-slate-400 italic px-1">Kein Personal</p>}
                            </div>
                        </div>
                        
                        {absentStaff.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
                                    Abwesend <span className="bg-red-50 text-red-500 px-1.5 rounded text-[10px]">{absentStaff.length}</span>
                                </h3>
                                <div className="space-y-2 opacity-80">
                                    {absentStaff.map(staff => (
                                        <div key={staff.id} className="relative group">
                                            <StaffCard 
                                                staff={staff} 
                                                compact 
                                                isSelected={selectedStaffId === staff.id}
                                                onClick={() => onStaffClick(staff.id)}
                                                onToggleSick={onToggleSick}
                                                isVacation={isStaffOnVacation(staff, currentDate)}
                                                onNotify={onNotify}
                                                onShiftChange={onShiftChange}
                                                shiftConfig={shiftConfig}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
};


