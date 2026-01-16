const { db, initializeDatabase } = require('./database-postgres');

// Initialize database when module is loaded (and connection string is present)
if (process.env.DATABASE_URL) {
    initializeDatabase();
} else {
    // Fallback/Warning if no DB_URL provided (common in dev before setup)
    console.warn("WARNING: DATABASE_URL not set. Application may crash if trying to query DB.");
}

module.exports = db;
