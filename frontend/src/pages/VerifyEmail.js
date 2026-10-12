import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { authAPI } from '../services/api';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    authAPI
      .verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed.');
      });
  }, [token]);

  return (
    <div className="auth-container">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center' }}
      >
        {status === 'loading' && (
          <>
            <Loader size={40} className="spin" />
            <h1>Verifying your email...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} color="#10b981" />
            <h1>Email Verified!</h1>
            <p>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} color="#ef4444" />
            <h1>Verification Failed</h1>
            <p>{message}</p>
          </>
        )}

        <div className="auth-footer" style={{ marginTop: '20px' }}>
          <Link to="/login">Go to login</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
