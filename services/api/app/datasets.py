import hashlib
import json
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, Query, Request, UploadFile
from sqlalchemy import func, select

from app.access import DB, Current, audit, owned, remember, replay
from app.contracts import Problem
from app.jobs import enqueue
from app.models import Dataset, Job, Reading, Shipment
from app.shipments import page, serialized
from app.storage import S3Store

router = APIRouter(prefix="/api/v1")


def public_dataset(item: Dataset) -> dict[str, Any]:
    body = serialized(item)
    body.pop("raw_object_key", None)
    return body


@router.post("/shipments/{shipment_id}/temperature-datasets", status_code=202)
async def upload(
    shipment_id: UUID,
    request: Request,
    db: DB,
    current: Current,
    file: UploadFile = File(...),
    mapping: str = Form(...),
    source_timezone: str | None = Form(None),
    default_unit: str = Form("C"),
    conflicting_duplicate_mode: str = Form("REJECT"),
) -> dict[str, Any]:
    shipment = owned(db, Shipment, str(shipment_id), current, True)
    if shipment.status in {"CLOSED", "CANCELLED"}:
        raise Problem(409, "INVALID_STATE_TRANSITION", "Shipment is closed")
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise Problem(415, "UNSUPPORTED_MEDIA", "CSV file required")
    if conflicting_duplicate_mode != "REJECT":
        raise Problem(422, "VALIDATION_ERROR", "Duplicates must be rejected")
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise Problem(413, "FILE_TOO_LARGE", "CSV exceeds 10 MB")
    try:
        columns = json.loads(mapping)
        if (
            not isinstance(columns, dict)
            or not {"timestamp", "temperature"} <= columns.keys()
            or not columns.keys() <= {"timestamp", "temperature", "sensor_id"}
            or not all(isinstance(v, str) for v in columns.values())
        ):
            raise ValueError()
    except (ValueError, TypeError):
        raise Problem(422, "COLUMN_MAPPING_REQUIRED", "Invalid mapping") from None
    if default_unit not in {"C", "F"}:
        raise Problem(422, "VALIDATION_ERROR", "Invalid temperature unit")
    digest = hashlib.sha256(content).hexdigest()
    key, fingerprint, existing = replay(
        db,
        current,
        request,
        {"sha256": digest, "mapping": columns, "timezone": source_timezone, "unit": default_unit},
    )
    if existing:
        return existing
    version = (
        db.scalar(
            select(func.max(Dataset.version)).where(
                Dataset.organization_id == current.organization_id,
                Dataset.shipment_id == shipment.id,
            )
        )
        or 0
    ) + 1
    identifier = str(uuid4())
    object_key = f"{current.organization_id}/datasets/{identifier}/{digest}.csv"
    store = getattr(request.app.state, "store", None) or S3Store(request.app.state.settings)
    store.put(object_key, content, "text/csv")
    item = Dataset(
        id=identifier,
        organization_id=current.organization_id,
        shipment_id=shipment.id,
        version=version,
        raw_object_key=object_key,
        sha256=digest,
        mapping=columns,
        source_timezone=source_timezone,
        default_unit=default_unit,
        uploaded_by=current.user_id,
    )
    db.add(item)
    db.flush()
    job = enqueue(db, current.organization_id, "DATASET_IMPORT", item.id)
    body = {"dataset": public_dataset(item), "job": serialized(job)}
    remember(db, current, request, key, fingerprint, body, 202)
    audit(
        db, current, request, "UPLOAD", "dataset", item.id, {"sha256": digest, "version": version}
    )
    return body


@router.get("/shipments/{shipment_id}/temperature-datasets")
def datasets(
    shipment_id: UUID,
    db: DB,
    current: Current,
    limit: int = Query(25, ge=1, le=100),
    cursor: str | None = None,
) -> dict[str, Any]:
    owned(db, Shipment, str(shipment_id), current)
    result = page(
        db,
        current,
        Dataset,
        limit,
        cursor,
        f"datasets:{shipment_id}",
        [Dataset.shipment_id == str(shipment_id)],
    )
    for item in result["items"]:
        item.pop("raw_object_key", None)
    return result


@router.get("/temperature-datasets/{dataset_id}")
def dataset(dataset_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    return {"dataset": public_dataset(owned(db, Dataset, str(dataset_id), current))}


@router.get("/temperature-datasets/{dataset_id}/validation")
def validation(dataset_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Dataset, str(dataset_id), current)
    return {"dataset_id": item.id, "status": item.status, **item.validation}


@router.get("/temperature-datasets/{dataset_id}/readings")
def readings(
    dataset_id: UUID,
    db: DB,
    current: Current,
    limit: int = Query(100, ge=1, le=100),
    cursor: str | None = None,
    sensor_id: str | None = None,
    resolution: str = "raw",
    max_points: int = Query(100, ge=2, le=1000),
) -> dict[str, Any]:
    item = owned(db, Dataset, str(dataset_id), current)
    if item.status != "READY":
        raise Problem(409, "DATASET_NOT_READY", "Dataset not ready")
    if resolution != "raw":
        raise Problem(
            422, "VALIDATION_ERROR", "Use paginated raw readings; aggregation is not enabled"
        )
    filters = [Reading.dataset_id == item.id]
    if sensor_id:
        filters.append(Reading.sensor_id == sensor_id)
    result = page(
        db, current, Reading, limit, cursor, f"readings:{dataset_id}:{sensor_id}", filters
    )
    result["unknown_intervals"] = []
    result["gap_evaluation"] = "REQUIRES_POLICY_ANALYSIS"
    return result


@router.get("/jobs/{job_id}")
def job(job_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    return {"job": serialized(owned(db, Job, str(job_id), current))}
