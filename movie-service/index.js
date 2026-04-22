require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8082;

let db;

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
  console.log('[MovieService] ✅ MariaDB connected');
}

// ─── Routes ────────────────────────────────────────────────────────────────
// GET /movies - List all movies
app.get('/movies', async (req, res) => {
  try {
    const { genre, search } = req.query;
    let query = 'SELECT * FROM movies';
    const params = [];
    const conditions = [];

    if (genre) {
      conditions.push('genre = ?');
      params.push(genre);
    }
    if (search) {
      conditions.push('title LIKE ?');
      params.push(`%${search}%`);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY rating DESC, created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[MovieService] GET /movies error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /movies/:id - Get movie detail
app.get('/movies/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM movies WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Phim không tồn tại' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /movies - Add new movie
app.post('/movies', async (req, res) => {
  try {
    const { title, description, duration, genre, rating, poster_url, price, seats_available } = req.body;
    if (!title) return res.status(400).json({ error: 'Tên phim là bắt buộc' });

    const [result] = await db.execute(
      'INSERT INTO movies (title, description, duration, genre, rating, poster_url, price, seats_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', duration || 120, genre || 'Other', rating || 7.0, poster_url || '', price || 100000, seats_available || 100]
    );
    const [rows] = await db.execute('SELECT * FROM movies WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[MovieService] POST /movies error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /movies/:id - Update movie
app.put('/movies/:id', async (req, res) => {
  try {
    const { title, description, duration, genre, rating, poster_url, price, seats_available } = req.body;
    await db.execute(
      'UPDATE movies SET title=?, description=?, duration=?, genre=?, rating=?, poster_url=?, price=?, seats_available=? WHERE id=?',
      [title, description, duration, genre, rating, poster_url, price, seats_available, req.params.id]
    );
    const [rows] = await db.execute('SELECT * FROM movies WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Phim không tồn tại' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /genres - List unique genres
app.get('/genres', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT DISTINCT genre FROM movies ORDER BY genre');
    res.json(rows.map(r => r.genre));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'movie-service', port: PORT })
);

// ─── Start ─────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 [MovieService] Running on http://0.0.0.0:${PORT}`);
    console.log('   GET  /movies');
    console.log('   POST /movies');
    console.log('   GET  /movies/:id');
    console.log('   PUT  /movies/:id');
    console.log('   GET  /genres\n');
  });
}

start().catch((err) => {
  console.error('[MovieService] Failed to start:', err);
  process.exit(1);
});
