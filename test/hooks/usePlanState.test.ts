import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlanState } from '../../hooks/usePlanState';

describe('usePlanState Hook', () => {
    
    it('should initialize with default values', () => {
        const { result } = renderHook(() => usePlanState());

        expect(result.current.rooms).toEqual([]);
        expect(result.current.assignments).toEqual([]);
        expect(result.current.staffShifts).toEqual({});
        expect(result.current.currentDate).toBeDefined();
        expect(result.current.history).toEqual([]);
        expect(result.current.future).toEqual([]);
    });

    it('should update rooms', () => {
        const { result } = renderHook(() => usePlanState());

        const newRooms = [
            { id: 'R1', name: 'SAAL 1', primaryDepts: ['UCH'], operations: [], requiredStaffCount: 2 }
        ];

        act(() => {
            result.current.setRooms(newRooms as any);
        });

        expect(result.current.rooms).toEqual(newRooms);
    });

    it('should update assignments', () => {
        const { result } = renderHook(() => usePlanState());

        const newAssignments = [
            { roomId: 'R1', staffIds: ['S1', 'S2'] }
        ];

        act(() => {
            result.current.setAssignments(newAssignments);
        });

        expect(result.current.assignments).toEqual(newAssignments);
    });

    it('should update staff shifts', () => {
        const { result } = renderHook(() => usePlanState());

        const shifts = { 'S1': 'T1' as any, 'S2': 'S44' as any };

        act(() => {
            result.current.setStaffShifts(shifts);
        });

        expect(result.current.staffShifts).toEqual(shifts);
    });

    it('should update current date', () => {
        const { result } = renderHook(() => usePlanState());

        const newDate = '15.12.2025';

        act(() => {
            result.current.setCurrentDate(newDate);
        });

        expect(result.current.currentDate).toBe(newDate);
    });

    it('should manage history for undo/redo', () => {
        const { result } = renderHook(() => usePlanState());

        const state1 = {
            rooms: [{ id: 'R1', name: 'SAAL 1', primaryDepts: ['UCH'], operations: [], requiredStaffCount: 2 }],
            assignments: [{ roomId: 'R1', staffIds: ['S1'] }]
        };

        act(() => {
            result.current.saveToHistory();
            result.current.setRooms(state1.rooms as any);
            result.current.setAssignments(state1.assignments);
        });

        expect(result.current.history.length).toBeGreaterThan(0);
    });

    it('should track imported operations count', () => {
        const { result } = renderHook(() => usePlanState());

        act(() => {
            result.current.setImportedOpsCount(5);
        });

        expect(result.current.importedOpsCount).toBe(5);
    });

    it('should update custom times for staff', () => {
        const { result } = renderHook(() => usePlanState());

        const customTimes = { 
            'S1': { start: '08:00', end: '16:00' }
        };

        act(() => {
            result.current.setStaffCustomTimes(customTimes);
        });

        expect(result.current.staffCustomTimes).toEqual(customTimes);
    });

    it('should reset history when requested', () => {
        const { result } = renderHook(() => usePlanState());

        act(() => {
            result.current.saveToHistory();
            result.current.saveToHistory();
        });

        expect(result.current.history.length).toBeGreaterThan(0);

        act(() => {
            result.current.resetHistory();
        });

        expect(result.current.history).toEqual([]);
        expect(result.current.future).toEqual([]);
    });
});
