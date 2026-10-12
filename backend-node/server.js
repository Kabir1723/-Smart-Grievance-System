const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;

// ---------------------------------------------------------------------------
// AI chatbot config sanity check - a wrong-format key is the #1 cause of the
// chatbot silently failing, so warn loudly and specifically at startup.
// ---------------------------------------------------------------------------
(function checkAnthropicKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your-anthropic-api-key') {
    console.warn('⚠ ANTHROPIC_API_KEY is not set - the AI chatbot will not work until you add a real key from https://console.anthropic.com/ to backend-node/.env');
  } else if (!key.startsWith('sk-ant-')) {
    console.warn('⚠ ANTHROPIC_API_KEY does not look like a valid Anthropic key (real keys start with "sk-ant-"). The AI chatbot will fail until this is replaced with a genuine key from https://console.anthropic.com/');
  }
})();

// Middleware
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// File uploads (images & documents attached to complaints)
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_DIR));

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

// Email transporter — uses Gmail service shorthand (port 465 SSL).
// This bypasses the port-587 block that Render free tier applies to raw SMTP.
function createEmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD   // Gmail App Password (16 chars, no spaces)
    }
  });
}

// Twilio client configuration
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID !== 'your-twilio-account-sid') {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✓ Twilio SMS configured');
  }
} catch (error) {
  console.log('⚠ Twilio not configured (SMS disabled)');
}


 // Database configuration for Aiven MySQL
const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
};


// Create database connection pool
let pool;


async function initializeDatabase() {
  try {
    const requiredVariables = [
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME'
    ];

    const missing = requiredVariables.filter(
      key => !process.env[key]
    );

    if (missing.length) {
      throw new Error(
        `Missing environment variables: ${missing.join(', ')}`
      );
    }

    // Connect directly to Aiven's existing database.
    // Do not attempt CREATE DATABASE on Aiven.
    pool = mysql.createPool(dbConfig);

    const connection = await pool.getConnection();

    try {
      await connection.query('SELECT 1');
      console.log('✓ Connected to Aiven MySQL');
    } finally {
      connection.release();
    }

    await createTables();
    await ensureAdminAccount();
    console.log('✓ All tables created/verified');
  } catch (error) {
    console.error(
      'Database initialization error:',
      error.code || '',
      error.message
    );
    process.exit(1);
  }
}

// Bootstrap the administrator from deployment environment variables. This is
// intentionally skipped for local installs that have not configured admin
// credentials, and never writes the password to logs or source control.
async function ensureAdminAccount() {
  const email = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('⚠ Admin bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in the deployment environment.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const phone = process.env.ADMIN_PHONE || '0000000000';

  await pool.query(
    `INSERT INTO users (name, email, phone, password, address, role, is_verified, created_at)
     VALUES (?, ?, ?, ?, ?, 'admin', TRUE, NOW())
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       phone = VALUES(phone),
       password = VALUES(password),
       address = VALUES(address),
       role = 'admin',
       is_verified = TRUE`,
    ['Administrator', email, phone, passwordHash, 'Admin Office']
  );

  console.log('✓ Admin account created/updated from deployment environment');
}

async function createTables() {
  const connection = await pool.getConnection();

  try {
    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        address TEXT,
        role ENUM('citizen', 'officer', 'admin') DEFAULT 'citizen',
        department VARCHAR(100),
        is_verified BOOLEAN DEFAULT FALSE,
        email_verify_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expiry DATETIME,
        email_notifications BOOLEAN DEFAULT TRUE,
        inapp_notifications BOOLEAN DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        INDEX idx_email (email),
        INDEX idx_role (role)
      )
    `);

    // Best-effort migrations for existing databases created before these columns existed
    const userColumns = [
      "ADD COLUMN is_verified BOOLEAN DEFAULT FALSE",
      "ADD COLUMN email_verify_token VARCHAR(255)",
      "ADD COLUMN reset_token VARCHAR(255)",
      "ADD COLUMN reset_token_expiry DATETIME",
      "ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE",
      "ADD COLUMN inapp_notifications BOOLEAN DEFAULT TRUE"
    ];
    for (const clause of userColumns) {
      try {
        await connection.query(`ALTER TABLE users ${clause}`);
      } catch (e) {
        // Column already exists - ignore
      }
    }

    // Complaints table
    await connection.query(`
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
        escalation_level INT DEFAULT 0,
        is_deleted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_sla_deadline (sla_deadline)
      )
    `);

    // Add is_deleted column for existing databases
    try {
      await connection.query('ALTER TABLE complaints ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE');
    } catch (e) {
      // Ignore error if column already exists
    }

    // Add sla_deadline column for existing databases created before SLA tracking
    try {
      await connection.query('ALTER TABLE complaints ADD COLUMN sla_deadline DATETIME');
    } catch (e) { /* already exists */ }

    // Add resolved_at column for existing databases
    try {
      await connection.query('ALTER TABLE complaints ADD COLUMN resolved_at DATETIME');
    } catch (e) { /* already exists */ }

    // Add escalation_level column for existing databases
    try {
      await connection.query('ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 0');
    } catch (e) { /* already exists */ }

    // Add assigned_to column for existing databases
    try {
      await connection.query('ALTER TABLE complaints ADD COLUMN assigned_to INT');
    } catch (e) { /* already exists */ }

    // Allow complaints to be cancelled by their owner
    try {
      await connection.query(
        `ALTER TABLE complaints MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Resolved', 'Closed', 'Escalated', 'Cancelled') DEFAULT 'Pending'`
      );
    } catch (e) {
      // Ignore if already migrated
    }

    // Attachments table (images / documents uploaded with a complaint)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100),
        file_size INT,
        uploaded_at DATETIME NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
        INDEX idx_complaint_id (complaint_id)
      )
    `);

    // Feedback table (rating + comments on resolved complaints)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        user_id INT NOT NULL,
        rating INT NOT NULL,
        comment TEXT,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_complaint_id (complaint_id)
      )
    `);

    // Chatbot conversation log (used for AI complaint-status lookups & guidance)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chatbot_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        role ENUM('user', 'assistant') NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_user_id (user_id)
      )
    `);

    // Escalation log table
    await connection.query(`
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
    `);

    // Notifications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        complaint_id INT,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read)
      )
    `);
  } finally {
    connection.release();
  }
}

