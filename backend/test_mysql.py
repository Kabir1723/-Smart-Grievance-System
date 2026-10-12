import mysql.connector
from mysql.connector import Error

# Common default passwords to try
passwords = ['', 'root', 'password', 'admin', '123456']

print("Testing MySQL connection with common passwords...\n")

for pwd in passwords:
    try:
        connection = mysql.connector.connect(
            host='localhost',
            user='root',
            password=pwd
        )
        print(f"✓ SUCCESS! Connected with password: '{pwd if pwd else '(empty)'}'")
        
        # Update .env file
        env_content = f"""DB_HOST=localhost
DB_USER=root
DB_PASSWORD={pwd}
DB_NAME=grievance_system
JWT_SECRET_KEY=grievance-system-secret-key-2024-change-this
"""
        with open('.env', 'w') as f:
            f.write(env_content)
        
        print("✓ .env file updated!")
        connection.close()
        break
    except Error as e:
        print(f"✗ Failed with password '{pwd if pwd else '(empty)'}': {e}")
else:
    print("\n⚠ Could not connect with common passwords.")
    print("Please run: python setup_db_interactive.py")
