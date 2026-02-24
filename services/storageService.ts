
import { Assignment, Room, Staff, ShiftType, AppConfig, CustomTime, StaffPairing, Location } from '../types';
import { AuthService } from './authService';
import { DEFAULT_APP_CONFIG } from '../constants';
import { db } from '../db'; // Import our new IndexedDB instance

// Re-export weekly plan utilities
export { loadLocationConfig, saveLocationConfig } from './weeklyPlanService';

// Backwards-compat aliases so existing code doesn't break during transition
export { loadLocationConfig as loadRoomConfig, saveLocationConfig as saveRoomConfig } from './weeklyPlanService';

// Use relative path so it works on Vercel (same domain) and locally (via Vite proxy)
const API_URL = '/api';

// LocalStorage Keys (Legacy - Kept for last active date only)
const LAST_DATE_KEY = 'or_planner_last_active_date';

export interface DailyPlan {
    date: string;
    assignments: Assignment[];
    operations: any[]; // Store simplified ops to restore state
    staffShifts?: Record<string, ShiftType>; 
    version?: number; // Optimistic Locking
}

export interface DailyRoster {
    date: string;
    shifts: Record<string, ShiftType>;
    customTimes?: Record<string, CustomTime>;
}

export type SaveResult = 'success' | 'error' | 'conflict';

/**
 * Helper to fetch with Auth Header
 */
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = AuthService.getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    return fetch(url, { ...options, headers });
};

/**
 * Saves the last active date to automatically restore user session on reload
 */
export const saveLastActiveDate = (date: string) => {
    localStorage.setItem(LAST_DATE_KEY, date);
};

/**
 * Gets the last active date or returns null
 */
export const getLastActiveDate = (): string | null => {
    return localStorage.getItem(LAST_DATE_KEY);
};

/**
 * Internal: Save Plan Payload (Assignments & Ops)
 */
