// ============================================================================
// OPAWR-Personalplaner — Weekly Auto-Planning Service
// Implements the Anesthesia Department scheduling rules for Klinikum Gütersloh
// ============================================================================

import { Staff, Location, WeeklyPlan, WeeklyAssignment, WeekDay, ShiftType, AppConfig, StaffPairing } from '../types';
import {
    getWeekDays,
    parseDate,
    formatDate,
    addDays,
    createEmptyWeeklyPlan,
    canStaffWorkAtLocation,
    setAssignment,
    setStaffShiftForDay,
    getStaffShiftForDay,
} from './weeklyPlanService';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Days that T11 / late OR shift is allowed (Mon–Thu only) */
const LATE_OR_DAYS: WeekDay[] = ['Mo', 'Di', 'Mi', 'Do'];

/** Shifts that block the NEXT entire day */
const BLOCKS_NEXT_DAY = new Set(['BD', 'BD_FR', 'R3']);

/** Shifts that require F5 the following day */
const REQUIRES_F5_NEXT_DAY = new Set(['T10', 'R1']);

/** Late/long shifts — max 1 in a row */
const LATE_OR_LONG_SHIFTS = new Set(['T11', 'AT11', 'T10', 'R1']);

/** Shifts that make staff unavailable for location assignment */
const ABSENT_SHIFTS = new Set(['OFF', 'URLAUB', 'SICK', 'RECOVERY', 'BD', 'BD_FR', 'R3']);

// ── Day sequence helpers ──────────────────────────────────────────────────────

