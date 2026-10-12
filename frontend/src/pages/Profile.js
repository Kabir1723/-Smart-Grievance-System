import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { ArrowLeft, User, Lock, Bell, Save, CheckCircle } from 'lucide-react';
import { profileAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';
import './Dashboard.css';

const Profile = () => {
  const navigate = useNavigate();
  const { login, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({ name: '', phone: '', address: '', email: '', is_verified: false });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [prefs, setPrefs] = useState({ emailNotifications: true, inappNotifications: true });

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await profileAPI.getProfile();
      const u = res.data.user;
      setProfile({ name: u.name, phone: u.phone, address: u.address || '', email: u.email, is_verified: !!u.is_verified });
      setPrefs({
        emailNotifications: !!u.email_notifications,
        inappNotifications: !!u.inapp_notifications,
      });
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await profileAPI.updateProfile({ name: profile.name, phone: profile.phone, address: profile.address });
      // Keep local auth user in sync
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      login({ ...storedUser, name: profile.name }, token);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await profileAPI.changePassword(passwords.currentPassword, passwords.newPassword);
      toast.success('Password changed successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handlePrefsSave = async () => {
    setSaving(true);
    try {
      await profileAPI.updateNotificationPreferences(prefs.emailNotifications, prefs.inappNotifications);
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await authAPI.resendVerification(profile.email);
      toast.info('Verification email sent (if not already verified).');
    } catch (error) {
      toast.error('Failed to resend verification email');
    }
  };

  if (loading) {
    return <div className="dashboard-container"><p style={{ padding: 40 }}>Loading profile...</p></div>;
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'inherit' }}>
            <ArrowLeft size={22} /> Back
          </button>
        </div>
      </nav>

      <div className="dashboard-content" style={{ maxWidth: 720, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="welcome-section">
          <h1>My Profile</h1>
          <p>Manage your account details, password, and notification preferences</p>
        </motion.div>

        {/* Edit profile */}
        <motion.div className="auth-card" style={{ margin: '20px 0' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="auth-header" style={{ textAlign: 'left' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><User size={20} /> Edit Profile</h2>
          </div>
          <form onSubmit={handleProfileSave} className="auth-form">
            <div className="form-group">
              <label>Full Name</label>
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Email {profile.is_verified ? <CheckCircle size={14} color="#10b981" style={{ verticalAlign: 'middle' }} /> : (
                <button type="button" onClick={handleResendVerification} style={{ marginLeft: 8, fontSize: 12, color: '#667eea', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  (unverified - resend link)
                </button>
              )}</label>
              <input value={profile.email} disabled />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
            </div>
            <motion.button type="submit" className="auth-button" disabled={saving} whileHover={{ scale: 1.02 }}>
              <Save size={18} /> Save Profile
            </motion.button>
          </form>
        </motion.div>

        {/* Change password */}
        <motion.div className="auth-card" style={{ margin: '20px 0' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="auth-header" style={{ textAlign: 'left' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={20} /> Change Password</h2>
          </div>
          <form onSubmit={handlePasswordChange} className="auth-form">
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" minLength={6} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" minLength={6} value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} required />
            </div>
            <motion.button type="submit" className="auth-button" disabled={saving} whileHover={{ scale: 1.02 }}>
              <Lock size={18} /> Change Password
            </motion.button>
          </form>
        </motion.div>

        {/* Notification preferences */}
        <motion.div className="auth-card" style={{ margin: '20px 0' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="auth-header" style={{ textAlign: 'left' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={20} /> Notification Preferences</h2>
          </div>
          <div className="auth-form">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={prefs.emailNotifications}
                onChange={(e) => setPrefs({ ...prefs, emailNotifications: e.target.checked })}
              />
              Email notifications
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <input
                type="checkbox"
                checked={prefs.inappNotifications}
                onChange={(e) => setPrefs({ ...prefs, inappNotifications: e.target.checked })}
              />
              In-app notifications
            </label>
            <motion.button type="button" className="auth-button" style={{ marginTop: 20 }} disabled={saving} onClick={handlePrefsSave} whileHover={{ scale: 1.02 }}>
              <Save size={18} /> Save Preferences
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