// Rule-based priority assignment
function assignPriority(description, category) {
  const descLower = description.toLowerCase();
  const catLower = category.toLowerCase();

  // High priority keywords in description
  const highKeywords = ['urgent', 'emergency', 'critical', 'danger', 'life', 'death', 'severe', 'immediate', 'accident', 'fire', 'flood', 'leak'];

  // High priority categories - check if category CONTAINS these words
  const highCategories = ['health', 'safety', 'water', 'electricity'];

  if (
    highKeywords.some(keyword => descLower.includes(keyword)) ||
    highCategories.some(cat => catLower.includes(cat))
  ) {
    return 'High';
  }

  // Medium priority categories first (more specific)
  const mediumCategories = ['roads', 'sanitation', 'transportation'];

  if (mediumCategories.some(cat => catLower.includes(cat))) {
    return 'Medium';
  }

  // Medium priority keywords (only if not already categorized)
  const mediumKeywords = ['broken', 'damaged', 'not working', 'repair', 'fix', 'bad', 'poor', 'faulty'];

  if (mediumKeywords.some(keyword => descLower.includes(keyword))) {
    return 'Medium';
  }

  return 'Low';
}

// Calculate SLA deadline based on priority
function calculateSLADeadline(priority) {
  const now = new Date();
  let hours = 72; // Default 3 days for Low priority

  if (priority === 'High') {
    hours = 24; // 1 day for High priority
  } else if (priority === 'Medium') {
    hours = 48; // 2 days for Medium priority
  }

  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

// Auto-assign officer based on category
async function autoAssignOfficer(category) {
  try {
    const [officers] = await pool.query(
      'SELECT id FROM users WHERE role = "officer" AND department = ? ORDER BY RAND() LIMIT 1',
      [category]
    );

    if (officers.length > 0) {
      return officers[0].id;
    }

    // If no officer for specific department, assign to any officer
    const [anyOfficer] = await pool.query(
      'SELECT id FROM users WHERE role = "officer" ORDER BY RAND() LIMIT 1'
    );

    return anyOfficer.length > 0 ? anyOfficer[0].id : null;
  } catch (error) {
    console.error('Auto-assign error:', error);
    return null;
  }
}

// Create notification
async function createNotification(userId, complaintId, message, type = 'info') {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, complaint_id, message, type, created_at) VALUES (?, ?, ?, ?, NOW())',
      [userId, complaintId, message, type]
    );
  } catch (error) {
    console.error('Notification error:', error);
  }
}

// Send Email Notification
async function sendEmailNotification(subject, message, complaintDetails) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('⚠ Email credentials not configured');
      return;
    }

    const mailOptions = {
      from: `"Grievance System" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">🔔 New Complaint Alert</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937; margin-top: 0;">${message}</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #667eea; margin-top: 0;">Complaint Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Complaint ID:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">#${complaintDetails.id}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Title:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${complaintDetails.title}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Category:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${complaintDetails.category}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Priority:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                    <span style="background: ${complaintDetails.priority === 'High' ? '#fee2e2' : complaintDetails.priority === 'Medium' ? '#fef3c7' : '#d1fae5'}; 
                                 color: ${complaintDetails.priority === 'High' ? '#dc2626' : complaintDetails.priority === 'Medium' ? '#d97706' : '#059669'}; 
                                 padding: 4px 12px; border-radius: 12px; font-weight: 600;">
                      ${complaintDetails.priority}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Location:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${complaintDetails.location || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>User Name:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${complaintDetails.userName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>User Email:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${complaintDetails.userEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>User Phone:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${complaintDetails.userPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 10px;"><strong>Description:</strong></td>
                  <td style="padding: 10px;">${complaintDetails.description}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${FRONTEND_URL}/admin/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        font-weight: 600;
                        display: inline-block;">
                View in Admin Dashboard
              </a>
            </div>
          </div>
          <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Smart Public Grievance Escalation System</p>
            <p style="margin: 5px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    await createEmailTransporter().sendMail(mailOptions);
    console.log('✓ Email notification sent to admin');
  } catch (error) {
    console.error('Email notification error:', error.message);
  }
}

// Send account verification email to a newly registered user
async function sendVerificationEmail(toEmail, name, token) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('⚠ Email credentials not configured - skipping verification email');
    return;
  }
  const verifyLink = `${FRONTEND_URL}/verify-email?token=${token}`;
  await createEmailTransporter().sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align:center;">
          <h1 style="color:white; margin:0;">Welcome, ${name}!</h1>
        </div>
        <div style="padding:30px; background:#f9fafb;">
          <p>Thanks for registering with the Smart Public Grievance System. Please verify your email address to activate your account.</p>
          <div style="text-align:center; margin:30px 0;">
            <a href="${verifyLink}" style="background:#667eea; color:white; padding:12px 30px; text-decoration:none; border-radius:6px; font-weight:600;">Verify Email</a>
          </div>
          <p style="color:#6b7280; font-size:13px;">If the button doesn't work, copy this link into your browser:<br>${verifyLink}</p>
        </div>
      </div>
    `
  });
  console.log('✓ Verification email sent to', toEmail);
}

