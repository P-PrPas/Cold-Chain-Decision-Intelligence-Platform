from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response
from pydantic import Field
from sqlalchemy import select

from app.access import DB, Current, audit, owned, permit, remember, replay
from app.analyses import require_current_analysis
from app.contracts import Problem, etag, request_hash, require_match
from app.db import now
from app.models import (
    Analysis,
    Audit,
    Dataset,
    Decision,
    Explanation,
    Organization,
    Policy,
    ReferenceDocument,
    Scenario,
    Shipment,
    Simulation,
)
from app.shipments import Strict, page, serialized

router = APIRouter(prefix="/api/v1")


def lock_decision_workflow(db: DB, current: Current) -> None:
    # All decision writers take the same lock BEFORE any decision row lock.
    db.scalar(
        select(Organization).where(Organization.id == current.organization_id).with_for_update()
    )


def active_decisions(db: DB, current: Current, shipment_id: str, excluding: str) -> list[Decision]:
    return list(
        db.scalars(
            select(Decision)
            .join(
                Simulation,
                (Simulation.id == Decision.simulation_run_id)
                & (Simulation.organization_id == Decision.organization_id),
            )
            .where(
                Decision.organization_id == current.organization_id,
                Simulation.shipment_id == shipment_id,
                Decision.id != excluding,
                Decision.status.in_(["PENDING_QA", "APPROVED"]),
            )
        )
    )


class DecisionInput(Strict):
    simulation_run_id: UUID
    selected_scenario_id: UUID
    justification: str = Field(min_length=1, max_length=4000)
    supersedes_decision_id: UUID | None = None


class Submit(Strict):
    justification: str = Field(min_length=1, max_length=4000)


class Review(Strict):
    acting_role: Literal["QA"] = "QA"
    review_notes: str = Field(min_length=1, max_length=4000)
    evidence_references: list[str] = Field(default_factory=list, max_length=50)
    acknowledged_required_actions: list[str] = Field(default_factory=list, max_length=20)


def allowed(scenario: Scenario) -> None:
    if scenario.eligibility in {"BLOCKED", "INSUFFICIENT_DATA"}:
        raise Problem(
            422, "SCENARIO_BLOCKED", "Blocked or insufficient-data scenarios cannot be proposed"
        )


def source_snapshot(
    db: DB, current: Current, run: Simulation, scenario: Scenario
) -> dict[str, Any]:
    dataset = owned(db, Dataset, run.dataset_id, current)
    policy = owned(db, Policy, run.policy_version_id, current)
    analysis = owned(db, Analysis, run.analysis_id, current)
    shipment = owned(db, Shipment, run.shipment_id, current)
    require_current_analysis(analysis, shipment)
    if (
        dataset.status != "READY"
        or policy.status != "APPROVED"
        or analysis.status != "COMPLETED"
        or run.status != "COMPLETED"
    ):
        raise Problem(422, "INSUFFICIENT_DATA", "Complete approved source chain required")
    explanation = db.scalar(
        select(Explanation)
        .where(
            Explanation.organization_id == current.organization_id,
            Explanation.simulation_run_id == run.id,
            Explanation.status == "COMPLETED",
        )
        .order_by(Explanation.created_at.desc())
    )
    return {
        "shipment": serialized(shipment),
        "dataset": {"id": dataset.id, "version": dataset.version, "sha256": dataset.sha256},
        "policy": serialized(policy),
        "analysis": serialized(analysis),
        "simulation": serialized(run),
        "scenario": serialized(scenario),
        "explanation": serialized(explanation) if explanation else None,
        "proposer": current.user_id,
        "limitations": [
            "Internal QA workflow only; not food-safety certification or physical dispatch."
        ],
    }


