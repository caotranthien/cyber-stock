# Dockerfile for 24/7 Autonomous Cyber Trading Bot
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for efficient caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Run background bot and web server
CMD ["node", "server.js"]
