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
        ]:
            with pytest.raises(DBAPIError):
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
