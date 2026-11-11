import base64
import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Generic, TypeVar
from uuid import UUID

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, PlainSerializer


class Problem(Exception):
    def __init__(self, status: int, code: str, detail: str) -> None:
        self.status, self.code, self.detail = status, code, detail


class ProblemBody(BaseModel):
    type: str
    title: str
    status: int
    code: str
    detail: str
    request_id: str
    errors: list[dict[str, str]] = Field(default_factory=list)


def decimal_input(value: object) -> object:
    if not isinstance(value, str):
        raise ValueError("Decimal must be a string")
    return value


Money = Annotated[
    Decimal,
    BeforeValidator(decimal_input),
    Field(ge=0, max_digits=18, decimal_places=2, allow_inf_nan=False),
    PlainSerializer(lambda v: format(v, ".2f"), return_type=str),
]


def aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Explicit timezone required")
    return value.astimezone(UTC)


UTCDateTime = Annotated[
    datetime,
    AfterValidator(aware),
    PlainSerializer(lambda v: v.isoformat().replace("+00:00", "Z"), return_type=str),
]
T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    total_count: int | None = None


class Cursor(BaseModel):
    organization_id: UUID
    scope: str
    created_at: UTCDateTime
    id: UUID


def encode_cursor(cursor: Cursor) -> str:
    return base64.urlsafe_b64encode(cursor.model_dump_json().encode()).decode()


def decode_cursor(value: str, organization_id: UUID, scope: str) -> Cursor:
    try:
        if len(value) > 2048:
            raise ValueError()
        cursor = Cursor.model_validate_json(base64.b64decode(value, altchars=b"-_", validate=True))
        if cursor.organization_id != organization_id or cursor.scope != scope:
            raise ValueError()
        return cursor
    except (ValueError, TypeError):
        raise Problem(422, "VALIDATION_ERROR", "Invalid cursor") from None


def etag(resource: str, revision: int) -> str:
    return f'"{resource}-r{revision}"'


def require_match(value: str | None, expected: str) -> None:
    if value is None:
        raise Problem(428, "PRECONDITION_REQUIRED", "If-Match required")
    if value != expected:
        raise Problem(412, "STALE_REVISION", "Resource revision changed")


def request_hash(payload: dict[str, object]) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def require_same_request(stored_hash: str, current_hash: str) -> None:
    if stored_hash != current_hash:
        raise Problem(409, "IDEMPOTENCY_KEY_REUSED", "Key already used for different input")
