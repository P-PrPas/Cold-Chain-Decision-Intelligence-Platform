import json
from datetime import UTC, datetime, timedelta

import pytest
from conftest import use_identity
from sqlalchemy.orm import Session
from test_analytics import ROOT, rules
from test_decisions import submit_decision
from test_review_regressions import draft
from test_temperature import MAPPING

from app.analytics import analyze
from app.models import MemberRole
from app.provision_membership import provision
from app.simulation_engine import ScenarioInput, Weights, calculate
from app.temperature import normalize


def test_window_clipping_golden_fixtures():
    scenario = ScenarioInput(
        type="CONTINUE_DELIVERY",
        estimated_delay_minutes=0,
        receiver_acceptance="ACCEPTED",
        costs={
            name: {"amount": "0.00", "source": "USER_ESTIMATE"}
            for name in [
                "additional_transport",
                "inspection",
                "holding",
                "handling",
                "disposal",
                "other",
            ]
        },
    )
    start = datetime(2026, 1, 1, tzinfo=UTC)
    for name, expected in json.loads((ROOT / "window_expected.json").read_text()).items():
        readings, _ = normalize((ROOT / (name + ".csv")).read_bytes(), MAPPING, None, "C")
        result = analyze(readings, rules(), start, start + timedelta(minutes=10))
        assert result["classification"] == expected["classification"], name
        assert result["summary"]["max_c"] == expected["max_c"]
        assert result["summary"]["unknown_seconds"] == expected["unknown_seconds"]
        assert type(result["summary"]["unknown_seconds"]) is int
        assert all(type(g["duration_seconds"]) is int for g in result["unknown_intervals"])
        release = calculate(result, rules(), [scenario], Weights(cost="0.5", delay="0.5"), "THB")[0]
        assert release["eligibility"] == expected["release"], name
        if "hot" in name:
            assert result["summary"]["unbounded_out_of_range_observations"]


def test_clipped_gap_uses_original_sampling_distance_and_integer_unknowns():
    start = datetime(2026, 1, 1, tzinfo=UTC)

    def row(seconds):
        return {
            "sensor_id": "A",
            "timestamp_utc": start + timedelta(seconds=seconds),
            "temperature_c": "2",
        }

    # A 20-minute observation gap cannot become valid by clipping it to 60s.
    result = analyze([row(-600), row(600)], rules(), start, start + timedelta(seconds=60))
    assert (
        result["classification"] == "INDETERMINATE" and result["summary"]["unknown_seconds"] == 60
    )
    # A nonzero fractional uncovered boundary cannot round down to compliant.
    result = analyze([row(0.1), row(60)], rules(), start, start + timedelta(seconds=60))
    assert result["classification"] == "INDETERMINATE" and result["summary"]["unknown_seconds"] == 1
    assert type(result["unknown_intervals"][0]["duration_seconds"]) is int


def test_eta_hot_observation_survives_later_normal_reading_and_duration_clips():
    start = datetime(2026, 1, 1, tzinfo=UTC)

    def analyze_values(samples):
        return analyze(
            [
                {
                    "sensor_id": "A",
                    "timestamp_utc": start + timedelta(seconds=at),
                    "temperature_c": temperature,
                }
                for at, temperature in samples
            ],
            rules(),
            start,
            start + timedelta(seconds=600),
        )

    result = analyze_values([(0, "2"), (300, "2"), (600, "40"), (900, "2")])
    assert result["classification"] == "INDETERMINATE"
    assert result["summary"]["max_c"] == "40"
    assert result["summary"]["cumulative_excursion_seconds"] == 0
    assert (
        result["summary"]["unbounded_out_of_range_observations"][0]["at"]
        == (start + timedelta(seconds=600)).isoformat()
    )
    # A measured 600s hot interval contributes only its 300s overlap to this window.
    result = analyze_values([(-300, "2"), (0, "2"), (300, "40"), (900, "2")])
    assert result["summary"]["cumulative_excursion_seconds"] == 300
    assert result["summary"]["unknown_seconds"] == 0
    assert result["excursions"][0]["end_at"] == (start + timedelta(seconds=600)).isoformat()