@router.post("/decisions", status_code=201)
def create(
    payload: DecisionInput, request: Request, response: Response, db: DB, current: Current
) -> dict[str, Any]:
    lock_decision_workflow(db, current)
    run = owned(db, Simulation, str(payload.simulation_run_id), current)
    scenario = owned(db, Scenario, str(payload.selected_scenario_id), current)
    if scenario.simulation_run_id != run.id:
        raise Problem(422, "VALIDATION_ERROR", "Scenario does not belong to simulation")
    if run.status != "COMPLETED":
        raise Problem(409, "SIMULATION_NOT_READY", "Completed simulation required")
    allowed(scenario)
    if not payload.justification.strip():
        raise Problem(422, "VALIDATION_ERROR", "Justification required")
    key, fingerprint, existing = replay(db, current, request, payload.model_dump(mode="json"))
    if existing:
        response.headers["ETag"] = etag("decision", existing["decision"]["revision"])
        return existing
    if payload.supersedes_decision_id:
        previous = owned(db, Decision, str(payload.supersedes_decision_id), current)
        previous_run = owned(db, Simulation, previous.simulation_run_id, current)
        if (
            previous.status not in {"CHANGES_REQUESTED", "APPROVED", "PENDING_QA"}
            or previous_run.shipment_id != run.shipment_id
        ):
            raise Problem(
                409,
                "INVALID_STATE_TRANSITION",
                "Correction must replace a current decision for the same shipment",
            )
    item = Decision(
        organization_id=current.organization_id,
        simulation_run_id=run.id,
        selected_scenario_id=scenario.id,
        justification=payload.justification,
        submitted_by=current.user_id,
        supersedes_decision_id=str(payload.supersedes_decision_id)
        if payload.supersedes_decision_id
        else None,
    )
    db.add(item)
    db.flush()
    body = {"decision": serialized(item)}
    remember(db, current, request, key, fingerprint, body)
    audit(db, current, request, "CREATE", "decision", item.id, body)
    response.headers["ETag"] = etag("decision", item.revision)
    return body


@router.get("/decisions")
def decisions(
    db: DB,
    current: Current,
    status: str | None = None,
    limit: int = Query(25, ge=1, le=100),
    cursor: str | None = None,
) -> dict[str, Any]:
    return page(
        db,
        current,
        Decision,
        limit,
        cursor,
        f"decisions:{status}",
        [Decision.status == status] if status else [],
    )


@router.get("/decisions/{decision_id}")
def decision(decision_id: UUID, response: Response, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Decision, str(decision_id), current)
    response.headers["ETag"] = etag("decision", item.revision)
    return {"decision": serialized(item)}


