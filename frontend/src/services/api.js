import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post('/register', userData),
  login: (credentials) => api.post('/login', credentials),
  verifyEmail: (token) => api.get(`/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (email) => api.post('/resend-verification', { email }),
  forgotPassword: (email) => api.post('/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/reset-password', { token, newPassword }),
};

export const profileAPI = {
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
  changePassword: (currentPassword, newPassword) =>
    api.put('/profile/change-password', { currentPassword, newPassword }),
  updateNotificationPreferences: (emailNotifications, inappNotifications) =>
    api.put('/profile/notification-preferences', { emailNotifications, inappNotifications }),
};

export const complaintAPI = {
  submitComplaint: (complaintData) => api.post('/complaints', complaintData),
  getComplaints: (params = {}) => api.get('/complaints', { params }),
  getComplaint: (id) => api.get(`/complaints/${id}`),
  editComplaint: (id, data) => api.put(`/complaints/${id}`, data),
  deleteComplaint: (id) => api.delete(`/complaints/${id}`),
  cancelComplaint: (id) => api.put(`/complaints/${id}/cancel`),
  reopenComplaint: (id, reason) => api.put(`/complaints/${id}/reopen`, { reason }),
  uploadAttachments: (id, files) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    return api.post(`/complaints/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAttachments: (id) => api.get(`/complaints/${id}/attachments`),
  submitFeedback: (id, rating, comment) => api.post(`/complaints/${id}/feedback`, { rating, comment }),
};

export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

export const chatbotAPI = {
  sendMessage: (message, history = []) => api.post('/chatbot', { message, history }),
  draftComplaint: (conversation) => api.post('/chatbot/draft-complaint', { conversation }),
  submitComplaint: (draft) => api.post('/chatbot/submit-complaint', draft),
};

export default api;
