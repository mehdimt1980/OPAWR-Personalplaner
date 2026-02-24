import Dexie, { type EntityTable } from 'dexie';
import { Staff, AppConfig, StaffPairing, ShiftType, CustomTime, ChatMessage, WeeklyPlan, Location } from './types';

// ── Table Interfaces ──────────────────────────────────────────────────────────

/** Weekly plan keyed by week-start date (Monday DD.MM.YYYY) */
export interface LocalWeeklyPlan {
    weekStart: string; // PK — Monday in DD.MM.YYYY
    assignments: WeeklyPlan['assignments'];
    dailyShifts: WeeklyPlan['dailyShifts'];
    version?: number;
}

/** Staff list (single document pattern) */
export interface LocalStaffList {
    identifier: string; // 'main_list'
    staff: Staff[];
}

/** Location config (replaces RoomConfig) */
export interface LocalLocationConfig {
    identifier: string; // 'main_locations'
    locations: Location[];
}

/** App config */
export interface LocalAppConfig {
    identifier: string; // 'main_config'
    config: AppConfig;
}

/** Staff pairings (mentor–trainee, tandem) */
export interface LocalPairings {
    key: string; // 'main_pairings'
    data: StaffPairing[];
}

// ── Legacy plan/roster interfaces kept for migration ─────────────────────────
export interface LocalPlan {
    date: string;
    assignments: any[];
    operations: any[];
    staffShifts?: Record<string, ShiftType>;
    version?: number;
}
export interface LocalRoster {
    date: string;
    shifts: Record<string, ShiftType>;
    customTimes?: Record<string, CustomTime>;
}

// ── Dexie Database ────────────────────────────────────────────────────────────

const db = new Dexie('OPAWRPlannerDB') as Dexie & {
    weeklyPlans: EntityTable<LocalWeeklyPlan, 'weekStart'>;
    staff: EntityTable<LocalStaffList, 'identifier'>;
    locationConfig: EntityTable<LocalLocationConfig, 'identifier'>;
    appConfig: EntityTable<LocalAppConfig, 'identifier'>;
    pairings: EntityTable<LocalPairings, 'key'>;
    chatHistory: EntityTable<ChatMessage, 'id'>;
    // Legacy tables kept for data migration
    plans: EntityTable<LocalPlan, 'date'>;
    rosters: EntityTable<LocalRoster, 'date'>;
};

db.version(2).stores({
    weeklyPlans: 'weekStart',
    staff: 'identifier',
    locationConfig: 'identifier',
    appConfig: 'identifier',
    pairings: 'key',
    chatHistory: '++id, timestamp',
    // Legacy
    plans: 'date',
    rosters: 'date',
});

export { db };
