const { db, initializeDatabase } = require('./database-postgres');
// const sqlite3 = require('sqlite3').verbose();
// const path = require('path');
// const dbPath = path.resolve(__dirname, 'loan_system.db');
// const db = new sqlite3.Database(dbPath);

async function runTest() {
    console.log("--- Starting Isolation Test ---");

    // 1. Create two users
    const userA = 'test_user_a_' + Date.now();
    const userB = 'test_user_b_' + Date.now();

    const idA = await createUser(userA);
    const idB = await createUser(userB);

    console.log(`Created User A (ID ${idA}) and User B (ID ${idB})`);

    // 2. Add customer to User A
    const custName = 'Customer of A';
    await createCustomer(custName, idA);
    console.log(`Created Customer "${custName}" for User A`);

    // 3. Query Customers for User A (Should find 1)
    const listA = await getCustomers(idA);
    console.log(`User A sees ${listA.length} customers. (Expected >= 1)`);
    const foundA = listA.find(c => c.name === custName);
    if (!foundA) console.error("FAILED: User A cannot see their own customer!");

    // 4. Query Customers for User B (Should NOT find Customer of A)
    const listB = await getCustomers(idB);
    console.log(`User B sees ${listB.length} customers.`);
    const foundB = listB.find(c => c.name === custName);

    if (foundB) {
        console.error("CRITICAL FAILURE: User B can see User A's customer!");
        console.error(foundB);
    } else {
        console.log("SUCCESS: User B CANNOT see User A's customer.");
    }

    db.close();
}

function createUser(username) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO users (username, password, role, status) VALUES (?, '123', 'user', 'active')", [username], function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function createCustomer(name, userId) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO customers (name, cpf_rg, user_id) VALUES (?, '000', ?)", [name, userId], function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getCustomers(userId) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM customers WHERE user_id = ?", [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

runTest();
