# ==============================================================================
# Glow PDF — Production Dockerfile
# Target: Blitz.cloud (2 GB RAM / 10 GB storage free tier)
# Base:   Python 3.11-slim on Debian Bookworm
# ==============================================================================

FROM python:3.11-slim-bookworm

# ------------------------------------------------------------------------------
# 1. System environment variables
# ------------------------------------------------------------------------------
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    HOME=/tmp \
    TMPDIR=/tmp

# ------------------------------------------------------------------------------
# 2. Install system packages
#    Ordered to maximise Docker layer cache reuse across rebuilds.
# ------------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    # LibreOffice headless (Writer / Calc / Impress → PDF)
    libreoffice \
    # Ghostscript (PDF compression, PDF/A compliance)
    ghostscript \
    # QPDF (PDF structural repair & linearization)
    qpdf \
    # Tesseract OCR engine + English language data
    tesseract-ocr \
    tesseract-ocr-eng \
    # Chromium headless (HTML/URL → PDF rendering)
    chromium \
    # Fonts required for correct PDF rendering across all tools
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
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------------------
# 3. Create and set working directory
# ------------------------------------------------------------------------------
WORKDIR /app

# ------------------------------------------------------------------------------
# 4. Install Python dependencies (cached layer — only re-runs when requirements.txt changes)
# ------------------------------------------------------------------------------
COPY server/requirements.txt /app/server/requirements.txt

RUN pip install --upgrade pip --no-cache-dir \
    && pip install --no-cache-dir -r /app/server/requirements.txt \
    && pip cache purge

# ------------------------------------------------------------------------------
# 5. Copy application source code
# ------------------------------------------------------------------------------
COPY server/ /app/server/

# ------------------------------------------------------------------------------
# 6. Create non-root user for safer runtime
#    LibreOffice and Chromium both operate correctly as a non-root user.
# ------------------------------------------------------------------------------
RUN groupadd --gid 1001 glowpdf \
    && useradd --uid 1001 --gid glowpdf --shell /bin/bash --no-create-home glowpdf \
    && chown -R glowpdf:glowpdf /app \
    && mkdir -p /tmp/glowpdf_workdir \
    && chmod 777 /tmp/glowpdf_workdir

USER glowpdf

# ------------------------------------------------------------------------------
# 7. Expose port (Blitz.cloud injects $PORT at runtime; default 8000 locally)
# ------------------------------------------------------------------------------
ENV PORT=8000
EXPOSE ${PORT}

# ------------------------------------------------------------------------------
# 8. Docker health check
# ------------------------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# ------------------------------------------------------------------------------
# 9. Start FastAPI via Uvicorn
#
#    IMPORTANT RAM rationale (Blitz.cloud free = 2 GB):
#    - 1 Uvicorn worker keeps baseline RAM at ~120 MB
#    - LibreOffice peak per conversion: ~350-500 MB
#    - Chromium headless peak: ~400-600 MB
#    - Python libs + overhead: ~150-200 MB
#    - With 1 worker and semaphore=3 we stay safely under 2 GB
#    - Do NOT increase workers without upgrading RAM allocation
# ------------------------------------------------------------------------------
CMD uvicorn server.main:app \
        --host 0.0.0.0 \
        --port ${PORT} \
        --workers 1 \
        --log-level info \
        --no-access-log
