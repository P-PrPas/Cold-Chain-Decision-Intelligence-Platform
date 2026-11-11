import json

from conftest import use_identity
from sqlalchemy.orm import Session
from test_analytics import rules
from test_temperature import MAPPING, ROOT, MemoryStore

from app.jobs import execute
from app.models import Job


def prepare(platform, name="normal"):
    client, identities, engine = platform
    use_identity(client, identities[0])
    store = MemoryStore()
    client.app.state.store = store
    product = client.post("/api/v1/products", json={"name": "Fruit", "category": "TEST"}).json()[
        "product"
    ]
    client.headers["Idempotency-Key"] = "ship"
    ship = client.post(
        "/api/v1/shipments",
        json={
            "reference": "TEST",
            "product_id": product["id"],
            "origin": {"name": "A"},
            "destination": {"name": "B"},
            "departure_at": "2026-01-01T00:00:00Z",
            "estimated_arrival_at": "2026-01-01T01:00:00Z",
            "cargo_value": "100.00",
            "currency": "THB",
        },
    ).json()["shipment"]
    client.headers["Idempotency-Key"] = "upload"
    uploaded = client.post(
        f"/api/v1/shipments/{ship['id']}/temperature-datasets",
        data={"mapping": json.dumps(MAPPING)},
        files={"file": (name + ".csv", (ROOT / (name + ".csv")).read_bytes(), "text/csv")},
    ).json()
    with Session(engine) as db:
        execute(db, db.get(Job, uploaded["job"]["id"]), store)
        db.commit()
    reference = client.post(
        "/api/v1/reference-documents",
        files={"file": ("source.txt", b"Synthetic test oracle only", "text/plain")},
    ).json()["reference_document"]
    response = client.post(
        "/api/v1/quality-policies",
        json={
            "product_id": product["id"],
            "policy_key": "DEMO",
            "version": 1,
            "reference_document_id": reference["id"],
            "effective_from": "2025-01-01T00:00:00Z",
            "rules": rules().model_dump(mode="json"),
        },
    )
    assert response.status_code == 201, response.text
    policy = response.json()["quality_policy"]
    path = f"/api/v1/quality-policies/{policy['id']}"
    client.headers.update({"If-Match": '"policy-r1"', "Idempotency-Key": "submit"})
    assert (
        client.post(path + "/submit-review", json={"note": "Synthetic review"}).status_code == 200
    )
    client.headers.update({"If-Match": '"policy-r2"', "Idempotency-Key": "approve"})
    assert (
        client.post(path + "/approve", json={"approval_note": "Synthetic only"}).status_code == 403
    )
    use_identity(client, identities[1])
    response = client.post(path + "/approve", json={"approval_note": "Synthetic only"})
    assert response.status_code == 200, response.text
    policy = response.json()["quality_policy"]
    use_identity(client, identities[0])
    client.headers["Idempotency-Key"] = "analysis"
    response = client.post(
        f"/api/v1/shipments/{ship['id']}/analyses",
        json={
            "dataset_id": uploaded["dataset"]["id"],
            "policy_version_id": policy["id"],
            "selected_sensor_ids": ["A"],
        },
    )
    assert response.status_code == 202, response.text
    analysis = response.json()["analysis"]
    with Session(engine) as db:
        execute(db, db.get(Job, response.json()["job"]["id"]), store)
        db.commit()
    return {
        "shipment": ship,
        "dataset": uploaded["dataset"],
        "policy": policy,
        "analysis": analysis,
        "store": store,
    }
