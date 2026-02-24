// @ts-nocheck

import { Operation, Dept, Staff, QualificationLevel, ShiftType, Room, Assignment, Vacation, ReschedulingOption, RoomConfig, ProcedureRule, CsvMappingConfig, LogicConfig } from '../types';
import { DEFAULT_SHIFT_CONFIG, DEFAULT_APP_CONFIG, DEFAULT_DEPARTMENTS } from '../constants';
import { z } from 'zod';

// --- ZOD SCHEMAS ---

const QualificationLevelSchema = z.enum(['E', 'J', 'Expert', 'Expert+', 'Junior', '']).catch('');

// Allow dynamic string for Department to support user-added depts (e.g. NEURO)
const DeptSchema = z.string().min(2).transform(val => val.toUpperCase());

const StaffSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string().default('Mitarbeiter'),
    phone: z.string().optional(),
    // OPAWR fields (required by auto-assignment engine)
    areaType: z.enum(['OR', 'AWR', 'UNIVERSAL']).default('UNIVERSAL'),
    qualificationLevel: QualificationLevelSchema,
    isTrainee: z.boolean().default(false),
    contractType: z.enum(['FULL', 'PART_TIME']).default('FULL'),
    preferredLocations: z.array(z.string()).default([]),
    avoidLocations: z.array(z.string()).default([]),
    overtimeBalance: z.number().default(0),
    // Legacy / compat fields
    skills: z.record(z.string(), QualificationLevelSchema).default({}),
    isSaalleitung: z.boolean().default(false),
    isManagement: z.boolean().default(false),
    isMFA: z.boolean().default(false),
    isJoker: z.boolean().default(false),
    isSick: z.boolean().default(false),
    workDays: z.array(z.string()).default(['Mo', 'Di', 'Mi', 'Do', 'Fr']),
    preferredRooms: z.array(z.string()).default([]),
    leadDepts: z.array(z.string()).default([]),
    departmentPriority: z.array(z.string()).default([]),
    tags: z.array(z.string()).optional().default([]),
    requiresCoworkerId: z.string().optional(),
    recoveryDays: z.array(z.string()).default([]),
    shifts: z.record(z.string(), z.string()).default({}),
    vacations: z.array(z.object({
        start: z.string(),
        end: z.string(),
        type: z.string()
    })).default([])
});

const OperationSchema = z.object({
    id: z.string(),
    room: z.string().min(1),
    time: z.string().regex(/^\d{1,2}:\d{2}$/, "Invalid time format"),
    dept: DeptSchema,
    procedure: z.string().min(1),
    durationMinutes: z.number().positive(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    estimatedRevenue: z.number().nonnegative()
});

// Helper to estimate duration and revenue based on procedure keywords
// Accepts optional rules (from AppConfig)
export const estimateOpDetails = (procedure: string, rules?: ProcedureRule[]): { duration: number, revenue: number, priority: 'HIGH' | 'MEDIUM' | 'LOW', requiredDept?: string } => {
    const p = procedure.toLowerCase();
    
    // Use rules from config if provided, otherwise fallback to defaults (legacy safety)
    const effectiveRules = rules || DEFAULT_APP_CONFIG.procedureRules || [];

    for (const rule of effectiveRules) {
        if (rule.keywords.some(k => p.includes(k.toLowerCase()))) {
            return {
                duration: rule.durationMinutes,
                revenue: rule.revenue,
                priority: rule.priority,
                requiredDept: rule.requiredDept
            };
        }
    }

    // Default fallback if no rules match
    return { duration: 60, revenue: 2500, priority: 'MEDIUM' };
};

/**
 * Reads a file with encoding detection (UTF-8 vs ISO-8859-1)
 * Fixes issues with German Umlauts (ä, ö, ü) in legacy CSV exports.
 */
export const readCsvFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const text = e.target?.result as string;
            // Check for the replacement character  (U+FFFD) which indicates UTF-8 decoding errors
            if (text.includes('\uFFFD')) {
                console.log("Encoding mismatch detected (UTF-8). Retrying with ISO-8859-1 (Latin-1).");
                const retryReader = new FileReader();
                retryReader.onload = (ev) => resolve(ev.target?.result as string);
                retryReader.onerror = (err) => reject(err);
                retryReader.readAsText(file, 'ISO-8859-1'); 
            } else {
                resolve(text);
            }
        };
        
        reader.onerror = (err) => reject(err);
        reader.readAsText(file, 'UTF-8');
    });
};

