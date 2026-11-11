from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import Request
from sqlalchemy import JSON, DateTime, ForeignKey, MetaData, String, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

JSONType = JSON().with_variant(JSONB(), "postgresql")


def now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_N_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class Entity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TenantEntity(Entity):
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)


def database_url(url: str) -> str:
    return url.replace("postgresql://", "postgresql+psycopg://", 1)


def connect(url: str) -> Any:
    return create_engine(database_url(url), pool_pre_ping=True)


def session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise


def set_tenant(db: Session, organization_id: str) -> None:
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        from sqlalchemy import text

        db.execute(
            text("SELECT set_config('cc.organization_id', :tenant, true)"),
            {"tenant": organization_id},
        )
