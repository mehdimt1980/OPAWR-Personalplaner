
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { Plan, StaffList, Roster, AppConfig, RoomConfig, AuditLog } from "./db.js";

// Global server instance
let mcpServer;
let transports = [];

// --- INTELLIGENCE & LOGIC LAYER ---

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

// Re-implementation of core validation logic for Backend context
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
    const requiredDepts = rConfig?.primaryDepts || ['UCH']; // Default
    
    // Check if at least one Expert is present for the room's discipline
    const hasExpert = staffObjs.some(s => 
        requiredDepts.some(dept => {
            const skill = s.skills?.[dept];
            return skill === 'Expert' || skill === 'Expert+' || skill === 'E';
        })
    );

    if (!hasExpert) {
        issues.push({ type: 'WARNING', msg: `No Expert for [${requiredDepts.join(',')}] in ${room.name}` });
    }

    // 3. Understaffing
    if (staffIds.length < (rConfig?.requiredStaffCount || 2)) {
        issues.push({ type: 'WARNING', msg: `Understaffed (${staffIds.length}/2)` });
    }

    return issues;
};

// --- AUDIT HELPER ---
const logMcpAction = async (tool, params, summary) => {
    try {
        await AuditLog.create({
            method: 'MCP_TOOL',
            path: tool,
            statusCode: 200,
            userId: 'AI_AGENT',
            ip: '127.0.0.1',
            summary: summary,
            payload: params
        });
    } catch (e) {
        console.error("Failed to audit MCP action", e);
    }
};

