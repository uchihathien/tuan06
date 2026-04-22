import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/auth');
  }

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="logo-icon">🎬</span>
        <span>
          <span className="logo-text">Cine</span>
          <span className="logo-accent">Book</span>
        </span>
      </Link>

      {user && (
        <div className="navbar-nav">
          <Link to="/" className={`nav-link ${isActive('/')}`}>🎥 Phim</Link>
          <Link to="/bookings" className={`nav-link ${isActive('/bookings')}`}>🎫 Vé của tôi</Link>
        </div>
      )}

      <div className="nav-user">
        {user ? (
          <>
            <div className="nav-avatar" title={user.name}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {user.name}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Đăng xuất
            </button>
          </>
        ) : (
          <Link to="/auth" className="btn btn-primary btn-sm">Đăng nhập</Link>
        )}
      </div>
    </nav>
  );
}