const savePlanPayload = async (
    date: string, 
    assignments: Assignment[], 
    operations: any[],
    currentVersion?: number
): Promise<{ result: SaveResult, newVersion?: number }> => {
    const payload = { date, assignments, operations, version: currentVersion };

    // 1. IndexedDB (Immediate, Non-blocking, Large Storage)
    try {
        await db.plans.put(payload);
    } catch (e) {
        console.warn("IndexedDB failed", e);
    }

    // 2. Cloud DB (Protected)
    try {
        const response = await fetchWithAuth(`${API_URL}/plans`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (response.status === 409) {
            return { result: 'conflict' };
        }

        if (response.ok) {
            const data = await response.json();
            // Update local DB with server version if successful
            if (data.version) {
                await db.plans.update(date, { version: data.version });
            }
            return { result: 'success', newVersion: data.version };
        }
        return { result: 'error' };
    } catch (e) {
        // If offline, we rely on IndexedDB, but warn about sync
        console.warn("Save to cloud failed (Offline?)", e);
        return { result: 'success' }; 
    }
};

/**
 * Internal: Save Roster Payload (Shifts & Sickness) - INDEPENDENT
 */
const saveRosterPayload = async (
    date: string, 
    shifts: Record<string, ShiftType>, 
    customTimes?: Record<string, CustomTime>
): Promise<boolean> => {
    const payload = { date, shifts, customTimes };

    try {
        await db.rosters.put(payload);
    } catch (e) {
        console.warn("IndexedDB failed (Roster)", e);
    }

    try {
        await fetchWithAuth(`${API_URL}/roster`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return true;
    } catch (e) {
        return true;
    }
};

/**
 * Hybrid Save: Saves assignments/ops to Plan and shifts to Roster independently.
 * Checks for optimistic locking version if provided.
 */
export const savePlan = async (
    date: string, 
    assignments: Assignment[], 
    rooms: Room[], 
    staffShifts?: Record<string, ShiftType>,
    staffCustomTimes?: Record<string, CustomTime>,
    currentVersion?: number
): Promise<{ result: SaveResult, newVersion?: number }> => {
    const operations = rooms.flatMap(r => r.operations);
    
    // Save Plan (Assignments + Ops)
    const planResult = await savePlanPayload(date, assignments, operations, currentVersion);
    
    // Save Roster (Shifts) - Independent!
    if (staffShifts) {
        await saveRosterPayload(date, staffShifts, staffCustomTimes);
    }

    return planResult;
};

/**
 * Updates a specific shift for a staff member on a specific date.
 */
export const updateStaffShift = async (date: string, staffId: string, shift: ShiftType): Promise<boolean> => {
    let roster = await loadRoster(date);
    
    if (!roster) {
        roster = { date, shifts: {}, customTimes: {} };
    }

    roster.shifts[staffId] = shift;
    
    // Clean up assignments in plan if staff is unavailable
    if (shift === 'OFF' || shift === 'RECOVERY' || shift === 'S44') {
        const plan = await loadPlan(date);
        if (plan && plan.assignments) {
             const newAssignments = plan.assignments.map(assignment => ({
                ...assignment,
                staffIds: assignment.staffIds.filter(id => id !== staffId)
            }));
            // Note: We pass undefined version here as this is an indirect update (might overwrite if race condition, but less critical for shift change)
            await savePlanPayload(date, newAssignments, plan.operations, plan.version);
        }
    }

    return await saveRosterPayload(date, roster.shifts, roster.customTimes);
};

/**
 * Updates custom working times for a staff member.
 */
export const updateStaffCustomTime = async (date: string, staffId: string, start: string, end: string): Promise<boolean> => {
    let roster = await loadRoster(date);
    
    if (!roster) {
        roster = { date, shifts: {}, customTimes: {} };
    }
    
    if (!roster.customTimes) roster.customTimes = {};

    // If empty strings, remove the entry
    if (!start && !end) {
        delete roster.customTimes[staffId];
    } else {
        roster.customTimes[staffId] = { start, end };
    }

    return await saveRosterPayload(date, roster.shifts, roster.customTimes);
};

// --- SMART MATCHER UTILS ---

const normalizeName = (str: string) => str.toLowerCase().replace(/[^a-z0-9äöüß]/g, '').trim();

/**
 * Matches a CSV name (usually "First Last" after parsing) to a DB Staff name.
 * IMPROVED: Stricter checking to avoid month-long import mismatches.
 */
const findStaffFuzzy = (csvFullName: string, staffList: Staff[]) => {
    if (!csvFullName) return undefined;
    
    const csvNorm = normalizeName(csvFullName);
    const csvParts = csvFullName.trim().split(/\s+/);
    
    // 1. Try Exact Match (Normalized)
    let found = staffList.find(s => normalizeName(s.name) === csvNorm);
    if (found) return found;

    // 2. Try Intelligent First Name + Initial Logic
    const csvFirst = normalizeName(csvParts[0]); 
    const csvLast = csvParts.length > 1 ? normalizeName(csvParts.slice(1).join(' ')) : '';

    found = staffList.find(staff => {
        const staffParts = staff.name.trim().split(/\s+/);
        const staffFirst = normalizeName(staffParts[0]);

        // First Name MUST match strictly
        if (staffFirst !== csvFirst) return false;

        // If Staff has an Initial (e.g. "Gabi K")
        if (staffParts.length > 1) {
            const staffInitial = normalizeName(staffParts[1]).charAt(0);
            if (csvLast && csvLast.startsWith(staffInitial)) {
                return true;
            }
            return false;
        }
        return true;
    });

    if (found) return found;

    // 3. Fallback: Token Search (Mixed up names)
    const searchTokens = csvFullName.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1);
    if (searchTokens.length > 0) {
        return staffList.find(s => {
            const staffTokens = s.name.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1);
            // Strict match: All CSV tokens must exist in Staff name
            return searchTokens.every(st => staffTokens.some(tt => tt.includes(st) || st.includes(tt)));
        });
    }

    return undefined;
};

