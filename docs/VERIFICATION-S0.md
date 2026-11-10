# S0 verification
Windows Python 3.14; Compose Python 3.12 / Node 22.

- API pytest: 15 passed; upstream TestClient/httpx deprecation warning.
- Ruff lint/format, strict mypy and OpenAPI snapshot check: passed.
- Web ESLint, Prettier, Next typegen + TypeScript, Vitest (1 test), production build: passed.
- npm audit --omit=dev: zero vulnerabilities. Full audit: 8 moderate findings in minimatch via TypeScript ESLint; no high/critical. Frontend maintainer owns compatible upgrade before release; runtime image prunes dev dependencies.
- main protection: api/web/stack required checks, one approving review, stale review dismissal, admin enforcement, no force push or deletion.

## Verification limits
Test-only error routes validate common handlers, not S1 authentication. Cursor, hash and ETag helpers are primitives; durable idempotency and atomic writes await persistence. Fixture tests verify synthetic arithmetic, not production analytics. ADR/fixture review and qualified QA approval remain pending. No browser accessibility audit claimed.

Local Compose full-stack startup passed; GET /api/v1/health/ready returned {"status":"ready"}; Web HEAD / returned HTTP 200. Documentation links checked.
