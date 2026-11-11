# ADR 0002: secure core implementation
Status: proposed for owner review. S1 continues from unmerged S0 as explicitly requested.
- SQLAlchemy + staged Alembic migrations implement tenant tables with composite foreign keys. IDs are canonical UUID strings; SQL storage uses VARCHAR(36) for cross-platform test compatibility. PostgreSQL-specific audit immutability trigger supplements API restrictions. SQLite tests do not substitute for PostgreSQL migration smoke.
- Roles use a normalized membership_roles table with database CHECK vocabulary; Admin never implies QA.
- Authlib verifies OIDC state, nonce, PKCE, discovery/JWKS and issuer; only pre-provisioned issuer|subject identities can obtain sessions. Server session tokens and CSRF tokens are hashed at rest, expire after eight hours, and are checked against current membership each request.
- Keycloak realm is synthetic-only: operator and reviewer accounts use the published synthetic-demo-only password. This is not a production identity configuration. Production requires TLS, secure cookies, operator-managed identities and a fresh session secret.
- OIDC backchannel is a trusted configuration-only URL for local Docker networking, never a user parameter; authorization/issuer remain browser-visible localhost, token and JWKS requests use private identity service.
- Tenant-scoped transaction locking serializes idempotent writes initially. This prioritizes duplicate prevention; scale to per-key advisory locks after profiling. Key records have no automatic expiry/deletion yet.
- Initial supported currency allowlist is THB/USD/EUR/GBP/JPY (no FX conversion); JPY requires integral amounts. Extend explicitly with minor-unit rules.
- Product PATCH initially accepts the full product DTO; S6 adds partial PATCH, departure date filters and bounded membership administration. Shipment PATCH is partial. See ADR 0003 for the final pagination contract.
