
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './api/index.js';

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- AZURE / MONOLITH SETUP ---
// This file is the entry point for Azure App Service (node server.js).
// Vercel ignores this file and uses api/index.js directly as serverless functions.

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0 && NODE_ENV === 'production') {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please configure these in Azure App Service Configuration');
    process.exit(1);
}

// 1. Serve Static files from the React build (dist) with caching
const staticOptions = {
    maxAge: NODE_ENV === 'production' ? '1y' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        // Cache static assets aggressively
        if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
};

app.use(express.static(path.join(__dirname, 'dist'), staticOptions));

// 2. Handle React Routing (SPA) - Send all non-API requests to index.html
app.get('*', (req, res, next) => {
    // Skip if it's an API request (let the API router handle 404s for API)
    if (req.path.startsWith('/api')) {
        return next();
    }
    
    // For any other route, send the React app
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            // Fallback if dist is missing (e.g. dev mode without build)
            console.error('Error serving index.html:', err);
            if (!res.headersSent) {
                res.status(500).send(
                    NODE_ENV === 'production'
                        ? 'Application error. Please contact support.'
                        : 'Frontend not built. Run "npm run build" first.'
                );
            }
        }
    });
});

// Start server with enhanced error handling
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🏥 OR Staff Planner - Production Server');
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/hello`);
    console.log('========================================');
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        console.log('✅ HTTP server closed');
        console.log('👋 Server shutdown complete');
        process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error('⚠️  Forcing shutdown after timeout');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    if (NODE_ENV === 'production') {
        gracefulShutdown('UNCAUGHT_EXCEPTION');
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    if (NODE_ENV === 'production') {
        gracefulShutdown('UNHANDLED_REJECTION');
    }
});

export default app;
