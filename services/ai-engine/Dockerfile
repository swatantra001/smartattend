# FROM python:3.11-slim AS base

# WORKDIR /app

# # System deps for OpenCV + InsightFace
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     libglib2.0-0 \
#     libsm6 \
#     libxrender1 \
#     libxext6 \
#     libgl1-mesa-glx \
#     libgomp1 \
#     wget \
#     && rm -rf /var/lib/apt/lists/*

# # Install Python deps
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Download InsightFace models at build time
# # This avoids slow cold-start in production
# RUN python -c " \
# from insightface.app import FaceAnalysis \
# import os \
# os.makedirs('/app/models', exist_ok=True) \
# app = FaceAnalysis(name='buffalo_l', root='/app/models', providers=['CPUExecutionProvider']) \
# app.prepare(ctx_id=-1, det_size=(640, 640)) \
# print('Models downloaded successfully') \
# "

# COPY app ./app

# RUN addgroup --system aiengine \
#     && adduser --system --ingroup aiengine aiengine \
#     && chown -R aiengine:aiengine /app

# USER aiengine

# EXPOSE 8000

# HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
#     CMD wget -qO- http://localhost:8000/health || exit 1

# CMD ["uvicorn", "app.main:app", \
#     "--host", "0.0.0.0", \
#     "--port", "8000", \
#     "--workers", "2", \
#     "--timeout-keep-alive", "30"]











FROM python:3.11-slim AS base

WORKDIR /app

# System deps for OpenCV + InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1 \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
#RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir "numpy<2" -r requirements.txt
# Download InsightFace models at build time
# This avoids slow cold-start in production
RUN python -c "from insightface.app import FaceAnalysis; import os; os.makedirs('/app/models', exist_ok=True); app = FaceAnalysis(name='buffalo_l', root='/app/models', providers=['CPUExecutionProvider']); app.prepare(ctx_id=-1, det_size=(640, 640)); print('Models downloaded successfully')"
COPY app ./app

RUN addgroup --system aiengine \
    && adduser --system --ingroup aiengine aiengine \
    && chown -R aiengine:aiengine /app

USER aiengine

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "2", \
    "--timeout-keep-alive", "30"]