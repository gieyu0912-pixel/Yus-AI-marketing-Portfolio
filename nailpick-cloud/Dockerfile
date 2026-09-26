FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY frontend ./frontend

ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/data
ENV UPLOAD_DIR=/data/uploads
ENV DATABASE_URL=sqlite:////data/nailpick.db

EXPOSE 8080
CMD ["sh", "-c", "mkdir -p /data/uploads && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
