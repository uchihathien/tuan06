-- ============================================
-- Movie Ticket System - Database Init Script
-- Run: mysql -u root -p < init.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS movie_ticket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE movie_ticket;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Movies table
CREATE TABLE IF NOT EXISTS movies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration INT COMMENT 'Minutes',
  genre VARCHAR(100),
  rating FLOAT DEFAULT 0,
  poster_url VARCHAR(500),
  price DECIMAL(10,2) DEFAULT 0,
  seats_available INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  movie_id INT NOT NULL,
  seats INT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_movie_id (movie_id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_booking_id (booking_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT,
  user_id INT,
  message TEXT NOT NULL,
  type ENUM('success', 'error') DEFAULT 'success',
  is_read TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
);

-- Event log table (bonus)
CREATE TABLE IF NOT EXISTS event_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_type (event_type)
);

-- Seed sample movies
INSERT IGNORE INTO movies (id, title, description, duration, genre, rating, poster_url, price, seats_available) VALUES
(1, 'Avengers: Endgame', 'The Avengers assemble once more to reverse Thanos''s actions and restore balance to the universe.', 181, 'Action', 8.4, 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg', 120000, 150),
(2, 'Inception', 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task.', 148, 'Sci-Fi', 8.8, 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', 100000, 100),
(3, 'The Dark Knight', 'When the menace known as the Joker wreaks havoc on Gotham City, Batman must accept one of the greatest tests.', 152, 'Action', 9.0, 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', 110000, 80),
(4, 'Interstellar', 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity''s survival.', 169, 'Sci-Fi', 8.6, 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', 115000, 120),
(5, 'Parasite', 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.', 132, 'Drama', 8.5, 'https://image.tmdb.org/t/p/w500/7IiTTgloROVKgPeFHZCvXqcaPlV.jpg', 90000, 60),
(6, 'Dune', 'Feature adaptation of Frank Herbert''s science fiction novel about the son of a noble family entrusted with the protection of the valuable resource.', 155, 'Sci-Fi', 8.0, 'https://image.tmdb.org/t/p/w500/d5NXSklpcvgMGk7PgDR0dMmFMdT.jpg', 125000, 200);

SELECT 'Database initialized successfully!' AS message;
