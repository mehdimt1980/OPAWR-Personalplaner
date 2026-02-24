
import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, Assignment, ShiftType, RoomConfig, CustomTime, AppConfig } from '../types';
import { savePlan, loadPlan, loadRoster, saveLastActiveDate } from '../services/storageService';
import { getPreviousDayDate, calculateRecoveringStaff } from '../services/planningService';
import { DEMO_DATE, DEFAULT_SHIFT_CONFIG } from '../constants';
import { BUILD_INITIAL_ROOMS } from '../services/dataService';

export const useDataPersistence = (
    currentDate: string,
    assignments: Assignment[],
    rooms: Room[],
    staffShifts: Record<string, ShiftType>,
    staffCustomTimes: Record<string, CustomTime>,
    importedOpsCount: number,
    isAuthenticated: boolean,
    isPublicView: boolean,
    setRooms: (r: Room[]) => void,
    setAssignments: (a: Assignment[]) => void,
    setStaffShifts: (s: Record<string, ShiftType>) => void,
    setStaffCustomTimes: (t: Record<string, CustomTime>) => void,
    setImportedOpsCount: (c: number) => void,
    setCurrentDate: (d: string) => void,
    resetHistory: () => void,
    roomConfig?: RoomConfig[],
    appConfig?: AppConfig // Config for dynamic rules
) => {
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'conflict'>('saved');
    const [isLoadingPlan, setIsLoadingPlan] = useState(true);
    const [planVersion, setPlanVersion] = useState<number>(0);
    
    // Refs to break dependency cycles and track dirty state
    const planVersionRef = useRef(planVersion);
    const lastSavedStateRef = useRef<string>('');

    // Keep ref in sync with state
    useEffect(() => {
        planVersionRef.current = planVersion;
    }, [planVersion]);

    const loadDateData = useCallback(async (date: string) => {
        setIsLoadingPlan(true);
        resetHistory();
        setSaveStatus('saved'); // Reset any conflict status on load
        
        try {
            // Load Current Plan
            const plan = await loadPlan(date);
            
            // Load Previous Day (for Recovery status)
            const prevDate = getPreviousDayDate(date);
            const prevPlan = await loadPlan(prevDate);
            
            // Pass dynamic shift config if available, else default
            const shiftConfig = appConfig?.shifts || DEFAULT_SHIFT_CONFIG;
            const recoveringStaffIds = calculateRecoveringStaff(prevPlan, shiftConfig);

            let currentShifts: Record<string, ShiftType> = {};
            let currentCustomTimes: Record<string, CustomTime> = {};
            let loadedAssignments: Assignment[] = [];
            let loadedRooms: Room[] = [];
            let loadedOpsCount = 0;
            let currentVersion = 0;

            if (plan) {
                // Set Version for Optimistic Locking
                currentVersion = plan.version || 1;

                if (plan.operations && plan.operations.length > 0) {
                    // Pass the roomConfig to the builder
                    loadedRooms = BUILD_INITIAL_ROOMS(plan.operations, roomConfig);
                    loadedOpsCount = plan.operations.length;
                } else {
                    // Even with no operations, we want to show the configured rooms
                    loadedRooms = BUILD_INITIAL_ROOMS([], roomConfig);
                    loadedOpsCount = 0;
                }
                loadedAssignments = plan.assignments || [];
                currentShifts = plan.staffShifts || {};
            } else {
                currentVersion = 0; // New Plan
                loadedRooms = BUILD_INITIAL_ROOMS([], roomConfig);
                loadedAssignments = [];
                loadedOpsCount = 0;
                
                // Fallback: If plan is missing (deleted), explicitly try to load the roster
                const roster = await loadRoster(date);
                currentShifts = roster?.shifts || {};
            }

            // Always try to load latest Roster info for custom times
            // loadPlan already merges shifts, but we need customTimes specifically
            const roster = await loadRoster(date);
            if (roster && roster.customTimes) {
                currentCustomTimes = roster.customTimes;
            }

            // Apply Recovery Logic
            recoveringStaffIds.forEach(id => {
                currentShifts[id] = 'RECOVERY';
            });

            // Update State
            setPlanVersion(currentVersion);
            setRooms(loadedRooms);
            setAssignments(loadedAssignments);
            setStaffShifts(currentShifts);
            setStaffCustomTimes(currentCustomTimes);
            setImportedOpsCount(loadedOpsCount);

            // Initialize Checksum to prevent immediate auto-save
            lastSavedStateRef.current = JSON.stringify({
                a: loadedAssignments,
                r: loadedRooms,
                s: currentShifts,
                c: currentCustomTimes
            });
            
        } catch (e) {
            console.error("Error loading data", e);
        } finally {
            setIsLoadingPlan(false);
        }
    }, [setRooms, setAssignments, setStaffShifts, setStaffCustomTimes, setImportedOpsCount, resetHistory, roomConfig, appConfig]); 

    // Initial Load / Recovery
    useEffect(() => {
        if (isAuthenticated || isPublicView) {
            // Always start at "Today" (DEMO_DATE), ignoring stored session history per user request.
            const dateToLoad = DEMO_DATE;
            
            if (dateToLoad !== currentDate) {
                setCurrentDate(dateToLoad);
            }
            loadDateData(dateToLoad);
        }
    }, [isAuthenticated, isPublicView, roomConfig, appConfig]); // Trigger reload when config changes

    // Auto-Save
    useEffect(() => {
        if (isPublicView || isLoadingPlan || !isAuthenticated) return;

        // 1. Dirty Check: Compare current state with last known saved state
        const currentState = {
            a: assignments,
            r: rooms,
            s: staffShifts,
            c: staffCustomTimes
        };
        const currentStateStr = JSON.stringify(currentState);

        if (currentStateStr === lastSavedStateRef.current) {
            // Data is identical to server state. No need to save.
            if (saveStatus === 'unsaved') setSaveStatus('saved');
            return;
        }

        // Don't try to save if we are already in a conflict state
        if (saveStatus === 'conflict') return;

        setSaveStatus('unsaved');
        const timer = setTimeout(async () => {
            if (!isLoadingPlan) {
                setSaveStatus('saving');
                // Use ref for version to avoid dependency cycle
                const { result, newVersion } = await savePlan(currentDate, assignments, rooms, staffShifts, staffCustomTimes, planVersionRef.current);
                
                if (result === 'conflict') {
                    setSaveStatus('conflict');
                } else if (result === 'success') {
                    setSaveStatus('saved');
                    if (newVersion && newVersion > planVersionRef.current) {
                         setPlanVersion(newVersion); 
                    }
                    saveLastActiveDate(currentDate);
                    
                    // Update checksum to acknowledge this state is now saved
                    lastSavedStateRef.current = currentStateStr;
                } else {
                    setSaveStatus('unsaved'); // Retry or stay unsaved on error
                }
            }
        }, 1000); 

        return () => clearTimeout(timer);
    }, [assignments, rooms, currentDate, staffShifts, staffCustomTimes, isAuthenticated, isPublicView, isLoadingPlan]); 

    return { loadDateData, saveStatus, setSaveStatus, isLoadingPlan, setIsLoadingPlan };
};
