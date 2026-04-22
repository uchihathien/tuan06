require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const amqplib = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8084;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE = 'movie_ticket';

let db, rabbitChannel;

// SSE connected clients
const sseClients = new Map(); // clientId -> { res, userId }

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
  await db.execute('SELECT 1'); // Verify connection
  console.log('[PaymentNotif] ✅ MariaDB connected');
}

// ─── RabbitMQ ──────────────────────────────────────────────────────────────
async function publishEvent(routingKey, data) {
  const payload = {
    type: routingKey,
    data,
    timestamp: new Date().toISOString(),
    service: 'payment-notification',
  };
  rabbitChannel.publish(
    EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );
  await db.execute(
    'INSERT INTO event_logs (event_type, payload) VALUES (?, ?)',
    [routingKey, JSON.stringify(payload)]
  );
  console.log(`[PaymentNotif] 📤 Published [${routingKey}]:`, data);
}

function broadcastSSE(notification) {
  const data = `data: ${JSON.stringify(notification)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(data);
    } catch (_) {}
  });
}

async function initRabbit() {
  const conn = await amqplib.connect(RABBITMQ_URL);
  rabbitChannel = await conn.createChannel();
  await rabbitChannel.assertExchange(EXCHANGE, 'topic', { durable: true });

  // ══════════════════════════════════════════════
  // PAYMENT SERVICE: Consume BOOKING_CREATED
  // ══════════════════════════════════════════════
  const paymentQ = await rabbitChannel.assertQueue('payment_queue', { durable: true });
  await rabbitChannel.bindQueue(paymentQ.queue, EXCHANGE, 'booking.created');

  rabbitChannel.consume(paymentQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const { data } = event;

      console.log(`\n[Payment] 💳 Processing booking #${data.bookingId} — ${data.movieTitle} (${data.seats} ghế, ${data.totalPrice?.toLocaleString()}đ)`);

      // Save payment record
      await db.execute(
        'INSERT INTO payments (booking_id, amount, status) VALUES (?, ?, ?)',
        [data.bookingId, data.totalPrice, 'processing']
      );

      // Simulate payment processing (2s delay)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 80% success rate
      const success = Math.random() < 0.8;

      if (success) {
        await db.execute(
          'UPDATE payments SET status = ? WHERE booking_id = ?',
          ['completed', data.bookingId]
        );
        await publishEvent('payment.completed', {
          bookingId: data.bookingId,
          userId: data.userId,
          movieId: data.movieId,
          movieTitle: data.movieTitle,
          seats: data.seats,
          amount: data.totalPrice,
        });
        console.log(`[Payment] ✅ Booking #${data.bookingId} — PAYMENT COMPLETED`);
      } else {
        await db.execute(
          'UPDATE payments SET status = ? WHERE booking_id = ?',
          ['failed', data.bookingId]
        );
        await publishEvent('booking.failed', {
          bookingId: data.bookingId,
          userId: data.userId,
          movieId: data.movieId,
          movieTitle: data.movieTitle,
          seats: data.seats,
          amount: data.totalPrice,
        });
        console.log(`[Payment] ❌ Booking #${data.bookingId} — PAYMENT FAILED`);
      }

      rabbitChannel.ack(msg);
    } catch (err) {
      console.error('[Payment] Error processing booking:', err);
      rabbitChannel.nack(msg, false, true); // requeue once
    }
  });

  // ══════════════════════════════════════════════
  // NOTIFICATION SERVICE: Consume payment results
  // ══════════════════════════════════════════════
  const notifQ = await rabbitChannel.assertQueue('notification_queue', { durable: true });
  await rabbitChannel.bindQueue(notifQ.queue, EXCHANGE, 'payment.completed');
  await rabbitChannel.bindQueue(notifQ.queue, EXCHANGE, 'booking.failed');

  rabbitChannel.consume(notifQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const { type, data } = event;

      let message, notifType;

      if (type === 'payment.completed') {
        message = `🎬 Đặt vé thành công! Booking #${data.bookingId} — "${data.movieTitle}" × ${data.seats} ghế. Tổng tiền: ${Number(data.amount).toLocaleString('vi-VN')}đ`;
        notifType = 'success';
        console.log(`\n[Notification] ✅ User #${data.userId}: ${message}`);
      } else {
        message = `❌ Đặt vé thất bại! Booking #${data.bookingId} — Thanh toán không thành công cho phim "${data.movieTitle}". Ghế đã được hoàn lại.`;
        notifType = 'error';
        console.log(`\n[Notification] ❌ User #${data.userId}: ${message}`);
      }

      // Save notification to DB
      const [result] = await db.execute(
        'INSERT INTO notifications (booking_id, user_id, message, type) VALUES (?, ?, ?, ?)',
        [data.bookingId, data.userId, message, notifType]
      );

      // Push realtime via SSE
      const notif = {
        id: result.insertId,
        bookingId: data.bookingId,
        userId: data.userId,
        message,
        type: notifType,
        timestamp: new Date().toISOString(),
      };
      broadcastSSE(notif);

      rabbitChannel.ack(msg);
    } catch (err) {
      console.error('[Notification] Error processing event:', err);
      rabbitChannel.nack(msg, false, false);
    }
  });

  console.log('[PaymentNotif] ✅ RabbitMQ connected');
  console.log('[PaymentNotif]    → Listening: booking.created (payment_queue)');
  console.log('[PaymentNotif]    → Listening: payment.completed, booking.failed (notification_queue)');
}

// ─── REST Routes ───────────────────────────────────────────────────────────

// GET /payments - List all payments
app.get('/payments', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT p.*, b.user_id, b.movie_id FROM payments p JOIN bookings b ON p.booking_id = b.id ORDER BY p.created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /notifications - List notifications
app.get('/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = 'SELECT * FROM notifications';
    const params = [];
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /notifications/:id/read - Mark as read
app.patch('/notifications/:id/read', async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /notifications/stream - SSE endpoint for realtime notifications
app.get('/notifications/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = Date.now() + Math.random();
  const userId = req.query.userId;

  sseClients.set(clientId, { res, userId });
  console.log(`[SSE] Client #${clientId} connected (userId=${userId}). Total: ${sseClients.size}`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE Connected 🔌', clientId })}\n\n`);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  req.on('close', () => {
    sseClients.delete(clientId);
    clearInterval(heartbeat);
    console.log(`[SSE] Client #${clientId} disconnected. Total: ${sseClients.size}`);
  });
});

// GET /events - Event log history (bonus)
app.get('/events', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM event_logs ORDER BY created_at DESC LIMIT 200'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'payment-notification', port: PORT, sseClients: sseClients.size })
);

// ─── Start ─────────────────────────────────────────────────────────────────
async function withRetry(fn, name, retries = 20, delayMs = 4000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`[${name}] Attempt ${i}/${retries} failed: ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function start() {
  await withRetry(initDB, 'MariaDB');
  await withRetry(initRabbit, 'RabbitMQ');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 [PaymentNotif] Running on http://0.0.0.0:${PORT}`);
    console.log('   GET  /payments');
    console.log('   GET  /notifications');
    console.log('   GET  /notifications/stream  (SSE)');
    console.log('   GET  /events\n');
  });
}

start().catch((err) => {
  console.error('[PaymentNotif] Failed to start:', err);
  process.exit(1);
});
