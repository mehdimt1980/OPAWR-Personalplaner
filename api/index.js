
import express from 'express';
import cors from 'cors';
import { connectToDatabase } from './db.js';
import { auditLogger } from './middleware.js';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import dataRoutes from './dataRoutes.js';
import featureRoutes from './featureRoutes.js';
import { setupMcpServer } from './mcp.js';

const app = express();

// --- Standard Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Connection Middleware
// Wraps connection in try/catch to prevent server crash on cold starts
app.use(async (req, res, next) => {
    try {
        await connectToDatabase();
    } catch (e) {
        console.error("DB Middleware Error:", e.message);
        // Proceed anyway. API routes will fail gracefully or switch to offline mode if DB is missing.
    }
    next();
});

// Audit Logging
app.use(auditLogger);

// --- Routes ---
app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', dataRoutes);
app.use('/api', featureRoutes);

// --- MCP Server Setup (Agent Protocol) ---
setupMcpServer(app);

// Health Check
app.get('/api/hello', (req, res) => {
    res.send('Hello from OR Planner API (Hybrid + MCP)');
});

// --- Error Handling ---
// Optional: Custom Fallback Error Handler
app.use((err, req, res, next) => {
    console.error(err); // Log locally as well
    // If headers already sent, delegate to default handler
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: "Internal Server Error" });
});

export default app;
