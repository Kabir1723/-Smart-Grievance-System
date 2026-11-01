import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to the correct login page based on the current path
    const path = window.location.pathname;
    if (path.startsWith('/officer')) return <Navigate to="/officer/login" />;
    if (path.startsWith('/admin')) return <Navigate to="/admin/login" />;
    return <Navigate to="/login" />;
  }

  return children;
};

export default PrivateRoute;
