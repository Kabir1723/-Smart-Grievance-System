import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
}

def create_database():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        # Create database
        cursor.execute("CREATE DATABASE IF NOT EXISTS grievance_system")
        print("✓ Database 'grievance_system' created successfully")
        
        cursor.close()
        connection.close()
        
    except Error as e:
        print(f"Error creating database: {e}")

def create_tables():
    try:
        config = DB_CONFIG.copy()
        config['database'] = 'grievance_system'
        connection = mysql.connector.connect(**config)
        cursor = connection.cursor()
        
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
        print("✓ Table 'users' created successfully")
        
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
        print("✓ Table 'complaints' created successfully")
        
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
        print("✓ Table 'escalation_log' created successfully")
        
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
        print("✓ Table 'notifications' created successfully")
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print("\n✓ All tables created successfully!")
        print("\nDatabase Schema:")
        print("- users: Stores citizen, officer, and admin information")
        print("- complaints: Stores all grievance complaints")
        print("- escalation_log: Tracks complaint escalations")
        print("- notifications: Stores user notifications")
        
    except Error as e:
        print(f"Error creating tables: {e}")

if __name__ == '__main__':
    print("Setting up Grievance System Database...\n")
    create_database()
    create_tables()
    print("\n✓ Database setup completed!")
