# =============================================================
# FILE LOCATION: fileconverter/ai_microservices/Dockerfile
#
# WHAT THIS FILE DOES:
# Packages your Python FastAPI service into a Docker container.
# Uses 2-stage build because Python packages like numpy/transformers
# need C compilers to BUILD but NOT to RUN. Stage 1 compiles,
# Stage 2 only has the compiled packages - no compilers.
# =============================================================


# ── STAGE 1: Builder ─────────────────────────────────────────
# Need compilers here to build Python packages
FROM python:3.11-slim AS builder

WORKDIR /app

# Install C compilers needed to build some Python packages
# --no-install-recommends keeps it lean
# rm -rf clears apt cache after installing (saves ~50MB)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install packages into /install folder so we can copy them cleanly
# --no-cache-dir means don't keep pip download cache
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── STAGE 2: Production ──────────────────────────────────────
# Start fresh - NO compilers, only your code + installed packages
FROM python:3.11-slim AS production

# Security: create non-root user
RUN addgroup --system aigroup && adduser --system --ingroup aigroup aiuser

WORKDIR /app

# Copy ONLY the installed packages from builder (no gcc, no build tools)
COPY --from=builder /install /usr/local

# Copy ONLY the Python files your service needs
# (matches your actual files: main.py, chatbot.py, summarizer.py, models.py, config.py)
COPY main.py chatbot.py summarizer.py models.py config.py ./

# Give ownership to non-root user
RUN chown -R aiuser:aigroup /app

# Switch to non-root user
USER aiuser

# Your FastAPI runs on port 8000 (matches your main.py uvicorn config)
EXPOSE 8000

# Health check - hits your /health endpoint
# start-period=60s because Qwen model takes ~60 seconds to load into memory
# (matches your SummarizerModel.get_model() warm-up in main.py lifespan)
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start FastAPI with uvicorn
# --host 0.0.0.0 means accept connections from ALL interfaces (required for Docker)
# --workers 2 means 2 parallel processes handling requests at the same time
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]