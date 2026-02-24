import { useState, useCallback } from 'react';
import { Room, Assignment, ShiftType, CustomTime } from '../types';
import { DEMO_DATE } from '../constants';
import { BUILD_INITIAL_ROOMS } from '../services/dataService';

interface HistorySnapshot {
    assignments: Assignment[];
    staffShifts: Record<string, ShiftType>;
    staffCustomTimes?: Record<string, CustomTime>;
}

export const usePlanState = () => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [staffShifts, setStaffShifts] = useState<Record<string, ShiftType>>({});
    const [staffCustomTimes, setStaffCustomTimes] = useState<Record<string, CustomTime>>({});
    const [currentDate, setCurrentDate] = useState<string>(DEMO_DATE);
    const [importedOpsCount, setImportedOpsCount] = useState<number>(0);
    
    // History State
    const [history, setHistory] = useState<HistorySnapshot[]>([]);
    const [future, setFuture] = useState<HistorySnapshot[]>([]);

    const saveToHistory = useCallback(() => {
        setHistory(prev => {
            const snapshot: HistorySnapshot = {
                assignments: JSON.parse(JSON.stringify(assignments)),
                staffShifts: JSON.parse(JSON.stringify(staffShifts)),
                staffCustomTimes: JSON.parse(JSON.stringify(staffCustomTimes))
            };
            const newHistory = [...prev, snapshot];
            if (newHistory.length > 20) newHistory.shift(); // Limit history
            return newHistory;
        });
        setFuture([]); 
    }, [assignments, staffShifts, staffCustomTimes]);

    const undo = useCallback(() => {
        if (history.length === 0) return;
        
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        
        // Save current to future
        const current: HistorySnapshot = {
            assignments: JSON.parse(JSON.stringify(assignments)),
            staffShifts: JSON.parse(JSON.stringify(staffShifts)),
            staffCustomTimes: JSON.parse(JSON.stringify(staffCustomTimes))
        };
        setFuture(prev => [current, ...prev]);
        
        setHistory(newHistory);
        setAssignments(previous.assignments);
        setStaffShifts(previous.staffShifts);
        if (previous.staffCustomTimes) setStaffCustomTimes(previous.staffCustomTimes);
    }, [history, assignments, staffShifts, staffCustomTimes]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        
        const next = future[0];
        const newFuture = future.slice(1);
        
        // Save current to history
        const current: HistorySnapshot = {
            assignments: JSON.parse(JSON.stringify(assignments)),
            staffShifts: JSON.parse(JSON.stringify(staffShifts)),
            staffCustomTimes: JSON.parse(JSON.stringify(staffCustomTimes))
        };
        setHistory(prev => [...prev, current]);

        setFuture(newFuture);
        setAssignments(next.assignments);
        setStaffShifts(next.staffShifts);
        if (next.staffCustomTimes) setStaffCustomTimes(next.staffCustomTimes);
    }, [future, assignments, staffShifts, staffCustomTimes]);

    const resetHistory = useCallback(() => {
        setHistory([]);
        setFuture([]);
    }, []);

    return {
        rooms, setRooms,
        assignments, setAssignments,
        staffShifts, setStaffShifts,
        staffCustomTimes, setStaffCustomTimes,
        currentDate, setCurrentDate,
        importedOpsCount, setImportedOpsCount,
        history, future,
        saveToHistory, undo, redo, resetHistory
    };
};
