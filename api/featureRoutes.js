
import express from 'express';
import multer from 'multer';
import twilio from 'twilio';
import { GoogleGenAI } from "@google/genai";
import { put } from '@vercel/blob';
import { Feedback, Plan, Roster, StaffList, RoomConfig, AppConfig } from './db.js';
import { authenticateToken } from './middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Twilio Config
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// API Key Logic (Support both names)
const getAiKey = () => process.env.API_KEY || process.env.GEMINI_API_KEY;

// --- INTELLIGENCE LOGIC (Ported from MCP) ---

const isStaffAvailable = (staff, roster, date, shiftConfig) => {
    // 1. Check Shift Status with Dynamic Config
    const shiftCode = roster?.shifts?.[staff.id] || 'T1'; 
    
    // Use Config if available
    if (shiftConfig && shiftConfig[shiftCode]) {
        if (shiftConfig[shiftCode].isAssignable === false) return false;
    } else {
        // Fallback legacy check
        if (['OFF', 'SICK', 'RECOVERY'].includes(shiftCode)) return false; 
    }
    
    // 2. Check Vacations
    if (staff.vacations && staff.vacations.length > 0) {
        const [d, m, y] = date.split('.').map(Number);
        const checkTime = new Date(y, m - 1, d).getTime();
        
        const onVacation = staff.vacations.some(v => {
            const [sd, sm, sy] = v.start.split('.').map(Number);
            const [ed, em, ey] = v.end.split('.').map(Number);
            const start = new Date(sy, sm - 1, sd).getTime();
            const end = new Date(ey, em - 1, ed).getTime();
            return checkTime >= start && checkTime <= end;
        });
        if (onVacation) return false;
    }
    
    // 3. Check Work Days
    const dateObj = new Date(date.split('.').reverse().join('-'));
    const dayName = dateObj.toLocaleDateString('de-DE', { weekday: 'short' });
    if (staff.workDays && Array.isArray(staff.workDays) && !staff.workDays.includes(dayName)) return false;

    return true;
};

const validateAssignmentLogic = (room, staffIds, allStaff, allAssignments, roomConfig) => {
    const issues = [];
    const staffObjs = staffIds.map(id => allStaff.find(s => s.id === id)).filter(Boolean);

    // 1. Double Booking Check
    staffIds.forEach(id => {
        const other = allAssignments.find(a => a.roomId !== room.id && a.staffIds.includes(id));
        if (other) {
            issues.push({ type: 'ERROR', msg: `${id} is already assigned to ${other.roomId}` });
        }
    });

    // 2. Qualification Check
    const rConfig = roomConfig.find(r => r.id === room.id || r.name === room.name);
    const requiredDepts = rConfig?.primaryDepts || ['UCH']; 
    
    const hasExpert = staffObjs.some(s => 
        requiredDepts.some(dept => {
            const skill = s.skills?.[dept];
            return skill === 'Expert' || skill === 'Expert+' || skill === 'E';
        })
    );

    if (!hasExpert) {
        issues.push({ type: 'WARNING', msg: `No Expert for [${requiredDepts.join(',')}] in ${room.name}` });
    }

    // 3. Understaffing Check
    if (staffIds.length < (rConfig?.requiredStaffCount || 2)) {
        issues.push({ type: 'WARNING', msg: `Understaffed (${staffIds.length}/2)` });
    }

    return issues;
};