/**
 * Bulk Import Shifts with Fuzzy Matching
 * FIX: Using sequential processing (for-of) instead of parallel (forEach) 
 * to prevent race conditions during large monthly imports.
 */
export const bulkImportShifts = async (shiftData: { name: string, date: string, shift: ShiftType }[], staffList: Staff[]): Promise<number> => {
    const updatesByDate: Record<string, Record<string, ShiftType>> = {};
    let successCount = 0;

    // 1. Group all updates in memory first
    shiftData.forEach(item => {
        const staff = findStaffFuzzy(item.name, staffList);
        if (staff) {
            if (!updatesByDate[item.date]) updatesByDate[item.date] = {};
            updatesByDate[item.date][staff.id] = item.shift;
            successCount++;
        }
    });

    // 2. Save SEQUENTIALLY to avoid parallel write conflicts
    const sortedDates = Object.keys(updatesByDate).sort((a, b) => {
        const [da, ma, ya] = a.split('.').map(Number);
        const [db, mb, yb] = b.split('.').map(Number);
        return new Date(ya, ma, da).getTime() - new Date(yb, mb, db).getTime();
    });

    for (const date of sortedDates) {
        let roster = await loadRoster(date);
        if (!roster) roster = { date, shifts: {}, customTimes: {} };
        if (!roster.shifts) roster.shifts = {};

        // Merge incoming shifts for this day
        Object.assign(roster.shifts, updatesByDate[date]);
        
        // Wait for one day to finish saving before starting the next
        await saveRosterPayload(date, roster.shifts, roster.customTimes);
        
        // Check for "unavailable" status to clean up room assignments
        const offStaffIds = Object.entries(updatesByDate[date])
            .filter(([_, s]) => s === 'OFF' || s === 'SICK' || s === 'RECOVERY' || s === 'S44')
            .map(([id]) => id);

        if (offStaffIds.length > 0) {
            const plan = await loadPlan(date);
            if (plan && plan.assignments) {
                const newAssignments = plan.assignments.map(a => ({
                    ...a,
                    staffIds: a.staffIds.filter(id => !offStaffIds.includes(id))
                }));
                // Sequential save for plan cleanup too
                await savePlanPayload(date, newAssignments, plan.operations, plan.version);
            }
        }
    }

    return successCount;
};

/**
 * Deletes ONLY the Plan (Assignments/Ops).
 */
export const deletePlan = async (date: string): Promise<boolean> => {
    try {
        await db.plans.delete(date);
    } catch (e) {
        console.warn("Delete plan DB failed", e);
    }
    
    try {
        await fetchWithAuth(`${API_URL}/plans/${date}`, { method: 'DELETE' });
    } catch (e) {
        console.warn("Delete plan API failed", e);
    }
    return true;
};

/**
 * Load Roster Independent of Plan
 */
export const loadRoster = async (date: string): Promise<DailyRoster | null> => {
    let roster: DailyRoster | null = null;
    try {
        const localData = await db.rosters.get(date);
        if (localData) roster = localData;
    } catch (e) {}

    try {
        const response = await fetch(`${API_URL}/roster/${date}`);
        if (response.ok) {
            const remoteRoster = await response.json();
            if (remoteRoster) {
                await db.rosters.put(remoteRoster);
                roster = remoteRoster; 
            }
        }
    } catch (e) {}
    return roster;
};

/**
 * Hybrid Load: Merges Plan (Ops) + Roster (Shifts)
 */
export const loadPlan = async (date: string): Promise<DailyPlan | null> => {
    let plan: any = null;
    let roster: DailyRoster | null = null;

    try {
        const response = await fetch(`${API_URL}/plans/${date}`);
        if (response.ok) {
            plan = await response.json();
            if (plan) await db.plans.put(plan);
        }
    } catch (e) {
        try {
            const localPlan = await db.plans.get(date);
            if (localPlan) plan = localPlan;
        } catch (dbErr) { console.error(dbErr); }
    }
    
    if (!plan) {
        try {
            const localPlan = await db.plans.get(date);
            if (localPlan) plan = localPlan;
        } catch (e) {}
    }

    roster = await loadRoster(date);

    if (plan) {
        if (roster && roster.shifts) {
            plan.staffShifts = roster.shifts;
        } else if (!plan.staffShifts) {
            plan.staffShifts = {};
        }
        return plan as DailyPlan;
    } else {
        if (roster) {
            return {
                date,
                assignments: [],
                operations: [],
                staffShifts: roster.shifts,
                version: 0
            };
        }
    }
    return null;
};

