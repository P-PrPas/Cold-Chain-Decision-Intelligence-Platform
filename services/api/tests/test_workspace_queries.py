from datetime import UTC, datetime
from uuid import uuid4

from conftest import use_identity
from helpers import prepare
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session
from test_decisions import submit_decision

from app.jobs import execute
from app.models import Analysis, Dataset, Job


def test_server_search_pages_and_tenant_scope(platform):
    client, identities, _ = platform
    use_identity(client, identities[0])
    product = client.post(
        "/api/v1/products", json={"name": "Search test", "category": "TEST"}
    ).json()["product"]
    ids = []
    for i in range(31):
        client.headers["Idempotency-Key"] = f"search-{i}"
        r = client.post(
            "/api/v1/shipments",
            json={
                "reference": f"QUEUE-{i:02}",
                "product_id": product["id"],
                "origin": {"name": "Origin"},
                "destination": {"name": "Unique receiver" if i == 0 else "Receiver"},
                "departure_at": "2026-01-01T00:00:00Z",
                "estimated_arrival_at": "2026-01-01T01:00:00Z",
                "cargo_value": "100.00",
                "currency": "THB",
            },
        )
        assert r.status_code == 201, r.text
        ids.append(r.json()["shipment"]["id"])
    first = client.get("/api/v1/shipments").json()
    assert len(first["items"]) == 25 and first["next_cursor"]
    second = client.get("/api/v1/shipments", params={"cursor": first["next_cursor"]}).json()
    assert len(second["items"]) == 6
    assert (
        client.get("/api/v1/shipments", params={"q": "queue-00"}).json()["items"][0]["id"] == ids[0]
    )
    assert (
        client.get("/api/v1/shipments", params={"q": "Unique receiver"}).json()["items"][0]["id"]
        == ids[0]
    )
    assert client.get("/api/v1/shipments", params={"q": "%"}).json()["items"] == []
    assert (
        client.get(
            "/api/v1/shipments", params={"q": "other", "cursor": first["next_cursor"]}
        ).status_code
        == 422
    )
    use_identity(client, identities[2])
    assert client.get("/api/v1/shipments", params={"q": "queue"}).json()["items"] == []
    assert client.get(f"/api/v1/shipments/{ids[0]}/workflow").status_code == 404


def test_scoped_decisions_and_saved_workflow(platform):
    result = submit_decision(platform)
    client, identities, _ = platform
    shipment_id = result["simulation"]["shipment_id"]
    scoped = client.get("/api/v1/decisions", params={"shipment_id": shipment_id, "limit": 1})
    assert scoped.status_code == 200, scoped.text
    assert scoped.json()["items"][0]["id"] == result["decision"]["id"]
    saved = client.get(f"/api/v1/shipments/{shipment_id}/workflow").json()
    assert saved["decision"]["status"] == "PENDING_QA"
    assert saved["analysis"]["id"] == result["simulation"]["analysis_id"]
    assert saved["simulation"]["id"] == result["simulation"]["id"]
    assert client.get(f"/api/v1/shipments/{shipment_id}/analyses").json()["items"]
    use_identity(client, identities[2])
    assert client.get("/api/v1/decisions", params={"shipment_id": shipment_id}).status_code == 404


def listing(client, **params):
    response = client.get("/api/v1/shipments", params=params)
    assert response.status_code == 200, response.text
    return response.json()["items"]


