import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import BookingModal from '../components/BookingModal';

export default function MovieList() {
  const { user } = useAuth();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [genres, setGenres] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);

  useEffect(() => {
    fetchGenres();
    fetchMovies();
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [search, genre]);

  async function fetchGenres() {
    try {
      const res = await fetch(`${config.MOVIE_SERVICE}/genres`);
      const data = await res.json();
      setGenres(data);
    } catch (_) {}
  }

  async function fetchMovies() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (genre)  params.set('genre', genre);
      const res = await fetch(`${config.MOVIE_SERVICE}/movies?${params}`);
      const data = await res.json();
      setMovies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleBookingDone() {
    setSelectedMovie(null);
    fetchMovies(); // Refresh seat counts
  }

  return (
    <main>
      {/* Hero */}
      <div className="page-hero">
        <h1>🎬 Phim Đang Chiếu</h1>
        <p>Chọn phim yêu thích và đặt vé ngay hôm nay</p>
      </div>

      <div className="container" style={{ paddingBottom: '60px' }}>
        {/* Filters */}
        <div className="filters-bar">
          <div className="search-input-wrap">
            <span className="icon">🔍</span>
            <input
              id="movie-search"
              className="form-control"
              type="text"
              placeholder="Tìm kiếm phim..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {genres.length > 0 && (
          <div className="genre-pills" style={{ marginBottom: '24px' }}>
            <button
              className={`genre-pill ${!genre ? 'active' : ''}`}
              onClick={() => setGenre('')}
            >
              Tất cả
            </button>
            {genres.map((g) => (
              <button
                key={g}
                className={`genre-pill ${genre === g ? 'active' : ''}`}
                onClick={() => setGenre(g === genre ? '' : g)}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* Movies Grid */}
        {loading ? (
          <div className="loading-wrap">
            <div className="spinner"></div>
            <span>Đang tải danh sách phim...</span>
          </div>
        ) : movies.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎭</div>
            <h3>Không có phim nào</h3>
            <p>Hãy thử tìm kiếm với từ khóa khác</p>
          </div>
        ) : (
          <div className="movies-grid">
            {movies.map((movie) => (
              <div
                key={movie.id}
                className="movie-card"
                id={`movie-card-${movie.id}`}
                onClick={() => setSelectedMovie(movie)}
              >
                {movie.poster_url ? (
                  <img
                    className="movie-poster"
                    src={movie.poster_url}
                    alt={movie.title}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div
                  className="movie-poster-placeholder"
                  style={{ display: movie.poster_url ? 'none' : 'flex' }}
                >
                  🎞️
                </div>

                <div className="movie-info">
                  <h3 className="movie-title">{movie.title}</h3>
                  <div className="movie-meta">
                    <span className="movie-rating">⭐ {movie.rating}</span>
                    <span className="movie-genre">{movie.genre}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="movie-price">
                      {Number(movie.price).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="movie-seats">
                      {movie.seats_available > 0
                        ? `🪑 ${movie.seats_available} ghế`
                        : <span style={{ color: 'var(--red)' }}>Hết ghế</span>}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMovie && (
        <BookingModal
          movie={selectedMovie}
          user={user}
          onClose={() => setSelectedMovie(null)}
          onSuccess={handleBookingDone}
        />
      )}
    </main>
  );
}
