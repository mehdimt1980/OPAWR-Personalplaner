
import jwt from 'jsonwebtoken';
import { AuditLog } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET;

// --- Auth Middleware ---
export const authenticateToken = (req, res, next) => {
    if (!JWT_SECRET) {
        console.error("JWT_SECRET is not defined.");
        return res.status(500).json({ error: "Server Configuration Error" });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access Denied" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid Token" });
        req.user = user;
        next();
    });
};

export const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: "Admin privileges required" });
    }
};

// --- Audit Logger Middleware ---
export const auditLogger = (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        res.on('finish', async () => {
            // We assume DB is connected by the time route finishes
            try {
                const body = { ...req.body };
                // Redact sensitive fields
                if (body.password) body.password = '[REDACTED]';
                if (body.newPassword) body.newPassword = '[REDACTED]';
                
                ['staff', 'assignments', 'operations', 'notifications'].forEach(key => {
                    if (Array.isArray(body[key])) {
                        body[key] = `[Array(${body[key].length} items)]`;
                    }
                });

                const user = req.user ? `${req.user.username} (${req.user.role})` : 'anonymous';

                await AuditLog.create({
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    userId: user,
                    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                    payload: body,
                    summary: `${req.method} ${req.path} (${res.statusCode})`,
                    diff: res.locals.auditDiff || null // Capture calculated Data Diffs
                });
            } catch (err) {
                console.error("Audit Logging Error:", err);
            }
        });
    }
    next();
};
