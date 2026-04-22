import { useState } from 'react';
import config from '../config';

export default function BookingModal({ movie, user, onClose, onSuccess }) {
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(null);

  const totalPrice = Number(movie.price) * seats;

  async function handleBook() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${config.BOOKING_SERVICE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          movieId: movie.id,
          seats,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đặt vé thất bại');
      setBooked(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !booked && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>{booked ? '✅ Đặt vé thành công!' : '🎫 Đặt vé'}</h2>
          <button
            className="modal-close"
            id="booking-modal-close"
            onClick={() => booked ? onSuccess() : onClose()}
          >✕</button>
        </div>

        <div className="modal-body">
          {booked ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Booking #{booked.bookingId}</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Thanh toán đang được xử lý. Bạn sẽ nhận thông báo trong vài giây!
              </p>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '20px', textAlign: 'left', marginBottom: '24px' }}>
                <div className="info-row">
                  <span className="label">Phim</span>
                  <span className="value">{movie.title}</span>
                </div>
                <div className="info-row">
                  <span className="label">Số ghế</span>
                  <span className="value">{booked.seats} ghế</span>
                </div>
                <div className="info-row">
                  <span className="label">Trạng thái</span>
                  <span className="badge badge-pending">⏳ Đang xử lý</span>
                </div>
                <div className="price-total">
                  <span>Tổng tiền</span>
                  <span className="amount">{Number(booked.totalPrice).toLocaleString('vi-VN')}đ</span>
                </div>
              </div>

              <button id="booking-done-btn" className="btn btn-primary w-full" onClick={onSuccess}>
                🎬 Xem danh sách phim
              </button>
            </div>
          ) : (
            /* ── Booking form ── */
            <>
              {/* Movie info */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                {movie.poster_url && (
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    style={{ width: '80px', height: '110px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                  />
                )}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>{movie.title}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    ⭐ {movie.rating} · {movie.genre} · {movie.duration} phút
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    🪑 Còn {movie.seats_available} ghế trống
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-bright)', marginTop: '6px' }}>
                    {Number(movie.price).toLocaleString('vi-VN')}đ / ghế
                  </p>
                </div>
              </div>

              {/* Description */}
              {movie.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                  {movie.description}
                </p>
              )}

              {/* Seat selector */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px' }}>
                <label className="form-label">Chọn số ghế</label>
                <div className="seat-selector">
                  <button
                    id="seat-minus"
                    className="seat-btn"
                    onClick={() => setSeats(Math.max(1, seats - 1))}
                    disabled={seats <= 1}
                  >−</button>
                  <span className="seat-num">{seats}</span>
                  <button
                    id="seat-plus"
                    className="seat-btn"
                    onClick={() => setSeats(Math.min(10, movie.seats_available, seats + 1))}
                    disabled={seats >= 10 || seats >= movie.seats_available}
                  >+</button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    (tối đa {Math.min(10, movie.seats_available)} ghế)
                  </span>
                </div>

                <div className="price-total" style={{ marginTop: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tổng tiền</span>
                  <span className="amount">{totalPrice.toLocaleString('vi-VN')}đ</span>
                </div>
              </div>

              {error && <div className="error-msg" style={{ marginBottom: '16px' }}>⚠️ {error}</div>}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  id="booking-cancel"
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={onClose}
                >
                  Hủy
                </button>
                <button
                  id="booking-confirm"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  onClick={handleBook}
                  disabled={loading || movie.seats_available < 1}
                >
                  {loading ? '⏳ Đang xử lý...' : `🎫 Đặt ${seats} ghế — ${totalPrice.toLocaleString('vi-VN')}đ`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
