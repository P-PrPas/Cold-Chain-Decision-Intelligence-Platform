from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, Entity, JSONType, TenantEntity


class Organization(Entity, Base):
    __tablename__ = "organizations"
    name: Mapped[str]
    status: Mapped[str] = mapped_column(default="ACTIVE")
    require_separation_of_duties: Mapped[bool] = mapped_column(default=True)


class User(Entity, Base):
    __tablename__ = "users"
    identity_subject: Mapped[str] = mapped_column(unique=True)
    email: Mapped[str]
    name: Mapped[str]
    status: Mapped[str] = mapped_column(default="ACTIVE")


class Membership(TenantEntity, Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id"),
        UniqueConstraint("organization_id", "id"),
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(default="ACTIVE")


class MemberRole(Base):
    __tablename__ = "membership_roles"
    __table_args__ = (
        CheckConstraint("role IN ('ADMIN','LOGISTICS','QA')", name="role_vocabulary"),
    )
    membership_id: Mapped[str] = mapped_column(
        ForeignKey("organization_memberships.id"), primary_key=True
    )
    role: Mapped[str] = mapped_column(primary_key=True)


class LoginSession(Entity, Base):
    __tablename__ = "sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(unique=True)
    csrf_hash: Mapped[str]
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Product(TenantEntity, Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        UniqueConstraint("organization_id", "name"),
        CheckConstraint("revision > 0", name="product_revision"),
    )
    name: Mapped[str]
    category: Mapped[str]
    packaging_type: Mapped[str | None]
    notes: Mapped[str | None]
    active: Mapped[bool] = mapped_column(default=True)
    revision: Mapped[int] = mapped_column(default=1)


class Shipment(TenantEntity, Base):
    __tablename__ = "shipments"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        UniqueConstraint("organization_id", "reference"),
        ForeignKeyConstraint(
            ["organization_id", "product_id"], ["products.organization_id", "products.id"]
        ),
        CheckConstraint("estimated_arrival_at > departure_at", name="shipment_time"),
        CheckConstraint("cargo_value >= 0 AND revision > 0", name="shipment_values"),
        CheckConstraint(
            "status IN ('DRAFT','READY','IN_TRANSIT','ARRIVED','CLOSED','CANCELLED')",
            name="shipment_status",
        ),
    )
    reference: Mapped[str]
    product_id: Mapped[str]
    origin: Mapped[dict[str, Any]] = mapped_column(JSONType)
    destination: Mapped[dict[str, Any]] = mapped_column(JSONType)
    departure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    estimated_arrival_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cargo_value: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3))
    batch_reference: Mapped[str | None]
    notes: Mapped[str | None]
    status: Mapped[str] = mapped_column(default="DRAFT")
    revision: Mapped[int] = mapped_column(default=1)


class Idempotency(TenantEntity, Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("organization_id", "actor_id", "route_key", "idempotency_key"),
    )
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    route_key: Mapped[str]
    idempotency_key: Mapped[str]
    request_hash: Mapped[str]
    response_status: Mapped[int]
    response_json: Mapped[dict[str, Any]] = mapped_column(JSONType)


class Audit(TenantEntity, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (UniqueConstraint("organization_id", "id"),)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    acting_role: Mapped[str]
    action: Mapped[str]
    entity_type: Mapped[str]
    entity_id: Mapped[str]
    request_id: Mapped[str]
    after_digest: Mapped[str]