/**
 * Bulk Load Plans
 */
export const loadPlansByDates = async (dates: string[]): Promise<DailyPlan[]> => {
    let plans: any[] = [];
    let rosters: any[] = [];
    
    try {
        const localPlans = await db.plans.bulkGet(dates);
        plans = localPlans.filter(p => !!p);
    } catch(e) {}

    try {
        const res = await fetch(`${API_URL}/plans/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dates }),
        });
        if (res.ok) {
            const remotePlans = await res.json();
            if (remotePlans.length > 0) {
                plans = remotePlans;
                db.plans.bulkPut(remotePlans).catch(console.error);
            }
        }
    } catch (e) {}
    
    try {
        const res = await fetch(`${API_URL}/roster/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dates }),
        });
        if (res.ok) {
            rosters = await res.json();
            db.rosters.bulkPut(rosters).catch(console.error);
        } else {
            const localRosters = await db.rosters.bulkGet(dates);
            rosters = localRosters.filter(r => !!r);
        }
    } catch (e) {
        const localRosters = await db.rosters.bulkGet(dates);
        rosters = localRosters.filter(r => !!r);
    }

    const planMap = new Map<string, any>();
    plans.forEach(p => planMap.set(p.date, p));
    
    const rosterMap = new Map<string, any>();
    rosters.forEach(r => rosterMap.set(r.date, r));

    dates.forEach(date => {
        let p = planMap.get(date);
        let r = rosterMap.get(date);
        if (p) {
            if (r) p.staffShifts = r.shifts;
            planMap.set(date, p);
        } else if (r) {
            planMap.set(date, { date, assignments: [], operations: [], staffShifts: r.shifts });
        }
    });

    return Array.from(planMap.values());
};

export const saveStaffList = async (staff: Staff[]): Promise<boolean> => {
    try {
        await db.staff.put({ identifier: 'main_list', staff });
    } catch(e) {}

    try {
        await fetchWithAuth(`${API_URL}/staff`, {
            method: 'POST',
            body: JSON.stringify(staff),
        });
        return true;
    } catch (error) { return true; }
};

/** Ensures every staff object has all OPAWR fields, filling in safe defaults for legacy data */
const normalizeStaff = (raw: any[]): Staff[] =>
    raw.map(s => ({
        workDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
        preferredLocations: [],
        avoidLocations: [],
        overtimeBalance: 0,
        isTrainee: false,
        contractType: 'FULL',
        qualificationLevel: '',
        recoveryDays: [],
        shifts: {},
        vacations: [],
        tags: [],
        ...s,
        // Always override areaType: if missing or invalid, default to UNIVERSAL
        areaType: (['OR', 'AWR', 'UNIVERSAL'].includes(s.areaType) ? s.areaType : 'UNIVERSAL') as Staff['areaType'],
    } as Staff));

export const loadStaffList = async (): Promise<Staff[] | null> => {
    let staffList: Staff[] | null = null;
    try {
        const response = await fetch(`${API_URL}/staff`);
        if (response.ok) {
            const list = await response.json();
            if (list && list.length > 0) {
                staffList = normalizeStaff(list);
                await db.staff.put({ identifier: 'main_list', staff: staffList });
            }
        }
    } catch (e) {}
    
    if (!staffList) {
        try {
            const localData = await db.staff.get('main_list');
            if (localData) staffList = normalizeStaff(localData.staff);
        } catch(e) {}
    }
    return staffList;
};

