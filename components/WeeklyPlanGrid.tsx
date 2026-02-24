import React, { useState } from 'react';
import {
    DndContext, DragEndEvent, DragOverlay, MouseSensor, TouchSensor,
    useSensor, useSensors, useDroppable, useDraggable, pointerWithin
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { WeekDay, WeeklyAssignment, Location, Staff, ShiftType } from '../types';
import { usePlan } from '../contexts/PlanContext';
import { useStaff } from '../contexts/StaffContext';
import { getWeekDays, getAssignmentsForDay } from '../services/weeklyPlanService';

// ── Type helpers ──────────────────────────────────────────────────────────────

interface DragData {
    staffId: string;
    fromLocationId: string;
    fromDay: WeekDay;
}

// ── Shift badge ───────────────────────────────────────────────────────────────

const SHIFT_COLORS: Record<string, string> = {
    F7: 'bg-blue-100 text-blue-800',
    AF7: 'bg-teal-100 text-teal-800',
    AT19: 'bg-purple-100 text-purple-800',
    T11: 'bg-orange-100 text-orange-800',
    AT11: 'bg-pink-100 text-pink-800',
    T10: 'bg-yellow-100 text-yellow-800',
    R1: 'bg-amber-100 text-amber-800',
    F5: 'bg-green-100 text-green-800',
    BD: 'bg-red-100 text-red-800',
    BD_FR: 'bg-red-200 text-red-900',
    R3: 'bg-gray-100 text-gray-700',
    OFF: 'bg-gray-50 text-gray-400',
    URLAUB: 'bg-sky-100 text-sky-700',
    SICK: 'bg-rose-100 text-rose-700',
    RECOVERY: 'bg-indigo-50 text-indigo-400',
};

const ShiftBadge: React.FC<{ shiftCode: string }> = ({ shiftCode }) => (
    <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${SHIFT_COLORS[shiftCode] ?? 'bg-gray-100 text-gray-600'}`}>
        {shiftCode}
    </span>
);

// ── Staff chip (in cell) ──────────────────────────────────────────────────────

interface StaffChipProps {
    assignment: WeeklyAssignment;
    staff: Staff | undefined;
    isReadOnly: boolean;
    isDragOverlay?: boolean;
    onRemove: () => void;
}

const StaffChip: React.FC<StaffChipProps> = ({ assignment, staff, isReadOnly, isDragOverlay, onRemove }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `${assignment.locationId}__${assignment.day}`,
        data: {
            staffId: assignment.staffId,
            fromLocationId: assignment.locationId,
            fromDay: assignment.day,
        } as DragData,
        disabled: isReadOnly,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.35 : 1,
    };

    const initials = staff
        ? staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '??';

    return (
        <div
            ref={setNodeRef}
            style={isDragOverlay ? undefined : style}
            {...listeners}
            {...attributes}
            className={`
                group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg
                bg-white border border-gray-200 shadow-sm
                select-none cursor-grab active:cursor-grabbing
                ${isDragOverlay ? 'shadow-xl rotate-2 scale-105' : ''}
                ${assignment.isManual ? 'border-blue-300 ring-1 ring-blue-200' : ''}
            `}
        >
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold shrink-0">
                {initials}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-800 truncate leading-tight">
                    {staff?.name ?? assignment.staffId}
                </p>
                <ShiftBadge shiftCode={assignment.shiftCode} />
            </div>
            {!isReadOnly && (
                <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center
                               w-4 h-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
                    title="Entfernen"
                >
                    <X size={9} />
                </button>
            )}
        </div>
    );
};

// ── Drop cell ─────────────────────────────────────────────────────────────────

interface DropCellProps {
    locationId: string;
    day: WeekDay;
    assignment: WeeklyAssignment | undefined;
    staff: Staff | undefined;
    isReadOnly: boolean;
    hasWarning: boolean;
    onAddClick: () => void;
    onRemove: () => void;
}

const DropCell: React.FC<DropCellProps> = ({
    locationId, day, assignment, staff, isReadOnly, hasWarning, onAddClick, onRemove
}) => {
    const { setNodeRef, isOver } = useDroppable({ id: `drop__${locationId}__${day}` });

    return (
        <div
            ref={setNodeRef}
            className={`
                relative min-h-[72px] p-1.5 transition-colors rounded
                ${isOver ? 'bg-blue-50 ring-2 ring-blue-400' : 'hover:bg-gray-50'}
                ${hasWarning ? 'ring-1 ring-yellow-400' : ''}
            `}
        >
            {assignment ? (
                <StaffChip
                    assignment={assignment}
                    staff={staff}
                    isReadOnly={isReadOnly}
                    onRemove={onRemove}
                />
            ) : (
                !isReadOnly && (
                    <button
                        onClick={onAddClick}
                        className="w-full h-full min-h-[56px] flex items-center justify-center
                                   rounded border-2 border-dashed border-gray-200
                                   text-gray-300 hover:text-gray-400 hover:border-gray-300
                                   transition-colors group"
                        title="MA zuweisen"
                    >
                        <Plus size={16} className="group-hover:scale-110 transition-transform" />
                    </button>
                )
            )}
            {hasWarning && !assignment && (
                <div className="absolute top-1 right-1 text-yellow-500">
                    <AlertTriangle size={12} />
                </div>
            )}
        </div>
    );
};

// ── Location type row colours ─────────────────────────────────────────────────
const LOCATION_ROW_STYLE: Record<string, string> = {
    OR: 'bg-white',
    EXTERNAL: 'bg-blue-50/50',
    AWR: 'bg-emerald-50/60',
};

const LOCATION_LABEL_STYLE: Record<string, string> = {
    OR: 'text-gray-800',
    EXTERNAL: 'text-blue-800',
    AWR: 'text-emerald-800',
};

// ── Quick-assign mini dropdown ────────────────────────────────────────────────

interface QuickAssignProps {
    locationId: string;
    day: WeekDay;
    onAssign: (staffId: string) => void;
    onClose: () => void;
}

const ABSENCE_CODES = new Set(['BD', 'BD1', 'BD2', 'BD_FR', 'KK', 'KO', 'AU', 'URLAUB', 'OFF', 'SICK', 'RECOVERY', 'F5']);

const QuickAssignDropdown: React.FC<QuickAssignProps> = ({ locationId, day, onAssign, onClose }) => {
    const { staffList } = useStaff();
    const { currentWeekPlan, locations } = usePlan();

    const location = locations.find(l => l.id === locationId);
    const assignedToday = new Set(
        currentWeekPlan.assignments
            .filter(a => a.day === day)
            .map(a => a.staffId)
    );

    // Build shift-for-day map from dailyShifts bridge (populated by handleAutoAssign roster import)
    const shiftsOnDay: Record<string, string> = (currentWeekPlan as any).dailyShifts?.[day] ?? {};

    const eligible = staffList.filter(s => {
        if (assignedToday.has(s.id)) return false;
        if (s.isManagement) return false;
        // Exclude staff who are absent / on non-working shift today
        const shiftToday = shiftsOnDay[s.id];
        if (shiftToday && ABSENCE_CODES.has(shiftToday)) return false;
        if (!location) return true;
        // Normalise areaType — legacy staff without field are treated as UNIVERSAL
        const area = s.areaType ?? 'UNIVERSAL';
        if (location.type === 'AWR' && area === 'OR') return false;
        if (location.type === 'OR' && area === 'AWR') return false;
        return true;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
            onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-4 min-w-[240px] max-h-[340px] overflow-y-auto"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">
                        MA zuweisen · {locationId} · {day}
                    </span>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>
                {eligible.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Keine MA verfügbar</p>
                ) : (
                    <ul className="space-y-1">
                        {eligible.map(s => (
                            <li key={s.id}>
                                <button
                                    onClick={() => { onAssign(s.id); onClose(); }}
                                    className="w-full text-left text-sm px-3 py-2 rounded-lg
                                               hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">
                                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </span>
                                    <span className="flex-1 truncate">{s.name}</span>
                                    {shiftsOnDay[s.id] && (
                                        <ShiftBadge shiftCode={shiftsOnDay[s.id]} />
                                    )}
                                    <span className="text-xs text-gray-400">{s.areaType ?? 'UNI'}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// ── Main grid ─────────────────────────────────────────────────────────────────

interface WeeklyPlanGridProps {
    isReadOnly?: boolean;
}

export const WeeklyPlanGrid: React.FC<WeeklyPlanGridProps> = ({ isReadOnly = false }) => {
    const {
        currentWeekPlan, currentWeekStart, locations, validationIssues,
        handleUpdateAssignment, handleMoveAssignment, handleClearAssignment
    } = usePlan();
    const { staffList } = useStaff();

    const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
    const [quickAssign, setQuickAssign] = useState<{ locationId: string; day: WeekDay } | null>(null);

    const staffById = new Map(staffList.map(s => [s.id, s]));

    const weekDays = getWeekDays(currentWeekStart);

    // Build warning cell set
    const warnCells = new Set<string>();
    for (const issue of validationIssues) {
        if (issue.locationId && issue.day) {
            warnCells.add(`${issue.locationId}__${issue.day}`);
        }
    }

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragData(null);
        const { active, over } = event;
        if (!over || !active.data.current) return;

        const drag = active.data.current as DragData;
        const [, toLocationId, toDay] = (over.id as string).split('__');

        if (!toLocationId || !toDay) return;
        if (drag.fromLocationId === toLocationId && drag.fromDay === toDay) return;

        handleMoveAssignment(drag.fromLocationId, drag.fromDay as WeekDay, toLocationId, toDay as WeekDay);
    };

    const handleQuickAssign = (locationId: string, day: WeekDay, staffId: string) => {
        // Default shift based on location type
        const loc = locations.find(l => l.id === locationId);
        let shiftCode: ShiftType = 'F7';
        if (loc?.type === 'AWR') {
            shiftCode = locationId === 'AWR_AT19' ? 'AT19'
                : locationId === 'AWR_AT11' ? 'AT11' : 'AF7';
        }
        handleUpdateAssignment({ locationId, day, staffId, shiftCode, isManual: true });
    };

    // Sort locations: OR then EXTERNAL then AWR
    const sortedLocations = [...locations].sort((a, b) => {
        const order = { OR: 0, EXTERNAL: 1, AWR: 2 };
        return (order[a.type] ?? 3) - (order[b.type] ?? 3);
    });

    const activeDragStaff = activeDragData ? staffById.get(activeDragData.staffId) : undefined;
    const activeDragAssignment = activeDragData
        ? { locationId: activeDragData.fromLocationId, day: activeDragData.fromDay, staffId: activeDragData.staffId, shiftCode: 'F7' as ShiftType }
        : null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={ev => setActiveDragData(ev.active.data.current as DragData)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragData(null)}
        >
            <div className="overflow-auto h-full">
                <table className="border-collapse w-full min-w-[680px] text-sm">
                    {/* ── Header row ─────────────────────────────────────── */}
                    <thead>
                        <tr className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                            {/* Location column */}
                            <th className="sticky left-0 z-30 bg-gray-50 min-w-[130px] px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-r border-gray-200">
                                Bereich
                            </th>
                            {weekDays.map(wd => (
                                <th key={wd.day} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[150px]">
                                    <div className="font-bold text-gray-900">{wd.day}</div>
                                    <div className="text-gray-400 font-normal">{wd.date}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* ── Body ───────────────────────────────────────────── */}
                    <tbody>
                        {sortedLocations.map((location, locIdx) => {
                            const rowBg = LOCATION_ROW_STYLE[location.type] ?? 'bg-white';
                            const labelColor = LOCATION_LABEL_STYLE[location.type] ?? 'text-gray-700';
                            const isFirstAwr = location.type === 'AWR' && (locIdx === 0 || sortedLocations[locIdx - 1].type !== 'AWR');
                            const isFirstExt = location.type === 'EXTERNAL' && (locIdx === 0 || sortedLocations[locIdx - 1].type !== 'EXTERNAL');

                            return (
                                <React.Fragment key={location.id}>
                                    {/* Section divider */}
                                    {(isFirstAwr || isFirstExt) && (
                                        <tr>
                                            <td colSpan={6} className={`py-0.5 border-y border-gray-200 ${isFirstAwr ? 'bg-emerald-100/60' : 'bg-blue-100/60'}`}>
                                                <span className={`pl-3 text-xs font-semibold uppercase tracking-wide ${isFirstAwr ? 'text-emerald-700' : 'text-blue-700'}`}>
                                                    {isFirstAwr ? '▸ AWR' : '▸ Extern'}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className={`${rowBg} border-b border-gray-100 hover:brightness-[0.98] transition-colors`}>
                                        {/* Location name cell (sticky) */}
                                        <td className={`sticky left-0 z-10 ${rowBg} border-r border-gray-200 px-3 py-2`}>
                                            <div
                                                className="w-3 h-3 rounded-full inline-block mr-1.5 align-middle"
                                                style={{ backgroundColor: location.color ?? '#94a3b8' }}
                                            />
                                            <span className={`font-semibold text-xs ${labelColor}`}>
                                                {location.name}
                                            </span>
                                        </td>

                                        {/* Day cells */}
                                        {weekDays.map(wd => {
                                            const cellKey = `${location.id}__${wd.day}`;
                                            const assignment = currentWeekPlan.assignments.find(
                                                a => a.locationId === location.id && a.day === wd.day
                                            );
                                            const staff = assignment ? staffById.get(assignment.staffId) : undefined;
                                            const hasWarning = warnCells.has(cellKey);

                                            return (
                                                <td key={wd.day} className="border-r border-gray-100 p-0.5">
                                                    <DropCell
                                                        locationId={location.id}
                                                        day={wd.day}
                                                        assignment={assignment}
                                                        staff={staff}
                                                        isReadOnly={isReadOnly}
                                                        hasWarning={hasWarning}
                                                        onAddClick={() => setQuickAssign({ locationId: location.id, day: wd.day })}
                                                        onRemove={() => handleClearAssignment(location.id, wd.day)}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Drag overlay */}
            <DragOverlay>
                {activeDragAssignment && activeDragStaff && (
                    <StaffChip
                        assignment={{ ...activeDragAssignment, shiftCode: currentWeekPlan.assignments.find(a => a.locationId === activeDragData?.fromLocationId && a.day === activeDragData?.fromDay)?.shiftCode ?? 'F7' }}
                        staff={activeDragStaff}
                        isReadOnly={false}
                        isDragOverlay
                        onRemove={() => {}}
                    />
                )}
            </DragOverlay>

            {/* Quick-assign dropdown */}
            {quickAssign && (
                <QuickAssignDropdown
                    locationId={quickAssign.locationId}
                    day={quickAssign.day}
                    onAssign={(staffId) => handleQuickAssign(quickAssign.locationId, quickAssign.day, staffId)}
                    onClose={() => setQuickAssign(null)}
                />
            )}
        </DndContext>
    );
};
