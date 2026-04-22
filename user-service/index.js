require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const amqplib = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8081;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const JWT_SECRET = process.env.JWT_SECRET || 'movie_ticket_super_secret_2024';
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
  await db.execute('SELECT 1'); // Verify connection
  console.log('[UserService] ✅ MariaDB connected');
}

// ─── RabbitMQ ──────────────────────────────────────────────────────────────
async function initRabbit() {
  const conn = await amqplib.connect(RABBITMQ_URL);
  rabbitChannel = await conn.createChannel();
  await rabbitChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
  console.log('[UserService] ✅ RabbitMQ connected');
}

async function publishEvent(routingKey, data) {
  const payload = {
    type: routingKey,
    data,
    timestamp: new Date().toISOString(),
    service: 'user-service',
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
  console.log(`[UserService] 📤 Published [${routingKey}]:`, data);
}

// ─── Routes ────────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );
    const userId = result.insertId;

    // Publish USER_REGISTERED event
    await publishEvent('user.registered', { userId, name, email });

    res.status(201).json({ message: 'Đăng ký thành công!', userId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email đã được sử dụng' });
    }
    console.error('[UserService] Register error:', err);
    res.status(500).json({ error: 'Đăng ký thất bại' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
    }

    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Đăng nhập thành công!',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[UserService] Login error:', err);
    res.status(500).json({ error: 'Đăng nhập thất bại' });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'user-service', port: PORT })
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
    console.log(`\n🚀 [UserService] Running on http://0.0.0.0:${PORT}`);
    console.log('   POST /register');
    console.log('   POST /login');
    console.log('   GET  /health\n');
  });
}

start().catch((err) => {
  console.error('[UserService] Failed to start:', err);
  process.exit(1);
});
