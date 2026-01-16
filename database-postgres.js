const { Pool } = require('pg');

// Use connection string from environment variable (Supabase provides this)
// Format: postgres://user:password@host:port/database
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false, // Required for Supabase/Heroku in some configs
    },
});

// Helper to run queries similarly to sqlite's db.run/db.all
const db = {
    query: (text, params) => pool.query(text, params),

    // Shim for SQLite's db.all (returns rows)
    all: (text, params, callback) => {
        pool.query(text, params)
            .then(res => callback(null, res.rows))
            .catch(err => callback(err));
    },

    // Shim for SQLite's db.get (returns single row)
    get: (text, params, callback) => {
        pool.query(text, params)
            .then(res => callback(null, res.rows[0]))
            .catch(err => callback(err));
    },

    // Shim for SQLite's db.run (for INSERT/UPDATE/DELETE)
    // Note: 'this.lastID' handling is different in PG (requires RETURNING id)
    run: function (text, params, callback) {
        pool.query(text, params)
            .then(res => {
                // PG doesn't return lastID automatically unless requested.
                // We will mock context for callback: { lastID: ... }
                // BUT: Queries must be changed to "RETURNING id" for this to work perfectly.
                // For now, we just callback success.
                if (callback) callback.call({ changes: res.rowCount }, null);
            })
            .catch(err => {
                if (callback) callback(err);
            });
    }
};

// Initialize Tables (Postgres Syntax)
const initializeDatabase = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                status TEXT DEFAULT 'active',
                due_day INTEGER DEFAULT 10
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                cpf_rg TEXT UNIQUE NOT NULL,
                phone TEXT,
                address TEXT,
                photo_path TEXT,
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER NOT NULL REFERENCES customers(id),
                original_amount REAL NOT NULL,
                current_balance REAL NOT NULL,
                interest_rate REAL NOT NULL,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_interest_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'ACTIVE'
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                loan_id INTEGER NOT NULL REFERENCES loans(id),
                amount REAL NOT NULL,
                type TEXT NOT NULL,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("PostgreSQL Database Initialized");

        // Create default admin if not exists
        const adminCheck = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        if (adminCheck.rows.length === 0) {
            await pool.query("INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin')");
            console.log("Default admin created.");
        }

    } catch (err) {
        console.error("Error initializing database:", err);
    }
};

// Run init only if we are the main module (or call it explicitly)
// initializeDatabase();

module.exports = { db, initializeDatabase, pool };
