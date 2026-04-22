import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import NotifToasts from './components/NotifToasts';
import AuthPage from './pages/AuthPage';
import MovieList from './pages/MovieList';
import MyBookings from './pages/MyBookings';
import { useSSE } from './hooks/useSSE';

function AppInner() {
  const { user, loading } = useAuth();
  const { notifications, dismiss } = useSSE(user?.id);

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner"></div>
        <span>Đang tải...</span>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <NotifToasts notifications={notifications} onDismiss={dismiss} />
      <Routes>
        <Route path="/auth"      element={!user ? <AuthPage /> : <Navigate to="/" />} />
        <Route path="/"          element={user ? <MovieList />   : <Navigate to="/auth" />} />
        <Route path="/bookings"  element={user ? <MyBookings />  : <Navigate to="/auth" />} />
        <Route path="*"          element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </AuthProvider>
  );
}
