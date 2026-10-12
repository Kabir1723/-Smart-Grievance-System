from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

CORS(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'grievance_system')
}

def get_db_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# Rule-based priority assignment
def assign_priority(complaint_text, category):
    complaint_lower = complaint_text.lower()
    
    # High priority keywords
    high_priority_keywords = ['urgent', 'emergency', 'critical', 'danger', 'life', 'death', 'severe', 'immediate']
    
    # High priority categories
    high_priority_categories = ['health', 'safety', 'water', 'electricity']
    
    # Check for high priority
    if any(keyword in complaint_lower for keyword in high_priority_keywords):
        return 'High'
    
    if category.lower() in high_priority_categories:
        return 'High'
    
    # Medium priority keywords
    medium_priority_keywords = ['problem', 'issue', 'broken', 'damaged', 'not working']
    
    if any(keyword in complaint_lower for keyword in medium_priority_keywords):
        return 'Medium'
    
    return 'Low'

# Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Server is running'}), 200

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    password = data.get('password')
    address = data.get('address')
    
    if not all([name, email, phone, password]):
        return jsonify({'error': 'All fields are required'}), 400
    
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'error': 'Email already registered'}), 400
        
        # Insert new user
        query = """INSERT INTO users (name, email, phone, password, address, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s)"""
        cursor.execute(query, (name, email, phone, hashed_password, address, datetime.now()))
        connection.commit()
        
        return jsonify({'message': 'Registration successful'}), 201
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    
    if not all([email, password]):
        return jsonify({'error': 'Email and password are required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        
        if not user or not bcrypt.check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        access_token = create_access_token(identity=user['id'])
        
        return jsonify({
            'message': 'Login successful',
            'token': access_token,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'phone': user['phone']
            }
        }), 200
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/complaints', methods=['POST'])
@jwt_required()
def submit_complaint():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    title = data.get('title')
    description = data.get('description')
    category = data.get('category')
    location = data.get('location')
    
    if not all([title, description, category]):
        return jsonify({'error': 'Title, description, and category are required'}), 400
    
    # Assign priority using rule-based logic
    priority = assign_priority(description, category)
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        
        query = """INSERT INTO complaints 
                   (user_id, title, description, category, location, priority, status, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
        
        cursor.execute(query, (user_id, title, description, category, location, priority, 'Pending', datetime.now()))
        connection.commit()
        complaint_id = cursor.lastrowid
        
        return jsonify({
            'message': 'Complaint submitted successfully',
            'complaint_id': complaint_id,
            'priority': priority
        }), 201
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/complaints', methods=['GET'])
@jwt_required()
def get_complaints():
    user_id = get_jwt_identity()
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""SELECT * FROM complaints WHERE user_id = %s ORDER BY created_at DESC""", (user_id,))
        complaints = cursor.fetchall()
        
        # Convert datetime objects to strings
        for complaint in complaints:
            complaint['created_at'] = complaint['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if complaint['updated_at']:
                complaint['updated_at'] = complaint['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify({'complaints': complaints}), 200
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/complaints/<int:complaint_id>', methods=['GET'])
@jwt_required()
def get_complaint(complaint_id):
    user_id = get_jwt_identity()
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""SELECT * FROM complaints WHERE id = %s AND user_id = %s""", (complaint_id, user_id))
        complaint = cursor.fetchone()
        
        if not complaint:
            return jsonify({'error': 'Complaint not found'}), 404
        
        complaint['created_at'] = complaint['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        if complaint['updated_at']:
            complaint['updated_at'] = complaint['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify({'complaint': complaint}), 200
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
