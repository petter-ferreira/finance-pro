const express = require('express');
const router = express.Router();
const db = require('../database');

// GET Payment History
router.get('/payments', (req, res) => {
    // Optional query params: ?customer_id=1
    const { customer_id } = req.query;
    const userId = req.headers['x-user-id'];

    if (!userId) return res.status(403).json({ error: 'User ID required' });

    let sql = `
        SELECT 
            p.id, 
            p.amount, 
            p.type, 
            p.date, 
            l.id as loan_id,
            c.name as customer_name,
            c.cpf_rg
        FROM payments p
        JOIN loans l ON p.loan_id = l.id
        JOIN customers c ON l.customer_id = c.id
        WHERE c.user_id = $1
    `;

    const params = [userId];

    if (customer_id) {
        sql += ` AND c.id = $2`;
        params.push(customer_id);
    }

    sql += ` ORDER BY p.date DESC`;

    db.query(sql, params)
        .then(result => res.json({ data: result.rows }))
        .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;
