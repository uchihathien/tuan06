import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config';

const STATUS_MAP = {
  pending:   { label: '⏳ Đang xử lý', cls: 'badge-pending' },
  confirmed: { label: '✅ Thành công',  cls: 'badge-success' },
  failed:    { label: '❌ Thất bại',    cls: 'badge-error' },
};

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchBookings();
    // Auto-refresh every 5s to catch status updates
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchBookings() {
    try {
      const res = await fetch(`${config.BOOKING_SERVICE}/bookings?userId=${user.id}`);
      const data = await res.json();
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === 'all'
    ? bookings
    : bookings.filter((b) => b.status === filter);

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    failed: bookings.filter(b => b.status === 'failed').length,
  };

  return (
    <main>
      <div className="page-hero">
        <h1>🎫 Vé Của Tôi</h1>
        <p>Lịch sử đặt vé và trạng thái thanh toán của {user.name}</p>
      </div>

      <div className="container" style={{ paddingBottom: '60px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: '📋 Tất cả' },
            { key: 'pending',   label: '⏳ Đang xử lý' },
            { key: 'confirmed', label: '✅ Thành công' },
            { key: 'failed',    label: '❌ Thất bại' },
          ].map(({ key, label }) => (
            <button
              key={key}
              id={`filter-${key}`}
              className={`genre-pill ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label} <span style={{ opacity: 0.6 }}>({counts[key]})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-wrap">
            <div className="spinner"></div>
            <span>Đang tải...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎭</div>
            <h3>Chưa có vé nào</h3>
            <p>Hãy chọn phim và đặt vé ngay!</p>
          </div>
        ) : (
          <div className="booking-list">
            {filtered.map((b) => {
              const st = STATUS_MAP[b.status] || STATUS_MAP.pending;
              return (
                <div key={b.id} className="booking-item" id={`booking-${b.id}`}>
                  {b.poster_url ? (
                    <img
                      className="booking-thumb"
                      src={b.poster_url}
                      alt={b.movie_title}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="booking-thumb-placeholder">🎞️</div>
                  )}

                  <div className="booking-info">
                    <h3>{b.movie_title}</h3>
                    <p>{b.genre} · {b.duration} phút</p>
                    <p style={{ marginTop: '4px' }}>
                      🪑 {b.seats} ghế ·{' '}
                      <strong style={{ color: 'var(--accent-bright)' }}>
                        {Number(b.total_price).toLocaleString('vi-VN')}đ
                      </strong>
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      #{b.id} · {new Date(b.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {b.status === 'pending' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="animate-pulse">
                        Đang chờ...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button
              id="refresh-bookings"
              className="btn btn-ghost btn-sm"
              onClick={fetchBookings}
            >
              🔄 Làm mới
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
