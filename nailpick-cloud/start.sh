#!/bin/sh
set -e
cd "$(dirname "$0")"
mkdir -p data uploads
export PYTHONPATH=.
export JWT_SECRET="${JWT_SECRET:-nailpick-dev-secret-change-me}"
export DATA_DIR="${DATA_DIR:-./data}"
export UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///${DATA_DIR}/nailpick.db}"
PORT="${PORT:-8090}"
echo "指尖選 NailPick 啟動於 http://127.0.0.1:${PORT}"
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
