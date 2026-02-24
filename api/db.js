
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;

// --- CONNECTION CACHING FOR VERCEL/AZURE ---
// In serverless/container environments, we must cache the connection
// to prevent creating a new one on every request (which causes timeouts).
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// --- Schemas & Models ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'viewer' },
    name: String,
    mustChangePassword: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

const PlanSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true },
    assignments: Array,
    operations: Array,
    staffShifts: Object, 
    version: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now }
});

const RosterSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true },
    shifts: Object,
    customTimes: Object, // Store custom start/end times per staffId
    updatedAt: { type: Date, default: Date.now }
});

const StaffListSchema = new mongoose.Schema({
    identifier: { type: String, default: 'main_list', unique: true },
    staff: Array,
    updatedAt: { type: Date, default: Date.now }
});

const RoomConfigSchema = new mongoose.Schema({
    identifier: { type: String, default: 'main_rooms', unique: true },
    rooms: Array,
    updatedAt: { type: Date, default: Date.now }
});

const AppConfigSchema = new mongoose.Schema({
    identifier: { type: String, default: 'main_config', unique: true },
    weights: Object,
    constraints: Object,
    departments: [String], // Dynamic list of available departments
    shifts: Object,        // Custom Shift Definitions
    procedureRules: Array, // Smart Rescheduling Rules
    timeline: Object,      // Start/End Hours
    csvMapping: Object,    // CSV Import Keywords
    logic: Object,         // Logic Parsing Rules (Roles etc)
    updatedAt: { type: Date, default: Date.now }
});

const StaffPairingSchema = new mongoose.Schema({
    staffId1: { type: String, required: true },
    staffId2: { type: String, required: true },
    type: { type: String, default: 'TRAINING' }, // TRAINING | TANDEM
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const FeedbackSchema = new mongoose.Schema({
    audioUrl: String,
    transcript: String,
    createdAt: { type: Date, default: Date.now }
});

const AuditLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: Number,
    userId: String,
    ip: String,
    summary: String,
    payload: Object,
    diff: mongoose.Schema.Types.Mixed // New field for Data Diffs
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Plan = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);
export const Roster = mongoose.models.Roster || mongoose.model('Roster', RosterSchema);
export const StaffList = mongoose.models.StaffList || mongoose.model('StaffList', StaffListSchema);
export const RoomConfig = mongoose.models.RoomConfig || mongoose.model('RoomConfig', RoomConfigSchema);
export const AppConfig = mongoose.models.AppConfig || mongoose.model('AppConfig', AppConfigSchema);
export const StaffPairing = mongoose.models.StaffPairing || mongoose.model('StaffPairing', StaffPairingSchema);
export const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

// --- Seeding Logic ---
const seedDefaultAdmin = async () => {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            console.log("Creating default admin user...");
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash("admin123", salt);
            await User.create({
                username: "admin",
                passwordHash: hash,
                role: "admin",
                name: "System Administrator",
                mustChangePassword: true
            });
            console.log("✅ Default admin created: admin / admin123");
        }
    } catch (e) {
        console.error("Seeding failed (DB might be read-only or connection dropped):", e.message);
    }
};

export const connectToDatabase = async () => {
    if (!MONGODB_URI) {
        console.warn("⚠️ MONGODB_URI is missing in Environment Variables. Database features will not work.");
        return null;
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false, // Disable Mongoose buffering for Serverless
            serverSelectionTimeoutMS: 15000, // Timeout after 15s (default 30s is too long for Vercel)
            socketTimeoutMS: 45000,
            family: 4 // Use IPv4 to avoid issues with some cloud providers
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            console.log('✅ Connected to MongoDB');
            seedDefaultAdmin(); // Fire and forget seed
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error('❌ MongoDB connection error:', e.message);
        // Important: We do not throw immediately here if we want to allow 
        // the app to limp along in "Offline Mode" (see authRoutes.js)
        return null; 
    }

    return cached.conn;
};

