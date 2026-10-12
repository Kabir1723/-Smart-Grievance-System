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

    console.log('\n' + '='.repeat(60));
    console.log('Creating Admin User');
    console.log('='.repeat(60) + '\n');

    // Admin credentials
    const adminData = {
      name: 'Kabir',
      email: 'kabirrrr23@gmail.com',
      phone: '7696043644',
      password: 'admin123',
      role: 'admin'
    };

    // Check if admin already exists
    const [existing] = await connection.query('SELECT * FROM users WHERE email = ?', [adminData.email]);
    
    if (existing.length > 0) {
      console.log('⚠ Admin user already exists!');
      console.log('\nAdmin Credentials:');
      console.log('Email: kabirrrr23@gmail.com');
      console.log('Password: admin123');
      console.log('\n' + '='.repeat(60) + '\n');
      await connection.end();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Insert admin user
    await connection.query(
      'INSERT INTO users (name, email, phone, password, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [adminData.name, adminData.email, adminData.phone, hashedPassword, adminData.role]
    );

    console.log('✓ Admin user created successfully!\n');
    console.log('Admin Credentials:');
    console.log('Email: kabirrrr23@gmail.com');
    console.log('Password: admin123');
    console.log('\n' + '='.repeat(60) + '\n');

    await connection.end();
  } catch (error) {
    console.error('Error creating admin:', error.message);
  }
}

createAdmin();
