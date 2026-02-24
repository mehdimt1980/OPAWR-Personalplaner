
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from './db.js';
import { authenticateToken, JWT_SECRET } from './middleware.js';

const router = express.Router();

router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(401).json({ error: "Benutzer nicht gefunden" });
        }

        const validPass = await bcrypt.compare(password, user.passwordHash);
        if (!validPass) {
            return res.status(401).json({ error: "Falsches Passwort" });
        }

        // Sign Token (7 Days Validity for persistence)
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role, name: user.name }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.json({ 
            accessToken: token, 
            mustChangePassword: user.mustChangePassword || false,
            user: { username: user.username, role: user.role, name: user.name } 
        });

    } catch (error) {
        res.status(500).json({ error: "Login failed" });
    }
});

router.post('/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen lang sein." });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await User.findByIdAndUpdate(req.user.id, { 
            passwordHash: hash, 
            mustChangePassword: false 
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Password change failed" });
    }
});

export default router;
