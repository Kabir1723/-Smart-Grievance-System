
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Mail, Lock, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Auth.css';

const OfficerLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/officer/login', formData);

      login(response.data.user, response.data.token);

      toast.success('Officer login successful!');
      navigate('/officer/dashboard');
    } catch (error) {
      console.error(
        'Officer login error:',
        error.response?.data || error.message
      );

      toast.error(
        error.response?.data?.error ||
        'Officer login failed. Please check your credentials or server connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-header">
          <Briefcase size={48} color="#667eea" />
          <h1>Officer Login</h1>
          <p>Access your assigned complaints</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>
              <Mail size={20} />
              Email
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter officer email"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Lock size={20} />
              Password
            </label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter officer password"
              autoComplete="current-password"
              required
            />
          </div>

          <motion.button
            type="submit"
            className="auth-button"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              'Logging in...'
            ) : (
              <>
                <Briefcase size={20} />
                Officer Login
              </>
            )}
          </motion.button>
        </form>

        <div className="auth-footer">
          <p>
            <a href="/login">Back to User Login</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default OfficerLogin;
