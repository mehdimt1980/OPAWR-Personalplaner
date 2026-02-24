// @ts-nocheck
import { Staff, Room, Assignment, AssignmentResult, Operation, Dept, ShiftType, AppConfig, StaffPairing, ShiftDef } from '../types';
import { DEFAULT_SHIFT_CONFIG, DEFAULT_APP_CONFIG } from '../constants';
import { DailyPlan } from './storageService';
import { ValidationIssue } from './validationService';
import { calculateScore, getDominantDepartment, isQualifiedForRoom } from './planningLogic';

// Re-export for compatibility
export { calculateScore, getDominantDepartment, isQualifiedForRoom };

// Helper: Parse Time to minutes
export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

// Helper: Get Day abbreviation from Date string (dd.mm.yyyy)
export const getDayOfWeek = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('.');
    if (parts.length !== 3) return '';
    
    // Month is 0-indexed in JS Date
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const dayIndex = date.getDay();
    
    // Map Sunday (0) - Saturday (6) to Mo, Di, etc.
    const map = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return map[dayIndex];
};

export const getPreviousDayDate = (dateStr: string): string => {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return dateStr;
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Helper to parse "DD.MM.YYYY" to Date object
 */
export const parseDate = (dateStr: string): Date => {
    const parts = dateStr.split('.');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
};

/**
 * Formats a Date object to "DD.MM.YYYY"
 */
export const formatDate = (date: Date): string => {
    return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

/**
 * Gets the Monday of the week for a given date
 */
export const getMonday = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
};

/**
 * Adds days to a date
 */
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

/**
 * Returns an array of 7 date strings (DD.MM.YYYY) for the week of the given date
 */
export const getWeekDates = (currentDateStr: string): string[] => {
    const current = parseDate(currentDateStr);
    const monday = getMonday(current);
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
        week.push(formatDate(addDays(monday, i)));
    }
    return week;
};

/**
 * Checks if a specific date falls within a vacation range
 */
export const isStaffOnVacation = (staff: Staff, dateStr: string): boolean => {
    if (!staff.vacations || staff.vacations.length === 0) return false;

    const targetDate = parseDate(dateStr).getTime();

    return staff.vacations.some(v => {
        const start = parseDate(v.start).getTime();
        const end = parseDate(v.end).getTime();
        return targetDate >= start && targetDate <= end;
    });
};

/**
 * Calculates which staff IDs are recovering based on yesterday's plan
 * Accepts optional shift configuration
 */
export const calculateRecoveringStaff = (yesterdayPlan: DailyPlan | null, shiftConfig: Record<string, ShiftDef> = DEFAULT_SHIFT_CONFIG): string[] => {
    if (!yesterdayPlan) return [];
    
    const recoveringIds: string[] = [];
    
    // If specific shift assignments exist in the plan, check them
    if (yesterdayPlan.staffShifts) {
        Object.entries(yesterdayPlan.staffShifts).forEach(([staffId, shiftType]) => {
            const config = shiftConfig[shiftType as string];
            if (config && config.requiresRecovery) {
                recoveringIds.push(staffId);
            }
        });
    }
    
    return recoveringIds;
};

interface PlanContext {
    date: string;
    roomTeamLock: Map<string, string[]>; // RoomName -> StaffIds[]
    assignedStaffIds: Set<string>;
    assignments: Assignment[];
    alerts: string[];
}

/**
 * Checks if staff is theoretically scheduled for this date (Weekday + Recovery + Vacation check).
 * Does NOT check for sickness (sick staff are scheduled but ill).
 * 
 * UPDATE: Checks customTimes. If present, staff is considered scheduled (available), even if part-time.
 */
export const isStaffScheduled = (staff: Staff, date: string): boolean => {
    // 1. Check Vacation
    if (isStaffOnVacation(staff, date)) return false;

    // 2. Check explicit Absence/Recovery status
    // NOTE: Late shifts (S44) and On-Call (R1) are now CONSIDERED scheduled 
    // so they appear on the resource panel. AI will skip them if isAssignable is false.
    if (staff.currentShift === 'OFF' || staff.currentShift === 'RECOVERY' || staff.currentShift === 'SICK') return false;

    // 3. Check Custom Times (Override)
    // If a custom time is set, the staff member is explicitly scheduled for this day, 
    // overriding standard weekly availability.
    if (staff.currentCustomTime && staff.currentCustomTime.start && staff.currentCustomTime.end) {
        return true;
    }

    // 4. Check Weekly Availability (Day of Week)
    const dayOfWeek = getDayOfWeek(date);
    if (dayOfWeek && !staff.workDays.includes(dayOfWeek)) {
        return false;
    }

    return true;
};

