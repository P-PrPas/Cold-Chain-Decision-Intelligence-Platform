import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from conftest import use_identity
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from test_decisions import submit_decision

from app.db import set_tenant

pytestmark = pytest.mark.skipif(
    not os.environ.get("CC_TEST_POSTGRES_URL"),
    reason="Requires isolated PostgreSQL verification database",
)


def test_atomic_concurrent_qa_reviews(platform):
    result = submit_decision(platform)
    client, identities, _ = platform
    use_identity(client, identities[1])
    payload = {
        "acting_role": "QA",
        "review_notes": "Concurrent synthetic approval",
        "evidence_references": ["reference:" + result["policy"]["reference_document_id"]],
        "acknowledged_required_actions": ["HOLD_IN_CONTROLLED_STORAGE"],
    }
    path = "/api/v1/decisions/" + result["decision"]["id"] + "/approve"

    def approve(index):
        return client.post(
            path,
            json=payload,
            headers={"If-Match": '"decision-r2"', "Idempotency-Key": f"concurrent-{index}"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(approve, [1, 2]))
    assert sorted(statuses) == [200, 412]


def test_distinct_decisions_cannot_become_current_concurrently(platform):
    from test_review_regressions import draft
    from test_simulations import simulate

    result = simulate(platform)
    client, _, _ = platform
    decisions = [draft(client, result, "parallel-draft-" + str(index)) for index in range(2)]

    def submit(index):
        return client.post(
            f"/api/v1/decisions/{decisions[index]['id']}/submit",
            headers={"Idempotency-Key": f"parallel-submit-{index}", "If-Match": '"decision-r1"'},
            json={"justification": "Concurrent disposition"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(submit, [0, 1])) == [200, 409]


def test_concurrent_corrections_preserve_approved_predecessor(platform):
    from test_review_regressions import draft

    result = submit_decision(platform)
    client, identities, _ = platform
    original = result["decision"]
    use_identity(client, identities[1])
    response = client.post(
        f"/api/v1/decisions/{original['id']}/approve",
        headers={"Idempotency-Key": "approve-before-corrections", "If-Match": '"decision-r2"'},
        json={
            "review_notes": "Original QA review",
            "evidence_references": ["reference:" + result["policy"]["reference_document_id"]],
            "acknowledged_required_actions": ["HOLD_IN_CONTROLLED_STORAGE"],
        },
    )
    assert response.status_code == 200
    approved = response.json()["decision"]
    use_identity(client, identities[0])
    corrections = [draft(client, result, f"correction-{i}", original["id"]) for i in range(2)]

    def submit(index):
        return client.post(
            f"/api/v1/decisions/{corrections[index]['id']}/submit",
            headers={"Idempotency-Key": f"submit-correction-{index}", "If-Match": '"decision-r1"'},
            json={"justification": "Request QA correction"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(submit, [0, 1])) == [200, 409]
    assert client.get(f"/api/v1/decisions/{original['id']}").json()["decision"] == approved


def test_database_immutability_and_non_bypass_rls(platform):
    result = submit_decision(platform)
    _, identities, engine = platform
    with Session(engine) as db:
        for statement, params in [
            ("UPDATE decisions SET snapshot='{}' WHERE id=:id", {"id": result["decision"]["id"]}),
            (
                "UPDATE quality_policy_versions SET rules='{}' WHERE id=:id",
                {"id": result["policy"]["id"]},
            ),
            ("UPDATE analysis_runs SET result='{}' WHERE id=:id", {"id": result["analysis"]["id"]}),
            ("UPDATE audit_logs SET action='tampered'", {}),
            (
                "UPDATE reference_documents SET sha256='tampered' WHERE id=:id",
                {"id": result["policy"]["reference_document_id"]},
            ),
            (
                "UPDATE temperature_datasets SET source_timezone='tampered' WHERE id=:id",
                {"id": result["dataset"]["id"]},
            ),
            (
                "UPDATE simulation_scenarios SET result='{}' WHERE simulation_run_id=:id",
                {"id": result["simulation"]["id"]},
            ),
        ]:
            with pytest.raises(DBAPIError, match="immutable|append only"):
                db.execute(text(statement), params)
                db.commit()
            db.rollback()
    role = "verify_" + uuid4().hex
    with engine.begin() as connection:
        schema = connection.scalar(text("SELECT current_schema()"))
        connection.execute(text(f"CREATE ROLE {role} NOLOGIN NOSUPERUSER NOBYPASSRLS"))
        connection.execute(text(f'GRANT USAGE ON SCHEMA "{schema}" TO {role}'))
        connection.execute(text(f'GRANT SELECT ON ALL TABLES IN SCHEMA "{schema}" TO {role}'))
    try:
        with Session(engine) as db:
            db.execute(text(f"SET LOCAL ROLE {role}"))
            set_tenant(db, identities[2]["org"])
            assert db.execute(text("SELECT id FROM shipments")).all() == []
            set_tenant(db, identities[0]["org"])
            assert len(db.execute(text("SELECT id FROM shipments")).all()) == 1
    finally:
        with engine.begin() as connection:
            connection.execute(text(f"DROP OWNED BY {role}"))
            connection.execute(text(f"DROP ROLE {role}"))


def test_concurrent_shipment_reference_and_dataset_versions(platform):
    import json

    from helpers import prepare
    from test_temperature import MAPPING, ROOT

    result = prepare(platform)
    client, _, _ = platform
    shipment = result["shipment"]
    body = {
        key: shipment[key]
        for key in (
            "product_id",
            "origin",
            "destination",
            "departure_at",
            "estimated_arrival_at",
            "cargo_value",
            "currency",
        )
    }
    body["reference"] = "CONCURRENT"

    def create(index):
        return client.post(
            "/api/v1/shipments",
            json=body,
            headers={"Idempotency-Key": f"parallel-shipment-{index}"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(create, [1, 2])) == [201, 409]

    def upload(index):
        response = client.post(
            f"/api/v1/shipments/{shipment['id']}/temperature-datasets",
            headers={"Idempotency-Key": f"parallel-dataset-{index}"},
            data={"mapping": json.dumps(MAPPING)},
            files={"file": ("normal.csv", (ROOT / "normal.csv").read_bytes(), "text/csv")},
        )
        assert response.status_code == 202, response.text
        return response.json()["dataset"]["version"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(upload, [1, 2])) == [2, 3]


def test_disposable_migration_round_trip(platform):
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.downgrade(config, "base")
    command.upgrade(config, "head")
