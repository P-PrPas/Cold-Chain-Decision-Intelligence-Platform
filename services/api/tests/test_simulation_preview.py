from conftest import use_identity
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_simulations import parameters, simulate

from app.models import Job, Simulation


def test_preview_matches_saved_engine_without_creating_history(platform):
    result = simulate(platform)
    client, identities, engine = platform
    payload = parameters(result)
    path = f"/api/v1/shipments/{result['simulation']['shipment_id']}/simulation-preview"
    with Session(engine) as db:
        counts = (
            db.scalar(select(func.count()).select_from(Job)),
            db.scalar(select(func.count()).select_from(Simulation)),
        )
    response = client.post(path, json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["persisted"] is False
    saved = {s["type"]: {k: v for k, v in s.items() if k != "id"} for s in result["scenarios"]}
    assert {s["type"]: s for s in body["items"]} == saved
    payload["scenarios"][0]["estimated_delay_minutes"] += 7
    newer = client.post(path, json=payload).json()
    assert newer["assumptions_sha256"] != body["assumptions_sha256"]
    with Session(engine) as db:
        assert counts == (
            db.scalar(select(func.count()).select_from(Job)),
            db.scalar(select(func.count()).select_from(Simulation)),
        )
    use_identity(client, identities[2])
    assert client.post(path, json=payload).status_code == 404
