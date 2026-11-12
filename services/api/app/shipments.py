from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import and_, func, or_, select

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
from app.db import now
from app.models import Analysis, Dataset, Decision, Product, Report, Shipment, Simulation

router = APIRouter(prefix="/api/v1")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProductInput(Strict):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    packaging_type: str | None = Field(default=None, max_length=100)
    active: bool = True
    notes: str | None = Field(default=None, max_length=2000)


class ProductPatch(Strict):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    packaging_type: str | None = Field(default=None, max_length=100)
    active: bool | None = None
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


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def iso(value: datetime) -> str:
    return utc(value).isoformat().replace("+00:00", "Z")


def evidence_summary(analysis: Analysis) -> dict[str, Any]:
    """Echo stored analysis output only; nothing here is recomputed or inferred."""
    result = analysis.result or {}
    summary = result.get("summary") or {}
    return {
        "analysis_id": analysis.id,
        "classification": result.get("classification"),
        "unknown_seconds": summary.get("unknown_seconds"),
        "excursion_count": summary.get("excursion_count"),
        "coverage_window_known": summary.get("coverage_window_known"),
        "coverage_window": result.get("coverage_window"),
    }


def with_evidence(db: DB, current: Current, listing: dict[str, Any]) -> dict[str, Any]:
    """Add last_activity_at and evidence to a shipment page using constant-count batch queries."""
    items = listing["items"]
    ids = [item["id"] for item in items]
    if not ids:
        return listing
    org = current.organization_id
    latest: dict[str, list[datetime]] = {i: [] for i in ids}

    def collect(rows: Any) -> None:
        for shipment_id, *stamps in rows:
            latest[shipment_id].extend(stamp for stamp in stamps if stamp is not None)

    collect(
        db.execute(
            select(Dataset.shipment_id, func.max(Dataset.created_at))
            .where(Dataset.organization_id == org, Dataset.shipment_id.in_(ids))
            .group_by(Dataset.shipment_id)
        )
    )
    collect(
        db.execute(
            select(Analysis.shipment_id, func.max(Analysis.created_at))
            .where(Analysis.organization_id == org, Analysis.shipment_id.in_(ids))
            .group_by(Analysis.shipment_id)
        )
    )
    collect(
        db.execute(
            select(Simulation.shipment_id, func.max(Simulation.created_at))
            .where(Simulation.organization_id == org, Simulation.shipment_id.in_(ids))
            .group_by(Simulation.shipment_id)
        )
    )
    collect(
        db.execute(
            select(
                Simulation.shipment_id,
                func.max(Decision.created_at),
                func.max(Decision.submitted_at),
                func.max(Decision.reviewed_at),
            )
            .join(Simulation, Simulation.id == Decision.simulation_run_id)
            .where(
                Decision.organization_id == org,
                Simulation.organization_id == org,
                Simulation.shipment_id.in_(ids),
            )
            .group_by(Simulation.shipment_id)
        )
    )
    collect(
        db.execute(
            select(Simulation.shipment_id, func.max(Report.created_at))
            .join(Decision, Decision.id == Report.decision_id)
            .join(Simulation, Simulation.id == Decision.simulation_run_id)
            .where(
                Report.organization_id == org,
                Decision.organization_id == org,
                Simulation.organization_id == org,
                Simulation.shipment_id.in_(ids),
            )
            .group_by(Simulation.shipment_id)
        )
    )
    rank = (
        func.row_number()
        .over(
            partition_by=Analysis.shipment_id,
            order_by=(Analysis.created_at.desc(), Analysis.id.desc()),
        )
        .label("rank")
    )
    newest = (
        select(Analysis.id, rank)
        .where(
            Analysis.organization_id == org,
            Analysis.status == "COMPLETED",
            Analysis.shipment_id.in_(ids),
        )
        .subquery()
    )
    evidence = {
        a.shipment_id: evidence_summary(a)
        for a in db.scalars(
            select(Analysis)
            .join(newest, newest.c.id == Analysis.id)
            .where(newest.c.rank == 1, Analysis.organization_id == org)
        )
    }
    for item in items:
        own = [datetime.fromisoformat(item["created_at"])]
        if item.get("updated_at"):
            own.append(datetime.fromisoformat(item["updated_at"]))
        item["last_activity_at"] = iso(max([utc(v) for v in own + latest[item["id"]]]))
        item["evidence"] = evidence.get(item["id"])
    return listing


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
    payload: ProductPatch,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    permit(current, "ADMIN", "QA")
    item = owned(db, Product, str(product_id), current, True)
    require_match(request.headers.get("If-Match"), etag("product", item.revision))
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is None and key in {"name", "category", "active"}:
            raise Problem(422, "VALIDATION_ERROR", "Field cannot be null")
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
    q: str | None = Query(None, max_length=200),
    product_id: UUID | None = None,
    from_at: UTCDateTime | None = Query(None, alias="from"),
    to_at: UTCDateTime | None = Query(None, alias="to"),
    sort: Literal["created_at"] = "created_at",
) -> dict[str, Any]:
    filters = []
    if from_at and to_at and from_at >= to_at:
        raise Problem(422, "VALIDATION_ERROR", "Invalid departure interval")
    if from_at:
        filters.append(Shipment.departure_at >= from_at)
    if to_at:
        filters.append(Shipment.departure_at < to_at)
    if status:
        filters.append(Shipment.status == status)
    if reference:
        filters.append(Shipment.reference == reference)
    if q and q.strip():
        term = q.strip().replace("/", "//").replace("%", "/%").replace("_", "/_")
        pattern = f"%{term}%"
        filters.append(
            or_(
                Shipment.reference.ilike(pattern, escape="/"),
                Shipment.origin["name"].as_string().ilike(pattern, escape="/"),
                Shipment.destination["name"].as_string().ilike(pattern, escape="/"),
            )
        )
    if product_id:
        filters.append(Shipment.product_id == str(product_id))
    return with_evidence(
        db,
        current,
        page(
            db,
            current,
            Shipment,
            limit,
            cursor,
            f"shipments:{status}:{reference}:{product_id}:{from_at}:{to_at}:{sort}:{q}",
            filters,
        ),
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
    item.updated_at = now()
    body = {"shipment": serialized(item)}
    audit(db, current, request, "UPDATE", "shipment", item.id, body)
    response.headers["ETag"] = etag("shipment", item.revision)
    return body


@router.get("/shipments/{shipment_id}/workflow")
def workflow(shipment_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    shipment = owned(db, Shipment, str(shipment_id), current)

    def latest(model: Any, *filters: Any) -> Any:
        return db.scalar(
            select(model)
            .where(model.organization_id == current.organization_id, *filters)
            .order_by(model.created_at.desc(), model.id.desc())
            .limit(1)
        )

    analysis = latest(Analysis, Analysis.shipment_id == shipment.id, Analysis.status == "COMPLETED")
    run = latest(
        Simulation, Simulation.shipment_id == shipment.id, Simulation.status == "COMPLETED"
    )
    run_ids = select(Simulation.id).where(
        Simulation.organization_id == current.organization_id, Simulation.shipment_id == shipment.id
    )
    decision = latest(Decision, Decision.simulation_run_id.in_(run_ids))
    approved = latest(
        Decision, Decision.simulation_run_id.in_(run_ids), Decision.status == "APPROVED"
    )
    return {
        "analysis": serialized(analysis) if analysis else None,
        "simulation": serialized(run) if run else None,
        "decision": serialized(decision) if decision else None,
        "approved_decision": serialized(approved) if approved else None,
    }