/**
 * Parses a CSV string into a map of Operations grouped by date.
 */
export const parseOperationsCsv = (
    csvText: string, 
    procedureRules?: ProcedureRule[],
    mappingConfig: CsvMappingConfig = DEFAULT_APP_CONFIG.csvMapping
): Record<string, Operation[]> => {
    // Remove BOM if present
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    const result: Record<string, Operation[]> = {};
    const todayStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (lines.length < 2) {
        throw new Error("Datei ist leer oder enthält zu wenig Zeilen.");
    }

    const firstLine = lines[0] || '';
    const delimiter = firstLine.includes(';') ? ';' : ',';

    let headerIndex = -1;
    let colMap = { date: -1, time: -1, endTime: -1, procedure: -1, dept: -1, room: -1 };

    // Helper to find column index based on config keywords
    const findCol = (headers: string[], keywords: string[]) => {
        return headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
    };

    // 1. HEADER SCAN: Try to identify columns by name
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const lowerLine = lines[i].toLowerCase();
        const matchesTime = mappingConfig.time.some(k => lowerLine.includes(k));
        const matchesRoom = mappingConfig.room.some(k => lowerLine.includes(k));
        const matchesProc = mappingConfig.procedure.some(k => lowerLine.includes(k));
        
        if (matchesTime && (matchesRoom || matchesProc)) {
            headerIndex = i;
            const headers = lines[i].split(delimiter).map(h => h.trim().toLowerCase());
            
            colMap.date = findCol(headers, mappingConfig.date);
            colMap.time = headers.findIndex(h => mappingConfig.time.some(k => h.includes(k)) && !mappingConfig.endTime.some(k => h.includes(k)));
            colMap.endTime = findCol(headers, mappingConfig.endTime);
            colMap.procedure = findCol(headers, mappingConfig.procedure);
            colMap.dept = findCol(headers, mappingConfig.dept);
            colMap.room = findCol(headers, mappingConfig.room);
            break;
        }
    }

    const startRow = headerIndex === -1 ? 0 : headerIndex + 1;

    if (colMap.time === -1) throw new Error("Startzeit-Spalte nicht gefunden.");
    if (colMap.procedure === -1) throw new Error("Eingriffs-Spalte nicht gefunden.");

    let validRowsCount = 0;

    for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(delimiter).map(c => c.trim());
        
        if (cols.length < 3) continue;

        let room = colMap.room !== -1 ? cols[colMap.room] : '';
        if (/(mg|g|i\.v\.|tbl|nein|ja)/i.test(room) && !room.toLowerCase().includes('saal')) {
            room = ''; 
        }

        const time = colMap.time !== -1 ? cols[colMap.time] : '';
        const endTime = colMap.endTime !== -1 ? cols[colMap.endTime] : '';
        const procedure = colMap.procedure !== -1 ? cols[colMap.procedure] : 'Operation';
        let deptStr = colMap.dept !== -1 ? cols[colMap.dept] : '';

        if (!time || !time.includes(':')) continue;

        let rowDate = todayStr;
        if (colMap.date !== -1 && cols[colMap.date]) {
            rowDate = cols[colMap.date];
            // Normalize DD.MM.YY to DD.MM.YYYY
            const dateMatch = rowDate.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})/);
            if (dateMatch) {
                const parts = dateMatch[1].split('.');
                if (parts[2].length === 2) {
                    rowDate = `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}.20${parts[2]}`;
                } else {
                    rowDate = `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[2]}`;
                }
            }
        }

        let cleanRoom = room;
        
        if (cleanRoom && !cleanRoom.toUpperCase().includes('SAAL') && /^\d+$/.test(cleanRoom)) {
            cleanRoom = `SAAL ${cleanRoom}`;
        }
        if (!cleanRoom) cleanRoom = 'UNASSIGNED';

        const estimates = estimateOpDetails(procedure, procedureRules);
        let durationMinutes = estimates.duration;
        
        const dept = estimates.requiredDept 
            ? estimates.requiredDept as Dept 
            : (deptStr.toUpperCase() || 'UCH') as Dept;

        if (endTime) {
             const startParts = time.split(':').map(Number);
             const endParts = endTime.split(':').map(Number);
             if (startParts.length === 2 && endParts.length === 2) {
                 const startMins = startParts[0] * 60 + startParts[1];
                 const endMins = endParts[0] * 60 + endParts[1];
                 let diff = endMins - startMins;
                 if (diff < 0) diff += 1440; 
                 if (diff > 15 && diff < 720) durationMinutes = diff;
             }
        }

        const rawOp = {
            id: `op_${rowDate}_${i}`,
            room: cleanRoom,
            time: time,
            dept: dept,
            procedure: procedure,
            durationMinutes: durationMinutes,
            priority: estimates.priority,
            estimatedRevenue: estimates.revenue
        };

        const parseResult = OperationSchema.safeParse(rawOp);
        if (parseResult.success) {
            if (!result[rowDate]) result[rowDate] = [];
            result[rowDate].push(parseResult.data as Operation);
            validRowsCount++;
        }
    }

    if (validRowsCount === 0) {
        throw new Error("Keine gültigen Operationen in der Datei gefunden.");
    }

    return result;
};

