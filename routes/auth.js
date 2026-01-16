const express = require('express');
const router = express.Router();
const db = require('../database');

// POST /login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    // In a real app, use bcrypt.compare(password, user.password)
    db.get('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });

        if (user) {
            if (user.status === 'inactive') {
                return res.status(403).json({ error: 'Acesso bloqueado: Mensalidade atrasada.' });
            }
            // Success
            res.json({
                message: 'Login successful',
                user: { id: user.id, username: user.username, role: user.role }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

module.exports = router;