@router.post("/decisions/{decision_id}/submit")
def submit(
    decision_id: UUID,
    payload: Submit,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    lock_decision_workflow(db, current)
    item = owned(db, Decision, str(decision_id), current, True)
    if item.submitted_by != current.user_id:
        raise Problem(403, "PERMISSION_DENIED", "Only proposer can submit")
    key, fingerprint, existing = replay(
        db, current, request, {**payload.model_dump(), "if_match": request.headers.get("If-Match")}
    )
    if existing:
        response.headers["ETag"] = etag("decision", existing["decision"]["revision"])
        return existing
    require_match(request.headers.get("If-Match"), etag("decision", item.revision))
    if item.status != "DRAFT":
        raise Problem(409, "INVALID_STATE_TRANSITION", "Draft required")
    run = owned(db, Simulation, item.simulation_run_id, current)
    scenario = owned(db, Scenario, item.selected_scenario_id, current)
    allowed(scenario)
    active = active_decisions(db, current, run.shipment_id, item.id)
    if any(previous.id != item.supersedes_decision_id for previous in active):
        raise Problem(
            409, "ACTIVE_DECISION_EXISTS", "Explicitly supersede the current shipment decision"
        )
    if item.supersedes_decision_id:
        previous = owned(db, Decision, item.supersedes_decision_id, current, True)
        previous_run = owned(db, Simulation, previous.simulation_run_id, current)
        if previous_run.shipment_id != run.shipment_id or previous.status not in {
            "PENDING_QA",
            "APPROVED",
            "CHANGES_REQUESTED",
        }:
            raise Problem(409, "INVALID_STATE_TRANSITION", "Correction source is no longer current")
        previous.status = "SUPERSEDED"
        previous.revision += 1
        audit(
            db,
            current,
            request,
            "SUPERSEDE",
            "decision",
            previous.id,
            {"replacement_decision_id": item.id, "snapshot_sha256": previous.snapshot_sha256},
        )
    item.justification = payload.justification
    item.submitted_at = now()
    item.snapshot = {
        **source_snapshot(db, current, run, scenario),
        "justification": payload.justification,
        "submitted_at": item.submitted_at.isoformat(),
    }
    item.snapshot_sha256 = request_hash(item.snapshot)
    item.status = "PENDING_QA"
    item.revision += 1
    body = {"decision": serialized(item)}
    remember(db, current, request, key, fingerprint, body, 200)
    audit(
        db,
        current,
        request,
        "SUBMIT",
        "decision",
        item.id,
        {"snapshot_sha256": item.snapshot_sha256},
    )
    response.headers["ETag"] = etag("decision", item.revision)
    return body


def review(
    decision_id: UUID,
    action: str,
    payload: Review,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    if action not in {"approve", "reject", "request-changes"}:
        raise Problem(404, "RESOURCE_NOT_FOUND", "Unknown review action")
    permit(current, "QA")
    lock_decision_workflow(db, current)
    item = owned(db, Decision, str(decision_id), current, True)
    key, fingerprint, existing = replay(
        db, current, request, {**payload.model_dump(), "if_match": request.headers.get("If-Match")}
    )
    if existing:
        response.headers["ETag"] = etag("decision", existing["decision"]["revision"])
        return existing
    require_match(request.headers.get("If-Match"), etag("decision", item.revision))
    if item.status != "PENDING_QA":
        raise Problem(409, "INVALID_STATE_TRANSITION", "Pending QA decision required")
    org = db.get(Organization, current.organization_id)
    if org and org.require_separation_of_duties and item.submitted_by == current.user_id:
        raise Problem(403, "SELF_APPROVAL_FORBIDDEN", "Independent QA reviewer required")
    if not payload.review_notes.strip():
        raise Problem(422, "VALIDATION_ERROR", "Review notes required")
    if not item.snapshot or request_hash(item.snapshot) != item.snapshot_sha256:
        raise Problem(409, "INVALID_STATE_TRANSITION", "Snapshot integrity failure")
    if action == "approve":
        run = owned(db, Simulation, item.simulation_run_id, current)
        shipment = owned(db, Shipment, run.shipment_id, current, True)
        require_current_analysis(owned(db, Analysis, run.analysis_id, current), shipment)
        if active_decisions(db, current, run.shipment_id, item.id):
            raise Problem(
                409, "ACTIVE_DECISION_EXISTS", "Another decision is current for this shipment"
            )
        scenario = owned(db, Scenario, item.selected_scenario_id, current)
        allowed(scenario)
        if not payload.evidence_references:
            raise Problem(422, "INSUFFICIENT_DATA", "Stored reference evidence required")
        for reference in payload.evidence_references:
            if not reference.startswith("reference:"):
                raise Problem(
                    422, "VALIDATION_ERROR", "Evidence must reference a stored reference document"
                )
            owned(db, ReferenceDocument, reference.removeprefix("reference:"), current)
        required = (
            "HOLD_IN_CONTROLLED_STORAGE"
            if scenario.type == "HOLD_INSPECTION"
            else "REVIEW_PINNED_EVIDENCE"
        )
        if required not in payload.acknowledged_required_actions:
            raise Problem(422, "INSUFFICIENT_DATA", "Required action acknowledgement missing")
    item.status = {
        "approve": "APPROVED",
        "reject": "REJECTED",
        "request-changes": "CHANGES_REQUESTED",
    }[action]
    item.reviewed_by = current.user_id
    item.reviewed_at = now()
    item.review_notes = payload.review_notes
    item.review_evidence = payload.model_dump()
    item.revision += 1
    body = {"decision": serialized(item)}
    remember(db, current, request, key, fingerprint, body, 200)
    audit(
        db,
        current,
        request,
        action,
        "decision",
        item.id,
        {"snapshot_sha256": item.snapshot_sha256, "review": payload.model_dump()},
        "QA",
    )
    response.headers["ETag"] = etag("decision", item.revision)
    return body


@router.get("/audit-logs")
def audits(
    db: DB, current: Current, limit: int = Query(25, ge=1, le=100), cursor: str | None = None
) -> dict[str, Any]:
    permit(current, "ADMIN", "QA")
    return page(db, current, Audit, limit, cursor, "audit", [])


@router.post("/decisions/{decision_id}/approve")
def approve_decision(
    decision_id: UUID,
    payload: Review,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    return review(decision_id, "approve", payload, request, response, db, current)


@router.post("/decisions/{decision_id}/reject")
def reject_decision(
    decision_id: UUID,
    payload: Review,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    return review(decision_id, "reject", payload, request, response, db, current)


@router.post("/decisions/{decision_id}/request-changes")
def request_changes_decision(
    decision_id: UUID,
    payload: Review,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    return review(decision_id, "request-changes", payload, request, response, db, current)
