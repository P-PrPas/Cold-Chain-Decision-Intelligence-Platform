from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from conftest import use_identity
from helpers import prepare
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Shipment
from app.temperature import normalize


def test_composite_fk_rejects_cross_tenant_product(platform):
    client, identities, engine = platform
    use_identity(client, identities[0])
    product = client.post("/api/v1/products", json={"name": "A", "category": "TEST"}).json()[
        "product"
    ]
    with Session(engine) as db:
        db.add(
            Shipment(
                organization_id=identities[2]["org"],
                reference="bad",
                product_id=product["id"],
                origin={"name": "A"},
                destination={"name": "B"},
                departure_at=datetime(2026, 1, 1, tzinfo=UTC),
                estimated_arrival_at=datetime(2026, 1, 2, tzinfo=UTC),
                cargo_value=Decimal("1"),
                currency="THB",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_parser_bounds_and_nonfinite_values():
    mapping = {"timestamp": "t", "temperature": "v"}
    for value in ["NaN", "Infinity", "-Infinity", "=1+1"]:
        rows, result = normalize(
            f"t,v\n2026-01-01T00:00:00Z,{value}\n".encode(), mapping, None, "C"
        )
        assert not rows and result["errors"]
    with pytest.raises(Exception):
        normalize(b"x" * (10 * 1024 * 1024 + 1), mapping, None, "C")


def test_reading_order_and_aggregation_preserve_envelope(platform):
    result = prepare(platform, "irregular")
    client, _, _ = platform
    path = "/api/v1/temperature-datasets/" + result["dataset"]["id"] + "/readings"
    first = client.get(path + "?limit=1").json()
    second = client.get(path, params={"limit": 1, "cursor": first["next_cursor"]}).json()
    assert first["items"][0]["timestamp_utc"] < second["items"][0]["timestamp_utc"]
    aggregate = client.get(path + "?resolution=aggregated&max_points=2").json()
    assert max(Decimal(p["max_c"]) for p in aggregate["items"]) == Decimal("9")
    assert all(p["connect_to_next"] is False for p in aggregate["items"])


def test_rate_limit_returns_problem(platform, monkeypatch):
    client, _, _ = platform

    class Limiter:
        @classmethod
        def from_url(cls, *args, **kwargs):
            return cls()

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def eval(self, *args):
            return 999

    monkeypatch.setattr("app.main.Redis", Limiter)
    client.app.state.settings.rate_limit_enabled = True
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 429 and response.json()["code"] == "RATE_LIMITED"
    assert response.headers["Retry-After"] == "60"


def test_chunked_request_limit(platform):
    client, _, _ = platform

    def chunks():
        for _ in range(12):
            yield b"x" * (1024 * 1024)

    response = client.post(
        "/api/v1/auth/login", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413 and response.json()["code"] == "FILE_TOO_LARGE"


def test_outbox_queue_failure_preserves_durable_event(platform):
    from sqlalchemy import select

    from app.jobs import dispatch
    from app.models import Outbox

    result = prepare(platform)
    _, _, engine = platform

    class BrokenQueue:
        def enqueue(self, *args, **kwargs):
            raise ConnectionError("Queue unavailable")

    with Session(engine) as db:
        # Add a newly queued job without executing it; committed outbox survives enqueue failure.
        from app.jobs import enqueue

        enqueue(db, result["shipment"]["organization_id"], "EXPLANATION", str(uuid4()))
        db.commit()
        with pytest.raises(ConnectionError):
            dispatch(db, BrokenQueue())
        db.rollback()
        assert db.scalar(select(Outbox).where(Outbox.status == "PENDING")) is not None


def test_dispatch_uses_importable_target_when_started_as_module(platform, monkeypatch):
    from rq import Queue

    from app.jobs import dispatch, enqueue, run_job

    result = prepare(platform)
    _, _, engine = platform
    monkeypatch.setattr(run_job, "__module__", "__main__")
    targets = []

    class ValidatingQueue:
        def enqueue(self, target, *args, **kwargs):
            Queue.parse_args(target, *args, **kwargs)
            targets.append(target)

    with Session(engine) as db:
        enqueue(db, result["shipment"]["organization_id"], "EXPLANATION", str(uuid4()))
        db.commit()
        dispatch(db, ValidatingQueue())
    assert targets == ["app.jobs.run_job"]
