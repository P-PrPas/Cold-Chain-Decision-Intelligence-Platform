import copy

import pytest
from conftest import use_identity
from helpers import prepare
from sqlalchemy import delete
from sqlalchemy.orm import Session
from test_decisions import submit_decision
from test_simulations import parameters

from app.jobs import execute
from app.models import Analysis, Job, MemberRole, Membership


def test_window_is_pinned_and_changed_trip_requires_reanalysis(platform):
    result = prepare(platform)
    client, _, engine = platform
    response = client.post(
        f"/api/v1/shipments/{result['shipment']['id']}/analyses",
        headers={"Idempotency-Key": "pinned-window"},
        json={
            "dataset_id": result["dataset"]["id"],
            "policy_version_id": result["policy"]["id"],
            "selected_sensor_ids": ["A"],
        },
    )
    assert response.status_code == 202
    queued = response.json()
    window = copy.deepcopy(queued["analysis"]["result"]["coverage_window"])
    changed = client.patch(
        f"/api/v1/shipments/{result['shipment']['id']}",
        headers={"If-Match": '"shipment-r1"'},
        json={"estimated_arrival_at": "2026-01-02T00:00:00Z"},
    )
    assert changed.status_code == 200
    with Session(engine) as db:
        execute(db, db.get(Job, queued["job"]["id"]), result["store"])
        db.commit()
    analysis = client.get("/api/v1/analyses/" + queued["analysis"]["id"]).json()["analysis"]
    assert analysis["coverage_window"] == window
    assert analysis["classification"] == "NORMAL"
    result["analysis"] = analysis
    blocked = client.post(
        f"/api/v1/shipments/{result['shipment']['id']}/simulations",
        headers={"Idempotency-Key": "stale-trip"},
        json=parameters(result),
    )
    assert blocked.status_code == 409 and blocked.json()["code"] == "ANALYSIS_RECOMPUTE_REQUIRED"


@pytest.mark.parametrize(
    "fixture,arrival,unknown",
    [("partial_trip", "2026-01-02T00:00:00Z", 85800), ("final_hot", "2026-01-01T00:10:00Z", 0)],
)
def test_incomplete_evidence_api_cannot_make_release_eligible(platform, fixture, arrival, unknown):
    result = prepare(platform, fixture, arrival)
    client, _, engine = platform
    analysis = client.get("/api/v1/analyses/" + result["analysis"]["id"]).json()["analysis"]
    assert analysis["classification"] == "INDETERMINATE"
    assert analysis["summary"]["unknown_seconds"] == unknown
    response = client.post(
        f"/api/v1/shipments/{result['shipment']['id']}/simulations",
        headers={"Idempotency-Key": "partial-trip"},
        json=parameters(result),
    )
    assert response.status_code == 202
    with Session(engine) as db:
        execute(db, db.get(Job, response.json()["job"]["id"]), result["store"])
        db.commit()
    scenarios = client.get(
        "/api/v1/simulations/" + response.json()["simulation"]["id"] + "/scenarios"
    ).json()["items"]
    assert all(
        s["eligibility"] == "INSUFFICIENT_DATA"
        for s in scenarios
        if s["type"] == "CONTINUE_DELIVERY"
    )


