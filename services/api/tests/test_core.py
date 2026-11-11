from conftest import use_identity


def test_security_and_shipments(platform):
    client, identities, engine = platform
    assert client.get("/api/v1/shipments").status_code == 401
    use_identity(client, identities[0])
    product = client.post("/api/v1/products", json={"name": "Synthetic fruit", "category": "TEST"})
    assert product.status_code == 201, product.text
    product_id = product.json()["product"]["id"]
    body = {
        "reference": "S1",
        "product_id": product_id,
        "origin": {"name": "A"},
        "destination": {"name": "B"},
        "departure_at": "2026-01-01T00:00:00Z",
        "estimated_arrival_at": "2026-01-01T01:00:00Z",
        "cargo_value": "100.00",
        "currency": "THB",
    }
    client.headers["Idempotency-Key"] = "shipment-1"
    response = client.post("/api/v1/shipments", json=body)
    assert response.status_code == 201, response.text
    identifier = response.json()["shipment"]["id"]
    assert client.post("/api/v1/shipments", json=body).json() == response.json()
    assert (
        client.post("/api/v1/shipments", json={**body, "reference": "changed"}).status_code == 409
    )
    assert (
        client.patch(f"/api/v1/shipments/{identifier}", json={"status": "READY"}).status_code == 428
    )
    client.headers["If-Match"] = '"shipment-r1"'
    assert (
        client.patch(f"/api/v1/shipments/{identifier}", json={"status": "READY"}).status_code == 200
    )
    assert (
        client.patch(f"/api/v1/shipments/{identifier}", json={"status": "IN_TRANSIT"}).status_code
        == 412
    )
    use_identity(client, identities[1])
    assert client.post("/api/v1/shipments", json=body).status_code == 403
    use_identity(client, identities[2])
    assert client.get(f"/api/v1/shipments/{identifier}").status_code == 404
    assert client.post("/api/v1/shipments", json=body).status_code == 404
    assert client.get("/api/v1/shipments").json()["items"] == []
    client.headers["X-Organization-Id"] = identities[0]["org"]
    assert client.get("/api/v1/shipments").status_code == 403


def test_member_pages_bind_scope_and_role(platform):
    client, identities, _ = platform
    use_identity(client, identities[0])
    first = client.get("/api/v1/organizations/current/members?limit=1").json()
    assert len(first["items"]) == 1 and first["next_cursor"]
    second = client.get(
        "/api/v1/organizations/current/members", params={"limit": 1, "cursor": first["next_cursor"]}
    ).json()
    assert second["items"][0]["id"] != first["items"][0]["id"]
    assert (
        client.get("/api/v1/products", params={"cursor": first["next_cursor"]}).status_code == 422
    )
    use_identity(client, identities[1])
    assert client.get("/api/v1/organizations/current/members").status_code == 403


def test_departure_filter_validation(platform):
    client, identities, _ = platform
    use_identity(client, identities[0])
    assert (
        client.get(
            "/api/v1/shipments",
            params={"from": "2026-01-02T00:00:00Z", "to": "2026-01-01T00:00:00Z"},
        ).status_code
        == 422
    )
    assert (
        client.get("/api/v1/shipments", params={"from": "2026-01-01T00:00:00"}).status_code == 422
    )
    assert client.get("/api/v1/shipments", params={"sort": "unsupported"}).status_code == 422


def test_csrf_logout_and_cursor(platform):
    client, identities, _ = platform
    use_identity(client, identities[0])
    client.headers["X-CSRF-Token"] = "wrong"
    assert client.post("/api/v1/auth/logout").status_code == 403
    client.headers["X-CSRF-Token"] = identities[0]["csrf"]
    assert client.get("/api/v1/products?cursor=invalid").status_code == 422
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
