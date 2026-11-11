from conftest import use_identity
from helpers import prepare


def test_qa_policy_analysis_and_immutability(platform):
    result = prepare(platform)
    client, identities, _ = platform
    response = client.get("/api/v1/analyses/" + result["analysis"]["id"])
    assert response.status_code == 200
    assert response.json()["analysis"]["classification"] == "NORMAL"
    client.headers["If-Match"] = '"policy-r3"'
    policy = result["policy"]
    response = client.patch(
        "/api/v1/quality-policies/" + policy["id"],
        json={
            key: policy[key]
            for key in [
                "product_id",
                "policy_key",
                "version",
                "reference_document_id",
                "effective_from",
                "effective_to",
                "rules",
            ]
        },
    )
    assert response.status_code == 409
    use_identity(client, identities[2])
    assert client.get("/api/v1/analyses/" + result["analysis"]["id"]).status_code == 404
    assert client.get("/api/v1/quality-policies/" + policy["id"]).status_code == 404
