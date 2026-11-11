from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.contracts import (
    Cursor,
    Money,
    Page,
    Problem,
    UTCDateTime,
    decode_cursor,
    encode_cursor,
    etag,
    request_hash,
    require_match,
    require_same_request,
)
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    for key, value in {
        "DATABASE_URL": "postgresql://unused",
        "REDIS_URL": "redis://unused",
        "S3_ENDPOINT": "http://unused",
        "S3_ACCESS_KEY": "test",
        "S3_SECRET_KEY": "synthetic-secret-only",
        "S3_BUCKET": "evidence",
    }.items():
        monkeypatch.setenv("CC_" + key, value)
    app = create_app()

    @app.get("/test/error/{status}")
    def error(status: int):
        if status in (401, 403, 404):
            raise HTTPException(status, "secret must not appear")
        raise Problem(status, "TEST_ERROR", "Test error")

    @app.get("/test/crash")
    def crash():
        raise RuntimeError("secret")

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.mark.parametrize("status", [401, 403, 404, 409, 412, 422, 428])
def test_problem_envelope(client, status):
    response = client.get(f"/test/error/{status}", headers={"X-Request-Id": "test_123"})
    assert response.status_code == status
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["request_id"] == response.headers["X-Request-Id"] == "test_123"
    assert response.json()["status"] == status
    assert "secret" not in response.text


def test_framework_and_unexpected_errors(client):
    for path, status in [("/missing", 404), ("/test/error/no", 422), ("/test/crash", 500)]:
        response = client.get(path)
        assert response.status_code == status
        assert response.json()["request_id"]
        assert "secret" not in response.text


def test_health(client, monkeypatch):
    assert client.get("/api/v1/health/live").json() == {"status": "alive"}
    monkeypatch.setattr("app.main.dependencies_ready", lambda settings: False)
    assert client.get("/api/v1/health/ready").status_code == 503
    monkeypatch.setattr("app.main.dependencies_ready", lambda settings: True)
    assert client.get("/api/v1/health/ready").json() == {"status": "ready"}


def test_required_configuration(monkeypatch):
    for key in (
        "DATABASE_URL",
        "REDIS_URL",
        "S3_ENDPOINT",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
        "S3_BUCKET",
    ):
        monkeypatch.delenv("CC_" + key, raising=False)
    with pytest.raises(ValidationError):
        Settings()


def test_concurrency_and_hash():
    require_match('"shipment-r2"', etag("shipment", 2))
    for value, status in [(None, 428), ('"shipment-r1"', 412), ("*", 412)]:
        with pytest.raises(Problem) as caught:
            require_match(value, etag("shipment", 2))
        assert caught.value.status == status
    digest = request_hash({"a": 1, "b": "2.00"})
    require_same_request(digest, request_hash({"b": "2.00", "a": 1}))
    with pytest.raises(Problem) as caught:
        require_same_request(digest, request_hash({"a": 2}))
    assert caught.value.status == 409


def test_cursor_scope():
    tenant = uuid4()
    cursor = Cursor(
        organization_id=tenant, scope="shipments:all", created_at=datetime.now(UTC), id=uuid4()
    )
    encoded = encode_cursor(cursor)
    assert decode_cursor(encoded, tenant, "shipments:all") == cursor
    for value, org, scope in [
        (encoded, uuid4(), "shipments:all"),
        (encoded, tenant, "other"),
        ("!", tenant, "shipments:all"),
    ]:
        with pytest.raises(Problem):
            decode_cursor(value, org, scope)
    assert Page[int](items=[]).model_dump() == {
        "items": [],
        "next_cursor": None,
        "total_count": None,
    }


class Values(BaseModel):
    amount: Money
    at: UTCDateTime


def test_decimal_utc():
    values = Values(amount="0.10", at="2026-11-11T07:00:00+07:00")
    assert values.amount == Decimal("0.10")
    assert values.model_dump(mode="json") == {"amount": "0.10", "at": "2026-11-11T00:00:00Z"}
    for amount in [0.1, "NaN", "Infinity", "-1", "0.001"]:
        with pytest.raises(ValidationError):
            Values(amount=amount, at="2026-11-11T00:00:00Z")
    with pytest.raises(ValidationError):
        Values(amount="1", at="2026-11-11T00:00:00")
