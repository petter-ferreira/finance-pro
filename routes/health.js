const express = require('express');
const router = express.Router();
const db = require('../database');

// Diagnostic endpoint to test database connection
router.get('/db-test', async (req, res) => {
    try {
        // Test basic query
        const result = await db.query('SELECT NOW() as time, version() as version');

        // Test user count
        const userCount = await db.query('SELECT COUNT(*) as count FROM users');

        // Test if admin exists
        const adminCheck = await db.query("SELECT username, role FROM users WHERE username = 'admin'");

        res.json({
            status: 'SUCCESS',
            database: {
                connected: true,
                time: result.rows[0].time,
                version: result.rows[0].version
            },
            users: {
                total: userCount.rows[0].count,
                adminExists: adminCheck.rows.length > 0,
                adminUser: adminCheck.rows[0] || null
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;
