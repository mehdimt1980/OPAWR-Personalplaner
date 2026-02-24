// @ts-nocheck

import React, { useState } from 'react';
import { Room, Staff, ShiftType } from '../types';
import { ValidationIssue } from '../services/validationService';
import { StaffCard } from './StaffCard';
import { AlertCircle, AlertTriangle, Wand2, ShieldCheck, Clock, List, BarChartHorizontal } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { RoomSkeleton } from './ui/Skeleton';
import { usePlan } from '../contexts/PlanContext';

interface RoomCardProps {
    room: Room;
    assignedStaff: Staff[];
    roomIssues: ValidationIssue[];
    selectedStaffId: string | null;
    headerClass: string;
    borderClass: string;
    onRoomClick: () => void;
    onOpenWizard: (issue: ValidationIssue) => void;
    onStaffClick: (id: string) => void;
    onToggleSick: (id: string) => void;
    onShiftChange: (id: string, shift: ShiftType) => void;
    onRemoveStaff: (staffId: string) => void;
    onNotify?: (staff: Staff) => void; 
    isLoading?: boolean;
    readOnly?: boolean;
}

// Helper to parse "HH:MM" to minutes from 00:00
const timeToMins = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const RoomCardComponent: React.FC<RoomCardProps> = ({
    room,
    assignedStaff,
    roomIssues,
    selectedStaffId,
    headerClass,
    borderClass,
    onRoomClick,
    onOpenWizard,
    onStaffClick,
    onToggleSick,
    onShiftChange,
    onRemoveStaff,
    onNotify,
    isLoading = false,
    readOnly = false
}) => {
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
    const { appConfig } = usePlan();
    const shiftConfig = appConfig.shifts;
    
    // Dynamic Timeline Config
    const START_HOUR = appConfig.timeline?.startHour || 7;
    const END_HOUR = appConfig.timeline?.endHour || 17;
    const TOTAL_MINS = (END_HOUR - START_HOUR) * 60;

    // dnd-kit Droppable
    const { isOver, setNodeRef } = useDroppable({
        id: room.id,
        data: { room, type: 'room' },
        disabled: readOnly
    });

    if (isLoading) return <RoomSkeleton />;

    // --- TIMELINE HELPER FUNCTIONS ---
    const getPosition = (timeStr: string) => {
        let mins = timeToMins(timeStr);
        let offset = mins - (START_HOUR * 60);
        if (offset < 0) offset = 0;
        if (offset > TOTAL_MINS) offset = TOTAL_MINS;
        return (offset / TOTAL_MINS) * 100;
    };

    const getWidth = (durationMins: number, startTimeStr: string) => {
        const startMins = timeToMins(startTimeStr);
        const startOffset = startMins - (START_HOUR * 60);
        let effectiveDuration = durationMins;
        if (startOffset < 0) effectiveDuration += startOffset;
        const maxRemaining = TOTAL_MINS - Math.max(0, startOffset);
        if (effectiveDuration > maxRemaining) effectiveDuration = maxRemaining;
        if (effectiveDuration <= 0) return 0;
        return (effectiveDuration / TOTAL_MINS) * 100;
    };

    const getStaffBar = (staff: Staff) => {
        const shiftCode = staff.currentShift || 'T1';
        const config = shiftConfig[shiftCode];
        if (!config) return { left: 0, width: 100, label: '?' };

        let startStr = config.start;
        let endStr = config.end;
        if (startStr === '-' || endStr === '-') return { left: 0, width: 0, label: 'Off' }; 
        
        let duration = 0;
        const startMins = timeToMins(startStr);
        const endMins = timeToMins(endStr);
        if (endMins < startMins) {
             duration = (END_HOUR * 60) - (startMins - START_HOUR*60);
             if (duration > TOTAL_MINS) duration = TOTAL_MINS;
        } else {
             duration = endMins - startMins;
        }

        return {
            left: getPosition(startStr),
            width: getWidth(duration, startStr),
            label: config.label,
            color: config.color
        };
    };

    // Calculate final classes based on drop state
    // Removed scale-[1.01] to prevent layout jumping/shifting during drag
    const finalBorderClass = isOver 
        ? 'border-blue-500 ring-2 ring-blue-500 shadow-xl z-10' 
        : borderClass;

    // Generate timeline axis points (every 2 hours)
    const timeAxisPoints = [];
    for (let h = START_HOUR; h <= END_HOUR; h += 2) {
        timeAxisPoints.push(h);
    }

    return (
        <div 
            ref={setNodeRef}
            onClick={onRoomClick}
            className={`room-card w-full flex flex-col bg-white rounded-xl border shadow-sm h-full min-h-0 transition-all duration-200 ${finalBorderClass} print:h-auto print:block print:break-inside-avoid relative group/card`}
        >
            {/* Header */}
            <div className={`room-card-header p-1.5 border-b relative shrink-0 ${headerClass}`}>
                <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-sm text-inherit truncate">{room.name}</h3>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1 py-0.5 bg-white/60 border border-black/5 rounded text-inherit backdrop-blur-sm">
                            {room.primaryDepts.join(', ')}
                        </span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setViewMode(prev => prev === 'list' ? 'timeline' : 'list'); }}
                            className="p-0.5 rounded bg-white/40 hover:bg-white/60 text-inherit transition-colors print:hidden"
                            title={viewMode === 'list' ? "Zeitstrahl anzeigen" : "Liste anzeigen"}
                        >
                            {viewMode === 'list' ? <BarChartHorizontal size={12} /> : <List size={12} />}
                        </button>
                    </div>
                </div>

                {/* Validation Issues */}
                {roomIssues.length > 0 && (
                    <div className="mb-1 flex flex-col gap-0.5">
                        {roomIssues.map(issue => (
                            <div key={issue.id} className={`text-[9px] px-1 py-0.5 rounded flex items-center gap-2 font-bold ${issue.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                <div className="flex items-center gap-1 min-w-0">
                                    {issue.type === 'error' ? <AlertCircle size={10} className="shrink-0" /> : <AlertTriangle size={10} className="shrink-0" />}
                                    <span className="truncate">{issue.message}</span>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenWizard(issue);
                                    }}
                                    className={`p-0.5 rounded hover:bg-white/50 transition-colors shrink-0 ${issue.type === 'error' ? 'text-red-800' : 'text-amber-800'}`}
                                    title="Problem automatisch lösen"
                                >
                                    <Wand2 size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Drop Zone / Empty State */}
                <div className="print:min-h-0">
                    {assignedStaff.length === 0 ? (
                        <div className={`flex items-center justify-center border-2 border-dashed rounded-lg bg-white/40 text-[10px] p-2 text-center mt-1 transition-colors ${isOver ? 'border-blue-400 bg-blue-100/50 text-blue-700' : selectedStaffId ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-slate-300/50 text-slate-400'}`}>
                            {isOver ? "Hier ablegen" : selectedStaffId ? "Zuweisen" : "Leer"}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 mt-1">
                            {/* Lead Slot */}
                            <div className="flex items-center gap-1">
                                <div className="w-4 shrink-0 flex justify-center" title="Saalleitung">
                                     <ShieldCheck size={10} className="text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <StaffCard 
                                        staff={assignedStaff[0]} 
                                        tiny
                                        isSelected={selectedStaffId === assignedStaff[0].id}
                                        onClick={() => onStaffClick(assignedStaff[0].id)}
                                        onToggleSick={onToggleSick} 
                                        onShiftChange={onShiftChange}
                                        onRemove={() => onRemoveStaff(assignedStaff[0].id)}
                                        onNotify={onNotify}
                                        readOnly={readOnly}
                                        shiftConfig={shiftConfig}
                                    />
                                </div>
                            </div>
                            
                            {/* Springer Slot(s) */}
                            {assignedStaff.slice(1).map((staff, idx) => (
                                <div key={staff.id} className="flex items-center gap-1">
                                    <div className="w-4 shrink-0 flex justify-center" title="Springer">
                                        {idx === 0 ? <span className="text-[8px] text-slate-400 font-bold">2.</span> : null}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <StaffCard 
                                            staff={staff} 
                                            tiny
                                            isSelected={selectedStaffId === staff.id}
                                            onClick={() => onStaffClick(staff.id)}
                                            onToggleSick={onToggleSick} 
                                            onShiftChange={onShiftChange}
                                            onRemove={() => onRemoveStaff(staff.id)}
                                            onNotify={onNotify}
                                            readOnly={readOnly}
                                            shiftConfig={shiftConfig}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* CONTENT AREA: LIST vs TIMELINE */}
            <div className="room-card-content flex-1 min-h-0 overflow-y-auto bg-slate-50/30 print:overflow-visible print:h-auto relative">
                
                {viewMode === 'list' ? (
                    // --- LIST VIEW ---
                    <div className="p-1.5 space-y-1">
                         {room.operations.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 text-[10px] italic print:hidden py-4">
                                <span>Keine OPs</span>
                            </div>
                        ) : (
                            room.operations.map(op => (
                                <div key={op.id} className="bg-white p-1 rounded border border-slate-200 shadow-sm hover:border-blue-300 transition-colors group">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <span className="flex items-center gap-1 text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                                            <Clock size={8} /> {op.time}
                                        </span>
                                        <span className="text-[8px] text-slate-400">{op.dept}</span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-800 leading-tight line-clamp-2">{op.procedure}</p>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    // --- TIMELINE VIEW ---
                    <div className="h-full w-full relative p-2 overflow-hidden flex flex-col">
                        {/* Time Axis */}
                        <div className="flex justify-between text-[8px] text-slate-400 border-b border-slate-200 pb-0.5 mb-1 px-1">
                            {timeAxisPoints.map(h => (
                                <span key={h}>{h}:00</span>
                            ))}
                        </div>
                        
                        <div className="flex-1 relative overflow-y-auto custom-scrollbar pr-1">
                            {/* Background Grid Lines */}
                            <div className="absolute inset-0 flex justify-between pointer-events-none px-1">
                                {timeAxisPoints.map(h => (
                                    <div key={h} className="h-full w-px bg-slate-100 last:bg-transparent"></div>
                                ))}
                            </div>

                            {/* Operations Bars */}
                            <div className="space-y-1 mb-2 relative z-10">
                                {room.operations.length === 0 && <div className="text-center text-slate-300 text-[10px] italic py-2">Leer</div>}
                                {room.operations.map(op => {
                                    const left = getPosition(op.time);
                                    const width = getWidth(op.durationMinutes, op.time);
                                    
                                    return (
                                        <div key={op.id} className="relative h-3 rounded bg-blue-100 border border-blue-200 flex items-center group overflow-hidden" 
                                             style={{ marginLeft: `${left}%`, width: `${width}%` }}>
                                            <div className="px-1 text-[8px] font-bold text-blue-800 truncate leading-none w-full">
                                                {op.procedure}
                                            </div>
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] p-1 rounded z-20 whitespace-nowrap">
                                                {op.time} ({op.durationMinutes}m) - {op.procedure}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Staff Bars Separator */}
                            <div className="border-t border-slate-200 my-1 pt-1 relative z-10">
                                <div className="space-y-0.5">
                                    {assignedStaff.map(staff => {
                                        const bar = getStaffBar(staff);
                                        return (
                                            <div key={staff.id} className="flex items-center gap-1">
                                                <div className="w-8 shrink-0 text-[8px] font-medium text-slate-600 truncate" title={staff.name}>
                                                    {staff.name.split(' ')[0]}
                                                </div>
                                                <div className="flex-1 relative h-2 bg-slate-50 rounded-sm overflow-hidden">
                                                    <div 
                                                        className={`absolute h-full rounded-sm text-[6px] flex items-center justify-center text-slate-600 font-bold opacity-80 ${bar.color ? bar.color.split(' ')[0] : 'bg-slate-300'}`}
                                                        style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                                                    >
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const RoomCard = React.memo(RoomCardComponent);

