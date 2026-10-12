const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAdmin() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'grievance_system'
    });

    console.log('\nChecking users in database...\n');

    const [users] = await connection.query('SELECT id, name, email, role, created_at FROM users');
    
    console.log('Total users:', users.length);
    console.log('\nUsers list:');
    console.table(users);

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAdmin();
