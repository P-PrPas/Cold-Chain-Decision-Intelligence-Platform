import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC
from typing import Annotated, Any, TypeVar
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts import Problem, request_hash, require_same_request
from app.db import TenantEntity, now, session, set_tenant
from app.models import Audit, Idempotency, LoginSession, MemberRole, Membership, Organization, User

DB = Annotated[Session, Depends(session, scope="function")]
T = TypeVar("T", bound=TenantEntity)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@dataclass
class Actor:
    user_id: str
    organization_id: str
    roles: set[str]


def authenticated(request: Request, db: DB) -> User:
    token = request.cookies.get("cc_session", "")
    record = db.scalar(select(LoginSession).where(LoginSession.token_hash == digest(token)))
    if not record or record.expires_at.replace(tzinfo=UTC) <= now():
        raise Problem(401, "AUTH_REQUIRED", "Sign in required")
    user = db.get(User, record.user_id)
    if not user or user.status != "ACTIVE":
        raise Problem(401, "AUTH_REQUIRED", "Sign in required")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(record.csrf_hash, digest(csrf)):
            raise Problem(403, "PERMISSION_DENIED", "CSRF validation failed")
    return user


def actor(request: Request, db: DB, user: Annotated[User, Depends(authenticated)]) -> Actor:
    try:
        organization_id = str(UUID(request.headers.get("X-Organization-Id", "")))
    except ValueError:
        raise Problem(422, "TENANT_CONTEXT_REQUIRED", "Select an organization") from None
    membership = db.scalar(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.organization_id == organization_id,
            Membership.status == "ACTIVE",
        )
    )
    organization = db.get(Organization, organization_id)
    if not membership or not organization or organization.status != "ACTIVE":
        raise Problem(403, "TENANT_MEMBERSHIP_INVALID", "Membership unavailable")
    roles = set(
        db.scalars(select(MemberRole.role).where(MemberRole.membership_id == membership.id))
    )
    if not roles:
        raise Problem(403, "PERMISSION_DENIED", "An assigned role is required")
    set_tenant(db, organization_id)
    return Actor(user.id, organization_id, roles)


Current = Annotated[Actor, Depends(actor)]


def permit(actor: Actor, *roles: str) -> None:
    if not actor.roles.intersection(roles):
        raise Problem(403, "PERMISSION_DENIED", "Role does not permit this operation")


def owned(db: Session, model: type[T], identifier: str, actor: Actor, lock: bool = False) -> T:
    statement = select(model).where(
        model.id == identifier, model.organization_id == actor.organization_id
    )
    if lock:
        statement = statement.with_for_update()
    value = db.scalar(statement)
    if value is None:
        raise Problem(404, "RESOURCE_NOT_FOUND", "Resource unavailable")
    return value


def replay(
    db: Session, actor: Actor, request: Request, payload: dict[str, Any]
) -> tuple[str, str, dict[str, Any] | None]:
    key = request.headers.get("Idempotency-Key", "")
    if not 1 <= len(key) <= 128:
        raise Problem(422, "VALIDATION_ERROR", "Idempotency-Key required (1-128 characters)")
    route = request.method + " " + request.url.path
    fingerprint = request_hash(payload)
    # Serialize tenant writes so a concurrent key cannot perform duplicate effects.
    db.scalar(
        select(Organization).where(Organization.id == actor.organization_id).with_for_update()
    )
    record = db.scalar(
        select(Idempotency).where(
            Idempotency.organization_id == actor.organization_id,
            Idempotency.actor_id == actor.user_id,
            Idempotency.route_key == route,
            Idempotency.idempotency_key == key,
        )
    )
    if record:
        require_same_request(record.request_hash, fingerprint)
        return key, fingerprint, record.response_json
    return key, fingerprint, None


def remember(
    db: Session,
    actor: Actor,
    request: Request,
    key: str,
    fingerprint: str,
    body: dict[str, Any],
    status: int = 201,
) -> None:
    db.add(
        Idempotency(
            organization_id=actor.organization_id,
            actor_id=actor.user_id,
            route_key=request.method + " " + request.url.path,
            idempotency_key=key,
            request_hash=fingerprint,
            response_json=body,
            response_status=status,
        )
    )


def audit(
    db: Session,
    actor: Actor,
    request: Request,
    action: str,
    entity_type: str,
    identifier: str,
    payload: dict[str, Any],
    role: str | None = None,
) -> None:
    db.add(
        Audit(
            organization_id=actor.organization_id,
            actor_id=actor.user_id,
            acting_role=role or next(iter(sorted(actor.roles)), "NONE"),
            action=action,
            entity_type=entity_type,
            entity_id=identifier,
            request_id=request.state.request_id,
            after_digest=request_hash(payload),
        )
    )