const DAY_ORDER: WeekDay[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

/** Returns the previous weekday, or null if Monday */
const prevDay = (day: WeekDay): WeekDay | null => {
    const i = DAY_ORDER.indexOf(day);
    return i > 0 ? DAY_ORDER[i - 1] : null;
};

// ── Eligibility engine ────────────────────────────────────────────────────────

interface DayConstraints {
    /** Staff blocked completely (on-call day before) */
    blocked: Set<string>;
    /** Staff restricted to late/OR only after on-call recovery */
    lateOrOrOnly: Set<string>;
    /** Staff whose next-day F5 is already assigned */
    hasF5: Set<string>;
}

/**
 * Build per-day constraint sets from the staff shift assignments of the PREVIOUS day.
 * We walk Mon→Fri in order and carry over constraints.
 */
const buildConstraints = (
    plan: WeeklyPlan,
    staffList: Staff[]
): Record<WeekDay, DayConstraints> => {
    const result: Record<string, DayConstraints> = {};
    
    for (const day of DAY_ORDER) {
        result[day] = { blocked: new Set(), lateOrOrOnly: new Set(), hasF5: new Set() };
    }

    for (const staff of staffList) {
        for (let di = 0; di < DAY_ORDER.length; di++) {
            const day = DAY_ORDER[di];
            const shift = getStaffShiftForDay(plan, staff.id, day);
            if (!shift) continue;

            // On-call: block NEXT day
            if (BLOCKS_NEXT_DAY.has(shift) && di + 1 < DAY_ORDER.length) {
                result[DAY_ORDER[di + 1]].blocked.add(staff.id);
                // Day+2: late or OR only (not T10/R1)
                if (di + 2 < DAY_ORDER.length) {
                    result[DAY_ORDER[di + 2]].lateOrOrOnly.add(staff.id);
                }
            }

            // T10/R1: next day → F5
            if (REQUIRES_F5_NEXT_DAY.has(shift) && di + 1 < DAY_ORDER.length) {
                result[DAY_ORDER[di + 1]].hasF5.add(staff.id);
            }
        }
    }

    return result as Record<WeekDay, DayConstraints>;
};

/** 
 * Check whether a staff member is eligible to work on a given day.
 * Takes into account shift constraints, work days, and part-time rules.
 */
const isEligibleOnDay = (
    staff: Staff,
    day: WeekDay,
    plan: WeeklyPlan,
    constraints: DayConstraints
): boolean => {
    // Management excluded
    if (staff.isManagement) return false;
    // Sick
    if (staff.isSick) return false;
    // On-call recovery
    if (constraints.blocked.has(staff.id)) return false;
    // Work days
    if (!staff.workDays.includes(day)) return false;
    // Part-time fixed days
    if (staff.contractType === 'PART_TIME' && staff.fixedDays && !staff.fixedDays.includes(day)) return false;

    // Explicit shift is an absence
    const shift = getStaffShiftForDay(plan, staff.id, day);
    if (shift && ABSENT_SHIFTS.has(shift)) return false;

    // Check vacation
    const weekDays = getWeekDays(plan.weekStart);
    const entry = weekDays.find(wd => wd.day === day);
    if (entry) {
        const dateStr = entry.date;
        const d = parseDate(dateStr);
        for (const v of staff.vacations) {
            const start = parseDate(v.start);
            const end = parseDate(v.end);
            if (d >= start && d <= end) return false;
        }
    }

    return true;
};

/** Check if assigning this staff to a late/long shift on 'day' would violate the no-consecutive rule */
const wouldCreateConsecutiveLateOrLong = (
    staff: Staff,
    day: WeekDay,
    plan: WeeklyPlan
): boolean => {
    // Check previous day
    const prev = prevDay(day);
    if (prev) {
        const prevShift = getStaffShiftForDay(plan, staff.id, prev);
        if (prevShift && LATE_OR_LONG_SHIFTS.has(prevShift)) return true;
    }
    return false;
};

/** Get the "already-assigned" shift count for scoring (rotation fairness) */
const countLocationAssignments = (
    staff: Staff,
    locationId: string,
    recentHistory: Record<string, Record<string, number>>
): number => {
    return recentHistory[staff.id]?.[locationId] || 0;
};

// ── Shift assignment for the week ─────────────────────────────────────────────

/**
 * Determine the shift a staff member should have on a given day.
 * Returns the existing shift if set, otherwise auto-selects based on rules.
 * 
 * The shift-type distribution is based on what the location requires:
 *  - AWR_F7 / AWR_8  → AF7
 *  - AWR_AT19        → AT19  
 *  - AWR_AT11 / T11 slot → AT11 or T11
 *  - OR regular      → F7
 *  - Long shift day   → T10
 */
const resolveShiftForLocation = (
    location: Location,
    staff: Staff,
    day: WeekDay
): ShiftType => {
    // If staff has fixed hours (e.g. Konstanica), their "shift" is a custom F7-like
    if (staff.fixedHours) return 'F5'; // short shift, label it F5-like
    
    // Trainees are always F7/AF7
    if (staff.isTrainee) {
        return location.type === 'AWR' ? 'AF7' : 'F7';
    }

    switch (location.id) {
        case 'AWR_8':
        case 'AWR_F7':
            return 'AF7';
        case 'AWR_AT19':
            return 'AT19';
        case 'AWR_AT11':
            return 'AT11';
        default:
            // OR / EXTERNAL → standard early shift
            return 'F7';
    }
};

// ── Main auto-assignment algorithm ────────────────────────────────────────────

export interface AutoAssignOptions {
    /** Weekly plan with any pre-existing manual assignments to respect */
    existingPlan?: WeeklyPlan;
    /** Recent location history per staff (for rotation scoring) */
    recentHistory?: Record<string, Record<string, number>>;
    /** Active pairings (mentor–trainee) */
    pairings?: StaffPairing[];
}

/**
 * Generate a full WeeklyPlan assignment for Mon–Fri.
 *
 * Algorithm:
 *  1. Keep all manually-placed (isManual) assignments from the existing plan.
 *  2. Build constraint sets from pre-assigned shifts (BD, T10, etc.).
 *  3. For each day in order (Mon→Fri):
 *     a. Fill AWR slots first (priority — patient safety).
 *     b. Fill OR slots.
 *     c. Fill EXTERNAL slots (HKL, ENDO).
 *     d. Assign trainees alongside their mentors.
 */
export const autoAssignWeek = (
    weekStart: string,
    locations: Location[],
    staffList: Staff[],
    config: AppConfig,
    options: AutoAssignOptions = {}
): WeeklyPlan => {
    const { existingPlan, recentHistory = {}, pairings = [] } = options;

    // Start from existing or empty plan
    let plan: WeeklyPlan = existingPlan
        ? { ...existingPlan }
        : createEmptyWeeklyPlan(weekStart);

    // Only remove non-manual assignments (keep what was explicitly placed)
    plan = {
        ...plan,
        assignments: plan.assignments.filter(a => a.isManual),
    };

    // Build initial constraints from pre-existing shift data
    const constraints = buildConstraints(plan, staffList);

    // Sort locations: AWR first, then OR, then EXTERNAL
    const sortedLocations = [...locations].sort((a, b) => {
        const order = { AWR: 0, OR: 1, EXTERNAL: 2 };
        return (order[a.type] ?? 3) - (order[b.type] ?? 3);
    });

    const assignedPerDay: Record<WeekDay, Set<string>> = {
        Mo: new Set(), Di: new Set(), Mi: new Set(), Do: new Set(), Fr: new Set()
    };

    // Mark already-assigned staff
    for (const a of plan.assignments) {
        assignedPerDay[a.day].add(a.staffId);
    }

    // ── Trainee → Mentor map for quick lookup
    const traineeToMentor = new Map<string, string>();
    const mentorToTrainee = new Map<string, string>();
    for (const s of staffList) {
        if (s.isTrainee && s.mentorId) {
            traineeToMentor.set(s.id, s.mentorId);
            mentorToTrainee.set(s.mentorId, s.id);
        }
    }
    // Also use pairings list
    for (const p of pairings) {
        if (p.active) {
            traineeToMentor.set(p.staffId1, p.staffId2);
            mentorToTrainee.set(p.staffId2, p.staffId1);
        }
    }

    // ── Main loop: day by day
    for (const day of DAY_ORDER) {
        const dayConstraints = constraints[day];

        // Pool of available staff for this day
        const availableStaff = staffList.filter(s =>
            isEligibleOnDay(s, day, plan, dayConstraints)
        );

        // Trainees are handled together with their mentor — separate them out
        const regularStaff = availableStaff.filter(s => !s.isTrainee);
        const trainees = availableStaff.filter(s => s.isTrainee);

        // ── Score function: returns a numeric priority for a staff+location combo
        const score = (staff: Staff, location: Location): number => {
            let s = 0;

            // Heavily prefer AWR-only staff for AWR
            if (staff.areaType === 'AWR' && location.type === 'AWR') s += 10000;
            // Penalize putting UNIVERSAL staff in AWR if AWR-only staff is available
            //   (but we still allow it for rotation)
            if (staff.areaType === 'UNIVERSAL' && location.type === 'AWR') s += 100;

            // Rotation: favor staff who've done this location less recently
            const historyCount = countLocationAssignments(staff, location.id, recentHistory);
            s -= historyCount * 500;

            // Preferences
            if (staff.preferredLocations.includes(location.id)) s += 1500;
            if (staff.avoidLocations.includes(location.id)) s -= 3000;

            // Don't put restricted-to-AWR staff in OR
            if (staff.tags?.includes('AWR_ONLY') && location.type === 'OR') s -= 999999;

            return s;
        };

        // ── Assign each location slot
        for (const location of sortedLocations) {
            // Skip if already filled (manual or earlier in this loop)
            const alreadyFilled = plan.assignments.some(
                a => a.locationId === location.id && a.day === day
            );
            if (alreadyFilled) continue;

            // Get eligible candidates for this location
            const candidates = regularStaff
                .filter(s => !assignedPerDay[day].has(s.id))
                .filter(s => canStaffWorkAtLocation(s, location))
                .filter(s => {
                    // After on-call+1: can only be late or OR (not T10/R1-designated)
                    if (dayConstraints.lateOrOrOnly.has(s.id)) {
                        // Only allow assignment to OR or AWR late slot
                        const shift = resolveShiftForLocation(location, s, day);
                        return location.type === 'OR' || location.type === 'AWR' && shift !== 'T10' && shift !== 'R1';
                    }
                    return true;
                })
                .sort((a, b) => score(b, location) - score(a, location));

            if (candidates.length === 0) continue;

            const chosen = candidates[0];
            const shiftCode = resolveShiftForLocation(location, chosen, day);

            // Record shift for the day
            plan = setStaffShiftForDay(plan, chosen.id, day, shiftCode);
            plan = setAssignment(plan, location.id, day, chosen.id, shiftCode, false);
            assignedPerDay[day].add(chosen.id);

            // ── If this person is a mentor → also assign their trainee (F7/AF7 only)
            const traineeId = mentorToTrainee.get(chosen.id);
            if (traineeId) {
                const trainee = trainees.find(t => t.id === traineeId);
                if (
                    trainee &&
                    !assignedPerDay[day].has(traineeId) &&
                    canStaffWorkAtLocation(trainee, location) &&
                    ['F7', 'AF7'].includes(shiftCode) // Trainees only in early shifts
                ) {
                    const traineeShift: ShiftType = location.type === 'AWR' ? 'AF7' : 'F7';
                    plan = setStaffShiftForDay(plan, traineeId, day, traineeShift);
                    // Trainee is "additional" staff alongside mentor — we mark with same locationId
                    // But since each cell holds 1 staff we put them in an additional row if needed
                    // For now mark them as assigned (they shadow the mentor's slot)
                    assignedPerDay[day].add(traineeId);
                }
            }
        }

        // ── Auto-assign F5 next day for anyone who got T10/R1 today
        const todayT10Staff = plan.assignments
            .filter(a => a.day === day && (a.shiftCode === 'T10' || a.shiftCode === 'R1'))
            .map(a => a.staffId);

        const nextDayIndex = DAY_ORDER.indexOf(day) + 1;
        if (nextDayIndex < DAY_ORDER.length) {
            const nextDay = DAY_ORDER[nextDayIndex];
            for (const staffId of todayT10Staff) {
                plan = setStaffShiftForDay(plan, staffId, nextDay, 'F5');
                // Block them from getting a location on that next day (F5 is on-call-ready, not assigned)
                constraints[nextDay].blocked.add(staffId);
            }
        }
    }

    return plan;
};

// ── Validation helpers (used by validationService) ───────────────────────────

export interface WeeklyValidationIssue {
    id: string;
    type: 'ERROR' | 'WARNING' | 'INFO';
    /** severity alias used by legacy components */
    severity?: string;
    day?: WeekDay;
    locationId?: string;
    /** @deprecated alias for locationId */
    roomId?: string;
    staffId?: string;
    message: string;
    details?: string;
}

/**
 * Validate a weekly plan against all anesthesia rules.
 * Returns a list of issues (errors, warnings, info).
 */
export const validateWeeklyPlan = (
    plan: WeeklyPlan,
    locations: Location[],
    staffList: Staff[],
    config: AppConfig
): WeeklyValidationIssue[] => {
    const issues: WeeklyValidationIssue[] = [];
    let issueId = 0;
    const nextId = () => `issue_${++issueId}`;

    const staffById = new Map(staffList.map(s => [s.id, s]));
    const locationById = new Map(locations.map(l => [l.id, l]));

    // ── Rule 1: Each AWR slot must have exactly 1 staff per day ──────────────
    const awrLocations = locations.filter(l => l.type === 'AWR');
    for (const loc of awrLocations) {
        for (const day of DAY_ORDER) {
            const assignment = plan.assignments.find(
                a => a.locationId === loc.id && a.day === day
            );
            if (!assignment) {
                issues.push({
                    id: nextId(),
                    type: 'ERROR',
                    day,
                    locationId: loc.id,
                    message: `${loc.name} – Kein MA am ${day} eingeteilt (AWR muss besetzt sein)`,
                });
            }
        }
    }

    // ── Rule 2: AWR-only staff must not appear in OR ──────────────────────────
    for (const a of plan.assignments) {
        const staff = staffById.get(a.staffId);
        const loc = locationById.get(a.locationId);
        if (!staff || !loc) continue;
        if (staff.tags?.includes('AWR_ONLY') && loc.type === 'OR') {
            issues.push({
                id: nextId(),
                type: 'ERROR',
                day: a.day,
                locationId: a.locationId,
                staffId: a.staffId,
                message: `${staff.name} ist AWR-only, aber am ${a.day} in ${loc.name} (OP-Saal) eingeteilt`,
            });
        }
    }

    // ── Rule 3: T10/R1 must be followed by F5 next day ────────────────────────
    for (const day of DAY_ORDER) {
        const nextDayIndex = DAY_ORDER.indexOf(day) + 1;
        if (nextDayIndex >= DAY_ORDER.length) continue;
        const nextDay = DAY_ORDER[nextDayIndex];

        const t10Staff = plan.assignments.filter(
            a => a.day === day && (a.shiftCode === 'T10' || a.shiftCode === 'R1')
        );
        for (const a of t10Staff) {
            const nextShift = getStaffShiftForDay(plan, a.staffId, nextDay);
            if (nextShift !== 'F5') {
                const staff = staffById.get(a.staffId);
                issues.push({
                    id: nextId(),
                    type: 'WARNING',
                    day: nextDay,
                    staffId: a.staffId,
                    message: `${staff?.name || a.staffId}: Nach T10/R1 am ${day} fehlt F5 am ${nextDay}`,
                });
            }
        }
    }

    // ── Rule 4: No consecutive T11/AT11/T10/R1 ────────────────────────────────
    for (const staff of staffList) {
        for (let di = 0; di < DAY_ORDER.length - 1; di++) {
            const day = DAY_ORDER[di];
            const nextDay = DAY_ORDER[di + 1];
            const shiftA = getStaffShiftForDay(plan, staff.id, day);
            const shiftB = getStaffShiftForDay(plan, staff.id, nextDay);
            if (
                shiftA && LATE_OR_LONG_SHIFTS.has(shiftA) &&
                shiftB && LATE_OR_LONG_SHIFTS.has(shiftB)
            ) {
                issues.push({
                    id: nextId(),
                    type: 'WARNING',
                    day: nextDay,
                    staffId: staff.id,
                    message: `${staff.name}: Zwei Spät-/Langdienste in Folge (${shiftA} am ${day}, ${shiftB} am ${nextDay})`,
                });
            }
        }
    }

    // ── Rule 5: Staff deployed day after on-call ──────────────────────────────
    for (const staff of staffList) {
        for (let di = 0; di < DAY_ORDER.length; di++) {
            const day = DAY_ORDER[di];
            const shift = getStaffShiftForDay(plan, staff.id, day);
            if (!shift || !BLOCKS_NEXT_DAY.has(shift)) continue;
            
            const nextDayIndex = di + 1;
            if (nextDayIndex >= DAY_ORDER.length) continue;
            const nextDay = DAY_ORDER[nextDayIndex];

            const isAssignedNextDay = plan.assignments.some(
                a => a.day === nextDay && a.staffId === staff.id
            );
            if (isAssignedNextDay) {
                issues.push({
                    id: nextId(),
                    type: 'ERROR',
                    day: nextDay,
                    staffId: staff.id,
                    message: `${staff.name}: Nach BD am ${day} darf kein Einsatz am Folgetag (${nextDay}) geplant werden`,
                });
            }
        }
    }

    // ── Rule 6: Trainee not with mentor ──────────────────────────────────────
    for (const staff of staffList.filter(s => s.isTrainee)) {
        for (const day of DAY_ORDER) {
            const traineeAssigned = plan.assignments.find(a => a.day === day && a.staffId === staff.id);
            if (!traineeAssigned) continue;
            
            if (!staff.mentorId) {
                issues.push({
                    id: nextId(), type: 'WARNING', day,
                    staffId: staff.id,
                    message: `Auszubildende/r ${staff.name} am ${day} eingeteilt – kein Praxisanleiter zugewiesen`,
                });
                continue;
            }

            const mentorAssigned = plan.assignments.find(
                a => a.day === day && a.staffId === staff.mentorId
            );
            if (!mentorAssigned) {
                const mentor = staffById.get(staff.mentorId);
                issues.push({
                    id: nextId(), type: 'WARNING', day,
                    staffId: staff.id,
                    message: `Auszubildende/r ${staff.name}: Praxisanleiter ${mentor?.name || staff.mentorId} am ${day} nicht eingeteilt`,
                });
            }
        }
    }

    // ── Rule 7: Trainee assigned non-F7/AF7 shift ────────────────────────────
    for (const a of plan.assignments) {
        const staff = staffById.get(a.staffId);
        if (!staff?.isTrainee) continue;
        if (!['F7', 'AF7'].includes(a.shiftCode)) {
            issues.push({
                id: nextId(), type: 'ERROR', day: a.day, staffId: a.staffId,
                message: `Auszubildende/r ${staff.name} am ${a.day}: Nur F7/AF7 erlaubt (aktuell: ${a.shiftCode})`,
            });
        }
    }

    // ── Rule 8: Part-time staff deployed on wrong day ────────────────────────
    for (const a of plan.assignments) {
        const staff = staffById.get(a.staffId);
        if (!staff?.fixedDays) continue;
        if (!staff.fixedDays.includes(a.day)) {
            issues.push({
                id: nextId(), type: 'WARNING', day: a.day, staffId: a.staffId,
                message: `Teilzeit-MA ${staff.name} am ${a.day} eingeteilt (erlaubt: ${staff.fixedDays.join(', ')})`,
            });
        }
    }

    return issues;
};
