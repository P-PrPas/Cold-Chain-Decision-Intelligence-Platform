from datetime import UTC
from pathlib import Path

import pytest
from conftest import use_identity
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.jobs import execute
from app.models import Job, Reading
from app.temperature import normalize, timestamp

ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures"
MAPPING = {"timestamp": "timestamp", "temperature": "temperature_c", "sensor_id": "sensor_id"}


class MemoryStore:
    def __init__(self):
        self.objects = {}

    def put(self, key, content, content_type):
        assert key not in self.objects
        self.objects[key] = content

    def get(self, key):
        return self.objects[key]


@pytest.mark.parametrize(
    "name", ["normal", "warning", "critical", "gaps", "irregular", "multi_sensor_conflict"]
)
def test_valid_csv(name):
    rows, summary = normalize((ROOT / (name + ".csv")).read_bytes(), MAPPING, None, "C")
    assert rows and not summary["errors"]
    assert rows[0]["source_row"] >= 2
    assert rows[0]["timestamp_utc"].tzinfo == UTC


@pytest.mark.parametrize(
    "name,code", [("duplicates", "CONFLICTING_READINGS"), ("unknown_timezone", "TIMEZONE_REQUIRED")]
)
def test_invalid_csv(name, code):
    rows, summary = normalize((ROOT / (name + ".csv")).read_bytes(), MAPPING, None, "C")
    assert not rows and summary["errors"][0]["code"] == code


def test_units_and_dst():
    rows, summary = normalize(
        b"timestamp,temperature_c,sensor_id\n2026-01-01T00:00:00Z,32,A\n", MAPPING, None, "F"
    )
    assert str(rows[0]["temperature_c"]) == "0.000"
    for value in ["2026-11-01T01:30:00", "2026-03-08T02:30:00"]:
        with pytest.raises(ValueError):
            timestamp(value, "America/New_York")


def test_upload_worker_retry_and_isolation(platform):
    client, identities, engine = platform
    use_identity(client, identities[0])
    store = MemoryStore()
    client.app.state.store = store
    product = client.post("/api/v1/products", json={"name": "Fruit", "category": "TEST"}).json()[
        "product"
    ]
    client.headers["Idempotency-Key"] = "create"
    ship = client.post(
        "/api/v1/shipments",
        json={
            "reference": "CSV",
            "product_id": product["id"],
            "origin": {"name": "A"},
            "destination": {"name": "B"},
            "departure_at": "2026-01-01T00:00:00Z",
            "estimated_arrival_at": "2026-01-01T01:00:00Z",
            "cargo_value": "1.00",
            "currency": "THB",
        },
    ).json()["shipment"]
    client.headers["Idempotency-Key"] = "upload"
    import json

    payload = {"mapping": json.dumps(MAPPING)}
    files = {"file": ("normal.csv", (ROOT / "normal.csv").read_bytes(), "text/csv")}
    response = client.post(
        f"/api/v1/shipments/{ship['id']}/temperature-datasets", data=payload, files=files
    )
    assert response.status_code == 202, response.text
    result = response.json()
    dataset_id = result["dataset"]["id"]
    assert (
        client.post(
            f"/api/v1/shipments/{ship['id']}/temperature-datasets", data=payload, files=files
        ).json()
        == result
    )
    with Session(engine) as db:
        job = db.get(Job, result["job"]["id"])
        execute(db, job, store)
        db.commit()
        execute(db, job, store)
        db.commit()
        assert len(list(db.scalars(select(Reading)))) == 3
    assert (
        client.get(f"/api/v1/temperature-datasets/{dataset_id}/validation").json()["status"]
        == "READY"
    )
    assert (
        len(client.get(f"/api/v1/temperature-datasets/{dataset_id}/readings").json()["items"]) == 3
    )
    use_identity(client, identities[2])
    assert client.get(f"/api/v1/temperature-datasets/{dataset_id}").status_code == 404
    assert client.get(f"/api/v1/jobs/{result['job']['id']}").status_code == 404
