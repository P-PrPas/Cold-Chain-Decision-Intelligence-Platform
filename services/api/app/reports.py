import hashlib
import io
import json
import textwrap
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Request, Response
from reportlab.pdfgen.canvas import Canvas  # type: ignore[import-untyped]
from sqlalchemy import func, select

from app.access import DB, Current, audit, owned, remember, replay
from app.contracts import Problem, request_hash
from app.decisions import lock_decision_workflow
from app.jobs import enqueue
from app.models import Analysis, Decision, Job, Report, Shipment
from app.shipments import Strict, serialized
from app.storage import S3Store, Store

router = APIRouter(prefix="/api/v1")


class ReportInput(Strict):
    format: Literal["PDF"] = "PDF"
    language: Literal["en"] = "en"


def render(payload: dict[str, Any]) -> bytes:
    stream = io.BytesIO()
    canvas = Canvas(stream, invariant=1, pageCompression=0)
    canvas.setTitle("Cold Chain internal QA evidence")
    y = 800
    lines = [
        "COLD CHAIN - INTERNAL QA EVIDENCE",
        "Not food-safety certification. No automatic release or dispatch.",
        "Decision status at report request: " + payload["status"],
        "Pinned snapshot SHA256: " + payload["snapshot_sha256"],
        "",
    ]
    lines += json.dumps(payload, sort_keys=True, indent=2, ensure_ascii=True).splitlines()
    for line in lines:
        for part in textwrap.wrap(line, width=100, replace_whitespace=False) or [""]:
            if y < 45:
                canvas.showPage()
                y = 800
            canvas.setFont("Courier", 8)
            canvas.drawString(30, y, part)
            y -= 11
    canvas.save()
    return stream.getvalue()


@router.post("/decisions/{decision_id}/reports", status_code=202)
def create(
    decision_id: UUID, payload: ReportInput, request: Request, db: DB, current: Current
) -> dict[str, Any]:
    lock_decision_workflow(db, current)
    item = owned(db, Decision, str(decision_id), current, True)
    if not item.snapshot or not item.snapshot_sha256:
        raise Problem(409, "REPORT_NOT_READY", "Submitted decision snapshot required")
    if request_hash(item.snapshot) != item.snapshot_sha256:
        raise Problem(409, "INVALID_STATE_TRANSITION", "Snapshot integrity failure")
    key, fingerprint, existing = replay(db, current, request, payload.model_dump())
    if existing:
        return existing
    frozen = {
        "decision_id": item.id,
        "status": item.status,
        "snapshot": item.snapshot,
        "snapshot_sha256": item.snapshot_sha256,
        "reviewed_by": item.reviewed_by,
        "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
        "review_notes": item.review_notes,
        "review_evidence": item.review_evidence,
    }
    report = Report(
        organization_id=current.organization_id,
        decision_id=item.id,
        decision_snapshot_sha256=item.snapshot_sha256,
        frozen_payload=frozen,
    )
    db.add(report)
    db.flush()
    job = enqueue(db, current.organization_id, "REPORT", report.id)
    body = {"report": {"id": report.id, "status": report.status}, "job": serialized(job)}
    remember(db, current, request, key, fingerprint, body, 202)
    audit(
        db,
        current,
        request,
        "CREATE",
        "report",
        report.id,
        {"snapshot_sha256": item.snapshot_sha256},
    )
    return body


@router.get("/reports/{report_id}")
def report(report_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Report, str(report_id), current)
    return {
        "report": {
            "id": item.id,
            "decision_id": item.decision_id,
            "status": item.status,
            "format": "PDF",
            "sha256": item.sha256,
            "decision_snapshot_sha256": item.decision_snapshot_sha256,
        }
    }


@router.get("/reports/{report_id}/download")
def download(report_id: UUID, request: Request, db: DB, current: Current) -> Response:
    item = owned(db, Report, str(report_id), current)
    if item.status != "COMPLETED" or not item.object_key:
        raise Problem(409, "REPORT_NOT_READY", "Report not ready")
    store = getattr(request.app.state, "store", None) or S3Store(request.app.state.settings)
    content = store.get(item.object_key)
    if hashlib.sha256(content).hexdigest() != item.sha256:
        raise Problem(503, "DEPENDENCY_UNAVAILABLE", "Report integrity verification failed")
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="decision-{item.decision_id}.pdf"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/dashboard")
def dashboard(db: DB, current: Current) -> dict[str, Any]:
    counts = {
        status: count
        for status, count in db.execute(
            select(Shipment.status, func.count())
            .where(Shipment.organization_id == current.organization_id)
            .group_by(Shipment.status)
        )
    }
    pending = (
        db.scalar(
            select(func.count())
            .select_from(Decision)
            .where(
                Decision.organization_id == current.organization_id, Decision.status == "PENDING_QA"
            )
        )
        or 0
    )
    analyses = list(
        db.scalars(
            select(Analysis)
            .where(
                Analysis.organization_id == current.organization_id, Analysis.status == "COMPLETED"
            )
            .order_by(Analysis.created_at.desc())
            .limit(100)
        )
    )
    return {
        "shipment_counts": counts,
        "pending_qa": pending,
        "recent_analyses": [
            {
                "id": a.id,
                "classification": a.result.get("classification"),
                "shipment_id": a.shipment_id,
            }
            for a in analyses
        ],
        "recent_decisions": [
            {"id": d.id, "status": d.status}
            for d in db.scalars(
                select(Decision)
                .where(Decision.organization_id == current.organization_id)
                .order_by(Decision.created_at.desc())
                .limit(10)
            )
        ],
    }


def execute_report(db: DB, job: Job, store: Store) -> None:
    item = db.scalar(
        select(Report)
        .where(Report.id == job.resource_id, Report.organization_id == job.organization_id)
        .with_for_update()
    )
    if not item:
        raise ValueError("RESOURCE_NOT_FOUND")
    if item.status == "COMPLETED":
        return
    if request_hash(item.frozen_payload["snapshot"]) != item.decision_snapshot_sha256:
        raise ValueError("SNAPSHOT_INTEGRITY")
    content = render(item.frozen_payload)
    digest = hashlib.sha256(content).hexdigest()
    key = f"{job.organization_id}/reports/{item.id}/{digest}.pdf"
    store.put(key, content, "application/pdf")
    item.object_key = key
    item.sha256 = digest
    item.status = "COMPLETED"
