const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware to check if user is admin (Frontend sends role in header for this simple demo, 
// normally use JWT or Session)
const isAdmin = (req, res, next) => {
    const role = req.headers['x-role'];
    if (role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied: Admins only' });
    }
};

// GET all users (Admin only)
router.get('/', isAdmin, (req, res) => {
    db.all('SELECT id, username, role, status, due_day FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// POST create user (Admin only)
router.post('/', isAdmin, (req, res) => {
    const { username, password, role, due_day } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    db.query('INSERT INTO users (username, password, role, status, due_day) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [username, password, role || 'user', 'active', due_day || 10])
        .then(result => {
            res.json({ message: 'User created', id: result.rows[0].id });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// PATCH toggle status (Admin only)
router.patch('/:id/status', isAdmin, (req, res) => {
    const { status } = req.body; // 'active' or 'inactive'
    db.query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id])
        .then(() => res.json({ message: 'Status updated' }))
        .catch(err => res.status(500).json({ error: err.message }));
});

// DELETE user (Admin only)
router.delete('/:id', isAdmin, (req, res) => {
    db.query('DELETE FROM users WHERE id = $1', [req.params.id])
        .then(() => res.json({ message: 'User deleted' }))
        .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;
