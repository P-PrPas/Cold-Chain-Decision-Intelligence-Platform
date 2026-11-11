from datetime import UTC
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import Field
from sqlalchemy import select

from app.access import DB, Current, audit, owned, remember, replay
from app.analytics import Rules, analyze
from app.contracts import Problem, request_hash
from app.jobs import enqueue
from app.models import Analysis, Dataset, Job, Policy, Reading, Shipment
from app.shipments import Strict, serialized

router = APIRouter(prefix="/api/v1")


class AnalysisInput(Strict):
    dataset_id: UUID
    policy_version_id: UUID
    selected_sensor_ids: list[str] = Field(min_length=1, max_length=20)


@router.post("/shipments/{shipment_id}/analyses", status_code=202)
def create(
    shipment_id: UUID, payload: AnalysisInput, request: Request, db: DB, current: Current
) -> dict[str, Any]:
    shipment = owned(db, Shipment, str(shipment_id), current)
    dataset = owned(db, Dataset, str(payload.dataset_id), current)
    policy = owned(db, Policy, str(payload.policy_version_id), current)
    if dataset.shipment_id != shipment.id or policy.product_id != shipment.product_id:
        raise Problem(422, "POLICY_NOT_APPLICABLE", "Source chain does not match shipment")
    if dataset.status != "READY":
        raise Problem(409, "DATASET_NOT_READY", "Ready dataset required")
    if policy.status != "APPROVED":
        raise Problem(422, "UNAPPROVED_POLICY", "Approved policy required")
    rules = Rules.model_validate(policy.rules)
    if set(payload.selected_sensor_ids) != set(rules.required_sensor_ids):
        raise Problem(422, "INSUFFICIENT_DATA", "Select exactly the policy-required sensors")
    times = list(
        db.scalars(
            select(Reading.timestamp_utc).where(
                Reading.organization_id == current.organization_id, Reading.dataset_id == dataset.id
            )
        )
    )
    if (
        not times
        or min(times).replace(tzinfo=UTC) < policy.effective_from.replace(tzinfo=UTC)
        or (
            policy.effective_to
            and max(times).replace(tzinfo=UTC) >= policy.effective_to.replace(tzinfo=UTC)
        )
    ):
        raise Problem(422, "POLICY_NOT_APPLICABLE", "Dataset outside policy effective interval")
    key, fingerprint, existing = replay(db, current, request, payload.model_dump(mode="json"))
    if existing:
        return existing
    item = Analysis(
        organization_id=current.organization_id,
        shipment_id=shipment.id,
        dataset_id=dataset.id,
        policy_version_id=policy.id,
        selected_sensor_ids=payload.selected_sensor_ids,
        input_sha256=request_hash(
            {
                "dataset": dataset.sha256,
                "policy": policy.content_sha256,
                "sensors": sorted(payload.selected_sensor_ids),
                "engine": "1.0.0",
            }
        ),
        created_by=current.user_id,
    )
    db.add(item)
    db.flush()
    job = enqueue(db, current.organization_id, "ANALYSIS", item.id)
    body = {"analysis": serialized(item), "job": serialized(job)}
    remember(db, current, request, key, fingerprint, body, 202)
    audit(db, current, request, "CREATE", "analysis", item.id, body)
    return body


@router.get("/analyses/{analysis_id}")
def analysis(analysis_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Analysis, str(analysis_id), current)
    return {"analysis": {**serialized(item), **item.result}}


@router.get("/analyses/{analysis_id}/excursions")
def excursions(analysis_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Analysis, str(analysis_id), current)
    return {
        "items": item.result.get("excursions", []),
        "unknown_intervals": item.result.get("unknown_intervals", []),
        "next_cursor": None,
    }


def execute_analysis(db: DB, job: Job) -> None:
    item = db.scalar(
        select(Analysis)
        .where(Analysis.id == job.resource_id, Analysis.organization_id == job.organization_id)
        .with_for_update()
    )
    if not item:
        raise ValueError("RESOURCE_NOT_FOUND")
    if item.status == "COMPLETED":
        return
    policy = db.scalar(
        select(Policy).where(
            Policy.id == item.policy_version_id, Policy.organization_id == job.organization_id
        )
    )
    if not policy:
        raise ValueError("UNAPPROVED_POLICY")
    rows = [
        {
            "sensor_id": r.sensor_id,
            "timestamp_utc": r.timestamp_utc,
            "temperature_c": r.temperature_c,
        }
        for r in db.scalars(
            select(Reading).where(
                Reading.organization_id == job.organization_id,
                Reading.dataset_id == item.dataset_id,
            )
        )
    ]
    item.result = analyze(rows, Rules.model_validate(policy.rules))
    item.status = "COMPLETED"
