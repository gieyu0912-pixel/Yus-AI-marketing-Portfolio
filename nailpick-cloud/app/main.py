import json
import os
import re
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .auth import create_token, current_artist, hash_password, verify_password
from .db import Base, engine, get_db
from .models import Artist, Booking, Service, Work
from .seed import seed_if_empty

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(ROOT / "uploads"))).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

CITIES = ["台中市", "台北市", "新竹市", "高雄市", "台南市", "新北市", "桃園市"]
PHONE_RE = re.compile(r"^09\d{8}$")

app = FastAPI(title="指尖選 NailPick", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    from .db import SessionLocal

    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


def price_from(artist: Artist) -> int:
    prices = [s.price for s in artist.services]
    return min(prices) if prices else 0


def public_artist(artist: Artist, include_private=False, taken=None):
    works = [w.url for w in artist.works]
    data = {
        "id": artist.id,
        "name": artist.name,
        "studio": artist.studio,
        "city": artist.city,
        "district": artist.district,
        "years": artist.years,
        "rating": artist.rating,
        "reviews": artist.reviews,
        "bio": artist.bio,
        "styles": artist.styles_list(),
        "avatar": artist.avatar,
        "cover": artist.cover or (works[0] if works else ""),
        "works": [{"id": w.id, "url": w.url} for w in artist.works],
        "workUrls": works,
        "services": [
            {"id": s.id, "name": s.name, "mins": s.mins, "price": s.price} for s in artist.services
        ],
        "offDays": artist.off_days_list(),
        "slots": artist.slots_list(),
        "priceFrom": price_from(artist),
        "taken": taken or [],
    }
    if include_private:
        data["email"] = artist.email
    return data


def booking_out(b: Booking, artist: Artist | None = None):
    a = artist or b.artist
    return {
        "id": b.id,
        "artistId": b.artist_id,
        "artistName": a.name if a else "",
        "studio": a.studio if a else "",
        "city": a.city if a else "",
        "service": b.service_name,
        "price": b.price,
        "date": b.date,
        "time": b.time,
        "clientName": b.client_name,
        "phone": b.phone,
        "note": b.note or "",
        "status": b.status,
        "createdAt": b.created_at.isoformat() if b.created_at else "",
    }


class RegisterIn(BaseModel):
    name: str
    studio: str
    city: str
    district: str = ""
    email: str
    password: str
    bio: str = ""
    styles: list[str] = ["簡約"]


class LoginIn(BaseModel):
    email: str
    password: str


class ProfileIn(BaseModel):
    name: str | None = None
    studio: str | None = None
    city: str | None = None
    district: str | None = None
    bio: str | None = None
    styles: list[str] | None = None
    years: int | None = None
    avatar: str | None = None


class ServiceIn(BaseModel):
    name: str
    mins: int = Field(ge=20, le=360)
    price: int = Field(ge=100, le=50000)


class ScheduleIn(BaseModel):
    offDays: list[int] = []
    slots: list[str] = []


class BookingIn(BaseModel):
    artistId: int
    serviceId: int
    date: str
    time: str
    clientName: str
    phone: str
    note: str = ""


@app.get("/api/health")
def health():
    return {"ok": True, "name": "指尖選 NailPick"}


@app.get("/api/meta")
def meta():
    return {
        "cities": CITIES,
        "styles": ["韓系", "日系", "法式", "美式", "手繪", "貓眼", "延長", "足部", "新娘", "簡約", "3D", "奶茶色", "職場", "學生", "夏季"],
    }


@app.get("/api/artists")
def list_artists(city: str | None = None, style: str | None = None, q: str | None = None, date: str | None = None, db: Session = Depends(get_db)):
    rows = db.query(Artist).all()
    out = []
    for a in rows:
        if city and city not in ("全部地區", "") and a.city != city:
            continue
        styles = a.styles_list()
        if style and style not in ("全部風格", "") and style not in styles:
            continue
        if q:
            hay = f"{a.name}{a.studio}{a.city}{a.district}{' '.join(styles)}".lower()
            if q.lower() not in hay:
                continue
        if date:
            try:
                from datetime import date as dtdate

                y, m, d = [int(x) for x in date.split("-")]
                dow = dtdate(y, m, d).weekday()
                # Python Monday=0, we use Sunday=0
                js_dow = (dow + 1) % 7
                if js_dow in a.off_days_list():
                    continue
            except Exception:
                pass
        out.append(public_artist(a))
    out.sort(key=lambda x: (-x["rating"], -x["reviews"]))
    return out


@app.get("/api/artists/{artist_id}")
def get_artist(artist_id: int, db: Session = Depends(get_db)):
    a = db.get(Artist, artist_id)
    if not a:
        raise HTTPException(404, "找不到這位美甲師")
    taken = [
        {"date": b.date, "time": b.time}
        for b in db.query(Booking).filter(Booking.artist_id == artist_id, Booking.status == "confirmed")
    ]
    return public_artist(a, taken=taken)


@app.post("/api/auth/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Email 格式不正確")
    if len(body.password) < 4:
        raise HTTPException(400, "密碼至少 4 碼")
    if db.query(Artist).filter(Artist.email == email).first():
        raise HTTPException(400, "此 Email 已註冊")
    if not body.name.strip() or not body.studio.strip():
        raise HTTPException(400, "請填寫姓名與工作室名稱")
    artist = Artist(
        email=email,
        password_hash=hash_password(body.password),
        name=body.name.strip(),
        studio=body.studio.strip(),
        city=body.city.strip() or "台中市",
        district=body.district.strip(),
        bio=body.bio.strip() or "新上架的美甲師，作品集建置中。歡迎先預約溝通款式。",
        styles=json.dumps(body.styles or ["簡約"], ensure_ascii=False),
        avatar="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
        cover="https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=900&h=700&fit=crop",
        off_days="[]",
        slots=json.dumps(["11:00", "14:00", "17:00"]),
    )
    db.add(artist)
    db.flush()
    db.add(Service(artist_id=artist.id, name="單色凝膠", mins=90, price=999))
    db.commit()
    db.refresh(artist)
    return {"token": create_token(artist), "artist": public_artist(artist, include_private=True)}


@app.post("/api/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    artist = db.query(Artist).filter(Artist.email == body.email.strip().lower()).first()
    if not artist or not verify_password(body.password, artist.password_hash):
        raise HTTPException(401, "帳號或密碼不正確")
    return {"token": create_token(artist), "artist": public_artist(artist, include_private=True)}


@app.get("/api/me")
def me(artist: Artist = Depends(current_artist)):
    return public_artist(artist, include_private=True)


@app.put("/api/me")
def update_me(body: ProfileIn, db: Session = Depends(get_db), artist: Artist = Depends(current_artist)):
    if body.name:
        artist.name = body.name.strip()
    if body.studio:
        artist.studio = body.studio.strip()
    if body.city:
        artist.city = body.city.strip()
    if body.district is not None:
        artist.district = body.district.strip()
    if body.bio is not None:
        artist.bio = body.bio.strip()
    if body.styles is not None:
        artist.styles = json.dumps([s.strip() for s in body.styles if s.strip()], ensure_ascii=False)
    if body.years is not None:
        artist.years = body.years
    if body.avatar:
        artist.avatar = body.avatar
    db.commit()
    db.refresh(artist)
    return public_artist(artist, include_private=True)


@app.post("/api/me/works")
async def upload_work(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    artist: Artist = Depends(current_artist),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "請上傳圖片檔")
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(400, "圖片請小於 8MB")
    ext = Path(file.filename or "jpg").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".jpg"
    name = f"{artist.id}_{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / name
    dest.write_bytes(raw)
    url = f"/uploads/{name}"
    work = Work(artist_id=artist.id, url=url)
    db.add(work)
    if not artist.cover:
        artist.cover = url
    db.commit()
    db.refresh(work)
    return {"id": work.id, "url": url}


@app.delete("/api/me/works/{work_id}")
def delete_work(work_id: int, db: Session = Depends(get_db), artist: Artist = Depends(current_artist)):
    work = db.get(Work, work_id)
    if not work or work.artist_id != artist.id:
        raise HTTPException(404, "找不到作品")
    path = UPLOAD_DIR / Path(work.url).name
    if path.exists() and path.is_file():
        path.unlink()
    db.delete(work)
    db.commit()
    return {"ok": True}


@app.post("/api/me/services")
def add_service(body: ServiceIn, db: Session = Depends(get_db), artist: Artist = Depends(current_artist)):
    svc = Service(artist_id=artist.id, name=body.name.strip(), mins=body.mins, price=body.price)
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return {"id": svc.id, "name": svc.name, "mins": svc.mins, "price": svc.price}


@app.delete("/api/me/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), artist: Artist = Depends(current_artist)):
    svc = db.get(Service, service_id)
    if not svc or svc.artist_id != artist.id:
        raise HTTPException(404, "找不到服務")
    if db.query(Service).filter(Service.artist_id == artist.id).count() <= 1:
        raise HTTPException(400, "至少需保留一項服務")
    db.delete(svc)
    db.commit()
    return {"ok": True}


@app.put("/api/me/schedule")
def update_schedule(body: ScheduleIn, db: Session = Depends(get_db), artist: Artist = Depends(current_artist)):
    off = [d for d in body.offDays if isinstance(d, int) and 0 <= d <= 6]
    slots = []
    for s in body.slots:
        s = s.strip()
        if re.match(r"^\d{1,2}:\d{2}$", s):
            hh, mm = s.split(":")
            slots.append(f"{int(hh):02d}:{mm}")
    artist.off_days = json.dumps(off)
    artist.slots = json.dumps(slots)
    db.commit()
    return {"offDays": off, "slots": slots}


@app.post("/api/bookings")
def create_booking(body: BookingIn, db: Session = Depends(get_db)):
    artist = db.get(Artist, body.artistId)
    if not artist:
        raise HTTPException(404, "找不到美甲師")
    svc = db.get(Service, body.serviceId)
    if not svc or svc.artist_id != artist.id:
        raise HTTPException(400, "服務項目不正確")
    phone = re.sub(r"\D", "", body.phone)
    if not PHONE_RE.match(phone):
        raise HTTPException(400, "請輸入有效台灣手機（09 開頭 10 碼）")
    if not body.clientName.strip():
        raise HTTPException(400, "請填寫稱呼")
    if body.time not in artist.slots_list():
        raise HTTPException(400, "此時段未開放")
    try:
        from datetime import date as dtdate

        y, m, d = [int(x) for x in body.date.split("-")]
        day = dtdate(y, m, d)
        js_dow = (day.weekday() + 1) % 7
        if js_dow in artist.off_days_list():
            raise HTTPException(400, "這天公休")
        if day < dtdate.today():
            raise HTTPException(400, "不能預約過去日期")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "日期格式不正確")
    exists = (
        db.query(Booking)
        .filter(
            Booking.artist_id == artist.id,
            Booking.date == body.date,
            Booking.time == body.time,
            Booking.status == "confirmed",
        )
        .first()
    )
    if exists:
        raise HTTPException(409, "此時段剛被預約走了")
    booking = Booking(
        artist_id=artist.id,
        service_id=svc.id,
        service_name=svc.name,
        price=svc.price,
        date=body.date,
        time=body.time,
        client_name=body.clientName.strip(),
        phone=phone,
        note=body.note.strip(),
        status="confirmed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking_out(booking, artist)


@app.get("/api/bookings")
def list_bookings(phone: str, db: Session = Depends(get_db)):
    phone = re.sub(r"\D", "", phone)
    rows = (
        db.query(Booking)
        .filter(Booking.phone == phone)
        .order_by(Booking.date.desc(), Booking.time.desc())
        .all()
    )
    return [booking_out(b) for b in rows]


@app.get("/api/me/bookings")
def my_bookings(db: Session = Depends(get_db), artist: Artist = Depends(current_artist)):
    rows = (
        db.query(Booking)
        .filter(Booking.artist_id == artist.id)
        .order_by(Booking.date.desc(), Booking.time.desc())
        .all()
    )
    return [booking_out(b, artist) for b in rows]


@app.post("/api/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: int, phone: str | None = None, db: Session = Depends(get_db)):
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(404, "找不到預約")
    if not phone:
        raise HTTPException(400, "請提供預約時的手機號碼")
    if re.sub(r"\D", "", phone) != b.phone:
        raise HTTPException(403, "手機號碼不符，無法取消")
    if b.status == "cancelled":
        return booking_out(b)
    b.status = "cancelled"
    db.commit()
    db.refresh(b)
    return booking_out(b)


app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/")
def index():
    return FileResponse(FRONTEND / "index.html")


if FRONTEND.exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(FRONTEND / "js")), name="js")