// --- HELPER: Tool Definitions ---
const tools = [
    {
        functionDeclarations: [
            {
                name: "assign_staff",
                description: "Assigns staff to a room. Always try to assign 2 people (Lead + Support). Overwrites existing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date in DD.MM.YYYY format" },
                        roomId: { type: "STRING", description: "The ID of the room (e.g. SAAL_1)" },
                        staffIds: { 
                            type: "ARRAY", 
                            items: { type: "STRING" },
                            description: "List of Staff IDs (names). Prefer 2 IDs." 
                        }
                    },
                    required: ["date", "roomId", "staffIds"]
                }
            },
            {
                name: "find_candidates",
                description: "Finds available, qualified staff for a specific room or skill. Use this before assigning if you don't know who is free.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date in DD.MM.YYYY" },
                        roomId: { type: "STRING", description: "Room ID to find staff for (e.g. SAAL_1)" },
                        minSkill: { type: "STRING", description: "Minimum skill level: 'Any', 'Junior', or 'Expert'" }
                    },
                    required: ["date", "roomId"]
                }
            },
            {
                name: "swap_staff",
                description: "Swaps two staff members between their current assignments (or bench).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date in DD.MM.YYYY format" },
                        staffId1: { type: "STRING", description: "ID of first staff member" },
                        staffId2: { type: "STRING", description: "ID of second staff member" }
                    },
                    required: ["date", "staffId1", "staffId2"]
                }
            },
            {
                name: "clear_room",
                description: "Removes all assigned staff from a specific room.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date in DD.MM.YYYY format" },
                        roomId: { type: "STRING", description: "ID of the room to clear (e.g. SAAL_1)" }
                    },
                    required: ["date", "roomId"]
                }
            },
            {
                name: "set_shift",
                description: "Sets status (e.g. SICK, OFF).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date in DD.MM.YYYY format" },
                        staffId: { type: "STRING", description: "ID of the staff member" },
                        shift: { type: "STRING", description: "Shift Code: T1, S44, OFF, SICK, RECOVERY" }
                    },
                    required: ["date", "staffId", "shift"]
                }
            },
            {
                name: "add_operation",
                description: "Adds a new operation/surgery.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date in DD.MM.YYYY format" },
                        roomId: { type: "STRING", description: "Target Room ID" },
                        procedure: { type: "STRING", description: "Name of the procedure" },
                        dept: { type: "STRING", description: "Department code" },
                        time: { type: "STRING", description: "Start time (HH:MM)" }
                    },
                    required: ["date", "roomId", "procedure"]
                }
            },
            {
                name: "auto_assign",
                description: "Triggers global auto-assignment algorithm.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date in DD.MM.YYYY format" }
                    },
                    required: ["date"]
                }
            }
        ]
    }
];

// Helper to normalize room IDs (e.g. "SAAL 1" -> "SAAL_1")
const normalizeRoomId = (id) => {
    if (!id) return id;
    return id.trim().replace(/\s+/g, '_').toUpperCase();
};

/**
 * Shared logic to execute a function call returned by Gemini
 */
