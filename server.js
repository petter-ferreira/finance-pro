const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Disable caching for API calls to prevent data leak between users
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running!',
        timestamp: new Date().toISOString()
    });
});
console.log('✓ Test route registered');

app.use('/api/health', require('./routes/health'));
console.log('✓ Health route registered');

app.use('/api/auth', require('./routes/auth'));
console.log('✓ Auth route registered');

app.use('/api/users', require('./routes/users'));
console.log('✓ Users route registered');

app.use('/api/customers', require('./routes/customers'));
console.log('✓ Customers route registered');

app.use('/api/loans', require('./routes/loans'));
console.log('✓ Loans route registered');

app.use('/api/reports', require('./routes/reports'));
console.log('✓ Reports route registered');

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
    console.log(`========================================\n`);
});
