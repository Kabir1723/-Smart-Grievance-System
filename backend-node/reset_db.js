const mysql = require('mysql2/promise');
require('dotenv').config();

async function reset() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        await connection.query('DROP DATABASE IF EXISTS grievance_system');
        console.log('Database dropped. It will be recreated with new schemas on next server start.');
        await connection.end();
    } catch (error) {
        console.error('Error dropping database:', error);
    }
}

reset();
