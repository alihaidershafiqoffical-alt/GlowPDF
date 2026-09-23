# ==============================================================================
# Glow PDF — Production Dockerfile (Multi-Stage Build)
# Target: Blitz.cloud (2 GB RAM / 10 GB storage free tier)
# Stage 1: Builder  — compiles Python wheels (has gcc / build-essential)
# Stage 2: Runtime  — lean final image, no build tools, ~500 MB smaller
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Builder — install build deps and compile all Python wheels
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Only what's needed to compile Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    python3-dev \
    libffi-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY server/requirements.txt .

# Build wheels into /wheels so the runtime stage can install without gcc
RUN pip install --upgrade pip setuptools wheel --no-cache-dir \
    && pip wheel --no-cache-dir --wheel-dir=/wheels -r requirements.txt

# ------------------------------------------------------------------------------
# STAGE 2: Runtime — lean image with only what's needed to run
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    HOME=/tmp \
    TMPDIR=/tmp

# Install ONLY runtime system packages — no build tools, no gcc
RUN apt-get update && apt-get install -y --no-install-recommends \
    # LibreOffice headless (Writer / Calc / Impress → PDF)
    libreoffice \
    # Ghostscript (PDF compression, PDF/A compliance)
    ghostscript \
    # QPDF (PDF structural repair & linearization)
    qpdf \
    # Tesseract OCR engine + English language data + OCR helpers
    tesseract-ocr \
    tesseract-ocr-eng \
    pngquant \
    unpaper \
    # Chromium headless (HTML/URL → PDF rendering)
    chromium \
    # Fonts required for correct PDF rendering
    fonts-liberation \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fonts-noto-core \
    # Runtime libraries required by Chromium headless in Docker
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    # curl for Docker HEALTHCHECK
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && find /usr/share/doc -type f -delete \
    && find /usr/share/man -type f -delete \
    && find /usr/share/locale -mindepth 1 -maxdepth 1 ! -name 'en*' -exec rm -rf {} +

# Copy pre-built wheels from builder and install without compiling
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/*.whl \
    && rm -rf /wheels \
    && pip cache purge

WORKDIR /app

COPY server/ /app/server/

# Create non-root user
RUN groupadd --gid 1001 glowpdf \
    && useradd --uid 1001 --gid glowpdf --shell /bin/bash --no-create-home glowpdf \
    && chown -R glowpdf:glowpdf /app \
    && mkdir -p /tmp/glowpdf_workdir \
    && chmod 777 /tmp/glowpdf_workdir

USER glowpdf

ENV PORT=8000
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8000}/api/health || exit 1

CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info"]
