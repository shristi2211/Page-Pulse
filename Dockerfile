# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install ALL dependencies (for build)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Production Stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled output and public assets
COPY --from=builder /app/dist ./dist
COPY public/ ./public/

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
