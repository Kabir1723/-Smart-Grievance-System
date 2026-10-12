import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await authAPI.login(formData);
            login(response.data.user, response.data.token);
            toast.success('Login successful!');
            onClose();
            navigate('/submit-complaint');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="auth-modal-overlay">
                    <motion.div
                        className="auth-modal-content auth-card"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <button className="close-btn" onClick={onClose} aria-label="Close">
                            <X size={24} />
                        </button>
                        <div className="auth-header" style={{ marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.8rem', color: 'var(--text-dark)', fontWeight: '700' }}>Login Required</h2>
                            <p style={{ color: 'var(--text-light)', marginTop: '8px' }}>You need to log in to submit a complaint</p>
                        </div>
                        <form onSubmit={handleSubmit} className="auth-form" style={{ marginBottom: 0 }}>
                            <div className="form-group">
                                <label><Mail size={18} /> Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label><Lock size={18} /> Password</label>
                                <input type="password" name="password" value={formData.password} onChange={handleChange} required />
                            </div>
                            <button type="submit" className="auth-button" disabled={loading} style={{ marginTop: '10px' }}>
                                {loading ? 'Logging in...' : <><LogIn size={18} /> Login to Continue</>}
                            </button>
                        </form>
                        <div className="auth-footer" style={{ marginTop: '24px', textAlign: 'center' }}>
                            <p>Don't have an account? <span onClick={() => { onClose(); navigate('/register'); }} style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '700' }}>Register here</span></p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
export default AuthModal;
