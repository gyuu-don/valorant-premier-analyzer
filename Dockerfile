# --- Stage 1: build the React frontend ---
FROM node:20-slim AS web
WORKDIR /web
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build          # -> /web/dist

# --- Stage 2: Python runtime serving API + built frontend (single service) ---
FROM python:3.12-slim
WORKDIR /app/server

# Install backend (editable so `app` resolves to source → client/dist path resolution works).
COPY server/ /app/server/
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -e .

# Built frontend where main.py expects it: parents[2]/client/dist == /app/client/dist
COPY --from=web /web/dist /app/client/dist

ENV PORT=8000
EXPOSE 8000
# Shell form so the platform-provided $PORT (e.g. Render) is expanded.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