// Send password-reset email
async function sendPasswordResetEmail(toEmail, name, token) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('⚠ Email credentials not configured - skipping password reset email');
    return;
  }
  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
  await emailTransporter.sendMail({
  await createEmailTransporter().sendMail({
    from: `"Grievance System" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align:center;">
          <h1 style="color:white; margin:0;">Password Reset</h1>
        </div>
        <div style="padding:30px; background:#f9fafb;">
          <p>Hi ${name}, we received a request to reset your password. This link expires in 1 hour.</p>
          <div style="text-align:center; margin:30px 0;">
            <a href="${resetLink}" style="background:#667eea; color:white; padding:12px 30px; text-decoration:none; border-radius:6px; font-weight:600;">Reset Password</a>
          </div>
          <p style="color:#6b7280; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>
    `
  });
  console.log('✓ Password reset email sent to', toEmail);
}

// Send SMS Notification (Using Fast2SMS - Free for India)
async function sendSMSNotification(message) {
  try {
    // Method 1: Fast2SMS (if configured)
    if (process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY !== 'your-fast2sms-api-key') {
      const axios = require('axios');
      const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        route: 'v3',
        sender_id: 'TXTIND',
        message: message,
        language: 'english',
        flash: 0,
        numbers: process.env.ADMIN_PHONE
      }, {
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      console.log('✓ SMS notification sent to admin via Fast2SMS');
      return;
    }

    // Method 2: Twilio (if configured)
    if (twilioClient) {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${process.env.ADMIN_PHONE}`
      });
      console.log('✓ SMS notification sent to admin via Twilio');
      return;
    }

    // No SMS service configured
    console.log('⚠ SMS not configured - Install Fast2SMS (free) or Twilio');
    console.log('📱 SMS would have been sent to:', process.env.ADMIN_PHONE);
    console.log('📝 Message:', message.substring(0, 100) + '...');

  } catch (error) {
    console.error('SMS notification error:', error.message);
    console.log('📱 Failed to send SMS to:', process.env.ADMIN_PHONE);
  }
}

// Notify Admin about new complaint
async function notifyAdminAboutComplaint(complaintDetails) {
  try {
    // Get admin user
    const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin" LIMIT 1');

    if (admins.length > 0) {
      // Create in-app notification for admin
      await createNotification(
        admins[0].id,
        complaintDetails.id,
        `New ${complaintDetails.priority} priority complaint: "${complaintDetails.title}" from ${complaintDetails.userName}`,
        'warning'
      );
    }

    // Send Email
    await sendEmailNotification(
      `🚨 New ${complaintDetails.priority} Priority Complaint #${complaintDetails.id}`,
      `A new complaint has been submitted and requires your attention.`,
      complaintDetails
    );

    // Send SMS
    const smsMessage = `🚨 New ${complaintDetails.priority} Priority Complaint #${complaintDetails.id}\nTitle: ${complaintDetails.title}\nCategory: ${complaintDetails.category}\nFrom: ${complaintDetails.userName}\nView: ${FRONTEND_URL}/admin/dashboard`;
    await sendSMSNotification(smsMessage);

  } catch (error) {
    console.error('Admin notification error:', error);
  }
}

// Check and escalate overdue complaints
async function checkAndEscalateComplaints() {
  try {
    const [overdueComplaints] = await pool.query(`
      SELECT c.*, u.id as user_id 
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE c.status NOT IN ('Resolved', 'Closed') 
      AND c.sla_deadline < NOW()
      AND c.escalation_level < 2
    `);

    for (const complaint of overdueComplaints) {
      const newLevel = complaint.escalation_level + 1;

      await pool.query(
        'UPDATE complaints SET status = "Escalated", escalation_level = ?, updated_at = NOW() WHERE id = ?',
        [newLevel, complaint.id]
      );

      await pool.query(
        'INSERT INTO escalation_log (complaint_id, escalated_from, escalated_to, reason, escalated_at) VALUES (?, ?, ?, ?, NOW())',
        [complaint.id, complaint.assigned_to, null, 'SLA deadline exceeded',]
      );

      await createNotification(
        complaint.user_id,
        complaint.id,
        `Your complaint #${complaint.id} has been escalated due to SLA breach.`,
        'warning'
      );
    }
  } catch (error) {
    console.error('Escalation check error:', error);
  }
}

// Run escalation check every 5 minutes
setInterval(checkAndEscalateComplaints, 5 * 60 * 1000);

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.userId = user.id;
    next();
  });
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password, address, email_verify_token, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [name, email, phone, hashedPassword, address, verifyToken]
    );

    // Best-effort verification email (registration still succeeds if email isn't configured)
    sendVerificationEmail(email, name, verifyToken).catch(() => {});

    await createNotification(
      result.insertId,
      null,
      `Welcome ${name}! Please verify your email address to unlock all features.`,
      'info'
    );

    res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email
