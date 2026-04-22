// Service URLs — change IPs if running on different machines
const config = {
  USER_SERVICE:    import.meta.env.VITE_USER_SERVICE    || 'http://localhost:8081',
  MOVIE_SERVICE:   import.meta.env.VITE_MOVIE_SERVICE   || 'http://localhost:8082',
  BOOKING_SERVICE: import.meta.env.VITE_BOOKING_SERVICE || 'http://localhost:8083',
  PAYMENT_SERVICE: import.meta.env.VITE_PAYMENT_SERVICE || 'http://localhost:8084',
};

export default config;
