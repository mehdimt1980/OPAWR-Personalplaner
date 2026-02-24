
import { AppConfig, ShiftDef, Location } from './types';

// Manually construct date to ensure DD.MM.YYYY format regardless of browser locale
const today = new Date();
const dd = String(today.getDate()).padStart(2, '0');
const mm = String(today.getMonth() + 1).padStart(2, '0');
const yyyy = today.getFullYear();
export const DEMO_DATE = `${dd}.${mm}.${yyyy}`;

// ── Anesthesia Shift Definitions ──────────────────────────────────────────────
// These are the real shift codes used in the Anesthesia department at Klinikum Gütersloh.

export const DEFAULT_SHIFT_CONFIG: Record<string, ShiftDef> = {
    // ── Core Working Shifts ───────────────────────────────────────────────────
    'F7': {
        start: '07:00', end: '15:30',
        label: 'F7 – Früh', color: 'bg-blue-100 text-blue-800 border-blue-200',
        requiresRecovery: false, isAssignable: true, category: 'EARLY'
    },
    'AF7': {
        start: '07:00', end: '15:30',
        label: 'AF7 – AWR Früh', color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        requiresRecovery: false, isAssignable: true, category: 'EARLY'
    },
    'AT19': {
        start: '08:30', end: '17:00',
        label: 'AT19 – Mittel', color: 'bg-teal-100 text-teal-800 border-teal-200',
        requiresRecovery: false, isAssignable: true, category: 'MIDDLE'
    },
    'T11': {
        start: '11:30', end: '20:00',
        label: 'T11 – Spät OP', color: 'bg-orange-100 text-orange-800 border-orange-200',
        requiresRecovery: false, isAssignable: true, category: 'LATE'
        // Note: Mon–Thu only. Next day: OR or F7. Avoid T10 next day.
    },
    'AT11': {
        start: '11:30', end: '20:00',
        label: 'AT11 – Spät AWR', color: 'bg-amber-100 text-amber-800 border-amber-200',
        requiresRecovery: false, isAssignable: true, category: 'LATE'
        // Note: Mon–Thu only. Each staff should have 1× per month.
    },

    // ── Long Shift (always paired with F5 next day) ───────────────────────────
    'T10': {
        start: '07:00', end: '17:45',
        label: 'T10 – Langer Dienst', color: 'bg-violet-100 text-violet-800 border-violet-200',
        requiresRecovery: false, isAssignable: true, requiresFollowUpF5: true, category: 'LONG'
    },
    'R1': {
        start: '07:00', end: '17:45',
        label: 'R1 – Langer Dienst', color: 'bg-violet-200 text-violet-900 border-violet-300',
        requiresRecovery: false, isAssignable: true, requiresFollowUpF5: true, category: 'LONG'
    },
    'F5': {
        start: '07:00', end: '13:00',
        label: 'F5 – Rufdienst nach T10', color: 'bg-purple-100 text-purple-700 border-purple-200',
        requiresRecovery: false, isAssignable: false, category: 'EARLY'
        // Auto-assigned day after T10/R1
    },

    // ── On-Call Duties (Bereitschaftsdienst) ─────────────────────────────────
    'BD': {
        start: '07:00', end: '07:00+1',
        label: 'BD – Bereitschaft (Mo–Do)', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
        requiresRecovery: false, isAssignable: false, blocksNextDay: true, category: 'ONCALL'
        // Next day = not deployed. Day+2 = late or OR only (not T10/R1).
    },
    'BD_FR': {
        start: '11:30', end: '08:30+1',
        label: 'BD – Bereitschaft Freitag', color: 'bg-pink-100 text-pink-800 border-pink-200',
        requiresRecovery: false, isAssignable: false, blocksNextDay: true, category: 'ONCALL'
    },
    'R3': {
        start: '07:00', end: '07:00+1',
        label: 'R3 – Wochenende', color: 'bg-rose-100 text-rose-800 border-rose-200',
        requiresRecovery: false, isAssignable: false, category: 'ONCALL'
        // To be fully programmed later
    },

    // ── Absence ──────────────────────────────────────────────────────────────
    'OFF': {
        start: '-', end: '-',
        label: 'Frei', color: 'bg-slate-100 text-slate-400',
        requiresRecovery: false, isAssignable: false, category: 'ABSENT'
    },
    'RECOVERY': {
        start: '-', end: '-',
        label: 'Erholung', color: 'bg-slate-200 text-slate-500',
        requiresRecovery: false, isAssignable: false, category: 'ABSENT'
    },
    'SICK': {
        start: '-', end: '-',
        label: 'Krank', color: 'bg-red-100 text-red-600',
        requiresRecovery: false, isAssignable: false, category: 'ABSENT'
    },
    'URLAUB': {
        start: '-', end: '-',
        label: 'Urlaub', color: 'bg-green-100 text-green-600',
        requiresRecovery: false, isAssignable: false, category: 'ABSENT'
    },
};