/**
 * Intelligent parser for "Krankenhaus Roster Export" (Screenshot format)
 * Handles "Lastname, Firstname" and "Elementtyp" filtering.
 */
const parseComplexRosterCsv = (lines: string[]): { name: string, date: string, shift: ShiftType }[] => {
    const result: { name: string, date: string, shift: ShiftType }[] = [];
    // Deduplication: first meaningful row per staff+date wins
    const seen = new Set<string>();

    // 1. Find Header Line (Look for 'VNr' or 'Kürzel')
    let headerIdx = -1;
    for (let i = 0; i < Math.min(15, lines.length); i++) {
        const line = lines[i].replace(/["']/g, '');
        if (line.includes('VNr') || line.includes('Kürzel') || line.includes('Kurzel') || line.includes('Ist Dienst')) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) {
        console.warn("Complex Parser: Header row not found.");
        return [];
    }

    const headerLine = lines[headerIdx];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

    const findIndexFuzzy = (searchTerms: string[]) => {
        return headers.findIndex(h => {
            const normalizedHeader = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            return searchTerms.some(term => normalizedHeader.includes(term.toLowerCase()));
        });
    };

    const colName     = findIndexFuzzy(['name', 'nachname', 'mitarbeiter']);
    const colCode     = findIndexFuzzy(['kurzel', 'kuerzel', 'code', 'krz']);
    const colStart    = findIndexFuzzy(['zeitvon', 'zeit-von', 'beginn', 'start']);
    const colDauer    = findIndexFuzzy(['dauer', 'duration']);
    // FIXED: search 'elementtyp' specifically so we find col 19, not the shorter 'Typ' column (col 7)
    const colElementTyp = findIndexFuzzy(['elementtyp']);
    // Keep col 7 (Typ) reference for sick/off fallback
    const colTyp      = findIndexFuzzy(['typ', 'art']);

    if (colName === -1 || colCode === -1 || colStart === -1) {
        console.warn("Complex Parser: Critical columns missing.", { colName, colCode, colStart });
        return [];
    }

    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < colStart) continue;

        const rawName    = cols[colName] ?? '';
        const code       = cols[colCode] ?? '';
        const elementTyp = colElementTyp !== -1 ? (cols[colElementTyp] ?? '') : '';
        const rawStart   = cols[colStart] ?? '';
        const dauerStr   = colDauer !== -1 ? (cols[colDauer] ?? '') : '';

        // Skip break rows (Pause) and the overnight on-call sub-segment (Bereitschaft)
        // — the main shift code is already captured by the preceding Regeldienst row.
        if (elementTyp === 'Pause' || elementTyp === 'Bereitschaft') continue;

        // Skip very short "handoff" segments (< 1 h) — e.g. TB3 next-day return at 08:15–08:30
        const dauer = parseFloat(dauerStr.replace(',', '.'));
        if (!isNaN(dauer) && dauer > 0 && dauer < 1.0) continue;

        // Extract date from "DD.MM.YYYY HH:MM" (or similar)
        let date = '';
        const dateMatch = rawStart.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})/);
        if (dateMatch) {
            const parts = dateMatch[1].split('.');
            date = `${parts[0].padStart(2,'0')}.${parts[1].padStart(2,'0')}.${parts[2].length === 2 ? '20' + parts[2] : parts[2]}`;
        } else {
            continue;
        }

        // Normalise name: "Lastname, Firstname" → "Firstname Lastname"
        let name = rawName.replace(/^[\d-]+/, '').trim();
        if (name.includes(',')) {
            const [last, first] = name.split(',').map(p => p.trim());
            name = `${first} ${last}`;
        }

        // FIXED: strip trailing dots from Kürzel  (e.g. "AT11." → "AT11", "TB3..." → "TB3", "AF7." → "AF7")
        const c = code.toUpperCase().replace(/\s+/g, '').replace(/\.+$/, '');

        let shift: ShiftType | null = null;

        if (['K', 'KK', 'KO', 'KRA'].some(x => c === x || c.startsWith(x))) {
            // Krank / Krankheit
            shift = 'SICK';
        } else if (c === 'AU') {
            // Krankheit mit Attest (Arbeitsunfähigkeit)
            shift = 'SICK';
        } else if (c.startsWith('UL')) {
            // Urlaub → map to dedicated URLAUB code (not generic OFF)
            shift = 'URLAUB';
        } else if (['-', 'WB', 'FB', 'SU', 'ÜFM', 'ÜF', 'AA', 'AG', 'EZ', 'FREI'].some(x => c === x || c.startsWith(x))) {
            // Various "free / excused" Fehlzeit codes
            shift = 'OFF';
        } else if (/^TB\d/.test(c)) {
            // "Komplex" Bereitschaftsdienst: TB1 (F7+BD), TB3 (T11+BD), TB4/5/7 variants → BD
            shift = 'BD';
        } else if (['F10', 'F44', 'BR1', 'A1'].includes(c)) {
            // Non-standard early-shift codes → treat as standard F7
            shift = 'F7';
        } else if (c === 'T1') {
            // Long Tagdienst variant → T10
            shift = 'T10';
        } else if (c === 'S3') {
            // Spätdienst (OR) variant → T11
            shift = 'T11';
        } else if (c.length > 0) {
            // Pass through known codes: F7, AF7, AT11, AT19, T11, T10, R1, R3, F5, BD, BD_FR …
            shift = c as ShiftType;
        }

        // Fallback: derive from column values when code was unrecognised or empty
        if (!shift) {
            const typ = colTyp !== -1 ? (cols[colTyp] ?? '').toLowerCase() : '';
            if (elementTyp.toLowerCase().includes('fehlzeit') || typ.includes('frei')) {
                shift = 'OFF';
            } else if (typ.includes('urlaub')) {
                shift = 'URLAUB';
            } else if (typ.includes('krank')) {
                shift = 'SICK';
            }
        }

        if (shift && name && date) {
            const key = `${name}__${date}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push({ name, date, shift });
            }
        }
    }
    return result;
};

/**
 * Main Shift/Roster Parser
 */
export const parseShiftCsv = (csvText: string): { name: string, date: string, shift: ShiftType }[] => {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const sample = lines.slice(0, 10).join('\n');
    if (sample.includes('VNr') || sample.includes('Kürzel') || sample.includes('Kurzel') || sample.includes('Elementtyp')) {
        return parseComplexRosterCsv(lines);
    }

    const result: { name: string, date: string, shift: ShiftType }[] = [];
    const delimiter = lines[0].includes(';') ? ';' : ',';

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) continue;
        
        const name = cols[0];
        const dateRaw = cols[1];
        const shiftCode = cols[2].toUpperCase();
        
        let date = dateRaw;
        const dateMatch = dateRaw.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})/);
        if (dateMatch) {
             const p = dateMatch[1].split('.');
             date = `${p[0].padStart(2,'0')}.${p[1].padStart(2,'0')}.${p[2].length===2 ? '20'+p[2] : p[2]}`;
        }

        if (name && shiftCode) {
             result.push({ name, date, shift: shiftCode as ShiftType });
        }
    }
    return result;
};

// ... (Rest of parseStaffCsv and other methods remain identical)

export const parseStaffCsv = (
    csvText: string,
    logicConfig: LogicConfig = DEFAULT_APP_CONFIG.logic,
    knownDepartments: string[] = DEFAULT_DEPARTMENTS
): Staff[] => {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    const staffList: Staff[] = [];
    const delimiter = lines[0]?.includes(';') ? ';' : ',';

    // Detect column positions from header row
    const headers = lines[0].toLowerCase().split(delimiter);
    let phoneIndex = 7;
    let einsatzbereichIndex = -1;

    headers.forEach((h, i) => {
        if (h.includes('handy') || h.includes('telefon') || h.includes('phone')) phoneIndex = i;
        if (h.includes('einsatz') || h.includes('bereich') || h.includes('area')) einsatzbereichIndex = i;
    });

    // If old template (Handy at index 7, no Einsatzbereich), keep phoneIndex=7.
    // If new template has Einsatzbereich at 7 and Handy at 8, adjust phoneIndex.
    if (einsatzbereichIndex === 7 && phoneIndex === 7) phoneIndex = 8;

    const areaTypeMap: Record<string, string> = {
        'or': 'OR', 'op': 'OR', 'saal': 'OR',
        'awr': 'AWR', 'aufwach': 'AWR', 'aufwachraum': 'AWR',
        'universal': 'UNIVERSAL', 'universell': 'UNIVERSAL', 'all': 'UNIVERSAL', 'alle': 'UNIVERSAL'
    };

    const matchesKeyword = (text: string, keywords: string[]) => {
        const lower = text.toLowerCase();
        return keywords.some(k => lower.includes(k.toLowerCase()));
    };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;

        const name = cols[0];
        const id = name;
        const role = cols[1] || 'Mitarbeiter';
        const certs = cols[2] ? cols[2].split(',').map(c => c.trim()) : [];
        const workDays = cols[3] ? cols[3].split(',').map(d => d.trim()) : ['Mo','Di','Mi','Do','Fr'];
        
        let leadDepts = cols[4] ? cols[4].split(',').map(d => d.trim()).filter(Boolean) : [];
        
        const skillsRaw = cols[5] ? cols[5].split(',') : [];
        const prefRooms = cols[6] ? cols[6].split(',').map(r => r.trim()) : [];

        // Parse Einsatzbereich (area type) — column 7 in new template, or auto-detect
        const einsatzRaw = einsatzbereichIndex !== -1 && cols[einsatzbereichIndex]
            ? cols[einsatzbereichIndex].toLowerCase().trim()
            : '';
        const areaType = (areaTypeMap[einsatzRaw] || 'UNIVERSAL') as 'OR' | 'AWR' | 'UNIVERSAL';

        const phone = cols[phoneIndex] || undefined;

        const skills: Record<string, QualificationLevel> = {};
        skillsRaw.forEach(s => {
            const [dept, level] = s.split(':').map(part => part.trim());
            if (dept && level) skills[dept] = level as QualificationLevel;
        });

        const isSaalleitung = matchesKeyword(role, logicConfig.roleKeywords.saalleitung) || leadDepts.length > 0;
        const isJoker = matchesKeyword(role, logicConfig.roleKeywords.joker);
        const isMFA = certs.some(c => matchesKeyword(c, logicConfig.roleKeywords.mfa)) || matchesKeyword(role, logicConfig.roleKeywords.mfa);

        if (isSaalleitung && leadDepts.length === 0) {
             knownDepartments.forEach(dept => {
                 const regex = new RegExp(`\\b${dept}\\b|${dept}`, 'i');
                 if (regex.test(role)) {
                     if (!leadDepts.includes(dept)) {
                         leadDepts.push(dept);
                     }
                 }
             });
        }

        const rawStaff = {
            id,
            name,
            role,
            skills,
            phone,
            // OPAWR fields — critical for auto-assignment engine
            areaType,
            qualificationLevel: isSaalleitung ? 'Expert' : '',
            isTrainee: false,
            contractType: 'FULL',
            preferredLocations: prefRooms,
            avoidLocations: [],
            overtimeBalance: 0,
            // Legacy / compat fields
            isSaalleitung,
            isManagement: false,
            isMFA,
            isJoker,
            isSick: false,
            workDays,
            preferredRooms: prefRooms,
            leadDepts,
            departmentPriority: [],
            tags: [],
            recoveryDays: [],
            shifts: {},
            vacations: []
        };

        const parseResult = StaffSchema.safeParse(rawStaff);
        if (parseResult.success) staffList.push(parseResult.data as Staff);
    }
    return staffList;
};

export const parseVacationCsv = (csvText: string): { name: string, vacation: Vacation }[] => {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    const result: { name: string, vacation: Vacation }[] = [];
    const delimiter = lines[0]?.includes(';') ? ';' : ',';

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) continue;
        const name = cols[0];
        const start = cols[1];
        const end = cols[2];
        const type = cols[3] || 'Urlaub';
        const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
        if (dateRegex.test(start) && dateRegex.test(end)) {
            result.push({ name, vacation: { start, end, type } });
        }
    }
    return result;
};

export const downloadPlanCSV = (date: string, rooms: Room[], assignments: Assignment[], staffList: Staff[]) => {
    const header = ['Saal', 'Fachabteilung', 'Saalleitung / 1. Kraft', 'Springer / 2. Kraft', 'Weitere', 'Anzahl OPs', 'Startzeit', 'Details'];
    const rows = rooms.map(room => {
        const assignment = assignments.find(a => a.roomId === room.id);
        const assignedStaff = assignment ? assignment.staffIds.map(id => staffList.find(s => s.id === id)) : [];
        const leadStaff = assignedStaff.length > 0 ? assignedStaff[0] : null;
        const secondStaff = assignedStaff.length > 1 ? assignedStaff[1] : null;
        const otherStaff = assignedStaff.length > 2 ? assignedStaff.slice(2).map(s => s?.name).join(', ') : '';
        const leadName = leadStaff ? `${leadStaff.name} (${leadStaff.role})` : '-';
        const secondName = secondStaff ? `${secondStaff.name} (${secondStaff.role})` : '-';
        const dept = room.primaryDepts.join('/');
        const opCount = room.operations.length;
        const firstOpTime = room.operations.length > 0 ? room.operations[0].time : '-';
        const opDetails = room.operations.map(o => `[${o.time}] ${o.procedure}`).join(' | ');
        const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;
        return [
            escape(room.name),
            escape(dept),
            escape(leadName),
            escape(secondName),
            escape(otherStaff),
            escape(opCount),
            escape(firstOpTime),
            escape(opDetails)
        ].join(';');
    });

    const csvContent = [`OP-Tagesplan;${date};Generiert mit OP-Personalplaner AI`, header.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OP-Plan_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

export const exportReschedulingToCSV = (suggestions: ReschedulingOption[]) => {
    const header = ['Original Datum', 'Original Saal', 'Eingriff', 'Fachabteilung', 'Ziel Datum', 'Ziel Saal', 'Grund', 'Typ', 'Score', 'Umsatz (Simuliert)', 'Effizienz-Gewinn', 'Cluster-Bonus'];
    const rows = suggestions.map(opt => {
        let originalDate = 'Unbekannt';
        if (opt.originalOp.id && opt.originalOp.id.startsWith('op_')) {
             const parts = opt.originalOp.id.split('_');
             if (parts.length >= 2) originalDate = parts[1];
        }
        const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;
        return [
            escape(originalDate),
            escape(opt.originalOp.room),
            escape(opt.originalOp.procedure),
            escape(opt.originalOp.dept),
            escape(opt.targetDate),
            escape(opt.targetRoom),
            escape(opt.reasoning),
            escape(opt.matchType),
            escape(opt.score),
            escape(opt.metrics.revenueProtected + ' €'),
            escape('+' + opt.metrics.utilizationImpact + '%'),
            escape(opt.metrics.batchingBonus ? 'JA' : 'NEIN')
        ].join(';');
    });
    const csvContent = [`Simulations-Ergebnis;Generiert am ${new Date().toLocaleDateString('de-DE')}`, header.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Simulation_Umplanung_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

export const getStaffCsvTemplate = (): string => `Name;Rolle;Zertifikate;Arbeitstage;LeitungsAbteilungen;Fähigkeiten;BevorzugteSäle;Einsatzbereich;Handy
Marc Müller;OTA;OTA;Mo,Di,Mi,Do,Fr;;UCH:Expert;;UNIVERSAL;+491701234567
Gabi Kremer;Saalleitung;OTA;Mo,Di,Mi,Do;UCH;UCH:Expert;AWR1;AWR;+4916099887766
Anna Schneider;OTA;OTA;Mo,Di,Mi,Do,Fr;;UCH:Junior;;OR;`;

export const getVacationCsvTemplate = (): string => `Name;Startdatum;Enddatum;Art\nJennifer;24.12.2025;31.12.2025;Urlaub\nRita;01.01.2026;07.01.2026;Fortbildung`;
export const getShiftCsvTemplate = (): string => `Name;Datum;SchichtKuerzel\nRita;18.11.2025;S44\nJennifer;18.11.2025;OFF\nAnna;19.11.2025;BD1`;
export const getCsvTemplate = (): string => `Datum;Zeit;Endzeit;Eingriff;Antibiotika;OP-Orgaeinheit;OP-Saal;Nachname Vorname\n18.11.2025;07:20;09:00;Pansinus OP, Septum;Nein;HNO;SAAL 1;Domscheit\n18.11.2025;07:25;;Osteosynthese;Cefuroxim;UCH;SAAL 2;Hölscher`;

export const BUILD_INITIAL_ROOMS = (operations: Operation[] = [], customMapping?: RoomConfig[]): Room[] => {
    const roomMap = new Map<string, Room>();
    let baseRooms: RoomConfig[] = [];
    if (customMapping && customMapping.length > 0) baseRooms = customMapping;
    
    baseRooms.forEach(roomDef => {
        const id = roomDef.id || roomDef.name.replace(/\s+/g, '_');
        roomMap.set(roomDef.name, {
            id: id,
            name: roomDef.name,
            primaryDepts: roomDef.primaryDepts,
            operations: [],
            requiredStaffCount: 2,
            tags: roomDef.tags || [] 
        });
    });

    operations.forEach(op => {
        const targetRoomName = Array.from(roomMap.keys()).find(
            key => key.toLowerCase() === op.room.toLowerCase()
        ) || op.room;

        let r = roomMap.get(targetRoomName);
        if (!r) {
             r = {
                id: targetRoomName.replace(/\s+/g, '_'),
                name: targetRoomName,
                primaryDepts: [op.dept], 
                operations: [],
                requiredStaffCount: 2,
                tags: []
            };
            roomMap.set(targetRoomName, r);
        }
        r.operations.push(op);
    });
    return Array.from(roomMap.values());
};