const executeToolLogic = async (functionCall, contextDate) => {
    console.log("🤖 Gemini Tool Execution:", functionCall.name, functionCall.args);
            
    let toolResult = { result: "Error executing tool" };
    let clientAction = null;
    let shouldRefresh = false;
    
    let targetDate = functionCall.args.date;
    if (!targetDate || targetDate.length < 8) {
        targetDate = contextDate || new Date().toLocaleDateString('de-DE');
    }

    try {
        if (functionCall.name === "assign_staff") {
            const { roomId, staffIds } = functionCall.args;
            const cleanRoomId = normalizeRoomId(roomId);
            
            const existingPlan = await Plan.findOne({ date: targetDate });
            let assignments = existingPlan ? existingPlan.assignments : [];
            
            assignments = assignments.filter(a => a.roomId !== cleanRoomId);
            const idsToAdd = Array.isArray(staffIds) ? staffIds : [staffIds];
            
            if (idsToAdd.length > 0) {
                assignments.push({ roomId: cleanRoomId, staffIds: idsToAdd });
            }

            await Plan.findOneAndUpdate(
                { date: targetDate },
                { date: targetDate, assignments, updatedAt: new Date(), $inc: { version: 1 } },
                { upsert: true, new: true }
            );
            
            // Post-Validation
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const rConfig = await RoomConfig.findOne({ identifier: 'main_rooms' });
            const issues = validateAssignmentLogic(
                { id: cleanRoomId, name: cleanRoomId },
                idsToAdd,
                list?.staff || [],
                assignments,
                rConfig?.rooms || []
            );

            let msg = `Success: Assigned [${idsToAdd.join(', ')}] to ${cleanRoomId}.`;
            if (issues.length > 0) msg += ` WARNINGS: ${issues.map(i => i.msg).join(', ')}`;

            toolResult = { result: msg };
            shouldRefresh = true;
        }
        else if (functionCall.name === "find_candidates") {
            const { roomId, minSkill } = functionCall.args;
            const plan = await Plan.findOne({ date: targetDate });
            const roster = await Roster.findOne({ date: targetDate });
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const rConfig = await RoomConfig.findOne({ identifier: 'main_rooms' });
            const appConfigDoc = await AppConfig.findOne({ identifier: 'main_config' });
            
            const allStaff = list?.staff || [];
            const shiftConfig = appConfigDoc?.shifts || {};
            const roomDef = rConfig?.rooms?.find(r => r.id === roomId || r.name === roomId);
            const requiredDepts = roomDef?.primaryDepts || ['UCH'];
            const assignments = plan?.assignments || [];
            const assignedIds = new Set(assignments.flatMap(a => a.staffIds));

            const candidates = [];
            for (const staff of allStaff) {
                if (assignedIds.has(staff.id)) continue;
                if (!isStaffAvailable(staff, roster, targetDate, shiftConfig)) continue;

                let score = 0;
                let matchesSkill = false;
                for (const dept of requiredDepts) {
                    const level = staff.skills?.[dept];
                    if (['Expert', 'Expert+', 'E'].includes(level)) {
                        score += 100;
                        matchesSkill = true;
                    } else if (['Junior', 'J'].includes(level)) {
                        if (minSkill !== "Expert") {
                            score += 50;
                            matchesSkill = true;
                        }
                    }
                }
                if (!matchesSkill && minSkill !== "Any") continue;
                if (staff.isSaalleitung) score += 10;
                candidates.push({ name: staff.name, score, skills: staff.skills });
            }
            candidates.sort((a, b) => b.score - a.score);
            toolResult = { result: JSON.stringify({ room: roomId, candidates: candidates.slice(0, 5) }) };
        }
        else if (functionCall.name === "swap_staff") {
            const { staffId1, staffId2 } = functionCall.args;
            const existingPlan = await Plan.findOne({ date: targetDate });
            let assignments = existingPlan ? existingPlan.assignments : [];
            
            const findLoc = (sid) => {
                for (let i = 0; i < assignments.length; i++) {
                    const idx = assignments[i].staffIds.indexOf(sid);
                    if (idx !== -1) return { aIdx: i, sIdx: idx };
                }
                return null;
            };
            const loc1 = findLoc(staffId1);
            const loc2 = findLoc(staffId2);

            if (loc1 && loc2) {
                assignments[loc1.aIdx].staffIds[loc1.sIdx] = staffId2;
                assignments[loc2.aIdx].staffIds[loc2.sIdx] = staffId1;
            } else if (loc1) {
                assignments[loc1.aIdx].staffIds[loc1.sIdx] = staffId2;
            } else if (loc2) {
                assignments[loc2.aIdx].staffIds[loc2.sIdx] = staffId1;
            }

            await Plan.findOneAndUpdate(
                { date: targetDate },
                { assignments, updatedAt: new Date(), $inc: { version: 1 } },
                { upsert: true, new: true }
            );
            toolResult = { result: `Success: Swapped ${staffId1} and ${staffId2}.` };
            shouldRefresh = true;
        }
        else if (functionCall.name === "clear_room") {
            const { roomId } = functionCall.args;
            const cleanRoomId = normalizeRoomId(roomId);
            const existingPlan = await Plan.findOne({ date: targetDate });
            if (existingPlan) {
                const newAssignments = existingPlan.assignments.filter(a => a.roomId !== cleanRoomId);
                await Plan.findOneAndUpdate(
                    { date: targetDate },
                    { assignments: newAssignments, updatedAt: new Date(), $inc: { version: 1 } }
                );
            }
            toolResult = { result: `Success: Cleared ${cleanRoomId}.` };
            shouldRefresh = true;
        }
        else if (functionCall.name === "set_shift") {
            const { staffId, shift } = functionCall.args;
            const roster = await Roster.findOne({ date: targetDate });
            const shifts = roster ? roster.shifts : {};
            shifts[staffId] = shift;

            await Roster.findOneAndUpdate(
                { date: targetDate },
                { date: targetDate, shifts, updatedAt: new Date() },
                { upsert: true }
            );

            if (['SICK', 'OFF', 'RECOVERY'].includes(shift)) {
                const plan = await Plan.findOne({ date: targetDate });
                if (plan && plan.assignments) {
                    const newAssignments = plan.assignments.map(a => ({
                        ...a,
                        staffIds: a.staffIds.filter(id => id !== staffId)
                    }));
                    await Plan.findOneAndUpdate({ date: targetDate }, { assignments: newAssignments });
                }
            }
            toolResult = { result: `Success: Marked ${staffId} as ${shift}.` };
            shouldRefresh = true;
        }
        else if (functionCall.name === "add_operation") {
            const { roomId, procedure, dept, time } = functionCall.args;
            const cleanRoomId = normalizeRoomId(roomId);
            const existingPlan = await Plan.findOne({ date: targetDate });
            let operations = existingPlan ? existingPlan.operations : [];
            
            operations.push({
                id: `op_ai_${Date.now()}`,
                room: cleanRoomId,
                time: time || '08:00',
                dept: dept || 'UCH',
                procedure: procedure,
                durationMinutes: 60,
                priority: 'MEDIUM',
                estimatedRevenue: 2500
            });

            await Plan.findOneAndUpdate(
                { date: targetDate },
                { date: targetDate, operations, updatedAt: new Date(), $inc: { version: 1 } },
                { upsert: true, new: true }
            );
            toolResult = { result: `Success: Added op ${procedure} to ${cleanRoomId}.` };
            shouldRefresh = true;
        }
        else if (functionCall.name === "auto_assign") {
            toolResult = { result: "Auto-Assignment requested." };
            clientAction = "AUTO_ASSIGN";
        }

    } catch (dbError) {
        console.error("DB Tool Error:", dbError);
        toolResult = { result: `Error: ${dbError.message}` };
    }

    return { toolResult, shouldRefresh, clientAction };
};

