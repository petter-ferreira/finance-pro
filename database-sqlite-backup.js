const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'loan_system.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Create Customers Table
        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cpf_rg TEXT UNIQUE NOT NULL,
            phone TEXT,
            address TEXT,
            photo_path TEXT,
            user_id INTEGER, -- FK to users
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => {
            if (!err) {
                // Migration: Add user_id if not exists
                db.run("ALTER TABLE customers ADD COLUMN user_id INTEGER", (e) => {
                    if (!e) {
                        // Default existing customers to admin (id 1 usually, or query)
                        db.get("SELECT id FROM users WHERE username = 'admin'", [], (err, row) => {
                            if (row) {
                                db.run("UPDATE customers SET user_id = ? WHERE user_id IS NULL", [row.id]);
                            }
                        });
                    }
                });
            }
        });

        // Create Loans Table
        db.run(`CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            original_amount REAL NOT NULL,
            current_balance REAL NOT NULL,
            interest_rate REAL NOT NULL,
            start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_interest_update DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            FOREIGN KEY (customer_id) REFERENCES customers (id)
        )`);

        // Create Payments Table
        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            loan_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL, -- 'INTEREST_ONLY' or 'PRINCIPAL_AND_INTEREST'
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (loan_id) REFERENCES loans (id)
        )`);

        // Create Users Table (Admin & Common Users)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' -- 'admin' or 'user'
            -- Columns added later via migration: status, due_day
        )`, (err) => {
            if (!err) {
                // Migration: Add new columns if they don't exist
                db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'", (e) => { });
                db.run("ALTER TABLE users ADD COLUMN due_day INTEGER DEFAULT 10", (e) => { });

                // Check if admin exists, if not create default
                db.get("SELECT id FROM users WHERE username = 'admin'", [], (err, row) => {
                    if (!row) {
                        // Default password is 'admin' (In prod use hash, but for demo simplistic)
                        // Note: Ideally use bcrypt here, but to keep it simple and dependency-free if requested:
                        db.run("INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin')");
                        console.log("Default admin user created: admin / admin");
                    }
                });
            }
        });

        console.log('Database tables initialized.');
    });
}

module.exports = db;
