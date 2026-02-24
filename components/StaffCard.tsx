// @ts-nocheck

import React, { useState } from 'react';
import { Staff, ShiftType, ShiftDef } from '../types';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ShieldCheck, User, Thermometer, X, Clock, BedDouble, ChevronDown, Palmtree, ArrowLeftRight, MessageSquare } from 'lucide-react';

// --- SUB-COMPONENTS ---

const StaffIcon: React.FC<{ staff: Staff, iconSize: number, isVacation: boolean }> = ({ staff, iconSize, isVacation }) => {
    const containerClass = `p-1 rounded-full shrink-0 h-fit ${
        staff.isSick ? 'bg-red-100 text-red-500' 
        : isVacation ? 'bg-amber-100 text-amber-500' 
        : staff.isSaalleitung ? 'bg-amber-100 text-amber-600' 
        : 'bg-blue-50 text-blue-500'
    }`;

    if (staff.isSick) return <div className={containerClass}><Thermometer size={iconSize} /></div>;
    if (isVacation) return <div className={containerClass}><Palmtree size={iconSize} /></div>;
    if (staff.isSaalleitung) return <div className={containerClass}><ShieldCheck size={iconSize} /></div>;
    return <div className={containerClass}><User size={iconSize} /></div>;
};

const ShiftSelect: React.FC<{ 
    currentShift: ShiftType, 
    staffId: string, 
    onChange: (id: string, shift: ShiftType) => void,
    shiftConfig: Record<string, ShiftDef>
}> = ({ currentShift, staffId, onChange, shiftConfig }) => {
    return (
        <div className={`relative flex items-center justify-center rounded px-1.5 py-1 transition-colors border ${currentShift !== 'T1' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 hover:bg-slate-100 border-transparent'}`} title="Schicht ändern">
            <div className="flex items-center gap-0.5 pointer-events-none">
                <Clock size={12} className={currentShift !== 'T1' ? 'text-blue-500' : 'text-slate-400'} />
                {currentShift !== 'T1' && <span className="text-[9px] font-bold text-blue-600">{currentShift}</span>}
            </div>
            <select 
                value={currentShift}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                    e.stopPropagation();
                    onChange(staffId, e.target.value as ShiftType);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
            >
                {Object.entries(shiftConfig).map(([code, config]) => (
                    <option key={code} value={code}>
                        {config.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

const ShiftDropdown: React.FC<{
    currentShift: ShiftType,
    staffId: string,
    onShiftChange: (id: string, shift: ShiftType) => void,
    shiftConfig: Record<string, ShiftDef>
}> = ({ currentShift, staffId, onShiftChange, shiftConfig }) => {
    const [isOpen, setIsOpen] = useState(false);
    const shiftInfo = shiftConfig[currentShift];

    return (
        <div className="relative z-30">
            <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-bold cursor-pointer transition-colors ${shiftInfo?.color || 'bg-slate-100 text-slate-600'}`}
            >
                <Clock size={10} /> 
                {shiftInfo?.label || currentShift}
                <ChevronDown size={8} />
            </button>
            
            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }} 
                    />
                    <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg w-32 py-1 max-h-48 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-100">
                        {Object.entries(shiftConfig).map(([code, config]) => (
                            <button 
                                key={code}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onShiftChange(staffId, code as ShiftType); 
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-2 py-1 text-[10px] hover:bg-slate-50 flex items-center justify-between ${currentShift === code ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}`}
                            >
                                <span>{config.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

interface StaffCardProps {
  staff: Staff;
  onClick?: () => void;
  compact?: boolean;
  tiny?: boolean; 
  onToggleSick?: (id: string) => void;
  onShiftChange?: (id: string, shift: ShiftType) => void;
  onRemove?: () => void;
  onNotify?: (staff: Staff) => void; 
  isSelected?: boolean;
  isVacation?: boolean;
  readOnly?: boolean;
  shiftConfig?: Record<string, ShiftDef>; // Optional, passed from parent
}

const StaffCardComponent: React.FC<StaffCardProps> = ({ 
    staff, 
    onClick, 
    compact = false, 
    tiny = false,
    onToggleSick, 
    onShiftChange, 
    onRemove, 
    onNotify,
    isSelected = false, 
    isVacation = false,
    readOnly = false,
    shiftConfig = {} // Fallback to empty if not provided, but should be passed
}) => {
  const currentShift = staff.currentShift || 'T1';
  const shiftInfo = shiftConfig[currentShift];
  const isRecovering = currentShift === 'RECOVERY';
  const isAvailable = !staff.isSick && !isRecovering && !isVacation && currentShift !== 'OFF';
  const isDraggable = !readOnly && isAvailable;

  // dnd-kit Draggable
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: staff.id,
      data: { staff, type: 'staff' },
      disabled: !isDraggable
  });

  // dnd-kit Droppable (for swapping)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
      id: staff.id,
      data: { staff, type: 'staff' },
      disabled: readOnly
  });

  const style = {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.4 : 1,
      // 'manipulation' allows panning/scrolling on touch devices.
      touchAction: 'manipulation' 
  };

  const setRefs = (element: HTMLElement | null) => {
      setNodeRef(element);
      setDropRef(element);
  };

  const containerPadding = tiny ? 'p-1.5 gap-1.5' : compact ? 'p-2 gap-2' : 'p-3 gap-2';
  const iconSize = tiny ? 14 : (compact ? 14 : 16);
  const isSwapTarget = isOver && !isDragging;

  return (
    <div 
      ref={setRefs}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!readOnly && onClick) {
            e.stopPropagation();
            onClick();
        }
      }}
      className={`
        relative group
        border rounded-lg shadow-sm transition-all select-none
        flex flex-col 
        ${containerPadding}
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 z-20 bg-blue-50/50' : 'z-0'}
        ${!readOnly ? 'hover:z-50' : ''}
        ${isSwapTarget ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-50 shadow-md z-30' : ''} 
        ${!isSelected && !isSwapTarget && staff.isSick ? 'bg-red-50 border-red-200 opacity-90' : ''}
        ${!isSelected && !isSwapTarget && isRecovering ? 'bg-slate-100 border-slate-200 opacity-80' : ''}
        ${!isSelected && !isSwapTarget && isVacation ? 'bg-amber-50 border-amber-200 opacity-90' : ''}
        ${!isSelected && !isSwapTarget && !staff.isSick && !isRecovering && !isVacation ? 'bg-white border-gray-200' : ''}
        ${!readOnly && !isSelected && !isSwapTarget && !staff.isSick && !isRecovering && !isVacation ? 'hover:shadow-md hover:border-blue-300' : ''}
        ${compact ? 'min-w-[140px] text-sm' : ''} 
        ${tiny ? 'text-xs' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
      `}
    >
      {/* --- OVERLAYS --- */}
      {isSwapTarget && (
          <div className="absolute inset-0 bg-purple-500/10 z-40 flex items-center justify-center rounded-lg pointer-events-none">
               <div className="bg-white text-purple-600 px-2 py-1 rounded-full shadow text-[10px] font-bold flex items-center gap-1">
                   <ArrowLeftRight size={12} /> Swap
               </div>
          </div>
      )}

      {isRecovering && (
        <div className="absolute inset-0 bg-slate-100/50 z-10 flex items-center justify-center rounded-lg pointer-events-none">
            <div className="bg-white/90 px-2 py-0.5 rounded shadow-sm border border-slate-200 flex items-center gap-1">
                <BedDouble size={12} className="text-slate-400" />
                {!tiny && <span className="text-[10px] font-bold text-slate-500">Ruhezeit</span>}
            </div>
        </div>
      )}

      {isVacation && (
        <div className="absolute inset-0 bg-amber-50/30 z-10 flex items-center justify-center rounded-lg pointer-events-none">
            <div className="bg-white/90 px-2 py-0.5 rounded shadow-sm border border-amber-200 flex items-center gap-1">
                <Palmtree size={12} className="text-amber-500" />
                {!tiny && <span className="text-[10px] font-bold text-amber-600">Urlaub</span>}
            </div>
        </div>
      )}

      {/* --- HOVER ACTIONS (DESKTOP) --- */}
      {!readOnly && !tiny && (
          <div className="absolute top-1 right-1 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onNotify && staff.phone && !isVacation && !staff.isSick && (
                <button 
                    onPointerDown={(e) => e.stopPropagation()} 
                    onClick={(e) => { e.stopPropagation(); onNotify(staff); }}
                    className="p-1 rounded-full bg-slate-100 text-slate-400 hover:bg-green-100 hover:text-green-600 cursor-pointer"
                    title="SMS senden"
                >
                    <MessageSquare size={12} />
                </button>
            )}
            {onToggleSick && !isVacation && (
                <button 
                    onPointerDown={(e) => e.stopPropagation()} 
                    onClick={(e) => { e.stopPropagation(); onToggleSick(staff.id); }}
                    className="p-1 rounded-full bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 cursor-pointer"
                >
                    <Thermometer size={12} />
                </button>
            )}
            {onRemove && (
                <button 
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="p-1 rounded-full bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 cursor-pointer"
                >
                    <X size={12} />
                </button>
            )}
          </div>
      )}

      {/* --- CONTENT ROW --- */}
      <div className="flex justify-between items-center min-w-0">
        <div className="flex items-center gap-2 overflow-hidden w-full">
            <StaffIcon staff={staff} iconSize={iconSize} isVacation={isVacation} />
            
            <div className="min-w-0 flex flex-col justify-center w-full">
                <h4 className={`font-bold leading-tight truncate ${tiny ? 'text-xs' : compact ? 'text-xs' : 'text-sm'} ${staff.isSick ? 'text-red-700' : isVacation ? 'text-amber-700' : 'text-slate-900'}`}>
                    {staff.name}
                </h4>
                
                {/* Role is now always shown under the name for clarity */}
                <p className={`text-[10px] truncate ${staff.isSick ? 'text-red-400' : isVacation ? 'text-amber-500' : 'text-gray-500'}`}>
                    {staff.role}
                </p>
            </div>
        </div>
        
        {/* --- TINY MODE ACTIONS (TOUCH) --- */}
        {!readOnly && tiny ? (
            <div className="flex items-center gap-1 ml-1 shrink-0 self-start">
                 {onNotify && staff.phone && !isVacation && !staff.isSick && (
                    <button 
                        onPointerDown={(e) => e.stopPropagation()} 
                        onClick={(e) => { e.stopPropagation(); onNotify(staff); }}
                        className="p-1 rounded border border-transparent text-slate-300 hover:text-green-600 hover:bg-green-50 hover:border-green-100 cursor-pointer transition-colors"
                        title="SMS senden"
                    >
                        <MessageSquare size={12} />
                    </button>
                 )}
                 {onShiftChange && !staff.isSick && !isRecovering && !isVacation && (
                    <ShiftSelect currentShift={currentShift} staffId={staff.id} onChange={onShiftChange} shiftConfig={shiftConfig} />
                )}
                {onToggleSick && !isVacation && (
                    <button 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onToggleSick(staff.id); }}
                        className={`p-1 rounded border transition-colors cursor-pointer ${staff.isSick ? 'bg-red-100 text-red-600 border-red-200' : 'bg-slate-50 text-slate-300 border-transparent hover:bg-red-50 hover:text-red-500 hover:border-red-100'}`}
                        title="Krank melden"
                    >
                        <Thermometer size={12} />
                    </button>
                )}
                {onRemove && (
                    <button 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="p-1 rounded bg-slate-50 text-slate-300 border border-transparent hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors cursor-pointer"
                        title="Entfernen"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        ) : (
            !tiny && staff.isSick && (
                 <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">Krank</span>
            )
        )}
      </div>
      
      {/* --- STANDARD BADGES / SHIFT (NON-TINY) --- */}
      {!tiny && (
          <div className="flex flex-wrap gap-1 mt-1 items-center">
            {onShiftChange && !readOnly && !staff.isSick && !isRecovering && !isVacation ? (
                <ShiftDropdown 
                    currentShift={currentShift} 
                    staffId={staff.id} 
                    onShiftChange={onShiftChange}
                    shiftConfig={shiftConfig}
                />
            ) : (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${shiftInfo?.color || 'bg-slate-100'}`}>
                    {isRecovering ? <BedDouble size={10} /> : <Clock size={10} />}
                    {shiftInfo?.label}
                </span>
            )}
            {/* Qualification badges removed per request to declutter */}
          </div>
      )}
    </div>
  );
};

export const StaffCard = React.memo(StaffCardComponent, (prev, next) => {
    // 1. Core Data Changes
    if (prev.staff.id !== next.staff.id) return false;
    if (prev.staff.name !== next.staff.name) return false;
    if (prev.staff.currentShift !== next.staff.currentShift) return false;
    if (prev.staff.isSick !== next.staff.isSick) return false;
    if (prev.staff.phone !== next.staff.phone) return false; 
    
    // 2. Props Changes
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isVacation !== next.isVacation) return false;
    if (prev.readOnly !== next.readOnly) return false;
    if (prev.compact !== next.compact) return false;
    if (prev.tiny !== next.tiny) return false;
    
    // 3. Check config
    if (prev.shiftConfig !== next.shiftConfig) return false;

    return true;
});


