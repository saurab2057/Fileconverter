# =============================================================
# FILE LOCATION: fileconverter/backend/Dockerfile
#
# WHAT THIS FILE DOES:
# Packages your Node.js/Express backend into a Docker container.
# Uses 2-stage build: Stage 1 installs everything, Stage 2 keeps
# only what is needed to RUN the app (no dev tools, smaller image).
# =============================================================


# ── STAGE 1: Builder ─────────────────────────────────────────
# Install ALL dependencies (dev + prod) needed to prepare the app
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy package files FIRST (layer cache trick)
# If package.json didn't change, Docker skips npm install on next build
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy ALL your source code
COPY . .


# ── STAGE 2: Production ──────────────────────────────────────
# Start fresh - only copy what is needed to RUN the app
FROM node:20-alpine AS production

# Security: create a non-root user to run the app
# Running as root is dangerous - if hacker exploits app they get full server access
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install ONLY production dependencies (no mocha, nodemon, etc.)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code from the builder stage
COPY --from=builder /app .

# Give ownership of files to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Your backend runs on port 5000 (matches your index.js PORT)
EXPOSE 5000

# Health check - hits your /api/health endpoint every 30 seconds
# If it fails 3 times, Docker marks container as unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Start your server (matches your index.js entry point)
CMD ["node", "index.js"]