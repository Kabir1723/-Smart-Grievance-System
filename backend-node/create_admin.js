const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'grievance_system'
        });
        const hp = await bcrypt.hash('admin123', 10);
        await connection.query('INSERT INTO users (name, email, phone, password, address, role, created_at) VALUES ("Kabir", "kabirrrr23@gmail.com", "7696043644", ?, "Admin Office", "admin", NOW()) ON DUPLICATE KEY UPDATE role="admin"', [hp]);
        console.log('Admin created.');
        process.exit();
    } catch (e) {
        console.error(e);
    }
}
createAdmin();
