import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Briefcase, LogOut, Clock, CheckCircle, TrendingUp, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import SpotlightCard from '../components/SpotlightCard';
import api from '../services/api';
import './OfficerDashboard.css';

const OfficerDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setFetchError(null);
    try {
      const complaintsRes = await api.get('/officer/complaints');
      const allComplaints = complaintsRes.data.complaints || [];
      setComplaints(allComplaints);

      // Try server-side stats first; fall back to client-side computation
      let serverStats = null;
      try {
        const statsRes = await api.get('/officer/stats');
        serverStats = statsRes.data.stats;
      } catch (statsErr) {
        console.warn('Officer stats endpoint unavailable, computing from complaints:', statsErr.response?.status);
      }

      if (serverStats) {
        setStats({
          total: serverStats.total || 0,
          pending: serverStats.pending || 0,
          inProgress: serverStats.inProgress || 0,
          resolved: serverStats.resolved || 0,
        });
      } else {
        setStats({
          total: allComplaints.length,
          pending: allComplaints.filter(c => c.status === 'Pending').length,
          inProgress: allComplaints.filter(c => c.status === 'In Progress').length,
          resolved: allComplaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length,
        });
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      const status = error.response?.status;
      console.error('Error fetching officer data:', status, msg, error);
      setFetchError(`Failed to load data (${status || 'network error'}): ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (complaintId, newStatus) => {
    try {
      await api.put(`/officer/complaints/${complaintId}/status`, { status: newStatus });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/officer/login');
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return '';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'In Progress': return 'status-progress';
      case 'Resolved':
      case 'Closed': return 'status-resolved';
      case 'Escalated': return 'status-escalated';
      default: return '';
    }
  };

  return (
    <div className="officer-dashboard-container">
      <nav className="officer-nav">
        <div className="nav-brand">
          <Briefcase size={28} />
          <h2>Officer Dashboard</h2>
        </div>
        <div className="nav-user">
          <NotificationBell token={token} />
          <Briefcase size={20} />
          <span>{user?.name}</span>
          {user?.department && (
            <span className="department-badge">{user.department}</span>
          )}
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="officer-content">
        <motion.div
          className="welcome-section"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Welcome, {user?.name}!</h1>
          <p>Manage and resolve your assigned complaints</p>
        </motion.div>

        {fetchError && (
          <div style={{
            background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '16px', color: '#b91c1c', fontSize: '14px'
          }}>
            ⚠ {fetchError} — <button onClick={fetchData} style={{ color: '#b91c1c', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        <div className="stats-grid">
          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className="stat-icon total">
              <FileText size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.total}</h3>
              <p>Total Assigned</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="stat-icon pending">
              <Clock size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.pending}</h3>
              <p>Pending</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="stat-icon progress">
              <TrendingUp size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.inProgress}</h3>
              <p>In Progress</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <div className="stat-icon resolved">
              <CheckCircle size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.resolved}</h3>
              <p>Resolved</p>
            </div>
          </SpotlightCard>
        </div>

        <motion.div
          className="complaints-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2>Assigned Complaints</h2>

          {loading ? (
            <div className="loading">Loading complaints...</div>
          ) : complaints.length === 0 ? (
            <div className="empty-state">No complaints assigned to you yet</div>
          ) : (
            <div className="complaints-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Citizen</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => (
                    <tr key={complaint.id}>
                      <td>{complaint.id}</td>
                      <td>{complaint.title}</td>
                      <td>{complaint.category}</td>
                      <td>
                        <span className={`badge ${getPriorityClass(complaint.priority)}`}>
                          {complaint.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusClass(complaint.status)}`}>
                          {complaint.status}
                        </span>
                      </td>
                      <td>
                        <div className="user-info">
                          <strong>{complaint.user_name}</strong>
                          <small>{complaint.user_email}</small>
                        </div>
                      </td>
                      <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                      <td>
                        <select
                          value={complaint.status}
                          onChange={(e) => handleStatusChange(complaint.id, e.target.value)}
                          className="status-select"
                        >
                          <option value="Pending" disabled>Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default OfficerDashboard;
