"""Disposable PostgreSQL reference workload; includes persistence, excludes queue delay."""

import json
import os
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from helpers import prepare
from sqlalchemy.orm import Session
from test_simulations import parameters
from test_temperature import MAPPING

from app.jobs import execute
from app.models import Job


@pytest.mark.skipif(not os.environ.get("CC_TEST_POSTGRES_URL"), reason="PostgreSQL benchmark")
def test_reference_workload(platform):
    result = prepare(
        platform, arrival=(datetime(2026, 1, 1, tzinfo=UTC) + timedelta(minutes=99999)).isoformat()
    )
    client, _, engine = platform
    start = datetime(2026, 1, 1, tzinfo=UTC)
    content = (
        "timestamp,temperature_c,sensor_id\n"
        + "\n".join(f"{(start + timedelta(seconds=i * 60)).isoformat()},4,A" for i in range(100000))
    ).encode()
    timings = {}

    def finish(response, name, started):
        assert response.status_code == 202, response.text
        payload = response.json()
        with Session(engine) as db:
            execute(db, db.get(Job, payload["job"]["id"]), result["store"])
            db.commit()
        timings[name] = time.perf_counter() - started
        return payload

    tick = time.perf_counter()
    imported = finish(
        client.post(
            f"/api/v1/shipments/{result['shipment']['id']}/temperature-datasets",
            headers={"Idempotency-Key": "benchmark-import"},
            data={"mapping": json.dumps(MAPPING)},
            files={"file": ("100k.csv", content, "text/csv")},
        ),
        "import_seconds",
        tick,
    )
    result["dataset"] = imported["dataset"]
    tick = time.perf_counter()
    analyzed = finish(
        client.post(
            f"/api/v1/shipments/{result['shipment']['id']}/analyses",
            headers={"Idempotency-Key": "benchmark-analysis"},
            json={
                "dataset_id": result["dataset"]["id"],
                "policy_version_id": result["policy"]["id"],
                "selected_sensor_ids": ["A"],
            },
        ),
        "analysis_seconds",
        tick,
    )
    result["analysis"] = analyzed["analysis"]
    tick = time.perf_counter()
    finish(
        client.post(
            f"/api/v1/shipments/{result['shipment']['id']}/simulations",
            headers={"Idempotency-Key": "benchmark-simulation"},
            json=parameters(result),
        ),
        "simulation_seconds",
        tick,
    )
    measured = {
        "rows": 100000,
        "concurrency": 1,
        "scope": "HTTP adapters + PostgreSQL commit; in-memory object store; excludes queue and network latency",
        **timings,
    }
    print(json.dumps(measured))
    if path := os.environ.get("CC_BENCHMARK_OUTPUT"):
        Path(path).write_text(json.dumps(measured, indent=2) + "\n", encoding="utf-8")
    assert timings["import_seconds"] < 30
    assert timings["analysis_seconds"] < 10
    assert timings["simulation_seconds"] < 3
