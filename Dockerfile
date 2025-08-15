# syntax=docker/dockerfile:1
FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy app source
COPY . .

# Expose default port (platforms may override with PORT env)
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]