@pytest.mark.parametrize("times", [[-120, -60], [120, 180]])
def test_no_overlapping_readings_leaves_exact_window_unknown(times):
    start = datetime(2026, 1, 1, tzinfo=UTC)
    result = analyze(
        [
            {"sensor_id": "A", "timestamp_utc": start + timedelta(seconds=at), "temperature_c": "2"}
            for at in times
        ],
        rules(),
        start,
        start + timedelta(seconds=60),
    )
    assert result["classification"] == "INDETERMINATE"
    assert result["summary"]["unknown_seconds"] == 60
    assert result["unknown_intervals"][0]["start_at"] == start.isoformat()
    assert result["unknown_intervals"][0]["end_at"] == (start + timedelta(seconds=60)).isoformat()


@pytest.mark.parametrize("action", ["reject", "request-changes"])
def test_unapproved_correction_cannot_revoke_qa_approval(platform, action):
    result = submit_decision(platform)
    client, identities, _ = platform
    original = result["decision"]
    use_identity(client, identities[1])
    review = {
        "review_notes": "Original independent approval",
        "evidence_references": ["reference:" + result["policy"]["reference_document_id"]],
        "acknowledged_required_actions": ["HOLD_IN_CONTROLLED_STORAGE"],
    }
    approved = client.post(
        f"/api/v1/decisions/{original['id']}/approve",
        headers={"Idempotency-Key": "approve-original", "If-Match": '"decision-r2"'},
        json=review,
    )
    assert approved.status_code == 200
    before = approved.json()["decision"]
    use_identity(client, identities[0])
    correction = draft(client, result, "correction", original["id"])
    submitted = client.post(
        f"/api/v1/decisions/{correction['id']}/submit",
        headers={"Idempotency-Key": "submit-correction", "If-Match": '"decision-r1"'},
        json={"justification": "Request a different disposition"},
    )
    assert submitted.status_code == 200
    assert client.get(f"/api/v1/decisions/{original['id']}").json()["decision"] == before
    # A second pending correction is rejected even though it names the approval.
    competing = draft(client, result, "second-correction", original["id"])
    response = client.post(
        f"/api/v1/decisions/{competing['id']}/submit",
        headers={"Idempotency-Key": "submit-second", "If-Match": '"decision-r1"'},
        json={"justification": "Second correction"},
    )
    assert response.status_code == 409
    use_identity(client, identities[1])
    response = client.post(
        f"/api/v1/decisions/{correction['id']}/{action}",
        headers={"Idempotency-Key": "review-correction", "If-Match": '"decision-r2"'},
        json={"review_notes": "Correction not approved"},
    )
    assert response.status_code == 200
    assert client.get(f"/api/v1/decisions/{original['id']}").json()["decision"] == before


def test_operator_provisioning_creates_pending_without_granting_roles(platform):
    client, identities, engine = platform
    with Session(engine) as db:
        member = provision(db, identities[0]["org"], identities[2]["user"])
        identifier = member.id
        assert member.status == "PENDING"
        assert db.query(MemberRole).filter_by(membership_id=identifier).count() == 0
        assert provision(db, identities[0]["org"], identities[2]["user"]).id == identifier
        db.commit()
    use_identity(client, identities[2])
    assert (
        client.get(
            "/api/v1/shipments", headers={"X-Organization-Id": identities[0]["org"]}
        ).status_code
        == 403
    )
    use_identity(client, identities[0])
    response = client.post(
        "/api/v1/organizations/current/members",
        json={"email": "user2@example.invalid", "roles": ["LOGISTICS"]},
    )
    assert response.status_code == 201
    use_identity(client, identities[2])
    assert (
        client.get(
            "/api/v1/shipments", headers={"X-Organization-Id": identities[0]["org"]}
        ).status_code
        == 200
    )
