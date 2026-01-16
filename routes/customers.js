const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');

// Configure Multer for storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// GET all customers for the logged user
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(403).json({ error: 'User ID required' });

    const sql = 'SELECT * FROM customers WHERE user_id = $1 ORDER BY name';
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
});

// GET single customer and their history
router.get('/:id', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(403).json({ error: 'User ID required' });

    const sqlCustomer = 'SELECT * FROM customers WHERE id = $1 AND user_id = $2';
    const sqlLoans = 'SELECT * FROM loans WHERE customer_id = $1';

    db.get(sqlCustomer, [req.params.id, userId], (err, customer) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!customer) return res.status(404).json({ error: 'Customer not found or access denied' });

        db.all(sqlLoans, [req.params.id], (err, loans) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ customer, loans });
        });
    });
});

// POST create customer
router.post('/', upload.single('photo'), (req, res) => {
    const { name, cpf_rg, phone, address } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) return res.status(403).json({ error: 'User ID required' });

    const photo_path = req.file ? req.file.path : null;

    if (!name || !cpf_rg) {
        return res.status(400).json({ error: 'Name and CPF/RG are required' });
    }

    const sql = `INSERT INTO customers (name, cpf_rg, phone, address, photo_path, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
    const params = [name, cpf_rg, phone, address, photo_path, userId];

    db.query(sql, params)
        .then(result => {
            res.json({
                message: 'Customer created successfully',
                data: { id: result.rows[0].id, ...req.body, photo_path }
            });
        })
        .catch(err => res.status(500).json({ error: err.message }));

    /*
    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: 'Customer created successfully',
            data: { id: this.lastID, ...req.body, photo_path }
        });
    });
    */
});

module.exports = router;
