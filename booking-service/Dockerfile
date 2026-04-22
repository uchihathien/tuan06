FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
# Remove .env so dotenv cannot override Docker environment variables
RUN rm -f .env

EXPOSE 8083
CMD ["node", "index.js"]
