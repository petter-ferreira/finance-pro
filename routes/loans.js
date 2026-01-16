const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all loans for the logged user
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(403).json({ error: 'User ID required' });

    const sql = `
        SELECT l.* 
        FROM loans l 
        JOIN customers c ON l.customer_id = c.id 
        WHERE c.user_id = $1
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// POST create loan
router.post('/', (req, res) => {
    const { customer_id, amount, interest_rate } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) return res.status(403).json({ error: 'User ID required' });
    if (!customer_id || !amount || !interest_rate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify customer ownership
    db.get('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [customer_id, userId], (err, customer) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!customer) return res.status(403).json({ error: 'Access denied to this customer' });

        const sql = `INSERT INTO loans (customer_id, original_amount, current_balance, interest_rate) VALUES ($1, $2, $3, $4) RETURNING id`;

        db.query(sql, [customer_id, amount, amount, interest_rate])
            .then(result => {
                res.json({ message: 'Loan created', id: result.rows[0].id });
            })
            .catch(err => res.status(500).json({ error: err.message }));
    });
});

// POST update daily interest manually (Trigger)
router.post('/:id/update-interest', (req, res) => {
    const loanId = req.params.id;
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(403).json({ error: 'User ID required' });

    // Verify ownership via join
    const sqlVerify = `
        SELECT l.* 
        FROM loans l 
        JOIN customers c ON l.customer_id = c.id 
        WHERE l.id = $1 AND c.user_id = $2
    `;

    db.get(sqlVerify, [loanId, userId], (err, loan) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!loan) return res.status(404).json({ error: 'Loan not found or access denied' });

        if (loan.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'Loan is not active' });
        }

        const now = new Date();
        const lastUpdate = new Date(loan.last_interest_update);

        // Calculate difference in days
        const diffTime = Math.abs(now - lastUpdate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            // Add to balance logic
            const interestToAdd = loan.current_balance * (loan.interest_rate / 100) * diffDays;
            const newBalance = loan.current_balance + interestToAdd;

            db.query(`UPDATE loans SET current_balance = $1, last_interest_update = $2 WHERE id = $3`,
                [newBalance, now.toISOString(), loanId])
                .then(() => {
                    res.json({
                        message: 'Interest updated',
                        days_processed: diffDays,
                        added: interestToAdd,
                        new_balance: newBalance
                    });
                })
                .catch(err => res.status(500).json({ error: err.message }));
        } else {
            res.json({ message: 'No days passed since last update' });
        }
    });
});

// POST Make Payment
router.post('/:id/pay', (req, res) => {
    const loanId = req.params.id;
    const { amount, type } = req.body; // type: 'INTEREST_ONLY' or 'PRINCIPAL_AND_INTEREST'
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(403).json({ error: 'User ID required' });

    // Verify ownership via join
    const sqlVerify = `
        SELECT l.* 
        FROM loans l 
        JOIN customers c ON l.customer_id = c.id 
        WHERE l.id = $1 AND c.user_id = $2
    `;

    db.get(sqlVerify, [loanId, userId], (err, loan) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!loan) return res.status(404).json({ error: 'Loan not found or access denied' });

        let newBalance = loan.current_balance;

        if (type === 'INTEREST_ONLY') {
            const interestAccrued = loan.current_balance - loan.original_amount;
            if (amount < interestAccrued) {
                newBalance -= amount;
            } else {
                newBalance -= amount;
            }

        } else {
            // Parcelado (Principal + Interest)
            newBalance -= amount;
        }

        const status = newBalance <= 0.01 ? 'PAID' : 'ACTIVE';
        if (newBalance < 0) newBalance = 0;

        // PG doesn't serialize like SQLite, but promises are sequential here
        const runTransaction = async () => {
            try {
                // Record Payment
                await db.query(`INSERT INTO payments (loan_id, amount, type) VALUES ($1, $2, $3)`,
                    [loanId, amount, type]);

                // Update Loan
                await db.query(`UPDATE loans SET current_balance = $1, status = $2 WHERE id = $3`,
                    [newBalance, status, loanId]);

                res.json({ message: 'Payment successful', new_balance: newBalance, status });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        };
        runTransaction();
    });
});

module.exports = router;