def draft(client, result, key, supersedes=None):
    scenario = next(s for s in result["scenarios"] if s["type"] == "REJECT_QUARANTINE_DISPOSE")
    response = client.post(
        "/api/v1/decisions",
        headers={"Idempotency-Key": key},
        json={
            "simulation_run_id": result["simulation"]["id"],
            "selected_scenario_id": scenario["id"],
            "justification": "Correct the current proposal",
            "supersedes_decision_id": supersedes,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["decision"]


@pytest.mark.parametrize("approve_first", [False, True])
def test_current_decision_superseded_atomically_and_replay_etag(platform, approve_first):
    result = submit_decision(platform)
    client, identities, _ = platform
    original = result["decision"]
    if approve_first:
        use_identity(client, identities[1])
        approved = client.post(
            f"/api/v1/decisions/{original['id']}/approve",
            headers={"Idempotency-Key": "approve-original", "If-Match": '"decision-r2"'},
            json={
                "review_notes": "Original review",
                "evidence_references": ["reference:" + result["policy"]["reference_document_id"]],
                "acknowledged_required_actions": ["HOLD_IN_CONTROLLED_STORAGE"],
            },
        )
        assert approved.status_code == 200, approved.text
        use_identity(client, identities[0])
    proposed = draft(client, result, "competing")
    response = client.post(
        f"/api/v1/decisions/{proposed['id']}/submit",
        headers={"Idempotency-Key": "competing-submit", "If-Match": '"decision-r1"'},
        json={"justification": "Conflicting disposition"},
    )
    assert response.status_code == 409 and response.json()["code"] == "ACTIVE_DECISION_EXISTS"
    correction = draft(client, result, "correction", original["id"])
    path = f"/api/v1/decisions/{correction['id']}/submit"
    headers = {"Idempotency-Key": "correction-submit", "If-Match": '"decision-r1"'}
    payload = {"justification": "Correct previous proposal"}
    submitted = client.post(path, headers=headers, json=payload)
    assert submitted.status_code == 200, submitted.text
    replay = client.post(path, headers=headers, json=payload)
    assert replay.json() == submitted.json() and replay.headers["ETag"] == submitted.headers["ETag"]
    old = client.get(f"/api/v1/decisions/{original['id']}").json()["decision"]
    assert old["status"] == ("APPROVED" if approve_first else "SUPERSEDED")
    assert old["snapshot_sha256"] == original["snapshot_sha256"]
    use_identity(client, identities[1])
    events = client.get("/api/v1/audit-logs").json()["items"]
    assert any(e["action"] == "SUPERSEDE" and e["entity_id"] == original["id"] for e in events) is (
        not approve_first
    )
    review = {
        "acting_role": "QA",
        "review_notes": "Independent correction review",
        "evidence_references": ["reference:" + result["policy"]["reference_document_id"]],
        "acknowledged_required_actions": ["REVIEW_PINNED_EVIDENCE"],
    }
    reviewed = client.post(
        f"/api/v1/decisions/{correction['id']}/approve",
        headers={"Idempotency-Key": "review-correction", "If-Match": '"decision-r2"'},
        json=review,
    )
    assert reviewed.status_code == 200, reviewed.text
    repeated = client.post(
        f"/api/v1/decisions/{correction['id']}/approve",
        headers={"Idempotency-Key": "review-correction", "If-Match": '"decision-r2"'},
        json=review,
    )
    assert repeated.headers["ETag"] == reviewed.headers["ETag"]
    assert (
        client.get(f"/api/v1/decisions/{original['id']}").json()["decision"]["status"]
        == "SUPERSEDED"
    )
    events = client.get("/api/v1/audit-logs").json()["items"]
    assert any(e["action"] == "SUPERSEDE" and e["entity_id"] == original["id"] for e in events)


def test_roleless_membership_denied_and_email_not_enumerable(platform):
    client, identities, engine = platform
    use_identity(client, identities[0])
    path = "/api/v1/organizations/current/members"
    registered = client.post(path, json={"email": "user2@example.invalid", "roles": ["QA"]})
    absent = client.post(path, json={"email": "absent@example.invalid", "roles": ["QA"]})
    assert registered.status_code == absent.status_code == 404
    assert registered.json()["detail"] == absent.json()["detail"]
    with Session(engine) as db:
        db.add(
            Membership(
                organization_id=identities[0]["org"],
                user_id=identities[2]["user"],
                status="PENDING",
            )
        )
        db.commit()
    activated = client.post(path, json={"email": "user2@example.invalid", "roles": ["QA"]})
    assert activated.status_code == 201 and activated.json()["membership"]["status"] == "ACTIVE"
    with Session(engine) as db:
        membership = db.query(Membership).filter_by(user_id=identities[0]["user"]).one()
        db.execute(delete(MemberRole).where(MemberRole.membership_id == membership.id))
        db.commit()
    assert client.get("/api/v1/shipments").status_code == 403


def test_legacy_analysis_cannot_start_new_simulation(platform):
    result = prepare(platform)
    client, identities, engine = platform
    with Session(engine) as db:
        source = db.get(Analysis, result["analysis"]["id"])
        legacy = Analysis(
            organization_id=source.organization_id,
            shipment_id=source.shipment_id,
            dataset_id=source.dataset_id,
            policy_version_id=source.policy_version_id,
            selected_sensor_ids=source.selected_sensor_ids,
            status="COMPLETED",
            engine_version="1.0.0",
            input_sha256=source.input_sha256,
            result=copy.deepcopy(source.result),
            created_by=identities[0]["user"],
        )
        db.add(legacy)
        db.flush()
        legacy_id = legacy.id
        db.commit()
    result["analysis"] = {"id": legacy_id}
    response = client.post(
        f"/api/v1/shipments/{result['shipment']['id']}/simulations",
        headers={"Idempotency-Key": "legacy-rejection"},
        json=parameters(result),
    )
    assert response.status_code == 409 and response.json()["code"] == "ANALYSIS_RECOMPUTE_REQUIRED"


def test_failed_correction_does_not_supersede_original(platform):
    result = submit_decision(platform)
    client, identities, _ = platform
    original = result["decision"]
    correction = draft(client, result, "failed-correction", original["id"])
    use_identity(client, identities[1])
    retired = client.post(
        "/api/v1/quality-policies/" + result["policy"]["id"] + "/retire",
        headers={"Idempotency-Key": "retire-for-correction-test", "If-Match": '"policy-r3"'},
        json={"reason": "Policy no longer applicable"},
    )
    assert retired.status_code == 200, retired.text
    use_identity(client, identities[0])
    response = client.post(
        f"/api/v1/decisions/{correction['id']}/submit",
        headers={"Idempotency-Key": "failed-correction-submit", "If-Match": '"decision-r1"'},
        json={"justification": "Unavailable source policy"},
    )
    assert response.status_code == 422
    unchanged = client.get(f"/api/v1/decisions/{original['id']}").json()["decision"]
    assert unchanged["status"] == "PENDING_QA" and unchanged["revision"] == original["revision"]
    assert unchanged["snapshot"] == original["snapshot"]