app.get('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const [users] = await pool.query('SELECT id FROM users WHERE email_verify_token = ?', [token]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    await pool.query(
      'UPDATE users SET is_verified = TRUE, email_verify_token = NULL WHERE id = ?',
      [users[0].id]
    );

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification email
app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [users] = await pool.query('SELECT id, name, is_verified FROM users WHERE email = ?', [email]);
    // Respond generically either way to avoid leaking which emails are registered
    if (users.length > 0 && !users[0].is_verified) {
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE users SET email_verify_token = ? WHERE id = ?', [verifyToken, users[0].id]);
      sendVerificationEmail(email, users[0].name, verifyToken).catch(() => {});
    }

    res.json({ message: 'If that email is registered and unverified, a new verification link has been sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Forgot password - request a reset link
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [users] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email]);

    if (users.length > 0) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
        [resetToken, expiry, users[0].id]
      );
      sendPasswordResetEmail(email, users[0].name, resetToken).catch(() => {});
    }

    // Always respond generically so we don't reveal which emails are registered
    res.json({ message: 'If that email is registered, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password using a valid token
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const [users] = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashedPassword, users[0].id]
    );

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET_KEY || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Submit complaint
app.post('/api/complaints', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, location } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Title, description, and category are required' });
    }

    const priority = assignPriority(description, category);
    const slaDeadline = calculateSLADeadline(priority);
    const assignedOfficer = await autoAssignOfficer(category);

    const [result] = await pool.query(
      'INSERT INTO complaints (user_id, title, description, category, location, priority, status, assigned_to, sla_deadline, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [req.userId, title, description, category, location, priority, 'Pending', assignedOfficer, slaDeadline]
    );

    // Get user details for admin notification
    const [users] = await pool.query('SELECT name, email, phone FROM users WHERE id = ?', [req.userId]);
    const user = users[0];

    // Create notification for user
    await createNotification(
      req.userId,
      result.insertId,
      `Your complaint "${title}" has been submitted successfully with ${priority} priority.`,
      'success'
    );

    // Notify assigned officer if exists
    if (assignedOfficer) {
      await createNotification(
        assignedOfficer,
        result.insertId,
        `New ${priority} priority complaint assigned to you: "${title}"`,
        'info'
      );
    }

    // Notify Admin via Email, SMS, and In-App
    await notifyAdminAboutComplaint({
      id: result.insertId,
      title,
      description,
      category,
      location,
      priority,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone
    });

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint_id: result.insertId,
      priority,
      sla_deadline: slaDeadline,
      assigned_to: assignedOfficer
    });
  } catch (error) {
    console.error('Submit complaint error:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

// Get all complaints for user - supports search, filter, sort via query params
// ?search=keyword&status=Pending&category=Roads&priority=High&sort=created_at&order=DESC
app.get('/api/complaints', authenticateToken, async (req, res) => {
  try {
    const { search, status, category, priority, sort, order } = req.query;

    const allowedSortColumns = ['created_at', 'updated_at', 'priority', 'status', 'title'];
    const sortColumn = allowedSortColumns.includes(sort) ? sort : 'created_at';
    const sortOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = 'SELECT * FROM complaints WHERE user_id = ? AND is_deleted = FALSE';
    const params = [req.userId];

    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const [complaints] = await pool.query(query, params);

    res.json({ complaints });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Edit a complaint (only while it is still Pending, before an officer has acted on it)
app.put('/api/complaints/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, location } = req.body;

    const [complaints] = await pool.query(
      'SELECT * FROM complaints WHERE id = ? AND user_id = ? AND is_deleted = FALSE',
      [req.params.id, req.userId]
    );
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = complaints[0];
    if (complaint.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending complaints can be edited' });
    }

    const newTitle = title || complaint.title;
    const newDescription = description || complaint.description;
    const newCategory = category || complaint.category;
    const newLocation = location !== undefined ? location : complaint.location;

    // Re-run AI/rule-based priority assignment in case the edit changes urgency
    const priority = assignPriority(newDescription, newCategory);
    const slaDeadline = calculateSLADeadline(priority);

    await pool.query(
      'UPDATE complaints SET title = ?, description = ?, category = ?, location = ?, priority = ?, sla_deadline = ?, updated_at = NOW() WHERE id = ?',
      [newTitle, newDescription, newCategory, newLocation, priority, slaDeadline, req.params.id]
    );

    res.json({ message: 'Complaint updated successfully', priority });
  } catch (error) {
    console.error('Edit complaint error:', error);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// Cancel a complaint (user-initiated, only while Pending or In Progress)
app.put('/api/complaints/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const [complaints] = await pool.query(
      'SELECT * FROM complaints WHERE id = ? AND user_id = ? AND is_deleted = FALSE',
      [req.params.id, req.userId]
    );
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = complaints[0];
    if (!['Pending', 'In Progress'].includes(complaint.status)) {
      return res.status(400).json({ error: 'Only pending or in-progress complaints can be cancelled' });
    }

    await pool.query(
      'UPDATE complaints SET status = "Cancelled", updated_at = NOW() WHERE id = ?',
      [req.params.id]
    );

    await createNotification(req.userId, req.params.id, `Your complaint #${req.params.id} has been cancelled.`, 'info');

    res.json({ message: 'Complaint cancelled successfully' });
  } catch (error) {
    console.error('Cancel complaint error:', error);
    res.status(500).json({ error: 'Failed to cancel complaint' });
  }
});

// Reopen a resolved/closed complaint (within 7 days of resolution)
app.put('/api/complaints/:id/reopen', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const [complaints] = await pool.query(
      'SELECT * FROM complaints WHERE id = ? AND user_id = ? AND is_deleted = FALSE',
      [req.params.id, req.userId]
    );
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = complaints[0];
    if (!['Resolved', 'Closed'].includes(complaint.status)) {
      return res.status(400).json({ error: 'Only resolved or closed complaints can be reopened' });
    }

    const resolvedAt = complaint.resolved_at ? new Date(complaint.resolved_at) : null;
    if (resolvedAt) {
      const daysSince = (Date.now() - resolvedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        return res.status(400).json({ error: 'This complaint can no longer be reopened (7-day window has passed). Please submit a new complaint.' });
      }
    }

    await pool.query(
      'UPDATE complaints SET status = "In Progress", resolved_at = NULL, updated_at = NOW() WHERE id = ?',
      [req.params.id]
    );

    await pool.query(
      'INSERT INTO escalation_log (complaint_id, escalated_from, escalated_to, reason, escalated_at) VALUES (?, ?, ?, ?, NOW())',
      [req.params.id, complaint.assigned_to, complaint.assigned_to, reason || 'Reopened by user']
    );

    await createNotification(req.userId, req.params.id, `Your complaint #${req.params.id} has been reopened.`, 'info');
    if (complaint.assigned_to) {
      await createNotification(complaint.assigned_to, req.params.id, `Complaint #${req.params.id} was reopened by the citizen.`, 'warning');
    }

    res.json({ message: 'Complaint reopened successfully' });
  } catch (error) {
    console.error('Reopen complaint error:', error);
    res.status(500).json({ error: 'Failed to reopen complaint' });
  }
});

// Upload images/documents for a complaint
app.post('/api/complaints/:id/attachments', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    const [complaints] = await pool.query(
      'SELECT id FROM complaints WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const inserted = [];
    for (const file of req.files) {
      const [result] = await pool.query(
        'INSERT INTO attachments (complaint_id, file_name, original_name, file_type, file_size, uploaded_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [req.params.id, file.filename, file.originalname, file.mimetype, file.size]
      );
      inserted.push({
        id: result.insertId,
        url: `/uploads/${file.filename}`,
        original_name: file.originalname,
        file_type: file.mimetype
      });
    }

    res.status(201).json({ message: 'Files uploaded successfully', attachments: inserted });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload files' });
  }
});

