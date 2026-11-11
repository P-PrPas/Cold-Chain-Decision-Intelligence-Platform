from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import and_, or_, select

from app.access import DB, Current, audit, owned, permit, remember, replay
from app.contracts import (
    Cursor,
    Money,
    Problem,
    UTCDateTime,
    decode_cursor,
    encode_cursor,
    etag,
    require_match,
)
from app.models import Product, Shipment

router = APIRouter(prefix="/api/v1")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProductInput(Strict):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    packaging_type: str | None = Field(default=None, max_length=100)
    active: bool = True
    notes: str | None = Field(default=None, max_length=2000)


class Location(Strict):
    name: str = Field(min_length=1, max_length=200)
    country: str | None = Field(default=None, pattern="^[A-Z]{2}$")


class ShipmentInput(Strict):
    reference: str = Field(min_length=1, max_length=100)
    product_id: UUID
    origin: Location
    destination: Location
    departure_at: UTCDateTime
    estimated_arrival_at: UTCDateTime
    cargo_value: Money
    currency: Literal["THB", "USD", "EUR", "GBP", "JPY"]
    batch_reference: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def times(self) -> "ShipmentInput":
        if self.departure_at >= self.estimated_arrival_at:
            raise ValueError("Arrival must follow departure")
        if self.currency == "JPY" and self.cargo_value != self.cargo_value.to_integral_value():
            raise ValueError("JPY requires whole units")
        return self


class ShipmentPatch(Strict):
    origin: Location | None = None
    destination: Location | None = None
    estimated_arrival_at: UTCDateTime | None = None
    status: Literal["DRAFT", "READY", "IN_TRANSIT", "ARRIVED", "CLOSED", "CANCELLED"] | None = None
    notes: str | None = Field(default=None, max_length=2000)


def serialized(item: Any) -> dict[str, Any]:
    result = {}
    for column in item.__table__.columns:
        value = getattr(item, column.name)
        if isinstance(value, datetime):
            value = value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")
        elif isinstance(value, Decimal):
            value = str(value)
        result[column.name] = value
    return result


def page(
    db: DB,
    current: Current,
    model: Any,
    limit: int,
    cursor: str | None,
    scope: str,
    filters: list[Any],
) -> dict[str, Any]:
    statement = select(model).where(model.organization_id == current.organization_id, *filters)
    if cursor:
        point = decode_cursor(cursor, UUID(current.organization_id), scope)
        statement = statement.where(
            or_(
                model.created_at < point.created_at,
                and_(model.created_at == point.created_at, model.id < str(point.id)),
            )
        )
    items = list(
        db.scalars(statement.order_by(model.created_at.desc(), model.id.desc()).limit(limit + 1))
    )
    next_cursor = None
    if len(items) > limit:
        last = items[limit - 1]
        next_cursor = encode_cursor(
            Cursor(
                organization_id=current.organization_id,
                scope=scope,
                created_at=last.created_at.replace(tzinfo=UTC),
                id=last.id,
            )
        )
    return {
        "items": [serialized(item) for item in items[:limit]],
        "next_cursor": next_cursor,
        "total_count": None,
    }


@router.post("/products", status_code=201)
def create_product(
    payload: ProductInput, request: Request, db: DB, current: Current
) -> dict[str, Any]:
    permit(current, "ADMIN", "QA")
    item = Product(organization_id=current.organization_id, **payload.model_dump())
    db.add(item)
    db.flush()
    body = {"product": serialized(item)}
    audit(db, current, request, "CREATE", "product", item.id, body)
    return body


@router.get("/products")
def products(
    db: DB,
    current: Current,
    limit: int = Query(25, ge=1, le=100),
    cursor: str | None = None,
    active: bool | None = None,
) -> dict[str, Any]:
    return page(
        db,
        current,
        Product,
        limit,
        cursor,
        f"products:{active}",
        [] if active is None else [Product.active == active],
    )


