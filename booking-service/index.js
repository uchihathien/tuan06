require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const amqplib = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8083;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE = 'movie_ticket';

let db, rabbitChannel;

// ─── Database ──────────────────────────────────────────────────────────────
async function initDB() {
  db = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'movie_ticket',
    waitForConnections: true,
    connectionLimit: 10,
  });
  console.log('[BookingService] ✅ MariaDB connected');
}

// ─── RabbitMQ ──────────────────────────────────────────────────────────────
async function initRabbit() {
  const conn = await amqplib.connect(RABBITMQ_URL);
  rabbitChannel = await conn.createChannel();
  await rabbitChannel.assertExchange(EXCHANGE, 'topic', { durable: true });

  // Subscribe to payment results → update booking status
  const q = await rabbitChannel.assertQueue('booking_update_queue', { durable: true });
  await rabbitChannel.bindQueue(q.queue, EXCHANGE, 'payment.completed');
  await rabbitChannel.bindQueue(q.queue, EXCHANGE, 'booking.failed');

  rabbitChannel.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const { type, data } = event;

      if (type === 'payment.completed') {
        await db.execute(
          'UPDATE bookings SET status = ? WHERE id = ?',
          ['confirmed', data.bookingId]
        );
        console.log(`[BookingService] ✅ Booking #${data.bookingId} → CONFIRMED`);
      } else if (type === 'booking.failed') {
        await db.execute(
          'UPDATE bookings SET status = ? WHERE id = ?',
          ['failed', data.bookingId]
        );
        // Restore available seats
        if (data.seats && data.movieId) {
          await db.execute(
            'UPDATE movies SET seats_available = seats_available + ? WHERE id = ?',
            [data.seats, data.movieId]
          );
        }
        console.log(`[BookingService] ❌ Booking #${data.bookingId} → FAILED (seats restored)`);
      }

      rabbitChannel.ack(msg);
    } catch (err) {
      console.error('[BookingService] Error processing payment event:', err);
      rabbitChannel.nack(msg, false, false); // Send to DLQ
    }
  });

  console.log('[BookingService] ✅ RabbitMQ connected, listening for payment events');
}

async function publishEvent(routingKey, data) {
  const payload = {
    type: routingKey,
    data,
    timestamp: new Date().toISOString(),
    service: 'booking-service',
  };
  rabbitChannel.publish(
    EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );
  // Log to DB
  await db.execute(
    'INSERT INTO event_logs (event_type, payload) VALUES (?, ?)',
    [routingKey, JSON.stringify(payload)]
  );
  console.log(`[BookingService] 📤 Published [${routingKey}]:`, data);
}

// ─── Routes ────────────────────────────────────────────────────────────────

// POST /bookings - Create a new booking
app.post('/bookings', async (req, res) => {
  try {
    const { userId, movieId, seats } = req.body;
    if (!userId || !movieId || !seats) {
      return res.status(400).json({ error: 'Vui lòng cung cấp userId, movieId và seats' });
    }
    if (seats < 1 || seats > 10) {
      return res.status(400).json({ error: 'Số ghế phải từ 1 đến 10' });
    }

    // Check movie availability
    const [movies] = await db.execute('SELECT * FROM movies WHERE id = ?', [movieId]);
    if (!movies.length) return res.status(404).json({ error: 'Phim không tồn tại' });

    const movie = movies[0];
    if (movie.seats_available < seats) {
      return res.status(400).json({
        error: `Chỉ còn ${movie.seats_available} ghế trống`,
      });
    }

    // Reserve seats immediately
    await db.execute(
      'UPDATE movies SET seats_available = seats_available - ? WHERE id = ?',
      [seats, movieId]
    );

    const totalPrice = parseFloat(movie.price) * seats;

    // Create booking record
    const [result] = await db.execute(
      'INSERT INTO bookings (user_id, movie_id, seats, total_price, status) VALUES (?, ?, ?, ?, ?)',
      [userId, movieId, seats, totalPrice, 'pending']
    );
    const bookingId = result.insertId;

    // ★ Publish BOOKING_CREATED event (NO direct payment call)
    await publishEvent('booking.created', {
      bookingId,
      userId,
      movieId,
      movieTitle: movie.title,
      seats,
      totalPrice,
    });

    res.status(201).json({
      message: 'Đặt vé thành công! Đang xử lý thanh toán...',
      bookingId,
      status: 'pending',
      totalPrice,
      movieTitle: movie.title,
      seats,
    });
  } catch (err) {
    console.error('[BookingService] POST /bookings error:', err);
    res.status(500).json({ error: 'Đặt vé thất bại' });
  }
});

// GET /bookings - List bookings (optionally by userId)
app.get('/bookings', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = `
      SELECT 
        b.*,
        m.title AS movie_title,
        m.poster_url,
        m.genre,
        m.duration
      FROM bookings b
      JOIN movies m ON b.movie_id = m.id
    `;
    const params = [];
    if (userId) {
      query += ' WHERE b.user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY b.created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /bookings/:id - Get booking detail
app.get('/bookings/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT b.*, m.title AS movie_title, m.poster_url, m.genre
       FROM bookings b
       JOIN movies m ON b.movie_id = m.id
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking không tồn tại' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'booking-service', port: PORT })
);

// ─── Start ─────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  await initRabbit();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 [BookingService] Running on http://0.0.0.0:${PORT}`);
    console.log('   POST /bookings');
    console.log('   GET  /bookings');
    console.log('   GET  /bookings/:id\n');
  });
}

start().catch((err) => {
  console.error('[BookingService] Failed to start:', err);
  process.exit(1);
});
