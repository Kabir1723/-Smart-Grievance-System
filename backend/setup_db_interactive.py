import mysql.connector
from mysql.connector import Error
import getpass

print("=" * 60)
print("MySQL Database Setup for Grievance System")
print("=" * 60)

# Get MySQL credentials
print("\nPlease enter your MySQL credentials:")
db_host = input("MySQL Host (default: localhost): ").strip() or "localhost"
db_user = input("MySQL User (default: root): ").strip() or "root"
db_password = getpass.getpass("MySQL Password: ")

# Test connection
print("\nTesting MySQL connection...")
try:
    connection = mysql.connector.connect(
        host=db_host,
        user=db_user,
        password=db_password
    )
    print("✓ Successfully connected to MySQL!")
    
    cursor = connection.cursor()
    
    # Create database
    print("\nCreating database 'grievance_system'...")
    cursor.execute("CREATE DATABASE IF NOT EXISTS grievance_system")
    print("✓ Database created successfully!")
    
    cursor.close()
    connection.close()
    
    # Connect to the new database and create tables
    connection = mysql.connector.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database='grievance_system'
    )
    cursor = connection.cursor()
    
    print("\nCreating tables...")
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(20) NOT NULL,
            password VARCHAR(255) NOT NULL,
            address TEXT,
            role ENUM('citizen', 'officer', 'admin') DEFAULT 'citizen',
            created_at DATETIME NOT NULL,
            INDEX idx_email (email)
        )
    """)
    print("✓ Table 'users' created")
    
    # Create complaints table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            location VARCHAR(255),
            priority ENUM('High', 'Medium', 'Low') DEFAULT 'Low',
            status ENUM('Pending', 'In Progress', 'Resolved', 'Closed', 'Escalated') DEFAULT 'Pending',
            assigned_to INT,
            sla_deadline DATETIME,
            created_at DATETIME NOT NULL,
            updated_at DATETIME,
            resolved_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_id (user_id),
            INDEX idx_status (status),
            INDEX idx_priority (priority)
        )
    """)
    print("✓ Table 'complaints' created")
    
    # Create escalation_log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS escalation_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            complaint_id INT NOT NULL,
            escalated_from INT,
            escalated_to INT,
            reason TEXT,
            escalated_at DATETIME NOT NULL,
            FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
            INDEX idx_complaint_id (complaint_id)
        )
    """)
    print("✓ Table 'escalation_log' created")
    
    # Create notifications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            complaint_id INT,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
            INDEX idx_user_id (user_id)
        )
    """)
    print("✓ Table 'notifications' created")
    
    connection.commit()
    cursor.close()
    connection.close()
    
    print("\n" + "=" * 60)
    print("✓ Database setup completed successfully!")
    print("=" * 60)
    
    # Update .env file
    print("\nUpdating .env file with your credentials...")
    env_content = f"""DB_HOST={db_host}
DB_USER={db_user}
DB_PASSWORD={db_password}
DB_NAME=grievance_system
JWT_SECRET_KEY=grievance-system-secret-key-2024-change-this
"""
    
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print("✓ .env file updated!")
    print("\nYou can now run: python app.py")
    
except Error as e:
    print(f"\n✗ Error: {e}")
    print("\nPlease check your MySQL credentials and try again.")
