# --- Frontend (Vite + React) ---
FROM node:22-alpine AS frontend
WORKDIR /src/dashboard/client
COPY dashboard/client/package.json dashboard/client/package-lock.json ./
RUN npm ci
COPY dashboard/client/ ./
RUN npm run build

# --- API + static SPA ---
FROM python:3.12-slim
WORKDIR /app/dashboard/server

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY dashboard/server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY dashboard/server/ ./

# Repo root (REPO_ROOT = parent.parent.parent of main.py → /app)
COPY signals.json /app/signals.json

COPY --from=frontend /src/dashboard/client/dist /app/dashboard/client/dist

EXPOSE 8000

# Render and many PaaS set PORT; default 8000 for local / Fly internal
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
