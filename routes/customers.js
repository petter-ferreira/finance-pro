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

    db.query('SELECT * FROM customers WHERE user_id = $1 ORDER BY name', [userId])
        .then(result => res.json({ data: result.rows }))
        .catch(err => res.status(500).json({ error: err.message }));
});

// GET single customer and their history
router.get('/:id', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(403).json({ error: 'User ID required' });

    const sqlCustomer = 'SELECT * FROM customers WHERE id = $1 AND user_id = $2';
    const sqlLoans = 'SELECT * FROM loans WHERE customer_id = $1';

    db.query(sqlCustomer, [req.params.id, userId])
        .then(customerResult => {
            const customer = customerResult.rows[0];
            if (!customer) return res.status(404).json({ error: 'Customer not found or access denied' });

            return db.query(sqlLoans, [req.params.id])
                .then(loansResult => {
                    res.json({ customer, loans: loansResult.rows });
                });
        })
        .catch(err => res.status(500).json({ error: err.message }));
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
});

module.exports = router;
