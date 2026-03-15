# =============================================================
# FILE LOCATION: fileconverter/frontend/Dockerfile
#
# WHAT THIS FILE DOES:
# Packages your React app into a Docker container.
# Stage 1: Uses Node.js to BUILD the React app (compile JSX, bundle JS/CSS)
# Stage 2: Throws Node.js away. Uses tiny NGINX server to SERVE the files.
# Result: ~25MB image instead of ~400MB if we kept Node.js.
# =============================================================


# ── STAGE 1: Build React App ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer cache trick)
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy all your React source code (App.jsx, components, pages, etc.)
COPY . .

# Build React for production
# This compiles JSX → JS, bundles everything, outputs to /app/dist
# (if using Create React App it outputs to /app/build - see comment below)
RUN npm run build


# ── STAGE 2: Serve with NGINX ─────────────────────────────────
# NGINX is a tiny high-performance web server (only ~10MB)
FROM nginx:1.27-alpine AS production

# Remove NGINX default config (it would conflict with ours)
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom NGINX config (nginx.conf must be in same folder as this Dockerfile)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled React app from builder stage into NGINX's serving folder
# Vite outputs to /app/dist
COPY --from=builder /app/dist /usr/share/nginx/html

# If you use Create React App instead of Vite, comment above and uncomment below:
# COPY --from=builder /app/build /usr/share/nginx/html

# NGINX serves on port 80
EXPOSE 80

# Health check - just checks if NGINX is responding
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1

# Start NGINX in foreground (Docker requires main process to stay in foreground)
CMD ["nginx", "-g", "daemon off;"]