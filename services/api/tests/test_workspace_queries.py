from conftest import use_identity
from test_decisions import submit_decision


def test_server_search_pages_and_tenant_scope(platform):
    client, identities, _ = platform
    use_identity(client, identities[0])
    product = client.post(
        "/api/v1/products", json={"name": "Search test", "category": "TEST"}
    ).json()["product"]
    ids = []
    for i in range(31):
        client.headers["Idempotency-Key"] = f"search-{i}"
        r = client.post(
            "/api/v1/shipments",
            json={
                "reference": f"QUEUE-{i:02}",
                "product_id": product["id"],
                "origin": {"name": "Origin"},
                "destination": {"name": "Unique receiver" if i == 0 else "Receiver"},
                "departure_at": "2026-01-01T00:00:00Z",
                "estimated_arrival_at": "2026-01-01T01:00:00Z",
                "cargo_value": "100.00",
                "currency": "THB",
            },
        )
        assert r.status_code == 201, r.text
        ids.append(r.json()["shipment"]["id"])
    first = client.get("/api/v1/shipments").json()
    assert len(first["items"]) == 25 and first["next_cursor"]
    second = client.get("/api/v1/shipments", params={"cursor": first["next_cursor"]}).json()
    assert len(second["items"]) == 6
    assert (
        client.get("/api/v1/shipments", params={"q": "queue-00"}).json()["items"][0]["id"] == ids[0]
    )
    assert (
        client.get("/api/v1/shipments", params={"q": "Unique receiver"}).json()["items"][0]["id"]
        == ids[0]
    )
    assert client.get("/api/v1/shipments", params={"q": "%"}).json()["items"] == []
    assert (
        client.get(
            "/api/v1/shipments", params={"q": "other", "cursor": first["next_cursor"]}
        ).status_code
        == 422
    )
    use_identity(client, identities[2])
    assert client.get("/api/v1/shipments", params={"q": "queue"}).json()["items"] == []
    assert client.get(f"/api/v1/shipments/{ids[0]}/workflow").status_code == 404


def test_scoped_decisions_and_saved_workflow(platform):
    result = submit_decision(platform)
    client, identities, _ = platform
    shipment_id = result["simulation"]["shipment_id"]
    scoped = client.get("/api/v1/decisions", params={"shipment_id": shipment_id, "limit": 1})
    assert scoped.status_code == 200, scoped.text
    assert scoped.json()["items"][0]["id"] == result["decision"]["id"]
    saved = client.get(f"/api/v1/shipments/{shipment_id}/workflow").json()
    assert saved["decision"]["status"] == "PENDING_QA"
    assert saved["analysis"]["id"] == result["simulation"]["analysis_id"]
    assert saved["simulation"]["id"] == result["simulation"]["id"]
    assert client.get(f"/api/v1/shipments/{shipment_id}/analyses").json()["items"]
    use_identity(client, identities[2])
    assert client.get("/api/v1/decisions", params={"shipment_id": shipment_id}).status_code == 404
