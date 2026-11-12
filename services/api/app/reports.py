import hashlib
import io
import json
import textwrap
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Request, Response
from reportlab.pdfbase import pdfmetrics  # type: ignore[import-untyped]
from reportlab.pdfbase.ttfonts import TTFont  # type: ignore[import-untyped]
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
    language: Literal["en", "th"] = "en"


# Noto Sans Thai Regular, SIL OFL 1.1 (see app/fonts/OFL.txt). ReportLab does no OpenType shaping.
THAI_FONT = "NotoSansThai"
pdfmetrics.registerFont(
    TTFont(THAI_FONT, str(Path(__file__).parent / "fonts" / "NotoSansThai-Regular.ttf"))
)
DISCLAIMER = "Not food-safety certification. No automatic release or dispatch."
THAI_LABELS = {
    "title": "ห่วงโซ่ความเย็น - หลักฐาน QA ภายใน",
    "disclaimer": "ไม่ใช่การรับรองความปลอดภัยของอาหาร ไม่มีการปล่อยสินค้าหรือการจัดส่งโดยอัตโนมัติ",
    "status": "สถานะการตัดสินใจ ณ เวลาที่ขอรายงาน: ",
    "hash": "SHA256 ของสแนปชอตที่ล็อกไว้: ",
    "data": "ข้อมูลสแนปชอตที่ล็อกไว้ (JSON ตามต้นฉบับ ไม่มีการคำนวณใหม่):",
}


def runs(text: str, font: str) -> list[tuple[str, str]]:
    """Split text so Thai letters use the Thai font and everything else (Latin, digits) Courier.

    Noto Sans Thai carries no Latin letters, so mixed labels such as "QA" or hashes need Courier.
    """
    if font != THAI_FONT:
        return [(text, font)]
    result: list[tuple[str, str]] = []
    for char in text:
        face = THAI_FONT if "฀" <= char <= "๿" else "Courier"
        if result and result[-1][1] == face:
            result[-1] = (result[-1][0] + char, face)
        else:
            result.append((char, face))
    return result


def render(payload: dict[str, Any], language: str = "en") -> bytes:
    """Language changes presentation labels only; the JSON body is the frozen payload verbatim."""
    stream = io.BytesIO()
    canvas = Canvas(stream, invariant=1, pageCompression=0)
    canvas.setTitle("Cold Chain internal QA evidence")
    y = 800
    thai = THAI_LABELS
    # (font, size, text) triples; Courier cannot draw Thai so labels switch to the embedded font.
    lines: list[tuple[str, int, str]] = (
        [
            ("Courier", 8, "COLD CHAIN - INTERNAL QA EVIDENCE"),
            ("Courier", 8, DISCLAIMER),
            ("Courier", 8, "Decision status at report request: " + payload["status"]),
            ("Courier", 8, "Pinned snapshot SHA256: " + payload["snapshot_sha256"]),
            ("Courier", 8, ""),
        ]
        if language != "th"
        else [
            (THAI_FONT, 11, thai["title"]),
            (THAI_FONT, 9, thai["disclaimer"]),
            ("Courier", 8, DISCLAIMER),
            (THAI_FONT, 9, thai["status"] + payload["status"]),
            (THAI_FONT, 9, thai["hash"] + payload["snapshot_sha256"]),
            (THAI_FONT, 9, thai["data"]),
            ("Courier", 8, ""),
        ]
    )
    lines += [
        ("Courier", 8, line)
        for line in json.dumps(payload, sort_keys=True, indent=2, ensure_ascii=True).splitlines()
    ]
    for font, size, line in lines:
        for part in textwrap.wrap(line, width=100, replace_whitespace=False) or [""]:
            if y < 45:
                canvas.showPage()
                y = 800
            x = 30.0
            for run, run_font in runs(part, font):
                canvas.setFont(run_font, size)
                canvas.drawString(x, y, run)
                x += pdfmetrics.stringWidth(run, run_font, size)
            y -= 11 if size <= 9 else 14
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
        language=payload.language,
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
            "language": item.language,
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
    content = render(item.frozen_payload, item.language)
    digest = hashlib.sha256(content).hexdigest()
    key = f"{job.organization_id}/reports/{item.id}/{digest}.pdf"
    store.put(key, content, "application/pdf")
    item.object_key = key
    item.sha256 = digest
    item.status = "COMPLETED"