// View attachments for a complaint
app.get('/api/complaints/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const [complaints] = await pool.query(
      'SELECT id FROM complaints WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const [attachments] = await pool.query(
      'SELECT id, file_name, original_name, file_type, file_size, uploaded_at FROM attachments WHERE complaint_id = ?',
      [req.params.id]
    );

    res.json({
      attachments: attachments.map(a => ({ ...a, url: `/uploads/${a.file_name}` }))
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Submit feedback / rating on a resolved complaint
app.post('/api/complaints/:id/feedback', authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const [complaints] = await pool.query(
      'SELECT * FROM complaints WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    if (!['Resolved', 'Closed'].includes(complaints[0].status)) {
      return res.status(400).json({ error: 'Feedback can only be given on resolved or closed complaints' });
    }

    await pool.query(
      'INSERT INTO feedback (complaint_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, NOW())',
      [req.params.id, req.userId, rating, comment || null]
    );

    res.status(201).json({ message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ---------------------------------------------------------------------------
// Profile management
// ---------------------------------------------------------------------------
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, phone, address, role, is_verified, email_notifications, inapp_notifications, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    await pool.query(
      'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
      [name || user.name, phone || user.phone, address !== undefined ? address : user.address]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.put('/api/profile/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.put('/api/profile/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const { emailNotifications, inappNotifications } = req.body;
    await pool.query(
      'UPDATE users SET email_notifications = ?, inapp_notifications = ? WHERE id = ?',
      [!!emailNotifications, !!inappNotifications, req.userId]
    );
    res.json({ message: 'Notification preferences updated' });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ---------------------------------------------------------------------------
// AI Chatbot (Anthropic Claude)
// ---------------------------------------------------------------------------
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

const CHATBOT_SYSTEM_PROMPT = `You are the helpful AI assistant embedded in the "Smart Public Grievance Escalation System", a portal citizens use to file and track civic complaints (roads, water, electricity, sanitation, health, safety, transportation, etc).

You can help with:
- Answering FAQs about how the system works (how to submit a complaint, how priority/SLA is decided, how escalation works).
- Guiding a citizen step-by-step through filing a new complaint (ask for: a short title, a clear description, the category, and the location).
- Recommending the right complaint category and department based on what the citizen describes.
- Explaining what a complaint's status (Pending, In Progress, Resolved, Closed, Escalated, Cancelled) means and what happens next.
- Suggesting practical next steps or solutions while a complaint is being processed.

Ground rules:
- Be concise, warm, and practical. Use plain language, not jargon.
- Never invent complaint numbers, statuses, or dates. If the user asks about the status of a specific complaint, tell them you can look it up if they give the complaint ID (the app will fetch the real record and give it to you as context).
- If the user is describing a new problem, help them turn it into a clear complaint (title, description, category, location) and tell them to review and submit it via the "Submit Complaint" form (or ask if they'd like you to prepare it for one-click submission).
- Categories in this system typically include: Roads, Water, Electricity, Sanitation, Health, Safety, Transportation, and Other. Pick the closest match.
- If asked something outside your scope (unrelated general knowledge), answer briefly but steer back to how you can help with grievances.`;

const CATEGORY_KEYWORDS = {
  Roads: ['road', 'pothole', 'street', 'footpath', 'sidewalk', 'traffic signal', 'speed breaker'],
  Water: ['water', 'pipeline', 'leak', 'sewage', 'drainage', 'tap', 'supply'],
  Electricity: ['electric', 'power cut', 'transformer', 'streetlight', 'street light', 'wire', 'voltage'],
  Sanitation: ['garbage', 'trash', 'waste', 'sanitation', 'sewer', 'dump', 'cleanliness', 'litter'],
  Health: ['hospital', 'clinic', 'health', 'disease', 'medicine', 'ambulance'],
  Safety: ['safety', 'crime', 'accident', 'danger', 'unsafe', 'harassment'],
  Transportation: ['bus', 'transport', 'auto', 'rickshaw', 'metro', 'train station']
};

function guessCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => lower.includes(w))) return category;
  }
  return 'Other';
}

// Rule-based responder used whenever the Anthropic API can't be reached
// (missing/invalid key, network issue, rate limit, etc.) so the chatbot
// always gives the citizen a useful answer instead of an error message.
function localFallbackReply(message, contextNote) {
  const text = (message || '').trim();
  const lower = text.toLowerCase();

  if (contextNote) {
    const match = contextNote.match(/Complaint #(\d+) "(.*?)" \| status: (.*?) \| priority: (.*?) \| category: (.*?) \| submitted: (.*?) \| SLA deadline: (.*)/);
    if (match) {
      const [, id, title, status, priority, category, , slaDeadline] = match;
      return `Complaint #${id} ("${title}") is currently **${status}**. It's a ${priority} priority ${category} complaint, with an SLA deadline of ${slaDeadline}. You can see the full timeline on the "My Complaints" page.`;
    }
  }

  if (/^(hi|hello|hey|hola)\b/.test(lower)) {
    return "Hi! I'm the grievance assistant. I can help you file a new complaint, check on an existing one, or explain how the system works. What would you like to do?";
  }

  if (/status|track|where is my|complaint\s*#?\d+/.test(lower) && /\d/.test(lower)) {
    return "I can look up a complaint if you share its ID (e.g. \"status of complaint #123\") while logged in, or you can check it directly on the \"My Complaints\" page.";
  }

  if (/how (do|can) i (submit|file|raise|report)|new complaint|file a complaint/.test(lower)) {
    return 'To file a complaint, go to "Submit Complaint" and give me a short title, a clear description of the problem, and the location. I\'ll suggest the right category, and the system will auto-assign an officer and set a priority-based deadline.';
  }

  if (/priority|sla|deadline|escalat/.test(lower)) {
    return 'Priority is decided from what you describe (urgent safety/health issues get top priority), and each priority has an SLA deadline. If an officer doesn\'t resolve it in time, it automatically escalates to a higher authority.';
  }

  const category = guessCategory(text);
  if (category !== 'Other' && text.length > 12) {
    return `That sounds like a **${category}** issue. If you'd like, go to "Submit Complaint" and I can help you turn this into a clear title, description, and location so it gets routed to the right department quickly.`;
  }

  return "I can help you file a complaint, check a complaint's status, or explain how priorities and escalation work. Could you tell me a bit more about what you need?";
}

async function callClaude(messages, systemPrompt = CHATBOT_SYSTEM_PROMPT, maxTokens = 700) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key') {
    throw new Error('AI chatbot is not configured on the server (missing ANTHROPIC_API_KEY).');
  }
  if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    throw new Error('AI chatbot is misconfigured: ANTHROPIC_API_KEY is not a valid Anthropic key (expected it to start with "sk-ant-"). Get a real key from https://console.anthropic.com/ and update backend-node/.env.');
  }
  try {
    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 30000
      }
    );

    const textBlock = (response.data.content || []).find(b => b.type === 'text');
    return textBlock ? textBlock.text : '';
  } catch (error) {
    const status = error.response?.status;
    const apiMessage = error.response?.data?.error?.message;
    if (status === 401) {
      throw new Error(`AI chatbot authentication failed (401) - ANTHROPIC_API_KEY was rejected by Anthropic. ${apiMessage || ''}`.trim());
    }
    if (status === 429) {
      throw new Error(`AI chatbot rate-limited (429) by Anthropic. ${apiMessage || ''}`.trim());
    }
    if (status) {
      throw new Error(`AI chatbot request failed (${status}). ${apiMessage || error.message}`.trim());
    }
    throw error;
  }
}

