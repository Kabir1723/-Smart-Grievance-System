const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createOfficers() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'grievance_system'
    });

    console.log('\n' + '='.repeat(60));
    console.log('Creating Department Officers');
    console.log('='.repeat(60) + '\n');

    const officers = [
      { name: 'Water Officer', email: 'water.officer@gov.in', phone: '9876543210', department: 'Water Supply', password: 'officer123' },
      { name: 'Electricity Officer', email: 'electricity.officer@gov.in', phone: '9876543211', department: 'Electricity', password: 'officer123' },
      { name: 'Roads Officer', email: 'roads.officer@gov.in', phone: '9876543212', department: 'Roads', password: 'officer123' },
      { name: 'Health Officer', email: 'health.officer@gov.in', phone: '9876543213', department: 'Health', password: 'officer123' },
      { name: 'Sanitation Officer', email: 'sanitation.officer@gov.in', phone: '9876543214', department: 'Sanitation', password: 'officer123' },
      { name: 'Safety Officer', email: 'safety.officer@gov.in', phone: '9876543215', department: 'Safety', password: 'officer123' }
    ];

    for (const officer of officers) {
      // Check if officer already exists
      const [existing] = await connection.query('SELECT * FROM users WHERE email = ?', [officer.email]);
      
      if (existing.length > 0) {
        console.log(`⚠ Officer ${officer.name} already exists`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(officer.password, 10);

      // Insert officer
      await connection.query(
        'INSERT INTO users (name, email, phone, password, role, department, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [officer.name, officer.email, officer.phone, hashedPassword, 'officer', officer.department]
      );

      console.log(`✓ Created officer: ${officer.name} (${officer.department})`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Officers Created Successfully!');
    console.log('='.repeat(60));
    console.log('\nOfficer Login Credentials:');
    console.log('Email: [department].officer@gov.in');
    console.log('Password: officer123');
    console.log('\nExample: water.officer@gov.in / officer123');
    console.log('='.repeat(60) + '\n');

    await connection.end();
  } catch (error) {
    console.error('Error creating officers:', error.message);
  }
}

createOfficers();
