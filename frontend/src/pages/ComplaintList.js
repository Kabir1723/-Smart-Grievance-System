import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { ArrowLeft, Eye, AlertCircle, Trash2, Search, XCircle } from 'lucide-react';
import { complaintAPI } from '../services/api';
import SpotlightCard from '../components/SpotlightCard';
import './ComplaintList.css';

const ComplaintList = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('DESC');

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      if (category) params.category = category;
      if (priority) params.priority = priority;
      params.sort = sort;
      params.order = order;

      const response = await complaintAPI.getComplaints(params);
      setComplaints(response.data.complaints);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, category, priority, sort, order]);

  useEffect(() => {
    const timeout = setTimeout(fetchComplaints, 300); // debounce search
    return () => clearTimeout(timeout);
  }, [fetchComplaints]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to remove this complaint from your list?')) {
      try {
        await complaintAPI.deleteComplaint(id);
        fetchComplaints();
      } catch (error) {
        console.error('Error deleting complaint:', error);
      }
    }
  };

  const handleCancel = async (id) => {
    if (window.confirm('Cancel this complaint? This cannot be undone.')) {
      try {
        await complaintAPI.cancelComplaint(id);
        toast.success('Complaint cancelled');
        fetchComplaints();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to cancel complaint');
      }
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'High':
        return 'priority-high';
      case 'Medium':
        return 'priority-medium';
      case 'Low':
        return 'priority-low';
      default:
        return '';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Pending':
        return 'status-pending';
      case 'In Progress':
        return 'status-progress';
      case 'Resolved':
      case 'Closed':
        return 'status-resolved';
      case 'Escalated':
        return 'status-escalated';
      case 'Cancelled':
        return 'status-escalated';
      default:
        return '';
    }
  };

  return (
    <div className="complaint-list-container">
      <div className="complaint-list-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
      </div>

      <motion.div
        className="complaint-list-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="card-header">
          <h1>My Complaints</h1>
          <p>View and track all your submitted grievances</p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '20px',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-light)' }} />
            <input
              type="text"
              placeholder="Search complaints..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 10px 10px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e5e7eb)',
                background: 'var(--bg-white)',
                color: 'var(--text-dark)',
              }}
            />
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-select">
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
            <option value="Escalated">Escalated</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
            <option value="">All Categories</option>
            {['Water Supply', 'Electricity', 'Roads', 'Sanitation', 'Health', 'Safety', 'Education', 'Transportation', 'Other'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="filter-select">
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSort(s);
              setOrder(o);
            }}
            className="filter-select"
          >
            <option value="created_at-DESC">Newest First</option>
            <option value="created_at-ASC">Oldest First</option>
            <option value="priority-DESC">Priority (High-Low)</option>
            <option value="status-ASC">Status (A-Z)</option>
            <option value="title-ASC">Title (A-Z)</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={64} />
            <h3>No complaints found</h3>
            <p>Try adjusting your search or filters, or submit a new complaint</p>
            <button onClick={() => navigate('/submit-complaint')} className="submit-new-btn">
              Submit Your First Complaint
            </button>
          </div>
        ) : (
          <div className="complaints-grid">
            {complaints.map((complaint, index) => (
              <SpotlightCard
                as={motion.div}
                key={complaint.id}
                className="complaint-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="complaint-header">
                  <h3>{complaint.title}</h3>
                  <div className="badges">
                    <span className={`badge ${getPriorityClass(complaint.priority)}`}>
                      {complaint.priority}
                    </span>
                    <span className={`badge ${getStatusClass(complaint.status)}`}>
                      {complaint.status}
                    </span>
                  </div>
                </div>

                <div className="complaint-body">
                  <p className="category">Category: {complaint.category}</p>
                  {complaint.location && (
                    <p className="location">Location: {complaint.location}</p>
                  )}
                  <p className="description">{complaint.description}</p>
                  <p className="date">Submitted: {new Date(complaint.created_at).toLocaleDateString()}</p>
                </div>

                <div className="card-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(`/complaints/${complaint.id}`)}
                    className="view-btn"
                    style={{ flex: 1 }}
                  >
                    <Eye size={18} />
                    View Details
                  </button>

                  {['Pending', 'In Progress'].includes(complaint.status) && (
                    <button
                      onClick={() => handleCancel(complaint.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: '#fef3c7',
                        color: '#b45309',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        flex: 1,
                      }}
                    >
                      <XCircle size={18} />
                      Cancel
                    </button>
                  )}

                  {(complaint.status === 'Resolved' || complaint.status === 'Closed' || complaint.status === 'Cancelled') && (
                    <button
                      onClick={() => handleDelete(complaint.id)}
                      className="delete-btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        flex: 1,
                      }}
                    >
                      <Trash2 size={18} />
                      Delete
                    </button>
                  )}
                </div>
              </SpotlightCard>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ComplaintList;
