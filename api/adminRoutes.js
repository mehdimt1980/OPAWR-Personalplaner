
import express from 'express';
import bcrypt from 'bcryptjs';
import { User, Plan, Roster, StaffList, RoomConfig, AppConfig } from './db.js';
import { authenticateToken, requireAdmin } from './middleware.js';

const router = express.Router();

// --- User Management Routes (Admin Only) ---

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, role, name } = req.body;
        
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: "Username already exists" });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            username,
            passwordHash: hash,
            role,
            name,
            mustChangePassword: true // Enforce change on first login
        });

        res.json({ success: true, user: { username: newUser.username, role: newUser.role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users/:id/reset', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const tempPassword = Math.random().toString(36).slice(-8); // Random 8 char string
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(tempPassword, salt);

        await User.findByIdAndUpdate(req.params.id, {
            passwordHash: hash,
            mustChangePassword: true
        });

        res.json({ success: true, tempPassword });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Prevent deleting self
        if (req.user.id === req.params.id) {
            return res.status(400).json({ error: "Cannot delete yourself" });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- System Backup / Restore (Protected) ---

router.get('/backup', authenticateToken, async (req, res) => {
    try {
        const allPlans = await Plan.find({});
        const allRosters = await Roster.find({});
        const staffList = await StaffList.findOne({ identifier: 'main_list' });
        const roomConfig = await RoomConfig.findOne({ identifier: 'main_rooms' });
        const appConfig = await AppConfig.findOne({ identifier: 'main_config' });
        
        res.json({
            plans: allPlans,
            rosters: allRosters,
            staff_list: staffList ? staffList.staff : [],
            room_config: roomConfig ? roomConfig.rooms : null,
            app_config: appConfig ? { weights: appConfig.weights, constraints: appConfig.constraints } : null,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/restore', authenticateToken, async (req, res) => {
    try {
        const { plans, rosters, staff_list, room_config, app_config } = req.body;
        
        await Plan.deleteMany({});
        await Roster.deleteMany({});
        await StaffList.deleteMany({});
        await RoomConfig.deleteMany({});
        await AppConfig.deleteMany({});

        if (plans && plans.length > 0) {
            const cleanPlans = plans.map(p => { const { _id, __v, ...rest } = p; return rest; });
            await Plan.insertMany(cleanPlans);
        }

        if (rosters && rosters.length > 0) {
            const cleanRosters = rosters.map(r => { const { _id, __v, ...rest } = r; return rest; });
            await Roster.insertMany(cleanRosters);
        }

        if (staff_list) {
            await StaffList.create({ identifier: 'main_list', staff: staff_list });
        }

        if (room_config) {
            await RoomConfig.create({ identifier: 'main_rooms', rooms: room_config });
        }

        if (app_config) {
            await AppConfig.create({ identifier: 'main_config', ...app_config });
        }

        res.json({ success: true, message: "System restored from backup" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
