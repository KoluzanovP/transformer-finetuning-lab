# Transformer Fine-Tuning Lab - inference image
FROM python:3.10-slim

# Avoid interactive prompts and keep Python output unbuffered
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface

WORKDIR /app

# System deps (build tooling needed by some wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential git curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first to leverage layer caching
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy source code
COPY . .

EXPOSE 8000

# Default command launches the FastAPI inference service.
# Override MODEL_DIR via -e MODEL_DIR=... to serve a different checkpoint.
CMD ["uvicorn", "serve.api:app", "--host", "0.0.0.0", "--port", "8000"]