def utc(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def reanalyze(platform, prepared, key, run=True):
    client, _, engine = platform
    client.headers["Idempotency-Key"] = key
    response = client.post(
        f"/api/v1/shipments/{prepared['shipment']['id']}/analyses",
        json={
            "dataset_id": prepared["dataset"]["id"],
            "policy_version_id": prepared["policy"]["id"],
            "selected_sensor_ids": ["A"],
        },
    )
    assert response.status_code == 202, response.text
    if run:
        with Session(engine) as db:
            execute(db, db.get(Job, response.json()["job"]["id"]), prepared["store"])
            db.commit()
    return response.json()["analysis"]["id"]


def test_list_carries_stored_evidence_and_activity(platform):
    prepared = prepare(platform, "gaps")
    client, _, engine = platform
    stored = client.get("/api/v1/analyses/" + prepared["analysis"]["id"]).json()["analysis"]
    item = listing(client)[0]
    assert item["id"] == prepared["shipment"]["id"]
    assert item["evidence"] == {
        "analysis_id": prepared["analysis"]["id"],
        "classification": stored["classification"],
        "unknown_seconds": stored["summary"]["unknown_seconds"],
        "excursion_count": stored["summary"]["excursion_count"],
        "coverage_window_known": stored["summary"]["coverage_window_known"],
        "coverage_window": stored["coverage_window"],
    }
    # Unknown time is surfaced as unknown, never folded into a compliant outcome.
    assert item["evidence"]["unknown_seconds"] > 0
    assert item["evidence"]["classification"] != "NORMAL"
    with Session(engine) as db:
        stamps = [db.scalar(select(Analysis.created_at)), db.scalar(select(Dataset.created_at))]
    newest = max([utc(item["created_at"])] + [s.replace(tzinfo=UTC) for s in stamps])
    assert utc(item["last_activity_at"]) == newest
    # Existing keys are unchanged and additive keys sit alongside them.
    assert {"reference", "status", "revision", "created_at", "updated_at"} <= item.keys()
    assert "evidence" not in client.get("/api/v1/shipments/" + item["id"]).json()["shipment"]


def test_list_without_analysis_has_null_evidence_and_edit_bumps_activity(platform):
    client, identities, _ = platform
    use_identity(client, identities[0])
    product = client.post("/api/v1/products", json={"name": "Bare", "category": "T"}).json()[
        "product"
    ]
    client.headers["Idempotency-Key"] = "bare"
    created = client.post(
        "/api/v1/shipments",
        json={
            "reference": "BARE",
            "product_id": product["id"],
            "origin": {"name": "A"},
            "destination": {"name": "B"},
            "departure_at": "2026-01-01T00:00:00Z",
            "estimated_arrival_at": "2026-01-01T01:00:00Z",
            "cargo_value": "1.00",
            "currency": "THB",
        },
    ).json()["shipment"]
    before = listing(client)[0]
    assert before["evidence"] is None and before["updated_at"] is None
    assert before["last_activity_at"] == created["created_at"]
    patched = client.patch(
        "/api/v1/shipments/" + created["id"],
        json={"status": "READY"},
        headers={"If-Match": '"shipment-r1"'},
    )
    assert patched.status_code == 200, patched.text
    after = listing(client)[0]
    assert after["updated_at"] and utc(after["last_activity_at"]) >= utc(before["last_activity_at"])
    assert after["last_activity_at"] == after["updated_at"]


def test_newer_completed_analysis_replaces_older_but_queued_does_not(platform):
    prepared = prepare(platform)
    client, _, _ = platform
    assert listing(client)[0]["evidence"]["analysis_id"] == prepared["analysis"]["id"]
    second = reanalyze(platform, prepared, "second-analysis")
    assert listing(client)[0]["evidence"]["analysis_id"] == second
    reanalyze(platform, prepared, "queued-analysis", run=False)
    item = listing(client)[0]
    assert item["evidence"]["analysis_id"] == second
    assert item["evidence"]["classification"] is not None


def test_other_tenant_rows_never_affect_list(platform):
    prepared = prepare(platform, "gaps")
    client, identities, engine = platform
    mine = listing(client)[0]
    if engine.dialect.name == "sqlite":
        # Seed a hostile cross-tenant analysis that claims tenant A's shipment id.
        with Session(engine) as db:
            db.execute(text("PRAGMA foreign_keys=OFF"))
            db.add(
                Analysis(
                    id=str(uuid4()),
                    organization_id=identities[2]["org"],
                    shipment_id=prepared["shipment"]["id"],
                    dataset_id=prepared["dataset"]["id"],
                    policy_version_id=prepared["policy"]["id"],
                    selected_sensor_ids=["A"],
                    status="COMPLETED",
                    input_sha256="x",
                    result={"classification": "NORMAL", "summary": {"unknown_seconds": 0}},
                    created_by=identities[2]["user"],
                    created_at=datetime(2999, 1, 1, tzinfo=UTC),
                )
            )
            db.commit()
        assert listing(client)[0] == mine
    use_identity(client, identities[2])
    assert listing(client) == []


def test_evidence_query_count_is_independent_of_page_size(platform):
    prepared = prepare(platform)
    client, _, engine = platform
    for i in range(11):
        client.headers["Idempotency-Key"] = f"bulk-{i}"
        created = client.post(
            "/api/v1/shipments",
            json={
                "reference": f"BULK-{i:02}",
                "product_id": prepared["shipment"]["product_id"],
                "origin": {"name": "A"},
                "destination": {"name": "B"},
                "departure_at": "2026-01-01T00:00:00Z",
                "estimated_arrival_at": "2026-01-01T01:00:00Z",
                "cargo_value": "1.00",
                "currency": "THB",
            },
        )
        assert created.status_code == 201
    statements = []

    def count(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", count)
    try:
        sizes = {}
        for limit in (2, 12):
            statements.clear()
            assert len(listing(client, limit=limit)) == limit
            sizes[limit] = len(statements)
    finally:
        event.remove(engine, "before_cursor_execute", count)
    assert sizes[2] == sizes[12], sizes