// General chatbot conversation (FAQ / guidance / department suggestions / free-form help)
// Auth is optional - logged-out visitors can still ask general FAQ questions.
app.post('/api/chatbot', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // If the user is authenticated, try to detect "status of complaint #123" style
    // questions and inject the real record so the AI never has to guess.
    let contextNote = '';
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY || 'your-secret-key');
        userId = decoded.id;
      } catch (e) { /* not logged in / expired token - continue as guest */ }
    }

    const idMatch = message.match(/#?(\d{1,10})/);
    if (userId && idMatch) {
      const [complaints] = await pool.query(
        'SELECT id, title, status, priority, category, created_at, sla_deadline FROM complaints WHERE id = ? AND user_id = ?',
        [idMatch[1], userId]
      );
      if (complaints.length > 0) {
        const c = complaints[0];
        contextNote = `\n\n[System context - real data, use this and do not contradict it]: Complaint #${c.id} "${c.title}" | status: ${c.status} | priority: ${c.priority} | category: ${c.category} | submitted: ${c.created_at} | SLA deadline: ${c.sla_deadline}`;
      }
    }

    const messages = [
      ...(Array.isArray(history) ? history.slice(-10).map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: String(h.content || '').slice(0, 4000)
      })) : []),
      { role: 'user', content: message + contextNote }
    ];

    let reply;
    try {
      reply = await callClaude(messages);
    } catch (aiError) {
      console.error('Chatbot AI call failed, using local fallback:', aiError.message);
      reply = localFallbackReply(message, contextNote);
    }

    if (userId) {
      await pool.query(
        'INSERT INTO chatbot_messages (user_id, role, message, created_at) VALUES (?, "user", ?, NOW())',
        [userId, message]
      );
      await pool.query(
        'INSERT INTO chatbot_messages (user_id, role, message, created_at) VALUES (?, "assistant", ?, NOW())',
        [userId, reply]
      );
    }

    res.json({ reply });
  } catch (error) {
    console.error('Chatbot error:', error.response?.data || error.message);
    // Even on an unexpected error, still give the citizen something useful
    // rather than a bare error message.
    res.json({ reply: localFallbackReply(req.body?.message || '', '') });
  }
});