export const setupMcpServer = (app) => {
    if (mcpServer) return;

    mcpServer = new McpServer({
        name: "OR Planner AI Agent",
        version: "2.5.0"
    });

    // ==============================================================================
    // 📚 RESOURCES (Context & State)
    // ==============================================================================

    // 1. Granular Staff Details (For deep-dive on a person)
    mcpServer.resource(
        "staff-detail",
        new ResourceTemplate("or://staff/{id}", { list: undefined }),
        async (uri, { id }) => {
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const staff = list?.staff?.find(s => s.id === id || s.name === id);
            if (!staff) return { contents: [], isError: true };
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(staff, null, 2),
                    mimeType: "application/json"
                }]
            };
        }
    );

    // 2. Daily Conflicts (Focused Error Reporting)
    mcpServer.resource(
        "daily-conflicts",
        new ResourceTemplate("or://conflicts/{date}", { list: undefined }),
        async (uri, { date }) => {
            const plan = await Plan.findOne({ date });
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const rConfig = await RoomConfig.findOne({ identifier: 'main_rooms' });
            
            const assignments = plan?.assignments || [];
            const allStaff = list?.staff || [];
            const rooms = rConfig?.rooms || [];

            const conflicts = [];
            assignments.forEach(a => {
                const room = { id: a.roomId, name: a.roomId }; // Minimal room obj
                const issues = validateAssignmentLogic(room, a.staffIds, allStaff, assignments, rooms);
                if (issues.length > 0) {
                    conflicts.push({ room: a.roomId, issues });
                }
            });

            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(conflicts, null, 2),
                    mimeType: "application/json"
                }]
            };
        }
    );

    // 3. Full Daily Schedule (Overview)
    mcpServer.resource(
        "daily-plan",
        new ResourceTemplate("or://schedule/{date}", { list: undefined }),
        async (uri, { date }) => {
            const plan = await Plan.findOne({ date });
            const roster = await Roster.findOne({ date });
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({
                        plan: plan || { assignments: [], operations: [] },
                        roster: roster || { shifts: {} }
                    }, null, 2),
                    mimeType: "application/json"
                }]
            };
        }
    );

    // ==============================================================================
    // 🧠 INTELLIGENT TOOLS (Simulation & Analysis)
    // ==============================================================================

    // SIMULATE: Allows the Agent to "think" before acting
    mcpServer.tool(
        "simulate_assignment",
        { date: z.string(), roomId: z.string(), staffIds: z.array(z.string()) },
        async ({ date, roomId, staffIds }) => {
            // 1. Fetch Context
            const plan = await Plan.findOne({ date });
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const rConfig = await RoomConfig.findOne({ identifier: 'main_rooms' });
            
            // 2. Mock the change
            const currentAssignments = plan?.assignments || [];
            // Remove old assignment for this room
            const mockAssignments = currentAssignments.filter(a => a.roomId !== roomId);
            // Add proposed assignment
            mockAssignments.push({ roomId, staffIds });

            // 3. Validate
            const issues = validateAssignmentLogic(
                { id: roomId, name: roomId }, 
                staffIds, 
                list?.staff || [], 
                mockAssignments, 
                rConfig?.rooms || []
            );

            // 4. Calculate Score (Simple Heuristic)
            const score = issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 30));

            return {
                content: [{ 
                    type: "text", 
                    text: JSON.stringify({ 
                        status: issues.length === 0 ? "VALID" : "ISSUES_FOUND",
                        score,
                        validation_issues: issues,
                        message: issues.length === 0 
                            ? "Simulation successful. No conflicts detected." 
                            : "Simulation warning: This assignment creates conflicts."
                    }, null, 2)
                }]
            };
        }
    );

    // ANALYZE: High-level risk assessment
    mcpServer.tool(
        "analyze_impact",
        { date: z.string() },
        async ({ date }) => {
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const roster = await Roster.findOne({ date });
            const plan = await Plan.findOne({ date });
            const appConfigDoc = await AppConfig.findOne({ identifier: 'main_config' });
            
            const staff = list?.staff || [];
            const shiftConfig = appConfigDoc?.shifts || {};
            const available = staff.filter(s => isStaffAvailable(s, roster, date, shiftConfig));
            const assignments = plan?.assignments || [];
            
            // Metrics
            const totalStaff = staff.length;
            const availableCount = available.length;
            const sickCount = staff.filter(s => roster?.shifts?.[s.id] === 'SICK').length;
            const assignedCount = new Set(assignments.flatMap(a => a.staffIds)).size;
            
            const riskLevel = availableCount < 10 ? "CRITICAL" : availableCount < 14 ? "HIGH" : "LOW";

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        date,
                        risk_level: riskLevel,
                        metrics: {
                            total_staff: totalStaff,
                            available: availableCount,
                            sick: sickCount,
                            utilization: `${Math.round((assignedCount / availableCount) * 100)}%`
                        },
                        alerts: riskLevel === "CRITICAL" ? ["Severe understaffing detected."] : []
                    }, null, 2)
                }]
            };
        }
    );

    // CANDIDATE FINDER: Helper for finding replacements
    mcpServer.tool(
        "find_candidates",
        {
            date: z.string(),
            roomId: z.string(),
            minSkill: z.enum(["Any", "Junior", "Expert"]).default("Any")
        },
        async ({ date, roomId, minSkill }) => {
            const plan = await Plan.findOne({ date });
            const roster = await Roster.findOne({ date });
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const rConfig = await RoomConfig.findOne({ identifier: 'main_rooms' });
            const appConfigDoc = await AppConfig.findOne({ identifier: 'main_config' });
            
            const allStaff = list?.staff || [];
            const shiftConfig = appConfigDoc?.shifts || {};
            const roomDef = rConfig?.rooms?.find(r => r.id === roomId || r.name === roomId);
            
            if (!roomDef) return { content: [{ type: "text", text: `Room '${roomId}' not found.` }] };

            const requiredDepts = roomDef.primaryDepts || ['UCH'];
            const assignments = plan?.assignments || [];
            const assignedIds = new Set(assignments.flatMap(a => a.staffIds));

            const candidates = [];

            for (const staff of allStaff) {
                if (assignedIds.has(staff.id)) continue;
                if (!isStaffAvailable(staff, roster, date, shiftConfig)) continue;

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

                candidates.push({ id: staff.id, name: staff.name, score, skills: staff.skills });
            }

            candidates.sort((a, b) => b.score - a.score);
            return {
                content: [{ 
                    type: "text", 
                    text: JSON.stringify({ room: roomDef.name, required: requiredDepts, candidates: candidates.slice(0, 5) }, null, 2)
                }]
            };
        }
    );

    // ==============================================================================
    // 🛠️ ACTION TOOLS (Write + Audit)
    // ==============================================================================

    mcpServer.tool(
        "assign_staff",
        { date: z.string(), roomId: z.string(), staffIds: z.array(z.string()) },
        async ({ date, roomId, staffIds }) => {
            // 1. Execute
            const existingPlan = await Plan.findOne({ date });
            let assignments = existingPlan ? existingPlan.assignments : [];
            assignments = assignments.filter(a => a.roomId !== roomId);
            assignments.push({ roomId, staffIds });

            await Plan.findOneAndUpdate(
                { date },
                { date, assignments, updatedAt: new Date(), $inc: { version: 1 } },
                { upsert: true, new: true }
            );

            // 2. Post-Validation (Feedback Loop)
            const list = await StaffList.findOne({ identifier: 'main_list' });
            const rConfig = await RoomConfig.findOne({ identifier: 'main_rooms' });
            const issues = validateAssignmentLogic(
                { id: roomId, name: roomId }, 
                staffIds, 
                list?.staff || [], 
                assignments, 
                rConfig?.rooms || []
            );

            await logMcpAction("assign_staff", { date, roomId, staffIds }, `Assigned ${staffIds.join(', ')}`);
            
            // 3. Enhanced Output
            let responseText = `Assigned [${staffIds.join(', ')}] to ${roomId}.`;
            if (issues.length > 0) {
                responseText += `\nWARNING: Created conflicts: ${issues.map(i => i.msg).join(', ')}`;
            } else {
                responseText += " (State is valid)";
            }

            return { content: [{ type: "text", text: responseText }] };
        }
    );

    mcpServer.tool(
        "swap_staff",
        { date: z.string(), staffId1: z.string(), staffId2: z.string() },
        async ({ date, staffId1, staffId2 }) => {
            const plan = await Plan.findOne({ date });
            if (!plan) return { content: [{ type: "text", text: `No plan for ${date}.` }], isError: true };
            
            let assignments = plan.assignments || [];
            
            // Swap Logic
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
            } else {
                return { content: [{ type: "text", text: "Neither staff found in assignments." }] };
            }

            await Plan.findOneAndUpdate({ date }, { assignments, updatedAt: new Date(), $inc: { version: 1 } });
            await logMcpAction("swap_staff", { date, staffId1, staffId2 }, `Swapped ${staffId1} <-> ${staffId2}`);
            
            return { content: [{ type: "text", text: `Successfully swapped ${staffId1} and ${staffId2}.` }] };
        }
    );

    mcpServer.tool(
        "clear_room",
        { date: z.string(), roomId: z.string() },
        async ({ date, roomId }) => {
            const plan = await Plan.findOne({ date });
            if (plan) {
                const newAssignments = (plan.assignments || []).filter(a => a.roomId !== roomId);
                await Plan.findOneAndUpdate({ date }, { assignments: newAssignments, updatedAt: new Date(), $inc: { version: 1 } });
            }
            await logMcpAction("clear_room", { date, roomId }, `Cleared ${roomId}`);
            return { content: [{ type: "text", text: `Cleared ${roomId}.` }] };
        }
    );

    mcpServer.tool(
        "set_shift",
        { date: z.string(), staffId: z.string(), shift: z.string() },
        async ({ date, staffId, shift }) => {
            const roster = await Roster.findOne({ date });
            const shifts = roster ? roster.shifts : {};
            shifts[staffId] = shift;

            await Roster.findOneAndUpdate(
                { date },
                { date, shifts, updatedAt: new Date() },
                { upsert: true }
            );
            
            // Clean up plan if absent
            if (['SICK', 'OFF', 'RECOVERY'].includes(shift)) {
                const plan = await Plan.findOne({ date });
                if (plan) {
                    const newAssignments = plan.assignments.map(a => ({
                        ...a,
                        staffIds: a.staffIds.filter(id => id !== staffId)
                    }));
                    await Plan.findOneAndUpdate({ date }, { assignments: newAssignments });
                }
            }

            await logMcpAction("set_shift", { date, staffId, shift }, `Set ${staffId} to ${shift}`);
            return { content: [{ type: "text", text: `Marked ${staffId} as ${shift}.` }] };
        }
    );

    // ==============================================================================
    // 📋 PROMPTS (Workflow Templates)
    // ==============================================================================

    mcpServer.prompt(
        "morning_briefing",
        { date: z.string().optional() },
        ({ date }) => {
            const d = date || new Date().toLocaleDateString('de-DE');
            return {
                messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: `Perform a morning briefing for ${d}. 
1. Load the schedule using 'daily-plan'.
2. Check for any validation conflicts or understaffing using 'daily-conflicts'.
3. Summarize the status of the day (Green/Yellow/Red).
4. List any staff marked as SICK.`
                    }
                }]
            };
        }
    );

    mcpServer.prompt(
        "sick_leave_resolution",
        { staffName: z.string(), date: z.string().optional() },
        ({ staffName, date }) => {
            const d = date || new Date().toLocaleDateString('de-DE');
            return {
                messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: `Staff member '${staffName}' has called in sick for ${d}.
1. Use 'set_shift' to mark them as SICK.
2. Check which room they were assigned to using 'daily-plan'.
3. Use 'find_candidates' to find a qualified replacement for that room.
4. Propose a solution or use 'simulate_assignment' to test one.`
                    }
                }]
            };
        }
    );

    // ==============================================================================
    // 📡 TRANSPORT
    // ==============================================================================
    
    app.get("/api/mcp/sse", async (req, res) => {
        // Vercel / Nginx optimization to prevent buffering
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        });

        const transport = new SSEServerTransport("/api/mcp/messages", res);
        transports.push(transport);
        console.log("MCP Client connected via SSE");
        await mcpServer.connect(transport);

        // Heartbeat to keep Vercel connection alive
        const heartbeat = setInterval(() => {
            res.write(": keep-alive\n\n");
        }, 10000); // 10s heartbeat for safety

        req.on("close", () => {
            clearInterval(heartbeat);
            transports = transports.filter(t => t !== transport);
        });
    });

    app.post("/api/mcp/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = sessionId ? transports.find(t => t.sessionId === sessionId) : transports[transports.length - 1];
        if (transport) await transport.handlePostMessage(req, res);
        else res.status(404).send("Session not found");
    });
    
    console.log("✅ MCP Server v2.5 (Agentic) initialized.");
};