/**
 * Checks basic staff availability based on shifts, sickness, recovery days AND vacation.
 * Used for Auto-Assignment (excludes sick/vacation people).
 */
export const isStaffAvailableGenerally = (staff: Staff, date: string): boolean => {
    if (staff.isSick) return false;
    if (isStaffOnVacation(staff, date)) return false;
    
    return isStaffScheduled(staff, date);
};

/**
 * Generic logic for Linked Availability (Deputy/Stand-in/Coworker dependency).
 * If a staff member requires another person to be present (e.g. for supervision or because they only work as deputy when the boss is there),
 * this function checks the availability of that required person.
 */
const checkLinkedAvailability = (staff: Staff, allStaff: Staff[], date: string): boolean => {
    if (!staff.requiresCoworkerId) return true;
    
    const requiredCoworker = allStaff.find(s => s.id === staff.requiresCoworkerId);
    if (!requiredCoworker) return true; // Fail safe if config is broken

    // If required coworker is available (not sick & not on vacation), then staff is available.
    // If required coworker is absent, staff is unavailable (e.g. takes over administrative duties).
    const isCoworkerAvailable = !requiredCoworker.isSick && !isStaffOnVacation(requiredCoworker, date);
    
    return isCoworkerAvailable;
};

/**
 * Spawns a Web Worker to run the optimization algorithm off the main thread.
 */
