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


class Dataset(TenantEntity, Base):
    __tablename__ = "temperature_datasets"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        UniqueConstraint("organization_id", "shipment_id", "version"),
        ForeignKeyConstraint(
            ["organization_id", "shipment_id"], ["shipments.organization_id", "shipments.id"]
        ),
        CheckConstraint(
            "status IN ('UPLOADED','VALIDATING','READY','INVALID','FAILED')", name="dataset_status"
        ),
    )
    shipment_id: Mapped[str]
    version: Mapped[int]
    raw_object_key: Mapped[str]
    sha256: Mapped[str]
    mapping: Mapped[dict[str, Any]] = mapped_column(JSONType)
    source_timezone: Mapped[str | None]
    default_unit: Mapped[str]
    status: Mapped[str] = mapped_column(default="UPLOADED")
    row_count: Mapped[int] = mapped_column(default=0)
    validation: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))


class Reading(TenantEntity, Base):
    __tablename__ = "temperature_readings"
    __table_args__ = (
        UniqueConstraint("organization_id", "dataset_id", "source_row"),
        ForeignKeyConstraint(
            ["organization_id", "dataset_id"],
            ["temperature_datasets.organization_id", "temperature_datasets.id"],
        ),
        CheckConstraint("source_row > 0", name="source_row_positive"),
    )
    dataset_id: Mapped[str] = mapped_column(index=True)
    sensor_id: Mapped[str]
    timestamp_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    temperature_c: Mapped[Decimal] = mapped_column(Numeric(8, 3))
    quality_flag: Mapped[str] = mapped_column(default="VALID")
    source_row: Mapped[int]


class Job(TenantEntity, Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        UniqueConstraint("organization_id", "dedupe_key"),
        CheckConstraint("status IN ('QUEUED','RUNNING','COMPLETED','FAILED')", name="job_status"),
    )
    type: Mapped[str]
    resource_id: Mapped[str]
    status: Mapped[str] = mapped_column(default="QUEUED")
    attempt_count: Mapped[int] = mapped_column(default=0)
    dedupe_key: Mapped[str]
    error_code: Mapped[str | None]


class Outbox(TenantEntity, Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        ForeignKeyConstraint(["organization_id", "job_id"], ["jobs.organization_id", "jobs.id"]),
    )
    job_id: Mapped[str]
    status: Mapped[str] = mapped_column(default="PENDING")
    attempt_count: Mapped[int] = mapped_column(default=0)


class ReferenceDocument(TenantEntity, Base):
    __tablename__ = "reference_documents"
    __table_args__ = (UniqueConstraint("organization_id", "id"),)
    object_key: Mapped[str]
    sha256: Mapped[str]
    filename: Mapped[str]
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))


class Policy(TenantEntity, Base):
    __tablename__ = "quality_policy_versions"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        UniqueConstraint("organization_id", "policy_key", "version"),
        ForeignKeyConstraint(
            ["organization_id", "product_id"], ["products.organization_id", "products.id"]
        ),
        ForeignKeyConstraint(
            ["organization_id", "reference_document_id"],
            ["reference_documents.organization_id", "reference_documents.id"],
        ),
        CheckConstraint(
            "status IN ('DRAFT','PENDING_REVIEW','APPROVED','RETIRED')", name="policy_status"
        ),
    )
    product_id: Mapped[str]
    policy_key: Mapped[str]
    version: Mapped[int]
    status: Mapped[str] = mapped_column(default="DRAFT")
    rules: Mapped[dict[str, Any]] = mapped_column(JSONType)
    reference_document_id: Mapped[str | None]
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    content_sha256: Mapped[str | None]
    revision: Mapped[int] = mapped_column(default=1)


class Analysis(TenantEntity, Base):
    __tablename__ = "analysis_runs"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        ForeignKeyConstraint(
            ["organization_id", "shipment_id"], ["shipments.organization_id", "shipments.id"]
        ),
        ForeignKeyConstraint(
            ["organization_id", "dataset_id"],
            ["temperature_datasets.organization_id", "temperature_datasets.id"],
        ),
        ForeignKeyConstraint(
            ["organization_id", "policy_version_id"],
            ["quality_policy_versions.organization_id", "quality_policy_versions.id"],
        ),
    )
    shipment_id: Mapped[str]
    dataset_id: Mapped[str]
    policy_version_id: Mapped[str]
    selected_sensor_ids: Mapped[list[str]] = mapped_column(JSONType)
    status: Mapped[str] = mapped_column(default="QUEUED")
    engine_version: Mapped[str] = mapped_column(default="1.0.0")
    input_sha256: Mapped[str]
    result: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
