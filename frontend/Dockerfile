# Stage 1: Build React app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build-time API URLs → nginx will proxy these paths internally
ARG VITE_USER_SERVICE=/api/user
ARG VITE_MOVIE_SERVICE=/api/movie
ARG VITE_BOOKING_SERVICE=/api/booking
ARG VITE_PAYMENT_SERVICE=/api/payment

ENV VITE_USER_SERVICE=$VITE_USER_SERVICE
ENV VITE_MOVIE_SERVICE=$VITE_MOVIE_SERVICE
ENV VITE_BOOKING_SERVICE=$VITE_BOOKING_SERVICE
ENV VITE_PAYMENT_SERVICE=$VITE_PAYMENT_SERVICE

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
