import React, { createContext, useContext, useMemo, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { WeeklyPlan, WeeklyAssignment, ShiftType, Staff, AppConfig, StaffPairing, Location, WeekDay, PairingType } from '../types';
import { useStaff } from './StaffContext';
import { autoAssignWeek } from '../services/weeklyPlanningService';
import { validateWeeklyPlan, type WeeklyValidationIssue } from '../services/validationService';
import {
    loadAppConfig, saveAppConfig, loadPairings, savePairing, deletePairing,
    loadLocationConfig, saveLocationConfig, loadRoster
} from '../services/storageService';
import {
    saveWeeklyPlan, loadWeeklyPlan, deleteWeeklyPlan, createEmptyWeeklyPlan,
    getCurrentWeekMonday, navigateWeek, formatWeekLabel, getWeekDays,
    setAssignment, clearAssignment, moveAssignment,
    getStaffShiftForDay, setStaffShiftForDay,
    saveLastActiveWeek, getLastActiveWeek
} from '../services/weeklyPlanService';
import { DEFAULT_APP_CONFIG, DEFAULT_LOCATIONS } from '../constants';

// ── History snapshot for undo/redo ────────────────────────────────────────────
interface HistorySnapshot {
    plan: WeeklyPlan;
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface PlanContextType {
    // State
    currentWeekPlan: WeeklyPlan;
    currentWeekStart: string;
    weekLabel: string;
    locations: Location[];
    appConfig: AppConfig;
    pairings: StaffPairing[];
    validationIssues: WeeklyValidationIssue[];
    saveStatus: 'saved' | 'saving' | 'unsaved';
    isLoadingPlan: boolean;
    canUndo: boolean;
    canRedo: boolean;

    // Week navigation
    switchWeek: (weekStart: string) => Promise<void>;
    goNextWeek: () => Promise<void>;
    goPrevWeek: () => Promise<void>;

    // Assignment mutations
    handleUpdateAssignment: (assignment: WeeklyAssignment) => void;
    handleMoveAssignment: (
        fromLocationId: string, fromDay: WeekDay,
        toLocationId: string, toDay: WeekDay
    ) => void;
    handleClearAssignment: (locationId: string, day: WeekDay) => void;

    // Shift-level mutations
    handleSetDailyShift: (staffId: string, day: WeekDay, shift: ShiftType) => void;

    // Auto-assign
    handleAutoAssign: () => Promise<void>;

    // Plan lifecycle
    deleteCurrentPlan: () => Promise<void>;

    // Config
    updateAppConfig: (config: AppConfig) => Promise<void>;
    updateLocations: (locs: Location[]) => Promise<void>;

    // Pairings
    addPairing: (s1: string, s2: string, type: PairingType) => Promise<void>;
    removePairing: (id: string) => Promise<void>;

    // Undo/Redo
    undo: () => void;
    redo: () => void;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export const PlanProvider: React.FC<{ children: ReactNode; isAuthenticated: boolean; isPublicView: boolean }> = ({
    children, isAuthenticated, isPublicView
}) => {
    const { staffList } = useStaff();

    // ── Core state ────────────────────────────────────────────────────────────
    const [currentWeekStart, setCurrentWeekStart] = useState<string>(getCurrentWeekMonday());
    const [currentWeekPlan, setCurrentWeekPlan] = useState<WeeklyPlan>(
        () => createEmptyWeeklyPlan(getCurrentWeekMonday())
    );
    const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
    const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
    const [pairings, setPairings] = useState<StaffPairing[]>([]);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [isLoadingPlan, setIsLoadingPlan] = useState(true);

    // ── History state ─────────────────────────────────────────────────────────
    const [history, setHistory] = useState<HistorySnapshot[]>([]);
    const [future, setFuture] = useState<HistorySnapshot[]>([]);

    const saveToHistory = useCallback(() => {
        setHistory(prev => {
            const snap: HistorySnapshot = { plan: JSON.parse(JSON.stringify(currentWeekPlan)) };
            const next = [...prev, snap];
            return next.length > 20 ? next.slice(-20) : next;
        });
        setFuture([]);
    }, [currentWeekPlan]);

    // ── Auto-save: debounced, whenever plan changes ───────────────────────────
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const mutatePlan = useCallback((updater: (prev: WeeklyPlan) => WeeklyPlan) => {
        saveToHistory();
        setCurrentWeekPlan(prev => {
            const next = updater(prev);
            // Debounced save to IndexedDB
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            setSaveStatus('unsaved');
            saveTimerRef.current = setTimeout(async () => {
                setSaveStatus('saving');
                try {
                    await saveWeeklyPlan(next);
                    setSaveStatus('saved');
                } catch (e) {
                    console.error('Failed to save weekly plan', e);
                    setSaveStatus('unsaved');
                }
            }, 1200);
            return next;
        });
    }, [saveToHistory]);

    // ── Load on mount & week change ───────────────────────────────────────────
    const loadWeek = useCallback(async (weekStart: string) => {
        setIsLoadingPlan(true);
        try {
            const [aConfig, pConfig, locConfig] = await Promise.all([
                loadAppConfig(),
                loadPairings(),
                loadLocationConfig(),
            ]);
            if (aConfig) setAppConfig(aConfig);
            setPairings(pConfig);
            if (locConfig && locConfig.length > 0) setLocations(locConfig);

            const plan = await loadWeeklyPlan(weekStart);
            setCurrentWeekPlan(plan ?? createEmptyWeeklyPlan(weekStart));
            setSaveStatus('saved');
        } finally {
            setIsLoadingPlan(false);
        }
    }, []);

    useEffect(() => {
        // On mount: restore last active week or use current
        const last = getLastActiveWeek();
        const week = last ?? getCurrentWeekMonday();
        setCurrentWeekStart(week);
        loadWeek(week);
    }, [loadWeek]);

    // ── Validation ────────────────────────────────────────────────────────────
    const validationIssues = useMemo(() => {
        if (isLoadingPlan) return [];
        return validateWeeklyPlan(currentWeekPlan, locations, staffList, appConfig);
    }, [currentWeekPlan, locations, staffList, appConfig, isLoadingPlan]);

    // ── Week navigation ───────────────────────────────────────────────────────
    const switchWeek = useCallback(async (weekStart: string) => {
        setCurrentWeekStart(weekStart);
        await saveLastActiveWeek(weekStart);
        await loadWeek(weekStart);
    }, [loadWeek]);

    const goNextWeek = useCallback(() => switchWeek(navigateWeek(currentWeekStart, 'next')), [switchWeek, currentWeekStart]);
    const goPrevWeek = useCallback(() => switchWeek(navigateWeek(currentWeekStart, 'prev')), [switchWeek, currentWeekStart]);

    // ── Assignment mutations ──────────────────────────────────────────────────
    const handleUpdateAssignment = useCallback((assignment: WeeklyAssignment) => {
        mutatePlan(prev => setAssignment(prev, assignment.locationId, assignment.day, assignment.staffId, assignment.shiftCode, assignment.isManual));
    }, [mutatePlan]);

    const handleMoveAssignment = useCallback((
        fromLocationId: string, fromDay: WeekDay,
        toLocationId: string, toDay: WeekDay
    ) => {
        mutatePlan(prev => moveAssignment(prev, fromLocationId, fromDay, toLocationId, toDay));
    }, [mutatePlan]);

    const handleClearAssignment = useCallback((locationId: string, day: WeekDay) => {
        mutatePlan(prev => clearAssignment(prev, locationId, day));
    }, [mutatePlan]);

    // ── Shift mutations ───────────────────────────────────────────────────────
    const handleSetDailyShift = useCallback((staffId: string, day: WeekDay, shift: ShiftType) => {
        mutatePlan(prev => setStaffShiftForDay(prev, staffId, day, shift));
    }, [mutatePlan]);

    // ── Auto-assign ───────────────────────────────────────────────────────────
    const handleAutoAssign = useCallback(async () => {
        saveToHistory();

        // ── Bridge: load real Dienstplan shifts from the OLD roster collection
        // and merge them into the plan's dailyShifts before running auto-assign.
        // Without this the engine sees empty shifts and ignores the real schedule.
        const weekDays = getWeekDays(currentWeekStart);
        let enrichedPlan: WeeklyPlan = {
            ...currentWeekPlan,
            dailyShifts: { ...currentWeekPlan.dailyShifts },
        };
        await Promise.all(
            weekDays.map(async ({ day, date }) => {
                const roster = await loadRoster(date);
                if (roster?.shifts) {
                    for (const [staffId, shift] of Object.entries(roster.shifts)) {
                        enrichedPlan = setStaffShiftForDay(enrichedPlan, staffId, day, shift as ShiftType);
                    }
                }
            })
        );

        const newPlan = autoAssignWeek(
            currentWeekStart,
            locations,
            staffList,
            appConfig,
            { existingPlan: enrichedPlan, pairings }
        );
        setCurrentWeekPlan(newPlan);
        setSaveStatus('saving');
        try {
            await saveWeeklyPlan(newPlan);
            setSaveStatus('saved');
        } catch {
            setSaveStatus('unsaved');
        }
    }, [currentWeekStart, locations, staffList, appConfig, currentWeekPlan, pairings, saveToHistory]);

    // ── Delete plan ───────────────────────────────────────────────────────────
    const deleteCurrentPlan = useCallback(async () => {
        saveToHistory();
        await deleteWeeklyPlan(currentWeekStart);
        setCurrentWeekPlan(createEmptyWeeklyPlan(currentWeekStart));
        setSaveStatus('saved');
    }, [currentWeekStart, saveToHistory]);

    // ── Config updates ────────────────────────────────────────────────────────
    const updateAppConfig = useCallback(async (config: AppConfig) => {
        setAppConfig(config);
        await saveAppConfig(config);
    }, []);

    const updateLocations = useCallback(async (locs: Location[]) => {
        setLocations(locs);
        await saveLocationConfig(locs);
    }, []);

    // ── Pairings ──────────────────────────────────────────────────────────────
    const addPairing = useCallback(async (s1: string, s2: string, type: PairingType) => {
        const updated = await savePairing(s1, s2, type);
        setPairings(updated);
    }, []);

    const removePairing = useCallback(async (id: string) => {
        const updated = await deletePairing(id);
        setPairings(updated);
    }, []);

    // ── Undo / Redo ───────────────────────────────────────────────────────────
    const undo = useCallback(() => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setFuture(f => [{ plan: JSON.parse(JSON.stringify(currentWeekPlan)) }, ...f]);
        setHistory(h => h.slice(0, -1));
        setCurrentWeekPlan(prev.plan);
    }, [history, currentWeekPlan]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        const next = future[0];
        setHistory(h => [...h, { plan: JSON.parse(JSON.stringify(currentWeekPlan)) }]);
        setFuture(f => f.slice(1));
        setCurrentWeekPlan(next.plan);
    }, [future, currentWeekPlan]);

    const weekLabel = useMemo(() => formatWeekLabel(currentWeekStart), [currentWeekStart]);

    return (
        <PlanContext.Provider value={{
            currentWeekPlan,
            currentWeekStart,
            weekLabel,
            locations,
            appConfig,
            pairings,
            validationIssues,
            saveStatus,
            isLoadingPlan,
            canUndo: history.length > 0,
            canRedo: future.length > 0,
            switchWeek,
            goNextWeek,
            goPrevWeek,
            handleUpdateAssignment,
            handleMoveAssignment,
            handleClearAssignment,
            handleSetDailyShift,
            handleAutoAssign,
            deleteCurrentPlan,
            updateAppConfig,
            updateLocations,
            addPairing,
            removePairing,
            undo,
            redo,
        }}>
            {children}
        </PlanContext.Provider>
    );
};

export const usePlan = () => {
    const context = useContext(PlanContext);
    if (!context) throw new Error("usePlan must be used within a PlanProvider");
    return context;
};
