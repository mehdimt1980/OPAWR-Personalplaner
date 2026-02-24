// ============================================================================
// OPAWR-Personalplaner — Weekly Plan Storage Service
// ============================================================================

import { WeeklyPlan, WeeklyAssignment, WeekDay, Location, Staff, ShiftType } from '../types';
import { db } from '../db';
import { AuthService } from './authService';

const API_URL = '/api';
const LAST_WEEK_KEY = 'opawr_last_active_week';

export type SaveResult = 'success' | 'error' | 'conflict';

// ── Auth helper ───────────────────────────────────────────────────────────────

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = AuthService.getToken();
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
};

// ── Week utilities ────────────────────────────────────────────────────────────

/** Parse DD.MM.YYYY → Date */
export const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('.');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
};

/** Date → DD.MM.YYYY */
export const formatDate = (date: Date): string => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}.${date.getFullYear()}`;
};

/** Add N days to a date */
export const addDays = (date: Date, n: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};

/** Get Monday of the week containing the given date */
export const getMonday = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
};

/** Returns the 5 weekdays (Mon–Fri) for a week given its Monday date */
export const getWeekDays = (mondayStr: string): { day: WeekDay; date: string }[] => {
    const monday = parseDate(mondayStr);
    const days: WeekDay[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
    return days.map((day, i) => ({ day, date: formatDate(addDays(monday, i)) }));
};

/** Current week's Monday in DD.MM.YYYY */
export const getCurrentWeekMonday = (): string => {
    return formatDate(getMonday(new Date()));
};

/** Navigate to prev/next week */
export const navigateWeek = (mondayStr: string, direction: 'prev' | 'next'): string => {
    const monday = parseDate(mondayStr);
    return formatDate(addDays(monday, direction === 'next' ? 7 : -7));
};

/** Format a week label: "KW 9 · 24.02 – 28.02.2026" */
export const formatWeekLabel = (mondayStr: string): string => {
    const monday = parseDate(mondayStr);
    const friday = addDays(monday, 4);
    const kw = getWeekNumber(monday);
    const fm = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    return `KW ${kw}  ·  ${fm(monday)} – ${fm(friday)}.${friday.getFullYear()}`;
};

const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// ── Last active week ──────────────────────────────────────────────────────────

export const saveLastActiveWeek = (weekStart: string) => {
    localStorage.setItem(LAST_WEEK_KEY, weekStart);
};

export const getLastActiveWeek = (): string => {
    return localStorage.getItem(LAST_WEEK_KEY) || getCurrentWeekMonday();
};

// ── Save weekly plan ──────────────────────────────────────────────────────────

export const saveWeeklyPlan = async (plan: WeeklyPlan): Promise<{ result: SaveResult; newVersion?: number }> => {
    const payload = { ...plan };

    // 1. IndexedDB (immediate, offline-first)
    try {
        await db.weeklyPlans.put({
            weekStart: plan.weekStart,
            assignments: plan.assignments,
            dailyShifts: plan.dailyShifts,
            version: plan.version,
        });
    } catch (e) {
        console.warn('IndexedDB write failed', e);
    }

    // 2. Cloud
    try {
        const response = await fetchWithAuth(`${API_URL}/weekly-plans`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (response.status === 409) return { result: 'conflict' };
        if (response.ok) {
            const data = await response.json();
            if (data.version) {
                await db.weeklyPlans.update(plan.weekStart, { version: data.version });
            }
            return { result: 'success', newVersion: data.version };
        }
        return { result: 'error' };
    } catch (e) {
        console.warn('Cloud save failed (offline?)', e);
        return { result: 'success' };
    }
};

// ── Load weekly plan ──────────────────────────────────────────────────────────

export const loadWeeklyPlan = async (weekStart: string): Promise<WeeklyPlan | null> => {
    let plan: WeeklyPlan | null = null;

    // Try cloud first
    try {
        const response = await fetch(`${API_URL}/weekly-plans/${encodeURIComponent(weekStart)}`);
        if (response.ok) {
            const data = await response.json();
            if (data) {
                plan = data as WeeklyPlan;
                await db.weeklyPlans.put({
                    weekStart: plan.weekStart,
                    assignments: plan.assignments,
                    dailyShifts: plan.dailyShifts,
                    version: plan.version,
                });
            }
        }
    } catch (e) {}

    // Fallback to IndexedDB
    if (!plan) {
        try {
            const local = await db.weeklyPlans.get(weekStart);
            if (local) {
                plan = {
                    weekStart: local.weekStart,
                    assignments: local.assignments,
                    dailyShifts: local.dailyShifts,
                    version: local.version,
                };
            }
        } catch (e) {}
    }

    return plan;
};

// ── Delete weekly plan ────────────────────────────────────────────────────────

export const deleteWeeklyPlan = async (weekStart: string): Promise<boolean> => {
    try { await db.weeklyPlans.delete(weekStart); } catch (e) {}
    try {
        await fetchWithAuth(`${API_URL}/weekly-plans/${encodeURIComponent(weekStart)}`, { method: 'DELETE' });
    } catch (e) {}
    return true;
};

// ── Empty plan factory ────────────────────────────────────────────────────────

export const createEmptyWeeklyPlan = (weekStart: string): WeeklyPlan => ({
    weekStart,
    assignments: [],
    dailyShifts: {},
    version: 0,
});

// ── Plan helpers ──────────────────────────────────────────────────────────────

/** Get all assignments for a specific day */
export const getAssignmentsForDay = (plan: WeeklyPlan, day: WeekDay): WeeklyAssignment[] =>
    plan.assignments.filter(a => a.day === day);

/** Get assignment for a specific location on a specific day */
export const getAssignmentForCell = (
    plan: WeeklyPlan,
    locationId: string,
    day: WeekDay
): WeeklyAssignment | undefined =>
    plan.assignments.find(a => a.locationId === locationId && a.day === day);

/** Add or replace an assignment in the plan */
export const setAssignment = (
    plan: WeeklyPlan,
    locationId: string,
    day: WeekDay,
    staffId: string,
    shiftCode: string,
    isManual = true
): WeeklyPlan => {
    const filtered = plan.assignments.filter(
        a => !(a.locationId === locationId && a.day === day)
    );
    return {
        ...plan,
        assignments: [...filtered, { locationId, day, staffId, shiftCode, isManual }],
    };
};

/** Remove an assignment from a cell */
export const clearAssignment = (plan: WeeklyPlan, locationId: string, day: WeekDay): WeeklyPlan => ({
    ...plan,
    assignments: plan.assignments.filter(
        a => !(a.locationId === locationId && a.day === day)
    ),
});

/** Move staff from one cell to another */
export const moveAssignment = (
    plan: WeeklyPlan,
    fromLocationId: string,
    fromDay: WeekDay,
    toLocationId: string,
    toDay: WeekDay
): WeeklyPlan => {
    const source = getAssignmentForCell(plan, fromLocationId, fromDay);
    if (!source) return plan;

    let newPlan = clearAssignment(plan, fromLocationId, fromDay);
    // Remove existing in target too (swap)
    const existing = getAssignmentForCell(newPlan, toLocationId, toDay);
    if (existing) {
        // Put source's staff at target, target's staff at source
        newPlan = clearAssignment(newPlan, toLocationId, toDay);
        newPlan = setAssignment(newPlan, toLocationId, toDay, source.staffId, source.shiftCode, true);
        newPlan = setAssignment(newPlan, fromLocationId, fromDay, existing.staffId, existing.shiftCode, true);
    } else {
        newPlan = setAssignment(newPlan, toLocationId, toDay, source.staffId, source.shiftCode, true);
    }
    return newPlan;
};

/** Get the shift code for a staff member on a specific day */
export const getStaffShiftForDay = (
    plan: WeeklyPlan,
    staffId: string,
    day: WeekDay
): ShiftType | undefined => {
    return plan.dailyShifts[day]?.[staffId];
};

/** Set a shift code for a staff member on a specific day */
export const setStaffShiftForDay = (
    plan: WeeklyPlan,
    staffId: string,
    day: WeekDay,
    shiftCode: ShiftType
): WeeklyPlan => ({
    ...plan,
    dailyShifts: {
        ...plan.dailyShifts,
        [day]: {
            ...(plan.dailyShifts[day] || {}),
            [staffId]: shiftCode,
        },
    },
});

/** Check if a staff member is available on a given day based on their shift */
export const isStaffAvailableOnDay = (staff: Staff, plan: WeeklyPlan | null, day: WeekDay): boolean => {
    if (staff.isSick) return false;
    if (staff.isManagement) return false;

    // Check work days
    if (!staff.workDays.includes(day)) return false;

    // Part-time with fixed days
    if (staff.contractType === 'PART_TIME' && staff.fixedDays && !staff.fixedDays.includes(day)) return false;

    // Check daily shift if a plan exists
    const shift = plan ? getStaffShiftForDay(plan, staff.id, day) : undefined;
    if (shift && ['OFF', 'URLAUB', 'SICK', 'RECOVERY', 'BD', 'BD_FR', 'R3'].includes(shift)) return false;

    return true;
};

/** Check if a staff member can be assigned to a location */
export const canStaffWorkAtLocation = (staff: Staff, location: Location): boolean => {
    if (staff.isManagement) return false;
    if (staff.areaType === 'UNIVERSAL') return true;
    if (staff.areaType === 'OR' && location.type === 'OR') return true;
    if (staff.areaType === 'AWR' && (location.type === 'AWR' || location.type === 'EXTERNAL')) return true;
    if (staff.areaType === 'OR' && location.type === 'EXTERNAL') return true;
    return false;
};

// ── Location config storage ───────────────────────────────────────────────────

export const loadLocationConfig = async (): Promise<Location[] | null> => {
    let config: Location[] | null = null;
    try {
        const response = await fetch(`${API_URL}/locations`);
        if (response.ok) {
            config = await response.json();
            if (config) await db.locationConfig.put({ identifier: 'main_locations', locations: config });
        }
    } catch (e) {}
    if (!config) {
        try {
            const local = await db.locationConfig.get('main_locations');
            if (local) config = local.locations;
        } catch (e) {}
    }
    return config;
};

export const saveLocationConfig = async (locations: Location[]): Promise<boolean> => {
    try {
        await db.locationConfig.put({ identifier: 'main_locations', locations });
    } catch (e) {}
    try {
        await fetchWithAuth(`${API_URL}/locations`, {
            method: 'POST',
            body: JSON.stringify(locations),
        });
    } catch (e) {}
    return true;
};
