import React, { useEffect, useState } from 'react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Users, LogOut, Shield, TrendingUp, AlertCircle, CheckCircle, Clock, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import SpotlightCard from '../components/SpotlightCard';
import api from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOfficers: 0,
    totalComplaints: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    escalated: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    overdue: 0,
    avgResolutionHours: 0
  });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setFetchError(null);
    try {
      const [statsRes, complaintsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/complaints')
      ]);

      setStats(statsRes.data.stats);
      setComplaints(complaintsRes.data.complaints);
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      const status = error.response?.status;
      console.error('Error fetching admin data:', status, msg, error);
      setFetchError(`Failed to load data (${status || 'network error'}): ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (complaintId, newStatus) => {
    try {
      await api.put(
        `/admin/complaints/${complaintId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const viewComplaintHistory = (complaint) => {
    setSelectedComplaint(complaint);
    setShowHistory(true);
  };

  const closeHistory = () => {
    setShowHistory(false);
    setSelectedComplaint(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
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
    <div className="admin-dashboard-container">
      <nav className="admin-nav">
        <div className="nav-brand">
          <Shield size={28} />
          <h2>Admin Dashboard</h2>
        </div>
        <div className="nav-user">
          <NotificationBell token={token} />
          <Shield size={20} />
          <span>{user?.name}</span>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="admin-content">
        <motion.div
          className="welcome-section"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Welcome, Admin!</h1>
          <p>Manage all grievances and monitor system statistics</p>
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
            <div className="stat-icon users">
              <Users size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.totalUsers}</h3>
              <p>Total Users</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <div className="stat-icon users">
              <Shield size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.totalOfficers}</h3>
              <p>Officers</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="stat-icon total">
              <FileText size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.totalComplaints}</h3>
              <p>Total Complaints</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="stat-icon pending">
              <Clock size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.pending}</h3>
              <p>Pending</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <div className="stat-icon progress">
              <TrendingUp size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.inProgress}</h3>
              <p>In Progress</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <div className="stat-icon resolved">
              <CheckCircle size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.resolved}</h3>
              <p>Resolved</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
            <div className="stat-icon escalated">
              <AlertCircle size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.escalated}</h3>
              <p>Escalated</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <div className="stat-icon high">
              <AlertCircle size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.highPriority}</h3>
              <p>High Priority</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
            <div className="stat-icon overdue">
              <Clock size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.overdue}</h3>
              <p>Overdue (SLA)</p>
            </div>
          </SpotlightCard>

          <SpotlightCard as={motion.div} className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <div className="stat-icon avg">
              <TrendingUp size={32} />
            </div>
            <div className="stat-info">
              <h3>{stats.avgResolutionHours}h</h3>
              <p>Avg Resolution</p>
            </div>
          </SpotlightCard>
        </div>

        <motion.div
          className="complaints-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h2>All Complaints</h2>
          
          {loading ? (
            <div className="loading">Loading complaints...</div>
          ) : complaints.length === 0 ? (
            <div className="empty-state">No complaints found</div>
          ) : (
            <div className="complaints-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>SLA Deadline</th>
                    <th>Date</th>
                    <th>Action</th>
                    <th>History</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => (
                    <tr key={complaint.id}>
                      <td>{complaint.id}</td>
                      <td>
                        <div className="user-info">
                          <strong>{complaint.user_name}</strong>
                          <small>{complaint.user_email}</small>
                        </div>
                      </td>
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
                        {complaint.sla_deadline ? (
                          <span className={new Date(complaint.sla_deadline) < new Date() && complaint.status !== 'Resolved' && complaint.status !== 'Closed' ? 'sla-overdue' : 'sla-normal'}>
                            {new Date(complaint.sla_deadline).toLocaleString()}
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                      <td>
                        <select
                          value={complaint.status}
                          onChange={(e) => handleStatusChange(complaint.id, e.target.value)}
                          className="status-select"
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                          <option value="Escalated">Escalated</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => viewComplaintHistory(complaint)}
                          className="history-btn"
                          title="View History"
                        >
                          <History size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {showHistory && selectedComplaint && (
        <div className="modal-overlay" onClick={closeHistory}>
          <motion.div
            className="history-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="modal-header">
              <h2>
                <History size={24} />
                Complaint History
              </h2>
              <button onClick={closeHistory} className="close-btn">×</button>
            </div>

            <div className="modal-content">
              <div className="history-section">
                <h3>Complaint Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>ID:</strong>
                    <span>{selectedComplaint.id}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Title:</strong>
                    <span>{selectedComplaint.title}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Category:</strong>
                    <span>{selectedComplaint.category}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Priority:</strong>
                    <span className={`badge ${getPriorityClass(selectedComplaint.priority)}`}>
                      {selectedComplaint.priority}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Current Status:</strong>
                    <span className={`badge ${getStatusClass(selectedComplaint.status)}`}>
                      {selectedComplaint.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Location:</strong>
                    <span>{selectedComplaint.location || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="history-section">
                <h3>User Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Name:</strong>
                    <span>{selectedComplaint.user_name}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Email:</strong>
                    <span>{selectedComplaint.user_email}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Phone:</strong>
                    <span>{selectedComplaint.user_phone}</span>
                  </div>
                </div>
              </div>

              <div className="history-section">
                <h3>Description</h3>
                <p className="description-text">{selectedComplaint.description}</p>
              </div>

              <div className="history-section">
                <h3>Timeline</h3>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-dot created"></div>
                    <div className="timeline-content">
                      <strong>Complaint Created</strong>
                      <span>{new Date(selectedComplaint.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {selectedComplaint.updated_at && (
                    <div className="timeline-item">
                      <div className="timeline-dot updated"></div>
                      <div className="timeline-content">
                        <strong>Last Updated</strong>
                        <span>{new Date(selectedComplaint.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedComplaint.resolved_at && (
                    <div className="timeline-item">
                      <div className="timeline-dot resolved"></div>
                      <div className="timeline-content">
                        <strong>Resolved</strong>
                        <span>{new Date(selectedComplaint.resolved_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
