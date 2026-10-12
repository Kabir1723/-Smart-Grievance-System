import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { ArrowLeft, Send, FileText, Tag, MapPin, Upload, X, MessageCircle } from 'lucide-react';
import { complaintAPI } from '../services/api';
import './SubmitComplaint.css';

const SubmitComplaint = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const categories = [
    'Water Supply',
    'Electricity',
    'Roads',
    'Sanitation',
    'Health',
    'Safety',
    'Education',
    'Transportation',
    'Other',
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length + files.length > 5) {
      toast.error('You can upload a maximum of 5 files');
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await complaintAPI.submitComplaint(formData);
      const complaintId = response.data.complaint_id;

      if (files.length > 0) {
        try {
          await complaintAPI.uploadAttachments(complaintId, files);
        } catch (uploadErr) {
          toast.warn('Complaint submitted, but some files failed to upload.');
        }
      }

      toast.success(`Complaint submitted successfully! Priority: ${response.data.priority}`);
      navigate('/complaints');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit complaint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="submit-complaint-container">
      <div className="submit-complaint-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
      </div>

      <motion.div
        className="submit-complaint-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="card-header">
          <FileText size={32} />
          <h1>Submit New Complaint</h1>
          <p>Fill in the details below to submit your grievance</p>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '13px', color: 'var(--text-light)' }}>
          <MessageCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Prefer to describe your issue in plain language? Use the AI chat assistant (bottom-right) to file this complaint conversationally.
        </div>

        <form onSubmit={handleSubmit} className="complaint-form">
          <div className="form-group">
            <label>
              <FileText size={20} />
              Complaint Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Brief title of your complaint"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Tag size={20} />
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              <MapPin size={20} />
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Location of the issue"
            />
          </div>

          <div className="form-group">
            <label>
              <FileText size={20} />
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your complaint in detail..."
              rows="6"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Upload size={20} />
              Attach Images / Documents (optional, up to 5 files)
            </label>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
            />
            {files.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {files.map((f, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--bg-app, #f3f4f6)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '12px',
                    }}
                  >
                    {f.name}
                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => removeFile(idx)} />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <motion.button
              type="button"
              className="cancel-btn"
              onClick={() => navigate('/dashboard')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel
            </motion.button>

            <motion.button
              type="submit"
              className="submit-btn"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                'Submitting...'
              ) : (
                <>
                  <Send size={20} />
                  Submit Complaint
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SubmitComplaint;