const runOptimizationWorker = (
    initialAssignments: Assignment[], 
    rooms: Room[], 
    staffList: Staff[],
    availableStaff: Staff[],
    config: AppConfig,
    pairings: StaffPairing[]
): Promise<AssignmentResult> => {
    return new Promise((resolve, reject) => {
        // Create worker
        const worker = new Worker(new URL('./optimization.worker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (e) => {
            resolve({
                assignments: e.data.assignments,
                alerts: e.data.alerts,
                unassignedStaff: [] // Calculated by context/wrapper, largely irrelevant for direct update
            });
            worker.terminate();
        };

        worker.onerror = (e) => {
            console.error("Optimization Worker Error", e);
            reject(e);
            worker.terminate();
        };

        // Send data including Config
        worker.postMessage({
            initialAssignments,
            rooms,
            staffList,
            availableStaff,
            config,
            pairings
        });
    });
};


export const autoAssignStaff = async (
    rooms: Room[], 
    staffList: Staff[], 
    planDate: string,
    config: AppConfig = DEFAULT_APP_CONFIG,
    pairings: StaffPairing[] = []
): Promise<AssignmentResult> => {
    const ctx: PlanContext = {
        date: planDate,
        roomTeamLock: new Map(),
        assignedStaffIds: new Set(),
        assignments: [],
        alerts: []
    };

    // Helper: Check for exclusion using config
    const isExcluded = (name: string) => {
        const lowerName = name.toLowerCase();
        // Use default keywords if config missing (legacy safety)
        const keywords = config.logic?.exclusionKeywords || ['hilfskraft'];
        return keywords.some(k => lowerName.includes(k.toLowerCase()));
    };

    // --- 0. PRE-CALCULATION: LEAD RESERVATION SYSTEM ---
    // This prevents High-Priority rooms (like Da Vinci) from "stealing" Specific Leads
    // from other departments just because they are processed first.
    const leadReservations = new Map<string, string>(); // StaffId -> RoomId

    // Map all rooms to their dominant departments first
    const roomDetails = rooms.map(r => ({
        room: r,
        dept: getDominantDepartment(r),
        opCount: r.operations.length
    }));

    // Sort rooms by opCount descending to ensure Leads are reserved for the busiest relevant room first
    const busyRoomsFirst = [...roomDetails].sort((a, b) => b.opCount - a.opCount);

    staffList.forEach(staff => {
        // Only reserve if they are a Lead AND not sick/unavailable AND have specific departments
        // IMPORTANT: Also skip if they are Management (e.g. Rita shouldn't be reserved if she's Deputy Management,
        // she might want to assign herself manually or do admin work)
        if (staff.isSaalleitung && !staff.isManagement && staff.leadDepts.length > 0 && isStaffAvailableGenerally(staff, planDate)) {
            // Find a room that matches their lead department
            const matchingRoom = busyRoomsFirst.find(rd => 
                staff.leadDepts.includes(rd.dept) &&
                // Ensure we don't double-book a room with multiple leads in this reservation phase
                !Array.from(leadReservations.values()).includes(rd.room.id)
            );

            if (matchingRoom) {
                leadReservations.set(staff.id, matchingRoom.room.id);
            }
        }
    });

    // 1. PHASE 1: GREEDY CONSTRUCTION (Sync - Fast)
    // Sort Rooms: Prioritize Rooms with PRIORITY tag (formerly Saal 5), then by operation count
    const sortedRooms = [...rooms].sort((a, b) => {
        const aPrio = a.tags?.includes('PRIORITY') ? 1 : 0;
        const bPrio = b.tags?.includes('PRIORITY') ? 1 : 0;
        
        if (aPrio !== bPrio) return bPrio - aPrio;
        
        return b.operations.length - a.operations.length;
    });

    sortedRooms.forEach(room => {
        // Skip empty rooms unless explicitly tagged with PRIORITY
        if (room.operations.length === 0 && !room.tags?.includes('PRIORITY')) return; 

        const teamIds: string[] = [];
        const dominantDept = getDominantDepartment(room);
        const currentTeamObjects: Staff[] = []; // To track for scoring

        // Helper to get fresh candidates
        const getCandidates = () => staffList.filter(s => {
            const shiftCode = s.currentShift || 'T1';
            const shiftDef = config.shifts[shiftCode];
            // Respect the isAssignable flag from shift configuration
            const isAssignable = shiftDef ? (shiftDef.isAssignable !== false) : true;

            return !ctx.assignedStaffIds.has(s.id) &&
            !isExcluded(s.name) &&
            !s.isManagement && // EXCLUDE MANAGEMENT FROM AUTO-ASSIGN
            isStaffAvailableGenerally(s, ctx.date) &&
            isAssignable && // NEW: Respect Shift Assignment Toggle
            // EXCLUSION: Staff with short shifts (< 7.5h) should not be Auto-Assigned to full rooms
            (!s.currentCustomTime || (
                (timeToMinutes(s.currentCustomTime.end) - timeToMinutes(s.currentCustomTime.start) + (timeToMinutes(s.currentCustomTime.end) < timeToMinutes(s.currentCustomTime.start) ? 1440 : 0)) >= 450
            )) &&
            checkLinkedAvailability(s, staffList, ctx.date) &&
            isQualifiedForRoom(s, room, config) && // Pass config for rules engine
            // RESERVATION CHECK: If staff is reserved for another room, do not offer them here.
            (!leadReservations.has(s.id) || leadReservations.get(s.id) === room.id)
        });

        // === DYNAMIC SLOT ASSIGNMENT ===
        // Loop through required slots (e.g. 2 for standard rooms)
        // Slot 0 is always treated as Lead, subsequent slots as Support/Springer
        for (let slotIndex = 0; slotIndex < room.requiredStaffCount; slotIndex++) {
            let candidates = getCandidates();
            
            // Re-calculate scores for all candidates based on current team state
            candidates.sort((a, b) => 
                calculateScore(b, room, slotIndex, dominantDept, currentTeamObjects, config.weights, pairings, config) - 
                calculateScore(a, room, slotIndex, dominantDept, currentTeamObjects, config.weights, pairings, config)
            );

            let selectedStaff: Staff | undefined;

            // SPECIAL LOGIC: CHECK FORCED PAIRINGS
            // If we have at least one person assigned, check if they have a partner who SHOULD be here.
            // This overrides the score sort if a valid partner is found.
            if (currentTeamObjects.length > 0 && pairings.length > 0) {
                // Check if any current team member has a partner
                for (const member of currentTeamObjects) {
                    const pairRule = pairings.find(p => p.staffId1 === member.id || p.staffId2 === member.id);
                    if (pairRule) {
                        const partnerId = pairRule.staffId1 === member.id ? pairRule.staffId2 : pairRule.staffId1;
                        // Find this partner in the candidates list
                        const partner = candidates.find(c => c.id === partnerId);
                        if (partner) {
                            selectedStaff = partner;
                            break; // Priority found
                        }
                    }
                }
            }

            // Fallback to highest scored candidate if no forced pair
            if (!selectedStaff && candidates.length > 0) {
                selectedStaff = candidates[0];
            }

            if (selectedStaff) {
                teamIds.push(selectedStaff.id);
                ctx.assignedStaffIds.add(selectedStaff.id);
                currentTeamObjects.push(selectedStaff);
            } else {
                // No more candidates available for this room
                break;
            }
        }

        if (teamIds.length > 0) {
            ctx.roomTeamLock.set(room.name, teamIds);
            ctx.assignments.push({
                roomId: room.id,
                staffIds: teamIds
            });
        }
    });

    // Identify Available Staff for optimization phase (All staff minus sick/vacation/short-shift)
    const availablePool = staffList.filter(s => {
        const shiftCode = s.currentShift || 'T1';
        const shiftDef = config.shifts[shiftCode];
        const isAssignable = shiftDef ? (shiftDef.isAssignable !== false) : true;

        return isStaffAvailableGenerally(s, planDate) && 
        !isExcluded(s.name) &&
        !s.isManagement && 
        isAssignable && // NEW: Respect Shift Assignment Toggle
        // EXCLUSION: Short shifts also excluded from optimization pool
        (!s.currentCustomTime || (
            (timeToMinutes(s.currentCustomTime.end) - timeToMinutes(s.currentCustomTime.start) + (timeToMinutes(s.currentCustomTime.end) < timeToMinutes(s.currentCustomTime.start) ? 1440 : 0)) >= 450
        )) &&
        checkLinkedAvailability(s, staffList, planDate)
    });

    // 2. PHASE 2: GLOBAL OPTIMIZATION (Async Worker)
    try {
        // Pass config and pairings to worker
        const optimizedResult = await runOptimizationWorker(ctx.assignments, rooms, staffList, availablePool, config, pairings);
        return optimizedResult;
    } catch (e) {
        console.warn("Worker optimization failed, falling back to greedy result", e);
        return {
            assignments: ctx.assignments,
            unassignedStaff: [],
            alerts: ctx.alerts
        };
    }
};


// --- SMART RESOLUTION WIZARD LOGIC ---

export interface ResolutionCandidate {
    staff: Staff;
    score: number;
    reasons: string[];
}

export const getResolutionSuggestions = (
    issue: ValidationIssue,
    room: Room,
    allStaff: Staff[],
    currentAssignments: Assignment[],
    date: string,
    config: AppConfig = DEFAULT_APP_CONFIG
): ResolutionCandidate[] => {
    const assignedStaffIds = new Set(currentAssignments.flatMap(a => a.staffIds));
    const dominantDept = getDominantDepartment(room);
    
    // Identify the "Problem Slot" or role we are trying to fill
    let targetSlotIndex = 1; // Default to Springer
    const currentRoomAssignment = currentAssignments.find(a => a.roomId === room.id);
    const currentTeam = currentRoomAssignment ? currentRoomAssignment.staffIds.map(id => allStaff.find(s => s.id === id)!) : [];

    if (issue.type === 'warning' && issue.details?.includes('Understaffed')) {
        targetSlotIndex = currentTeam.length === 0 ? 0 : 1;
    } else if (issue.type === 'error' && issue.details?.includes('Double')) {
        // Find index of conflicting person in current team
        const idx = currentTeam.findIndex(s => s.id === issue.staffId);
        if (idx !== -1) targetSlotIndex = idx;
    }

    // Filter Candidates
    const candidates = allStaff.filter(s => {
        const shiftCode = s.currentShift || 'T1';
        const shiftDef = config.shifts[shiftCode];
        const isAssignable = shiftDef ? (shiftDef.isAssignable !== false) : true;

        if (assignedStaffIds.has(s.id)) return false;
        if (!isStaffAvailableGenerally(s, date)) return false;
        if (!isAssignable) return false; // NEW: Respect Shift Assignment Toggle
        if (!isQualifiedForRoom(s, room, config)) return false;
        if (!checkLinkedAvailability(s, allStaff, date)) return false;
        return true;
    });

    // Score Candidates with Config
    const scoredCandidates = candidates.map(staff => {
        // Note: Pairings not strictly used in Wizard yet, but could be added
        const score = calculateScore(staff, room, targetSlotIndex, dominantDept, currentTeam.filter(s => s.id !== issue.staffId), config.weights, [], config); 
        
        const reasons: string[] = [];
        if (staff.skills[dominantDept] === 'Expert') reasons.push(`Experte für ${dominantDept}`);
        if (staff.skills[dominantDept] === 'Junior') reasons.push(`Junior für ${dominantDept}`);
        if (staff.isSaalleitung) reasons.push('Saalleitung');
        if (staff.preferredRooms.includes(room.name)) reasons.push('Bevorzugter Saal');
        if (staff.leadDepts.includes(dominantDept)) reasons.push(`Leitung ${dominantDept}`);
        if (staff.isManagement) reasons.push('OP-Management (Manuell)');
        
        return {
            staff,
            score,
            reasons
        };
    });

    // Sort by Score Descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Return top 3
    return scoredCandidates.slice(0, 3);
};

