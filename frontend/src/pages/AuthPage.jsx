import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import config from '../config';

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (tab === 'register') {
        const res = await fetch(`${config.USER_SERVICE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');
        setSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
        setTab('login');
        setForm({ ...form, name: '' });
      } else {
        const res = await fetch(`${config.USER_SERVICE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');
        login(data.token, data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="icon">🎬</div>
          <h1>
            <span style={{ color: 'var(--text-primary)' }}>Cine</span>
            <span style={{ color: 'var(--accent-bright)' }}>Book</span>
          </h1>
          <p>Hệ thống đặt vé xem phim trực tuyến</p>
        </div>

        <div className="auth-tabs">
          <button
            id="tab-login"
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
          >
            Đăng nhập
          </button>
          <button
            id="tab-register"
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); setSuccess(''); }}
          >
            Đăng ký
          </button>
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}
        {success && <div className="success-msg">✅ {success}</div>}

        <form onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Họ và tên</label>
              <input
                id="auth-name"
                className="form-control"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="form-control"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="example@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Mật khẩu</label>
            <input
              id="auth-password"
              className="form-control"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder={tab === 'register' ? 'Ít nhất 6 ký tự' : '••••••••'}
              required
              minLength={6}
            />
          </div>

          <button
            id="auth-submit"
            type="submit"
            className="btn btn-primary w-full btn-lg"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading
              ? '⏳ Đang xử lý...'
              : tab === 'login'
                ? '🚀 Đăng nhập'
                : '✨ Tạo tài khoản'
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {tab === 'login'
            ? <>Chưa có tài khoản? <button style={{ background: 'none', border: 'none', color: 'var(--accent-bright)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setTab('register')}>Đăng ký ngay</button></>
            : <>Đã có tài khoản? <button style={{ background: 'none', border: 'none', color: 'var(--accent-bright)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setTab('login')}>Đăng nhập</button></>
          }
        </p>
      </div>
    </div>
  );
}