// AI-assisted complaint submission: the citizen describes their problem in
// free text, Claude turns it into a structured complaint, and (if confirmed)
// it is filed automatically using the same logic as the manual form.
function heuristicDraftComplaint(conversation) {
  const text = conversation.trim().replace(/\s+/g, ' ');
  const category = guessCategory(text);

  const locationMatch = text.match(/\b(?:at|near|in|on)\s+([A-Z][\w\s,'-]{2,60})/);
  const location = locationMatch ? locationMatch[1].trim().replace(/[.,]$/, '') : '';

  const firstSentence = (text.match(/[^.!?]+[.!?]?/) || [text])[0].trim();
  const title = (firstSentence.length > 5 ? firstSentence : text).slice(0, 80);
  const description = text.slice(0, 400);

  const ready = text.length >= 20;
  return {
    title,
    description,
    category,
    location,
    ready,
    clarifying_question: ready ? '' : 'Could you describe the problem in a bit more detail, and let me know the location?'
  };
}

app.post('/api/chatbot/draft-complaint', authenticateToken, async (req, res) => {
  try {
    const { conversation } = req.body;
    if (!conversation || !conversation.trim()) {
      return res.status(400).json({ error: 'Conversation text is required' });
    }

    const extractionPrompt = `A citizen described a civic problem through a chatbot conversation. Extract a structured complaint from it.
Respond ONLY with valid JSON (no markdown, no commentary) in exactly this shape:
{"title": "short clear title (max 80 chars)", "description": "clear 1-3 sentence description of the problem", "category": "one of: Roads, Water, Electricity, Sanitation, Health, Safety, Transportation, Other", "location": "location mentioned, or empty string if none given", "ready": true or false, "clarifying_question": "a question to ask the citizen if more info is needed, else empty string"}

Conversation:
${conversation}`;

    let draft;
    try {
      const raw = await callClaude(
        [{ role: 'user', content: extractionPrompt }],
        'You are a data-extraction assistant. You only output strict JSON, nothing else.',
        400
      );
      const cleaned = raw.replace(/```json|```/g, '').trim();
      draft = JSON.parse(cleaned);
    } catch (aiError) {
      console.error('Draft-complaint AI call failed, using heuristic fallback:', aiError.message);
      draft = heuristicDraftComplaint(conversation);
    }

    res.json({ draft });
  } catch (error) {
    console.error('Draft complaint error:', error.response?.data || error.message);
    res.json({ draft: heuristicDraftComplaint(req.body?.conversation || '') });
  }
});

// Submit a complaint that the AI chatbot has drafted (after citizen confirms it)
app.post('/api/chatbot/submit-complaint', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, location } = req.body;
    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Title, description, and category are required' });
    }

    const priority = assignPriority(description, category);
    const slaDeadline = calculateSLADeadline(priority);
    const assignedOfficer = await autoAssignOfficer(category);

    const [result] = await pool.query(
      'INSERT INTO complaints (user_id, title, description, category, location, priority, status, assigned_to, sla_deadline, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [req.userId, title, description, category, location || null, priority, 'Pending', assignedOfficer, slaDeadline]
    );

    const [users] = await pool.query('SELECT name, email, phone FROM users WHERE id = ?', [req.userId]);
    const user = users[0];

    await createNotification(
      req.userId,
      result.insertId,
      `Your complaint "${title}" (filed via AI chatbot) has been submitted successfully with ${priority} priority.`,
      'success'
    );

    if (assignedOfficer) {
      await createNotification(
        assignedOfficer,
        result.insertId,
        `New ${priority} priority complaint assigned to you: "${title}"`,
        'info'
      );
    }

    await notifyAdminAboutComplaint({
      id: result.insertId,
      title,
      description,
      category,
      location,
      priority,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone
    });

    res.status(201).json({
      message: 'Complaint submitted successfully via AI assistant',
      complaint_id: result.insertId,
      priority,
      sla_deadline: slaDeadline
    });
  } catch (error) {
    console.error('AI submit complaint error:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

// Soft delete complaint
app.delete('/api/complaints/:id', authenticateToken, async (req, res) => {
  try {
    const [complaints] = await pool.query(
      'SELECT * FROM complaints WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = complaints[0];
    if (complaint.status !== 'Resolved' && complaint.status !== 'Closed') {
      return res.status(400).json({ error: 'Only resolved or closed complaints can be deleted' });
    }

    await pool.query(
      'UPDATE complaints SET is_deleted = TRUE WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({ error: 'Failed to delete complaint' });
  }
});

// Get single complaint
app.get('/api/complaints/:id', authenticateToken, async (req, res) => {
  try {
    const [complaints] = await pool.query(
      'SELECT * FROM complaints WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json({ complaint: complaints[0] });
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
});

// Admin Routes

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find admin user
    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, 'admin']);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET_KEY || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all complaints (Admin only)
app.get('/api/admin/complaints', authenticateToken, async (req, res) => {
  try {
    const [complaints] = await pool.query(`
      SELECT c.id, c.title, c.description, c.category, c.location, c.priority, c.status,
             c.created_at, c.updated_at,
             u.name as user_name, u.email as user_email, u.phone as user_phone
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `);

    res.json({ complaints });
  } catch (error) {
    console.error('Get all complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Get complaint statistics (Admin only)
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = "citizen"');
    const [totalOfficers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = "officer"');
    const [totalComplaints] = await pool.query('SELECT COUNT(*) as count FROM complaints');
    const [pendingComplaints] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE status = "Pending"');
    const [inProgressComplaints] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE status = "In Progress"');
    const [resolvedComplaints] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE status IN ("Resolved", "Closed")');
    const [escalatedComplaints] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE status = "Escalated"');
    const [highPriority] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE priority = "High"');
    const [mediumPriority] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE priority = "Medium"');
    const [lowPriority] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE priority = "Low"');

    // sla_deadline / resolved_at queries are safe-guarded — these columns may not exist
    // on databases that were created before the SLA feature was added. The ALTER TABLE
    // migration above adds them on next boot, but the query runs before that finishes
    // on the very first deploy with this code, so we catch and default to 0.
    let overdueCount = 0;
    try {
      const [overdueComplaints] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE sla_deadline < NOW() AND status NOT IN ("Resolved", "Closed")');
      overdueCount = overdueComplaints[0].count;
    } catch (e) { /* column not yet migrated */ }

    let avgHours = 0;
    try {
      const [avgResolution] = await pool.query(`
        SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours 
        FROM complaints 
        WHERE resolved_at IS NOT NULL
      `);
      avgHours = avgResolution[0].avg_hours ? Math.round(avgResolution[0].avg_hours) : 0;
    } catch (e) { /* column not yet migrated */ }

    res.json({
      stats: {
        totalUsers: totalUsers[0].count,
        totalOfficers: totalOfficers[0].count,
        totalComplaints: totalComplaints[0].count,
        pending: pendingComplaints[0].count,
        inProgress: inProgressComplaints[0].count,
        resolved: resolvedComplaints[0].count,
        escalated: escalatedComplaints[0].count,
        highPriority: highPriority[0].count,
        mediumPriority: mediumPriority[0].count,
        lowPriority: lowPriority[0].count,
        overdue: overdueCount,
        avgResolutionHours: avgHours
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Update complaint status (Admin only)
app.put('/api/admin/complaints/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const complaintId = req.params.id;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Get complaint details
    const [complaints] = await pool.query('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = complaints[0];
    const updateData = { status, updated_at: new Date() };

    // If resolved or closed, set resolved_at
    if (status === 'Resolved' || status === 'Closed') {
      updateData.resolved_at = new Date();
    }

    await pool.query(
      'UPDATE complaints SET status = ?, updated_at = NOW(), resolved_at = ? WHERE id = ?',
      [status, updateData.resolved_at || null, complaintId]
    );

    // Notify user about status change
    await createNotification(
      complaint.user_id,
      complaintId,
      `Your complaint #${complaintId} status has been updated to: ${status}`,
      status === 'Resolved' ? 'success' : 'info'
    );

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Admin: test email + SMS — calls the real send functions and reports success/failure
app.post('/api/admin/test-notifications', authenticateToken, async (req, res) => {
  const results = { email: null, sms: null, config: {} };

  results.config = {
    EMAIL_USER: process.env.EMAIL_USER || '(not set)',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD && process.env.EMAIL_PASSWORD !== 'your-app-password-here'
      ? '(set, length=' + process.env.EMAIL_PASSWORD.length + ')' : '(not set / placeholder)',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || '(not set)',
    ADMIN_PHONE: process.env.ADMIN_PHONE || '(not set)',
    FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY !== 'your-fast2sms-api-key'
      ? '(set, length=' + process.env.FAST2SMS_API_KEY.length + ')' : '(not set / placeholder)',
    FRONTEND_URL: process.env.FRONTEND_URL || '(not set)',
  };

  // Test email
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || process.env.EMAIL_PASSWORD === 'your-app-password-here') {
      results.email = 'SKIPPED: EMAIL_USER or EMAIL_PASSWORD not set on Render';
    } else {
      const transporter = createEmailTransporter();
      await transporter.verify();
      await transporter.sendMail({
        from: `"Grievance System" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: 'Test Notification from Grievance System',
        html: '<h2>Test email is working!</h2><p>Email notifications are configured correctly on Render.</p>'
      });
      results.email = 'SUCCESS: test email sent to ' + process.env.ADMIN_EMAIL;
    }
  } catch (e) {
    results.email = 'FAILED: ' + e.message;
  }

  // Test SMS
  try {
    if (!process.env.FAST2SMS_API_KEY || process.env.FAST2SMS_API_KEY === 'your-fast2sms-api-key') {
      results.sms = 'SKIPPED: FAST2SMS_API_KEY not set on Render';
    } else {
      const axios = require('axios');
      const r = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        route: 'v3',
        sender_id: 'TXTIND',
        message: 'Test SMS from Grievance System - notifications working!',
        language: 'english',
        flash: 0,
        numbers: process.env.ADMIN_PHONE
      }, {
        headers: { 'authorization': process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' }
      });
      results.sms = 'SUCCESS: ' + JSON.stringify(r.data);
    }
  } catch (e) {
    results.sms = 'FAILED: ' + (e.response ? JSON.stringify(e.response.data) : e.message);
  }

  res.json(results);
});

// Get notifications for user
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );

    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications error:', error);
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.userId]
    );

    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// Multer / file-upload error handler (must come after all routes that use `upload`)
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB per file.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err && err.message === 'Unsupported file type') {
    return res.status(400).json({ error: 'Unsupported file type. Allowed: images, PDF, Word documents, and text files.' });
  }
  next(err);
});

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve React app for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('✓ Grievance System Backend and Frontend Server Running');
    console.log(`✓ Server: http://localhost:${PORT}`);
    console.log(`✓ Health Check: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(60) + '\n');

    // Automatically open the application in the user's default browser
    try {
      require('child_process').exec(`start http://localhost:${PORT}`);
    } catch (e) {
      console.log('Could not automatically open the browser.');
    }
  });
});
