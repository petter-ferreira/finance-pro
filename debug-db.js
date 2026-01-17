const { db, pool } = require('./database-postgres');
require('dotenv').config();

async function checkUsers() {
    try {
        const result = await db.query('SELECT * FROM users');
        console.log('Users found:', result.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error querying users:', err);
        process.exit(1);
    }
}

checkUsers();
