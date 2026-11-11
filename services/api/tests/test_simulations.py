import copy

from helpers import prepare
from sqlalchemy.orm import Session

from app.jobs import execute
from app.models import Job

TYPES = ["CONTINUE_DELIVERY", "HOLD_INSPECTION", "CONDITIONAL_REROUTE", "REJECT_QUARANTINE_DISPOSE"]


def parameters(result):
    return {
        "analysis_id": result["analysis"]["id"],
        "dataset_id": result["dataset"]["id"],
        "policy_version_id": result["policy"]["id"],
        "currency": "THB",
        "scenario_types": TYPES,
        "scenarios": [
            {
                "type": kind,
                "estimated_delay_minutes": 30,
                "receiver_acceptance": "ACCEPTED",
                "costs": {
                    name: {
                        "amount": "0.10" if name == "inspection" else "0.20",
                        "source": "USER_ESTIMATE",
                    }
                    for name in [
                        "additional_transport",
                        "inspection",
                        "holding",
                        "handling",
                        "disposal",
                        "other",
                    ]
                },
            }
            for kind in TYPES
        ],
        "ranking_weights": {"cost": "0.60", "delay": "0.40"},
    }


def simulate(platform, name="normal"):
    result = prepare(platform, name)
    client, identities, engine = platform
    payload = parameters(result)
    client.headers["Idempotency-Key"] = "simulation"
    response = client.post(
        f"/api/v1/shipments/{result['shipment']['id']}/simulations", json=payload
    )
    assert response.status_code == 202, response.text
    result["simulation"] = response.json()["simulation"]
    with Session(engine) as db:
        execute(db, db.get(Job, response.json()["job"]["id"]), result["store"])
        db.commit()
    result["scenarios"] = client.get(
        "/api/v1/simulations/" + result["simulation"]["id"] + "/scenarios"
    ).json()["items"]
    return result


def test_costs_recalculation_and_old_run_immutable(platform):
    result = simulate(platform)
    client, _, engine = platform
    assert all(
        s["direct_incremental_cost"] == "1.10" and s["probability"] == "unknown"
        for s in result["scenarios"]
    )
    original = copy.deepcopy(result["scenarios"])
    payload = parameters(result)
    payload["scenarios"][0]["costs"]["inspection"]["amount"] = "99.00"
    client.headers["Idempotency-Key"] = "recalc"
    response = client.post(
        "/api/v1/simulations/" + result["simulation"]["id"] + "/recalculate", json=payload
    )
    assert response.status_code == 202, response.text
    assert response.json()["simulation"]["parent_run_id"] == result["simulation"]["id"]
    with Session(engine) as db:
        execute(db, db.get(Job, response.json()["job"]["id"]), result["store"])
        db.commit()
    assert (
        client.get("/api/v1/simulations/" + result["simulation"]["id"] + "/scenarios").json()[
            "items"
        ]
        == original
    )


def test_hard_block_not_ranked_even_at_zero_cost(platform):
    result = simulate(platform, "critical")
    for scenario in result["scenarios"]:
        if scenario["type"] in ["CONTINUE_DELIVERY", "CONDITIONAL_REROUTE"]:
            assert scenario["eligibility"] == "BLOCKED" and scenario["ranking_score"] is None
        else:
            assert scenario["eligibility"] == "REVIEW_REQUIRED"


def test_unknown_data_fails_closed(platform):
    result = simulate(platform, "gaps")
    assert all(
        s["eligibility"] == "INSUFFICIENT_DATA"
        for s in result["scenarios"]
        if s["type"] in ["CONTINUE_DELIVERY", "CONDITIONAL_REROUTE"]
    )
