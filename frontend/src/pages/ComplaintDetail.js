import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  ArrowLeft, FileText, Tag, MapPin, Calendar, AlertCircle, Trash2,
  Upload, Paperclip, Download, XCircle, RotateCcw, Star
} from 'lucide-react';
import { API_ORIGIN, complaintAPI } from '../services/api';
import './ComplaintDetail.css';

const ComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    fetchComplaint();
    fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchComplaint = async () => {
    try {
      const response = await complaintAPI.getComplaint(id);
      setComplaint(response.data.complaint);
    } catch (error) {
      console.error('Error fetching complaint:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async () => {
    try {
      const response = await complaintAPI.getAttachments(id);
      setAttachments(response.data.attachments);
    } catch (error) {
      // Non-fatal - attachments are optional
    }
  };

  const handleDelete = async (complaintId) => {
    if (window.confirm('Are you sure you want to remove this complaint from your view?')) {
      try {
        await complaintAPI.deleteComplaint(complaintId);
        navigate('/complaints');
      } catch (error) {
        console.error('Error deleting complaint:', error);
      }
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Cancel this complaint? This cannot be undone.')) {
      try {
        await complaintAPI.cancelComplaint(id);
        toast.success('Complaint cancelled');
        fetchComplaint();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to cancel complaint');
      }
    }
  };

  const handleReopen = async () => {
    const reason = window.prompt('Why would you like to reopen this complaint?', 'Issue is not fully resolved');
    if (reason === null) return;
    try {
      await complaintAPI.reopenComplaint(id, reason);
      toast.success('Complaint reopened');
      fetchComplaint();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reopen complaint');
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await complaintAPI.uploadAttachments(id, files);
      toast.success('Files uploaded successfully');
      fetchAttachments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload files');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleFeedbackSubmit = async () => {
    setSubmittingFeedback(true);
    try {
      await complaintAPI.submitFeedback(id, rating, feedbackComment);
      toast.success('Thank you for your feedback!');
      setFeedbackComment('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
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
      case 'Cancelled':
        return 'status-escalated';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="complaint-detail-container">
        <div className="loading">Loading complaint details...</div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="complaint-detail-container">
        <div className="error-state">
          <AlertCircle size={64} />
          <h3>Complaint not found</h3>
          <button onClick={() => navigate('/complaints')} className="back-btn">
            Back to Complaints
          </button>
        </div>
      </div>
    );
  }

  const isPending = complaint.status === 'Pending';
  const isCancellable = ['Pending', 'In Progress'].includes(complaint.status);
  const isResolved = ['Resolved', 'Closed'].includes(complaint.status);

  return (
    <div className="complaint-detail-container">
      <div className="complaint-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={() => navigate('/complaints')} className="back-btn">
          <ArrowLeft size={20} />
          Back to Complaints
        </button>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {isCancellable && (
            <button
              onClick={handleCancel}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', background: '#fef3c7',
                color: '#b45309', border: 'none', padding: '10px 16px', borderRadius: '4px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <XCircle size={18} /> Cancel Complaint
            </button>
          )}
          {isResolved && (
            <button
              onClick={handleReopen}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', background: '#e0e7ff',
                color: '#4338ca', border: 'none', padding: '10px 16px', borderRadius: '4px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <RotateCcw size={18} /> Reopen
            </button>
          )}
          {(isResolved || complaint.status === 'Cancelled') && (
            <button
              onClick={() => handleDelete(complaint.id)}
              className="delete-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', background: '#fee2e2',
                color: '#dc2626', border: 'none', padding: '10px 16px', borderRadius: '4px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Trash2 size={18} /> Delete Complaint
            </button>
          )}
        </div>
      </div>

      <motion.div
        className="complaint-detail-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="detail-header">
          <div className="header-content">
            <h1>{complaint.title}</h1>
            <div className="badges">
              <span className={`badge ${getPriorityClass(complaint.priority)}`}>
                {complaint.priority} Priority
              </span>
              <span className={`badge ${getStatusClass(complaint.status)}`}>
                {complaint.status}
              </span>
              {isPending && <span className="badge">Editable</span>}
            </div>
          </div>
        </div>

        <div className="detail-body">
          <div className="info-section">
            <div className="info-item">
              <Tag size={20} />
              <div>
                <label>Category</label>
                <p>{complaint.category}</p>
              </div>
            </div>

            {complaint.location && (
              <div className="info-item">
                <MapPin size={20} />
                <div>
                  <label>Location</label>
                  <p>{complaint.location}</p>
                </div>
              </div>
            )}

            <div className="info-item">
              <Calendar size={20} />
              <div>
                <label>Submitted On</label>
                <p>{new Date(complaint.created_at).toLocaleString()}</p>
              </div>
            </div>

            {complaint.updated_at && (
              <div className="info-item">
                <Calendar size={20} />
                <div>
                  <label>Last Updated</label>
                  <p>{new Date(complaint.updated_at).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          <div className="description-section">
            <div className="section-header">
              <FileText size={24} />
              <h2>Description</h2>
            </div>
            <p>{complaint.description}</p>
          </div>

          {/* Attachments */}
          <div className="description-section">
            <div className="section-header">
              <Paperclip size={24} />
              <h2>Attachments</h2>
            </div>
            {attachments.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                {attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`${API_ORIGIN}${a.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none',
                      background: 'var(--bg-app, #f3f4f6)', border: '1px solid var(--border-color, #e5e7eb)',
                      borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-dark, #1f2937)'
                    }}
                  >
                    <Download size={14} /> {a.original_name}
                  </a>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-light)', fontSize: '13px' }}>No files attached yet.</p>
            )}
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                color: '#667eea', fontSize: '13px', fontWeight: 600
              }}
            >
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload images / documents'}
              <input type="file" multiple hidden onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          <div className="status-timeline">
            <h3>Status Timeline</h3>
            <div className="timeline">
              <div className="timeline-item active">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <h4>Complaint Submitted</h4>
                  <p>{new Date(complaint.created_at).toLocaleString()}</p>
                </div>
              </div>

              {complaint.status !== 'Pending' && (
                <div className="timeline-item active">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <h4>Status: {complaint.status}</h4>
                    <p>{complaint.updated_at ? new Date(complaint.updated_at).toLocaleString() : 'In progress'}</p>
                  </div>
                </div>
              )}

              {isResolved && complaint.resolved_at && (
                <div className="timeline-item active">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <h4>Complaint Resolved</h4>
                    <p>{new Date(complaint.resolved_at).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Feedback */}
          {isResolved && (
            <div className="description-section">
              <div className="section-header">
                <Star size={24} />
                <h2>Rate This Resolution</h2>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={26}
                    fill={n <= rating ? '#f59e0b' : 'none'}
                    color="#f59e0b"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setRating(n)}
                  />
                ))}
              </div>
              <textarea
                rows={3}
                placeholder="Add comments about the resolution (optional)"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--border-color, #e5e7eb)', marginBottom: '10px',
                  background: 'var(--bg-white)', color: 'var(--text-dark)'
                }}
              />
              <button
                onClick={handleFeedbackSubmit}
                disabled={submittingFeedback}
                style={{
                  background: '#667eea', color: 'white', border: 'none', padding: '10px 18px',
                  borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ComplaintDetail;
