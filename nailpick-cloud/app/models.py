import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .db import Base


class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True)
    email = Column(String(190), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(80), nullable=False)
    studio = Column(String(120), nullable=False)
    city = Column(String(40), nullable=False)
    district = Column(String(40), default="")
    years = Column(Integer, default=1)
    rating = Column(Float, default=5.0)
    reviews = Column(Integer, default=0)
    bio = Column(Text, default="")
    styles = Column(Text, default="[]")
    avatar = Column(String(500), default="")
    cover = Column(String(500), default="")
    off_days = Column(Text, default="[]")
    slots = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)

    services = relationship("Service", back_populates="artist", cascade="all, delete-orphan")
    works = relationship("Work", back_populates="artist", cascade="all, delete-orphan", order_by="Work.id.desc()")
    bookings = relationship("Booking", back_populates="artist")

    def styles_list(self):
        try:
            return json.loads(self.styles or "[]")
        except json.JSONDecodeError:
            return []

    def off_days_list(self):
        try:
            return json.loads(self.off_days or "[]")
        except json.JSONDecodeError:
            return []

    def slots_list(self):
        try:
            return json.loads(self.slots or "[]")
        except json.JSONDecodeError:
            return []


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    mins = Column(Integer, default=90)
    price = Column(Integer, nullable=False)
    artist = relationship("Artist", back_populates="services")


class Work(Base):
    __tablename__ = "works"

    id = Column(Integer, primary_key=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    artist = relationship("Artist", back_populates="works")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        UniqueConstraint("artist_id", "date", "time", "status", name="uniq_slot_active"),
    )

    id = Column(Integer, primary_key=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    service_name = Column(String(120), nullable=False)
    price = Column(Integer, nullable=False)
    date = Column(String(10), nullable=False, index=True)
    time = Column(String(5), nullable=False)
    client_name = Column(String(80), nullable=False)
    phone = Column(String(20), nullable=False, index=True)
    note = Column(Text, default="")
    status = Column(String(20), default="confirmed")
    created_at = Column(DateTime, default=datetime.utcnow)

    artist = relationship("Artist", back_populates="bookings")