export const loadAppConfig = async (): Promise<AppConfig | null> => {
    let config: AppConfig | null = null;
    try {
        const response = await fetch(`${API_URL}/config`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.shifts) {
                config = {
                    shifts: data.shifts || DEFAULT_APP_CONFIG.shifts,
                    rotation: data.rotation || DEFAULT_APP_CONFIG.rotation,
                    exclusionKeywords: data.exclusionKeywords || DEFAULT_APP_CONFIG.exclusionKeywords,
                };
                await db.appConfig.put({ identifier: 'main_config', config });
            }
        }
    } catch (e) {}
    
    if (!config) {
        try {
            const localData = await db.appConfig.get('main_config');
            if (localData) config = localData.config;
        } catch(e) {}
    }
    return config;
};

export const saveAppConfig = async (config: AppConfig): Promise<boolean> => {
    try {
        await db.appConfig.put({ identifier: 'main_config', config });
    } catch (e) {}

    try {
        await fetchWithAuth(`${API_URL}/config`, {
            method: 'POST',
            body: JSON.stringify(config),
        });
        return true;
    } catch (error) { return true; }
};

// --- Staff Pairings ---
export const loadPairings = async (): Promise<StaffPairing[]> => {
    let pairings: StaffPairing[] = [];
    try {
        const response = await fetchWithAuth(`${API_URL}/pairings`);
        if (response.ok) {
            pairings = await response.json();
            await db.pairings.put({ key: 'main_pairings', data: pairings });
        }
    } catch (e) {}
    
    if (pairings.length === 0) {
        try {
            const local = await db.pairings.get('main_pairings');
            if (local) pairings = local.data;
        } catch(e) {}
    }
    return pairings;
};

export const savePairing = async (staffId1: string, staffId2: string, type: 'MENTOR' | 'TANDEM' | 'TRAINING'): Promise<StaffPairing[]> => {
    try {
        const response = await fetchWithAuth(`${API_URL}/pairings`, {
            method: 'POST',
            body: JSON.stringify({ staffId1, staffId2, type })
        });
        if (response.ok) {
            const newPairings = await response.json();
            await db.pairings.put({ key: 'main_pairings', data: newPairings });
            return newPairings;
        }
    } catch (e) {}
    return [];
};

export const deletePairing = async (id: string): Promise<StaffPairing[]> => {
    try {
        const response = await fetchWithAuth(`${API_URL}/pairings/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            const newPairings = await response.json();
            await db.pairings.put({ key: 'main_pairings', data: newPairings });
            return newPairings;
        }
    } catch (e) {}
    return [];
};

export const createBackup = async (): Promise<any> => {
    try {
        const response = await fetchWithAuth(`${API_URL}/backup`);
        if (response.ok) return await response.json();
    } catch (e) {}

    const backup: any = {
        staff_list: [],
        app_config: null,
        timestamp: new Date(),
        source: 'local_fallback'
    };
    
    const localStaff = await db.staff.get('main_list');
    if (localStaff) backup.staff_list = localStaff.staff;
    const localAppConfig = await db.appConfig.get('main_config');
    if (localAppConfig) backup.app_config = localAppConfig.config;

    return backup;
};

export const restoreBackup = async (data: any): Promise<boolean> => {
    let serverSuccess = false;
    try {
        const response = await fetchWithAuth(`${API_URL}/restore`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        serverSuccess = response.ok;
    } catch (e) {}

    try {
        await db.transaction('rw', [db.staff, db.appConfig], async () => {
            if (data.staff_list) await db.staff.put({ identifier: 'main_list', staff: data.staff_list });
            if (data.app_config) await db.appConfig.put({ identifier: 'main_config', config: data.app_config });
        });
        return true;
    } catch (e) {
        return serverSuccess;
    }
};

export const clearAllData = async () => {
    try { await restoreBackup({ staff_list: [], app_config: null }); } catch (e) {}
    try {
        await db.delete();
        await db.open();
    } catch (e) {
        console.error("Failed to clear IndexedDB", e);
    }
    localStorage.clear();
};

