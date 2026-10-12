import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, List, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { complaintAPI } from '../services/api';
import NotificationBell from '../components/NotificationBell';
import SpotlightCard from '../components/SpotlightCard';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const response = await complaintAPI.getComplaints();
      const complaints = response.data.complaints;

      setStats({
        total: complaints.length,
        pending: complaints.filter(c => c.status === 'Pending').length,
        inProgress: complaints.filter(c => c.status === 'In Progress').length,
        resolved: complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length,
      });
    } catch (error) {
      console.error('Error fetching complaints:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
      },
    }),
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={28} />
            <h2 style={{ margin: 0 }}>VoiceIt</h2>
          </div>
        </div>
        <div className="nav-user">
          <NotificationBell token={token} />
          <button
            onClick={() => navigate('/profile')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            title="Profile"
          >
            <User size={20} />
            <span>{user?.name}</span>
          </button>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        <motion.div
          className="welcome-section"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Welcome, {user?.name}!</h1>
          <p>Manage your grievances and track their status</p>
        </motion.div>

        <div className="stats-grid">
          <SpotlightCard
            as={motion.div}
            className="stat-card"
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ scale: 1.05 }}
          >
            <div className="stat-icon total">
              <FileText size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.total}</h3>
              <p>Total Complaints</p>
            </div>
          </SpotlightCard>

          <SpotlightCard
            as={motion.div}
            className="stat-card"
            custom={1}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ scale: 1.05 }}
          >
            <div className="stat-icon pending">
              <FileText size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.pending}</h3>
              <p>Pending</p>
            </div>
          </SpotlightCard>

          <SpotlightCard
            as={motion.div}
            className="stat-card"
            custom={2}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ scale: 1.05 }}
          >
            <div className="stat-icon progress">
              <FileText size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.inProgress}</h3>
              <p>In Progress</p>
            </div>
          </SpotlightCard>

          <SpotlightCard
            as={motion.div}
            className="stat-card"
            custom={3}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ scale: 1.05 }}
          >
            <div className="stat-icon resolved">
              <FileText size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.resolved}</h3>
              <p>Resolved</p>
            </div>
          </SpotlightCard>
        </div>

        <div className="action-buttons">
          <motion.button
            className="action-btn primary"
            onClick={() => navigate('/submit-complaint')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus size={24} />
            Submit New Complaint
          </motion.button>

          <motion.button
            className="action-btn secondary"
            onClick={() => navigate('/complaints')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <List size={24} />
            View All Complaints
          </motion.button>

          <motion.button
            className="action-btn secondary"
            onClick={() => navigate('/profile')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <User size={24} />
            My Profile
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