// --- LEARNING ROUTE (Implicit Preference Learning) ---
router.post('/learn/move', authenticateToken, async (req, res) => {
    try {
        const { staffId, roomName, primaryDepts } = req.body;
        
        // 1. Fetch Staff List
        const listDoc = await StaffList.findOne({ identifier: 'main_list' });
        if (!listDoc || !listDoc.staff) return res.status(404).json({ error: "Staff list not found" });
        
        let staffList = listDoc.staff;
        const staffIndex = staffList.findIndex(s => s.id === staffId);
        
        if (staffIndex === -1) return res.status(404).json({ error: "Staff not found" });
        
        const staff = staffList[staffIndex];
        let changed = false;

        // 2. Logic: Update Preferred Rooms (Top 3)
        // Move this room to the front of the preference list
        let prefs = staff.preferredRooms || [];
        // Remove if exists to re-add at top
        prefs = prefs.filter(r => r !== roomName);
        prefs.unshift(roomName);
        // Keep max 3
        if (prefs.length > 3) prefs = prefs.slice(0, 3);
        
        if (JSON.stringify(staff.preferredRooms) !== JSON.stringify(prefs)) {
            staff.preferredRooms = prefs;
            changed = true;
        }

        // 3. Logic: Update Department Priority
        // If room has a primary department, boost that dept priority
        if (primaryDepts && primaryDepts.length > 0) {
            const mainDept = primaryDepts[0];
            let deptPriorities = staff.departmentPriority || [];
            
            // Only learn if staff actually has skill in this dept (prevent learning "wrong" assignments)
            const skillLevel = staff.skills?.[mainDept];
            if (skillLevel && (skillLevel.includes('Expert') || skillLevel.includes('Junior') || skillLevel === 'E' || skillLevel === 'J')) {
                // Move to top
                deptPriorities = deptPriorities.filter(d => d !== mainDept);
                deptPriorities.unshift(mainDept);
                
                if (JSON.stringify(staff.departmentPriority) !== JSON.stringify(deptPriorities)) {
                    staff.departmentPriority = deptPriorities;
                    changed = true;
                }
            }
        }

        // 4. Save if changed
        if (changed) {
            staffList[staffIndex] = staff;
            await StaffList.findOneAndUpdate(
                { identifier: 'main_list' },
                { staff: staffList, updatedAt: new Date() }
            );
            return res.json({ success: true, message: "Preferences updated" });
        }

        res.json({ success: true, message: "No changes needed" });

    } catch (error) {
        console.error("Learning Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- NOTIFICATION ROUTE ---
router.post('/notify', authenticateToken, async (req, res) => {
    const { notifications } = req.body; 
    
    if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({ error: "No notifications provided" });
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return res.json({ success: true, sentCount: notifications.length, failedCount: 0, mode: 'simulation' });
    }

    try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        let sentCount = 0;
        let failedCount = 0;
        const errors = [];

        const results = await Promise.allSettled(notifications.map(n => 
            client.messages.create({ body: n.body, from: TWILIO_PHONE_NUMBER, to: n.to })
        ));

        results.forEach((result) => {
            if (result.status === 'fulfilled') sentCount++;
            else {
                failedCount++;
                errors.push(result.reason.message);
            }
        });

        res.json({ success: true, sentCount, failedCount, errors });
    } catch (error) {
        res.status(500).json({ error: "Failed to process notifications" });
    }
});

// --- TEXT AI ROUTE ---
router.post('/ask', authenticateToken, async (req, res) => {
    try {
        const { prompt, date: contextDate } = req.body;
        const apiKey = getAiKey();
        
        if (!apiKey) return res.status(500).json({ error: "AI API Key missing" });

        const ai = new GoogleGenAI({ apiKey: apiKey });
        // UPGRADE: Use Pro model for complex reasoning and tool execution to prevent 500 errors
        const model = 'gemini-3-pro-preview'; 

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ parts: [{ text: prompt }] }],
            config: { tools: tools }
        });

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) return res.json({ text: "Keine Antwort." });

        const modelParts = candidates[0].content.parts;
        const functionCallPart = modelParts.find(p => p.functionCall);
        const functionCall = functionCallPart?.functionCall;

        if (functionCall) {
            const { toolResult, shouldRefresh, clientAction } = await executeToolLogic(functionCall, contextDate);
            
            const finalResponse = await ai.models.generateContent({
                model: model,
                contents: [
                    { role: 'user', parts: [{ text: prompt }] },
                    { role: 'model', parts: modelParts }, // Pass exact history back
                    // FIX: Simplified response structure to avoid API Internal Errors
                    { role: 'user', parts: [{ functionResponse: { name: functionCall.name, response: toolResult } }] }
                ]
            });
            return res.json({ text: finalResponse.text, toolExecuted: shouldRefresh, clientAction: clientAction });
        }

        res.json({ text: response.text, toolExecuted: false });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- VOICE AI ROUTE ---
