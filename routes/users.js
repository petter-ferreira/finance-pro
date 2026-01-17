const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');

// Configure multer for user photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, 'user_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware to check if user is admin
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
    db.query('SELECT id, username, full_name, photo_path, role, status, due_day FROM users')
        .then(result => {
            res.json({ data: result.rows });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// POST create user (Admin only)
router.post('/', isAdmin, upload.single('photo'), (req, res) => {
    const { username, password, full_name, role, due_day } = req.body;
    const photo_path = req.file ? req.file.path : null;

    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    db.query('INSERT INTO users (username, password, full_name, photo_path, role, status, due_day) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [username, password, full_name, photo_path, role || 'user', 'active', due_day || 10])
        .then(result => {
            res.json({ message: 'User created', id: result.rows[0].id });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// PATCH toggle status (Admin only)
router.patch('/:id/status', isAdmin, (req, res) => {
    const { status } = req.body;
    db.query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id])
        .then(() => res.json({ message: 'Status updated' }))
        .catch(err => res.status(500).json({ error: err.message }));
});

// PATCH update own profile
router.patch('/profile', upload.single('photo'), (req, res) => {
    const userId = req.headers['x-user-id'];
    const { full_name } = req.body;
    const photo_path = req.file ? req.file.path : null;

    if (!userId) return res.status(403).json({ error: 'User ID required' });

    let sql, params;
    if (photo_path) {
        sql = 'UPDATE users SET full_name = $1, photo_path = $2 WHERE id = $3';
        params = [full_name, photo_path, userId];
    } else {
        sql = 'UPDATE users SET full_name = $1 WHERE id = $2';
        params = [full_name, userId];
    }

    db.query(sql, params)
        .then(() => {
            res.json({
                message: 'Profile updated',
                full_name,
                photo_path: photo_path || undefined
            });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// DELETE user (Admin only)
router.delete('/:id', isAdmin, (req, res) => {
    db.query('DELETE FROM users WHERE id = $1', [req.params.id])
        .then(() => res.json({ message: 'User deleted' }))
        .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;
