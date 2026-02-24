
import express from 'express';
import { Plan, Roster, StaffList, RoomConfig, AppConfig, StaffPairing } from './db.js';
import { authenticateToken } from './middleware.js';

const router = express.Router();

// --- Helpers for Diff Calculation ---

const calculateAssignmentDiff = (oldAssignments = [], newAssignments = []) => {
    const changes = [];
    const oldMap = new Map(oldAssignments.map(a => [a.roomId, new Set(a.staffIds)]));
    const newMap = new Map(newAssignments.map(a => [a.roomId, new Set(a.staffIds)]));

    // Check additions and modifications
    for (const [roomId, newStaffSet] of newMap) {
        const oldStaffSet = oldMap.get(roomId) || new Set();
        
        // Who was added?
        for (const staffId of newStaffSet) {
            if (!oldStaffSet.has(staffId)) {
                changes.push(`+ Assigned ${staffId} to ${roomId}`);
            }
        }
        
        // Who was removed?
        for (const staffId of oldStaffSet) {
            if (!newStaffSet.has(staffId)) {
                changes.push(`- Removed ${staffId} from ${roomId}`);
            }
        }
        oldMap.delete(roomId);
    }

    // Check cleared rooms (rooms present in old but not in new)
    for (const [roomId, oldStaffSet] of oldMap) {
        if (oldStaffSet.size > 0) {
            changes.push(`- Cleared room ${roomId} (${Array.from(oldStaffSet).join(', ')})`);
        }
    }

    return changes;
};

const calculateRosterDiff = (oldShifts = {}, newShifts = {}) => {
    const changes = [];
    const allStaff = new Set([...Object.keys(oldShifts), ...Object.keys(newShifts)]);

    for (const staffId of allStaff) {
        const oldS = oldShifts[staffId];
        const newS = newShifts[staffId];
        if (oldS !== newS) {
            changes.push(`Shift ${staffId}: ${oldS || 'None'} -> ${newS || 'None'}`);
        }
    }
    return changes;
};

