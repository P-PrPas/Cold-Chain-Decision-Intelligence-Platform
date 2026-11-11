import asyncio
import copy

from conftest import use_identity
from test_simulations import simulate

from app.explanations import bounded_explanation


def submit_decision(platform, name="normal"):
    result = simulate(platform, name)
    client, identities, engine = platform
    scenario = next(s for s in result["scenarios"] if s["type"] == "HOLD_INSPECTION")
    client.headers["Idempotency-Key"] = "decision"
    response = client.post(
        "/api/v1/decisions",
        json={
            "simulation_run_id": result["simulation"]["id"],
            "selected_scenario_id": scenario["id"],
            "justification": "Hold for independent review",
        },
    )
    assert response.status_code == 201, response.text
    decision = response.json()["decision"]
    client.headers.update({"Idempotency-Key": "submit-decision", "If-Match": '"decision-r1"'})
    response = client.post(
        "/api/v1/decisions/" + decision["id"] + "/submit",
        json={"justification": "Hold for independent review"},
    )
    assert response.status_code == 200, response.text
    result["decision"] = response.json()["decision"]
    return result


def test_qa_review_preserves_snapshot_and_replay(platform):
    result = submit_decision(platform)
    client, identities, _ = platform
    decision = result["decision"]
    original = copy.deepcopy(decision["snapshot"])
    payload = {
        "acting_role": "QA",
        "review_notes": "Synthetic evidence reviewed",
        "evidence_references": ["reference:" + result["policy"]["reference_document_id"]],
        "acknowledged_required_actions": ["HOLD_IN_CONTROLLED_STORAGE"],
    }
    path = "/api/v1/decisions/" + decision["id"] + "/approve"
    client.headers.update({"Idempotency-Key": "approve-decision", "If-Match": '"decision-r2"'})
    assert client.post(path, json=payload).status_code == 403
    use_identity(client, identities[1])
    approved = client.post(path, json=payload)
    assert approved.status_code == 200, approved.text
    assert approved.json()["decision"]["snapshot"] == original
    assert client.post(path, json=payload).json() == approved.json()
    client.headers["Idempotency-Key"] = "another-approval"
    assert client.post(path, json=payload).status_code == 412
    assert client.get("/api/v1/audit-logs").json()["items"]
    use_identity(client, identities[2])
    assert client.get("/api/v1/decisions/" + decision["id"]).status_code == 404
    assert client.get("/api/v1/audit-logs").status_code == 403


def test_blocked_release_cannot_create_decision(platform):
    result = simulate(platform, "critical")
    client, _, _ = platform
    scenario = next(s for s in result["scenarios"] if s["type"] == "CONTINUE_DELIVERY")
    client.headers["Idempotency-Key"] = "blocked"
    assert (
        client.post(
            "/api/v1/decisions",
            json={
                "simulation_run_id": result["simulation"]["id"],
                "selected_scenario_id": scenario["id"],
                "justification": "Cheap but blocked",
            },
        ).status_code
        == 422
    )


def test_provider_injection_timeout_fallback():
    class Attack:
        async def select_facts(self, facts):
            return {"fact_ids": ["invented"], "eligibility": "ELIGIBLE"}

    class Outage:
        async def select_facts(self, facts):
            raise TimeoutError()

    facts = {"scenario:real": "HOLD_INSPECTION: REVIEW_REQUIRED"}
    for provider in [None, Attack(), Outage()]:
        result = asyncio.run(bounded_explanation(facts, provider))
        assert result["model"] == "deterministic-template"
        assert result["source_references"] == ["scenario:real"]
        assert "ELIGIBLE" not in str(result)
