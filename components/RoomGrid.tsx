// @ts-nocheck

import React from 'react';
import { Room, Staff, Assignment, ShiftType } from '../types';
import { ValidationIssue } from '../services/validationService';
import { RoomCard } from './RoomCard';
import { getDepartmentHeaderClass } from '../utils/colors';

interface RoomGridProps {
    rooms: Room[];
    assignments: Assignment[];
    staffList: Staff[]; // We need this to lookup full staff objects from IDs
    staffShifts: Record<string, ShiftType>; // Needed to pass shift context to cards
    validationIssues: ValidationIssue[];
    selectedStaffId: string | null;
    onRoomClick: (roomId: string) => void;
    onOpenWizard: (issue: ValidationIssue) => void;
    onStaffClick: (id: string) => void;
    onToggleSick: (id: string) => void;
    onShiftChange: (id: string, shift: ShiftType) => void;
    onRemoveStaff: (roomId: string, staffId: string) => void;
    onNotify: (staff: Staff) => void;
    readOnly?: boolean;
    isLoading?: boolean;
}

export const RoomGrid: React.FC<RoomGridProps> = ({
    rooms,
    assignments,
    staffList,
    staffShifts,
    validationIssues,
    selectedStaffId,
    onRoomClick,
    onOpenWizard,
    onStaffClick,
    onToggleSick,
    onShiftChange,
    onRemoveStaff,
    onNotify,
    readOnly,
    isLoading = false
}) => {
    
    const getAssignedStaffForRoom = (roomId: string) => {
        const assignment = assignments.find(a => a.roomId === roomId);
        if (!assignment) return [];
        // Map IDs to Staff Objects
        return assignment.staffIds.map(id => {
            const staff = staffList.find(s => s.id === id);
            if (!staff) return null;
            
            const currentShift = staffShifts[staff.id] || 'T1';
            
            return { 
                ...staff, 
                currentShift: currentShift,
                isSick: currentShift === 'SICK' 
            };
        }).filter(Boolean) as Staff[];
    };

    // Helper to assign distinct colors to room headers based on department
    const getRoomHeaderClass = (room: Room, hasError: boolean, hasWarning: boolean) => {
        if (hasError) return 'bg-red-100 border-red-200 text-red-900';
        if (hasWarning) return 'bg-amber-100 border-amber-200 text-amber-900';
        
        const dept = room.primaryDepts[0] || 'UCH';
        return getDepartmentHeaderClass(dept);
    };

    // Loading State
    if (isLoading) {
        return (
            <section className="flex-1 h-full overflow-hidden p-3">
                <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-full min-h-0">
                            <RoomCard
                                room={{} as Room}
                                assignedStaff={[]}
                                roomIssues={[]}
                                selectedStaffId={null}
                                headerClass=""
                                borderClass=""
                                onRoomClick={() => {}}
                                onOpenWizard={() => {}}
                                onStaffClick={() => {}}
                                onToggleSick={() => {}}
                                onShiftChange={() => {}}
                                onRemoveStaff={() => {}}
                                isLoading={true}
                            />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className="flex-1 h-full overflow-hidden p-3 print:overflow-visible print:block print:h-auto">
            {/* 
               Grid Layout Logic:
               - Mobile (<768px): 1 column (scrolling)
               - Tablet Portrait (768px+): 2 columns
               - Tablet Landscape/Laptop (1024px+): 3 columns (Sidebar is now HIDDEN on these screens!)
               - Desktop Large (1280px+): 4 columns (Sidebar is VISIBLE again)
            */}
            <div id="room-grid" className="w-full h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1300px]:grid-cols-4 auto-rows-fr gap-3">
                {rooms.map(room => {
                    const assigned = getAssignedStaffForRoom(room.id);
                    const roomIssues = validationIssues.filter(i => i.roomId === room.id);
                    const hasError = roomIssues.some(i => i.type === 'error');
                    const hasWarning = roomIssues.some(i => i.type === 'warning');
                    
                    const headerClass = getRoomHeaderClass(room, hasError, hasWarning);

                    let borderClass = 'border-slate-200 hover:border-blue-400';
                    if (hasError) borderClass = 'border-red-400 shadow-red-100 hover:border-red-500';
                    else if (hasWarning) borderClass = 'border-amber-400 hover:border-amber-500';
                    
                    if (selectedStaffId) borderClass += ' ring-2 ring-blue-400 ring-offset-2 cursor-pointer';

                    return (
                        <div key={room.id} className="h-full min-h-0">
                            <RoomCard
                                room={room}
                                assignedStaff={assigned}
                                roomIssues={roomIssues}
                                selectedStaffId={selectedStaffId}
                                headerClass={headerClass}
                                borderClass={borderClass}
                                onRoomClick={() => onRoomClick(room.id)}
                                onOpenWizard={onOpenWizard}
                                onStaffClick={onStaffClick}
                                onToggleSick={onToggleSick}
                                onShiftChange={onShiftChange}
                                onRemoveStaff={(staffId) => onRemoveStaff(room.id, staffId)}
                                onNotify={onNotify}
                                readOnly={readOnly}
                            />
                        </div>
                    );
                })}
                
                {/* Empty state if no rooms */}
                {rooms.length === 0 && (
                    <div className="col-span-full flex items-center justify-center h-full text-slate-400 italic">
                        Keine Säle geladen. Bitte Import starten.
                    </div>
                )}
            </div>
        </section>
    );
};