router.post('/ask-voice', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        const contextDate = req.body.date || new Date().toLocaleDateString('de-DE');
        const apiKey = getAiKey();
        
        if (!file || !apiKey) return res.status(400).json({ error: "Missing audio or API Key" });

        const ai = new GoogleGenAI({ apiKey: apiKey });
        const model = 'gemini-3-pro-preview'; // UPGRADE: Use Pro for consistency
        const base64Audio = file.buffer.toString('base64');

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ 
                parts: [
                    { inlineData: { mimeType: file.mimetype || 'audio/webm', data: base64Audio } },
                    { text: "Listen to the audio. If user wants to change plan, call a tool. If asking, answer." }
                ]
            }],
            config: { tools: tools }
        });

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) return res.json({ text: "Audio nicht verstanden." });

        const modelParts = candidates[0].content.parts;
        const functionCallPart = modelParts.find(p => p.functionCall);
        const functionCall = functionCallPart?.functionCall;

        if (functionCall) {
            const { toolResult, shouldRefresh, clientAction } = await executeToolLogic(functionCall, contextDate);
            const finalResponse = await ai.models.generateContent({
                model: model,
                contents: [
                    { role: 'user', parts: [{ text: "Audio Command processed." }] }, 
                    { role: 'model', parts: modelParts }, 
                    // FIX: Simplified response structure
                    { role: 'user', parts: [{ functionResponse: { name: functionCall.name, response: toolResult } }] }
                ]
            });
            return res.json({ text: finalResponse.text, toolExecuted: shouldRefresh, clientAction: clientAction });
        }

        res.json({ text: response.text, toolExecuted: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FEEDBACK ROUTE ---
router.post('/feedback', upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No audio file' });

        let transcript = "Transkription fehlgeschlagen.";
        const apiKey = getAiKey();

        if (apiKey) {
            try {
                const ai = new GoogleGenAI({ apiKey: apiKey });
                const base64Audio = file.buffer.toString('base64');
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview', // Keep flash for simple transcription
                    contents: {
                        parts: [
                            { inlineData: { mimeType: file.mimetype || 'audio/webm', data: base64Audio } },
                            { text: "Transcribe to German text." }
                        ]
                    }
                });
                if (response.text) transcript = response.text;
            } catch (aiError) {}
        }
        await Feedback.create({ transcript: transcript });
        res.json({ success: true, transcript });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
