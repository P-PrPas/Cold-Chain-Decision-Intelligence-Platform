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


def request_report(client, decision, key, language):
    client.headers["Idempotency-Key"] = key
    return client.post(
        "/api/v1/decisions/" + decision["id"] + "/reports",
        json={"format": "PDF", "language": language},
    )


def complete(platform, response, result):
    _, _, engine = platform
    with Session(engine) as db:
        execute(db, db.get(Job, response.json()["job"]["id"]), result["store"])
        db.commit()


def test_thai_and_english_reports_are_distinct_and_frozen(platform):
    result = submit_decision(platform)
    client, _, _ = platform
    decision = result["decision"]
    english = request_report(client, decision, "report-en", "en")
    thai = request_report(client, decision, "report-th", "th")
    assert english.status_code == thai.status_code == 202
    assert english.json()["report"]["id"] != thai.json()["report"]["id"]
    complete(platform, english, result)
    complete(platform, thai, result)
    docs = {}
    for name, response in {"en": english, "th": thai}.items():
        report_id = response.json()["report"]["id"]
        meta = client.get("/api/v1/reports/" + report_id).json()["report"]
        assert meta["language"] == name and meta["status"] == "COMPLETED"
        assert meta["decision_snapshot_sha256"] == decision["snapshot_sha256"]
        document = client.get("/api/v1/reports/" + report_id + "/download")
        assert document.status_code == 200
        assert hashlib.sha256(document.content).hexdigest() == meta["sha256"]
        # Both languages carry the English caveat and the pinned snapshot hash.
        assert b"Not food-safety certification" in document.content
        assert decision["snapshot_sha256"].encode() in document.content
        docs[name] = document.content
    assert docs["en"] != docs["th"]
    assert b"NotoSansThai" in docs["th"] and b"NotoSansThai" not in docs["en"]


def test_report_language_idempotency_and_validation(platform):
    result = submit_decision(platform)
    client, _, _ = platform
    decision = result["decision"]
    first = request_report(client, decision, "same-key", "th")
    assert first.status_code == 202
    assert request_report(client, decision, "same-key", "th").json() == first.json()
    conflict = request_report(client, decision, "same-key", "en")
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_KEY_REUSED"
    assert request_report(client, decision, "bad-language", "fr").status_code == 422


def test_thai_pdf_render_is_reproducible_and_data_is_language_independent():
    payload = {"status": "PENDING_QA", "snapshot_sha256": "a" * 64, "snapshot": {"cost": "1.10"}}
    assert render(payload, "th") == render(payload, "th")
    assert render(payload, "en") == render(payload)
    assert b'"cost": "1.10"' in render(payload, "th")
