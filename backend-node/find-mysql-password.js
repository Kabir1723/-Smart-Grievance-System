const mysql = require('mysql2/promise');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const passwords = ['', 'root', 'password', 'admin', '123456', 'mysql', 'Password123', 'Admin123'];

async function testPasswords() {
  console.log('\n' + '='.repeat(60));
  console.log('MySQL Password Finder');
  console.log('='.repeat(60) + '\n');
  console.log('Testing common passwords...\n');

  for (const pwd of passwords) {
    try {
      const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: pwd
      });

      console.log(`✓ SUCCESS! MySQL password is: "${pwd || '(empty)'}"\n`);
      
      // Update .env file
      const fs = require('fs');
      const envContent = `DB_HOST=localhost
DB_USER=root
DB_PASSWORD=${pwd}
DB_NAME=grievance_system
JWT_SECRET_KEY=grievance-system-secret-key-2024
PORT=5000
`;
      fs.writeFileSync('.env', envContent);
      console.log('✓ .env file updated!\n');
      
      await connection.end();
      return true;
    } catch (error) {
      console.log(`✗ Failed with password "${pwd || '(empty)'}"`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Could not find password with common options.');
  console.log('='.repeat(60) + '\n');

  return new Promise((resolve) => {
    rl.question('Please enter your MySQL root password: ', async (password) => {
      try {
        const connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: password
        });

        console.log('\n✓ SUCCESS! Connected to MySQL!\n');
        
        // Update .env file
        const fs = require('fs');
        const envContent = `DB_HOST=localhost
DB_USER=root
DB_PASSWORD=${password}
DB_NAME=grievance_system
JWT_SECRET_KEY=grievance-system-secret-key-2024
PORT=5000
`;
        fs.writeFileSync('.env', envContent);
        console.log('✓ .env file updated!\n');
        
        await connection.end();
        rl.close();
        resolve(true);
      } catch (error) {
        console.log('\n✗ Failed to connect:', error.message);
        console.log('\nPlease check your MySQL installation and try again.\n');
        rl.close();
        resolve(false);
      }
    });
  });
}

testPasswords().then((success) => {
  if (success) {
    console.log('You can now run: npm start\n');
  }
  process.exit(success ? 0 : 1);
});
