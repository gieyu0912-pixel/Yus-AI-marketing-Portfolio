import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Artist

JWT_SECRET = os.getenv("JWT_SECRET", "nailpick-dev-secret-change-me")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 180000)
    return f"{salt.hex()}:{dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split(":")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 180000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def create_token(artist: Artist) -> str:
    payload = {
        "sub": str(artist.id),
        "email": artist.email,
        "name": artist.name,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def current_artist(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Artist:
    if not creds:
        raise HTTPException(401, "請先登入")
    try:
        data = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        artist = db.get(Artist, int(data["sub"]))
    except Exception:
        artist = None
    if not artist:
        raise HTTPException(401, "登入已失效，請重新登入")
    return artist
