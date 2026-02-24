
// ============================================================================
// OPAWR-Personalplaner  Anesthesia Staff Planner Type Definitions
// ============================================================================

/** Capability level  anesthesia staff are mostly Expert (universal) */
export type QualificationLevel = 'Expert' | 'Junior' | '';

/** Area type: where a staff member is allowed to work */
export type AreaType = 'OR' | 'AWR' | 'UNIVERSAL';

/** Contract type for part-time handling */
export type ContractType = 'FULL' | 'PART_TIME';

/** Pairing type for trainee-mentor relationships */
export type PairingType = 'MENTOR' | 'TANDEM' | 'TRAINING';

export type ShiftType =
    'F7'    |
    'AF7'   |
    'AT19'  |
    'T11'   |
    'AT11'  |
    'T10'   |
    'R1'    |
    'F5'    |
    'BD'    |
    'BD_FR' |
    'R3'    |
    'OFF'      |
    'RECOVERY' |
    'SICK'     |
    'URLAUB'   |
    string;

export interface ShiftDef {
    start: string;
    end: string;
    label: string;
    color: string;
    requiresRecovery: boolean;
    isAssignable: boolean;
    requiresFollowUpF5?: boolean;
    blocksNextDay?: boolean;
    category?: 'EARLY' | 'MIDDLE' | 'LATE' | 'LONG' | 'ONCALL' | 'ABSENT';
}

export type LocationType = 'OR' | 'AWR' | 'EXTERNAL';

export interface Location {
    id: string;
    name: string;
    type: LocationType;
    awrShift?: 'F7' | 'AT19' | 'AT11';
    staffCount: number;
    sortOrder: number;
    color?: string;
}

export type WeekDay = 'Mo' | 'Di' | 'Mi' | 'Do' | 'Fr';

export interface WeeklyAssignment {
    locationId: string;
    day: WeekDay;
    staffId: string;
    shiftCode: string;
    isManual?: boolean;
}

export interface WeeklyPlan {
    weekStart: string;
    assignments: WeeklyAssignment[];
    dailyShifts: Record<string, Record<string, ShiftType>>;
    version?: number;
}

export interface StaffPairing {
    _id?: string;
    staffId1: string;
    staffId2: string;
    type: PairingType;
    active: boolean;
}

export interface RotationConfig {
    maxConsecutiveLateOrLong: number;
    monthlyLateTarget: number;
    monthlyOvertimeMax: number;
    totalOvertimeMax: number;
}

export interface AppConfig {
    shifts: Record<string, ShiftDef>;
    rotation: RotationConfig;
    exclusionKeywords: string[];
    departments?: string[];
    logic?: Record<string, unknown>;
    weights?: Record<string, number>;
    constraints?: Record<string, unknown>;
    timeline?: Record<string, unknown>;
    csvMapping?: Record<string, string>;
    procedureRules?: ProcedureRule[];
}

export interface Vacation {
    start: string;
    end: string;
    type: string;
}

export interface Staff {
    id: string;
    name: string;
    role: string;
    phone?: string;
    areaType: AreaType;
    qualificationLevel: QualificationLevel;
    isTrainee: boolean;
    mentorId?: string;
    isManagement: boolean;
    isSick: boolean;
    contractType: ContractType;
    fixedDays?: string[];
    fixedHours?: { start: string; end: string };
    workDays: string[];
    preferredLocations: string[];
    avoidLocations: string[];
    overtimeBalance: number;
    recoveryDays: string[];
    shifts: Record<string, ShiftType>;
    currentShift?: ShiftType;
    vacations: Vacation[];
    tags?: string[];
    /** @deprecated */ isSaalleitung?: boolean;
    /** @deprecated */ skills?: Record<string, string>;
    /** @deprecated */ departmentPriority?: string[];
    /** @deprecated */ leadDepts?: string[];
    /** @deprecated */ isJoker?: boolean;
    /** @deprecated */ currentCustomTime?: { start: string; end: string };
    /** @deprecated */ requiresCoworkerId?: string;
    /** @deprecated */ preferredRooms?: string[];
}

export interface AssignmentResult {
    assignments: WeeklyAssignment[];
    unassignedStaff: string[];
    alerts: string[];
}

export interface StaffWorkload {
    staffId: string;
    name: string;
    role: string;
    daysAvailable: number;
    daysAssigned: number;
    lateShiftCount: number;
    longShiftCount: number;
    onCallCount: number;
    awrCount: number;
    orCount: number;
    locationHistory: Record<string, number>;
    burnoutRisk: boolean;
    utilizationRate: number;
    overtimeBalance: number;
    roomHistory?: Record<string, number>;
    dates?: string[];
    leadAssignments?: number;
    supportAssignments?: number;
    weekendShifts?: number;
}

export interface DailyRiskAnalysis {
    date: string;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    absences: number;
    totalStaff: number;
    reasons: string[];
}

export interface AnalyticsSummary {
    startDate: string;
    endDate: string;
    workload: StaffWorkload[];
    weeklyAbsences: Record<string, number>;
    lateShiftDistribution: Record<string, number>;
    locationRotation: Record<string, Record<string, number>>;
    dailyRisks?: DailyRiskAnalysis[];
    deptDistribution?: Record<string, number>;
    revenueAtRisk?: number;
    skillGaps?: Array<{ dept: string; level: string; count: number }>;
}

export interface ChatMessage {
    id?: number;
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
    id: string;
    username: string;
    role: UserRole;
    name: string;
}

/** @deprecated Use Location instead */
export interface Room {
    id: string;
    name: string;
    primaryDepts: string[];
    operations: unknown[];
    requiredStaffCount: number;
    tags?: string[];
}
/** @deprecated Use WeeklyAssignment instead */
export interface Assignment {
    roomId: string;
    staffIds: string[];
}
export type Dept = string;
export interface RoomConfig {
    id: string;
    name: string;
    primaryDepts: string[];
    tags?: string[];
}
export interface CustomTime { start: string; end: string; }

export interface Operation {
    id: string;
    name: string;
    dept: string;
    time?: string;
    duration?: number;
    procedure?: string;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
    estimatedRevenue?: number;
    durationMinutes?: number;
    room?: string;
}

export interface ReschedulingOption {
    staffId: string;
    fromDate: string;
    toDate: string;
    reason: string;
    score: number;
    originalOp?: Operation;
    targetDate?: string;
    targetRoom?: string;
    matchType?: string;
    reasoning?: string;
    metrics?: Record<string, number>;
}

export type WeightConfig = Record<string, number>;
export type ConstraintConfig = Record<string, unknown>;

export interface LogicConfig {
    [key: string]: unknown;
    maxRoomsPerStaff?: number;
    preferSameRoom?: boolean;
    allowCrossTraining?: boolean;
}

export interface SpecialRule {
    id: string;
    name?: string;
    condition: unknown;
    action: unknown;
    enabled?: boolean;
}

export interface ProcedureRule {
    id: string;
    procedure: string;
    rule: unknown;
    priority?: number;
}

export interface CsvMappingConfig {
    [key: string]: string;
}

export interface TimelineConfig {
    start: string;
    end: string;
    breakMinutes: number;
}
