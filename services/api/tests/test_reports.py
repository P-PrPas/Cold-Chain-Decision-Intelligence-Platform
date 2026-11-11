import hashlib

from conftest import use_identity
from sqlalchemy.orm import Session
from test_decisions import submit_decision

from app.jobs import execute
from app.models import Job
from app.reports import render


def test_report_is_frozen_and_private(platform):
    result = submit_decision(platform)
    client, identities, engine = platform
    decision = result["decision"]
    client.headers["Idempotency-Key"] = "report"
    response = client.post(
        "/api/v1/decisions/" + decision["id"] + "/reports", json={"format": "PDF", "language": "en"}
    )
    assert response.status_code == 202, response.text
    report = response.json()["report"]
    assert client.get("/api/v1/reports/" + report["id"] + "/download").status_code == 409
    with Session(engine) as db:
        execute(db, db.get(Job, response.json()["job"]["id"]), result["store"])
        db.commit()
    document = client.get("/api/v1/reports/" + report["id"] + "/download")
    assert document.status_code == 200
    assert (
        document.content.startswith(b"%PDF-")
        and decision["snapshot_sha256"].encode() in document.content
    )
    assert b"Not food-safety certification" in document.content
    meta = client.get("/api/v1/reports/" + report["id"]).json()["report"]
    assert hashlib.sha256(document.content).hexdigest() == meta["sha256"]
    use_identity(client, identities[2])
    assert client.get("/api/v1/reports/" + report["id"] + "/download").status_code == 404
    assert client.get("/api/v1/dashboard").json()["shipment_counts"] == {}


def test_pdf_render_is_reproducible():
    payload = {
        "status": "PENDING_QA",
        "snapshot_sha256": "a" * 64,
        "snapshot": {"cost": "1.10", "note": "(untrusted) <script>"},
    }
    assert render(payload) == render(payload)