// 1. Plans (Public READ for TV mode, Protected WRITE)
router.get('/plans/:date', async (req, res) => {
    try {
        const plan = await Plan.findOne({ date: req.params.date });
        res.json(plan || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/plans/search', async (req, res) => {
    try {
        const { dates } = req.body; 
        const plans = await Plan.find({ date: { $in: dates } });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/plans', authenticateToken, async (req, res) => {
    try {
        const { date, assignments, operations, version } = req.body;
        
        // Optimistic Locking & Diff Calculation
        const existingPlan = await Plan.findOne({ date });
        
        if (existingPlan) {
            const dbVersion = existingPlan.version || 1;
            const clientVersion = version || 0;
            
            // Conflict check
            if (clientVersion > 0 && clientVersion < dbVersion) {
                return res.status(409).json({ 
                    error: "Conflict", 
                    message: "Data modified by another user",
                    serverVersion: dbVersion
                });
            }

            // Calculate Diff
            const diffs = calculateAssignmentDiff(existingPlan.assignments, assignments);
            if (diffs.length > 0) {
                res.locals.auditDiff = diffs;
            } else {
                res.locals.auditDiff = ["No assignment changes (metadata update only)"];
            }
        } else {
            res.locals.auditDiff = [`Created new plan for ${date} with ${assignments?.length || 0} assignments`];
        }

        let newVersion = 1;
        if (existingPlan) {
             newVersion = (existingPlan.version || 0) + 1;
        }

        const plan = await Plan.findOneAndUpdate(
            { date },
            { 
                date, 
                assignments, 
                operations, 
                version: newVersion, 
                updatedAt: new Date() 
            },
            { upsert: true, new: true }
        );
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/plans/:date', authenticateToken, async (req, res) => {
    try {
        await Plan.findOneAndDelete({ date: req.params.date });
        res.locals.auditDiff = [`Deleted plan for ${req.params.date}`];
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Roster (Public READ, Protected WRITE)
router.get('/roster/:date', async (req, res) => {
    try {
        const roster = await Roster.findOne({ date: req.params.date });
        res.json(roster || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/roster', authenticateToken, async (req, res) => {
    try {
        const { date, shifts, customTimes } = req.body;
        
        // Calculate Diff
        const existingRoster = await Roster.findOne({ date });
        const shiftDiffs = calculateRosterDiff(existingRoster?.shifts || {}, shifts || {});
        
        if (shiftDiffs.length > 0) {
            res.locals.auditDiff = shiftDiffs;
        } else if (!existingRoster) {
            res.locals.auditDiff = [`Created roster for ${date}`];
        }

        const roster = await Roster.findOneAndUpdate(
            { date },
            { date, shifts, customTimes, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json(roster);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/roster/search', async (req, res) => {
    try {
        const { dates } = req.body;
        const rosters = await Roster.find({ date: { $in: dates } });
        res.json(rosters);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Staff (Public READ, Protected WRITE)
router.get('/staff', async (req, res) => {
    try {
        const list = await StaffList.findOne({ identifier: 'main_list' });
        res.json(list ? list.staff : []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/staff', authenticateToken, async (req, res) => {
    try {
        const staff = req.body;
        const list = await StaffList.findOneAndUpdate(
            { identifier: 'main_list' },
            { staff, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.locals.auditDiff = [`Updated Staff List (${staff.length} entries)`];
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Room Configuration (Public READ, Protected WRITE)
router.get('/rooms', async (req, res) => {
    try {
        const config = await RoomConfig.findOne({ identifier: 'main_rooms' });
        res.json(config ? config.rooms : null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/rooms', authenticateToken, async (req, res) => {
    try {
        const rooms = req.body;
        const config = await RoomConfig.findOneAndUpdate(
            { identifier: 'main_rooms' },
            { rooms, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.locals.auditDiff = [`Updated Room Config (${rooms.length} rooms)`];
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. App Configuration (Rules Engine) - Public READ, Protected WRITE
router.get('/config', async (req, res) => {
    try {
        const config = await AppConfig.findOne({ identifier: 'main_config' });
        res.json(config || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/config', authenticateToken, async (req, res) => {
    try {
        const { weights, constraints, departments, shifts, procedureRules, timeline, csvMapping, logic } = req.body;
        const config = await AppConfig.findOneAndUpdate(
            { identifier: 'main_config' },
            { 
                weights, 
                constraints, 
                departments, 
                shifts, 
                procedureRules, 
                timeline, 
                csvMapping, 
                logic, 
                updatedAt: new Date() 
            },
            { upsert: true, new: true }
        );
        res.locals.auditDiff = ["Updated App Rules/Config"];
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Staff Pairings (Tandems) - Protected
router.get('/pairings', authenticateToken, async (req, res) => {
    try {
        const pairings = await StaffPairing.find({ active: true });
        res.json(pairings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/pairings', authenticateToken, async (req, res) => {
    try {
        const { staffId1, staffId2, type } = req.body;
        
        // Remove existing pairings for these users to prevent conflicts/chains
        await StaffPairing.deleteMany({
            $or: [
                { staffId1: staffId1 }, { staffId2: staffId1 },
                { staffId1: staffId2 }, { staffId2: staffId2 }
            ]
        });

        const newPair = await StaffPairing.create({
            staffId1,
            staffId2,
            type,
            active: true
        });
        
        const allPairings = await StaffPairing.find({ active: true });
        res.locals.auditDiff = [`Paired ${staffId1} with ${staffId2} (${type})`];
        res.json(allPairings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/pairings/:id', authenticateToken, async (req, res) => {
    try {
        await StaffPairing.findByIdAndDelete(req.params.id);
        const allPairings = await StaffPairing.find({ active: true });
        res.locals.auditDiff = [`Deleted pairing ${req.params.id}`];
        res.json(allPairings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