@router.get("/products/{product_id}")
def product(product_id: UUID, response: Response, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Product, str(product_id), current)
    response.headers["ETag"] = etag("product", item.revision)
    return {"product": serialized(item)}


@router.patch("/products/{product_id}")
def update_product(
    product_id: UUID,
    payload: ProductInput,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    permit(current, "ADMIN", "QA")
    item = owned(db, Product, str(product_id), current, True)
    require_match(request.headers.get("If-Match"), etag("product", item.revision))
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.revision += 1
    response.headers["ETag"] = etag("product", item.revision)
    body = {"product": serialized(item)}
    audit(db, current, request, "UPDATE", "product", item.id, body)
    return body


@router.post("/shipments", status_code=201)
def create_shipment(
    payload: ShipmentInput, request: Request, db: DB, current: Current
) -> dict[str, Any]:
    permit(current, "ADMIN", "LOGISTICS")
    owned(db, Product, str(payload.product_id), current)
    key, fingerprint, existing = replay(db, current, request, payload.model_dump(mode="json"))
    if existing:
        return existing
    fields = payload.model_dump()
    fields["product_id"] = str(payload.product_id)
    item = Shipment(organization_id=current.organization_id, **fields)
    db.add(item)
    db.flush()
    body = {"shipment": serialized(item)}
    remember(db, current, request, key, fingerprint, body)
    audit(db, current, request, "CREATE", "shipment", item.id, body)
    return body


@router.get("/shipments")
def shipments(
    db: DB,
    current: Current,
    limit: int = Query(25, ge=1, le=100),
    cursor: str | None = None,
    status: str | None = None,
    reference: str | None = None,
    product_id: UUID | None = None,
) -> dict[str, Any]:
    filters = []
    if status:
        filters.append(Shipment.status == status)
    if reference:
        filters.append(Shipment.reference == reference)
    if product_id:
        filters.append(Shipment.product_id == str(product_id))
    return page(
        db,
        current,
        Shipment,
        limit,
        cursor,
        f"shipments:{status}:{reference}:{product_id}",
        filters,
    )


@router.get("/shipments/{shipment_id}")
def shipment(shipment_id: UUID, response: Response, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Shipment, str(shipment_id), current)
    response.headers["ETag"] = etag("shipment", item.revision)
    return {"shipment": serialized(item)}


@router.patch("/shipments/{shipment_id}")
def update_shipment(
    shipment_id: UUID,
    payload: ShipmentPatch,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    permit(current, "ADMIN", "LOGISTICS")
    item = owned(db, Shipment, str(shipment_id), current, True)
    require_match(request.headers.get("If-Match"), etag("shipment", item.revision))
    if item.status in {"CLOSED", "CANCELLED"}:
        raise Problem(409, "INVALID_STATE_TRANSITION", "Closed shipment cannot be edited")
    transitions = {
        "DRAFT": {"READY", "CANCELLED"},
        "READY": {"IN_TRANSIT", "CANCELLED"},
        "IN_TRANSIT": {"ARRIVED", "CANCELLED"},
        "ARRIVED": {"CLOSED"},
    }
    if (
        payload.status
        and payload.status != item.status
        and payload.status not in transitions.get(item.status, set())
    ):
        raise Problem(409, "INVALID_STATE_TRANSITION", "Invalid shipment transition")
    if payload.estimated_arrival_at and payload.estimated_arrival_at <= item.departure_at.replace(
        tzinfo=UTC
    ):
        raise Problem(422, "VALIDATION_ERROR", "Arrival must follow departure")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is None and key != "notes":
            raise Problem(422, "VALIDATION_ERROR", "Field cannot be null")
        setattr(item, key, value)
    item.revision += 1
    body = {"shipment": serialized(item)}
    audit(db, current, request, "UPDATE", "shipment", item.id, body)
    response.headers["ETag"] = etag("shipment", item.revision)
    return body