// ── Default Locations ────────────────────────────────────────────────────────
// Rows exactly as described in the Excel legend (rows 2–15)

export const DEFAULT_LOCATIONS: Location[] = [
    // ── OR Säle (Rows 2–9) ─────────────────────────────────────────────────
    { id: 'OR_1',  name: 'Saal 1',  type: 'OR',       staffCount: 1, sortOrder: 1  },
    { id: 'OR_2',  name: 'Saal 2',  type: 'OR',       staffCount: 1, sortOrder: 2  },
    { id: 'OR_3',  name: 'Saal 3',  type: 'OR',       staffCount: 1, sortOrder: 3  },
    { id: 'OR_4',  name: 'Saal 4',  type: 'OR',       staffCount: 1, sortOrder: 4  },
    { id: 'OR_5',  name: 'Saal 5',  type: 'OR',       staffCount: 1, sortOrder: 5  },
    { id: 'OR_6',  name: 'Saal 6',  type: 'OR',       staffCount: 1, sortOrder: 6  },
    { id: 'OR_7',  name: 'Saal 7',  type: 'OR',       staffCount: 1, sortOrder: 7  },
    { id: 'OR_8',  name: 'Saal 8',  type: 'OR',       staffCount: 1, sortOrder: 8  },
    // ── Außenbereiche (Rows 10–11) ─────────────────────────────────────────
    { id: 'HKL',   name: 'HKL / Mitra',    type: 'EXTERNAL', staffCount: 1, sortOrder: 9  },
    { id: 'ENDO',  name: 'Endoskopie / CT', type: 'EXTERNAL', staffCount: 1, sortOrder: 10 },
    // ── AWR (Rows 12–15) ───────────────────────────────────────────────────
    { id: 'AWR_8',  name: 'AF7 / Saal 8 (AWR)',       type: 'AWR', awrShift: 'F7',   staffCount: 1, sortOrder: 11, color: 'bg-cyan-50' },
    { id: 'AWR_F7', name: 'AWR Früh (AF7 07–15:30)',   type: 'AWR', awrShift: 'F7',   staffCount: 1, sortOrder: 12, color: 'bg-cyan-50' },
    { id: 'AWR_AT19',name: 'AWR Mittel (AT19 08:30–17)',type: 'AWR', awrShift: 'AT19', staffCount: 1, sortOrder: 13, color: 'bg-teal-50' },
    { id: 'AWR_AT11',name: 'AWR Spät (AT11 11:30–20)',  type: 'AWR', awrShift: 'AT11', staffCount: 1, sortOrder: 14, color: 'bg-amber-50' },
];

// ── Default App Config ───────────────────────────────────────────────────────

export const DEFAULT_APP_CONFIG: AppConfig = {
    shifts: DEFAULT_SHIFT_CONFIG,
    rotation: {
        maxConsecutiveLateOrLong: 1,  // No 2× T11/AT11/T10/R1 in a row
        monthlyLateTarget: 1,          // Each staff: 1× T11 or AT11 per month
        monthlyOvertimeMax: 10,        // ±10 h per month
        totalOvertimeMax: 20,          // ±20 h running balance
    },
    exclusionKeywords: ['admin', 'sekretariat', 'hilfskraft'],
};

/** @deprecated Legacy department list — kept for old settings components */
export const DEFAULT_DEPARTMENTS: string[] = [
    'Anästhesie', 'OP-Saal', 'AWR', 'HKL', 'Endoskopie',
];
