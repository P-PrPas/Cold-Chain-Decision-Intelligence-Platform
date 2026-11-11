# Cold Chain Decision Intelligence Platform

Decision support for shipment → CSV → analysis → scenarios → human QA → report.
The S0–S6 implementation includes OIDC sessions, tenant-scoped operations, immutable temperature evidence, versioned policies, deterministic analysis and cost scenarios, independent QA decisions, private PDF reports and an operations dashboard. All sprint PRs remain open for owner review. Synthetic fixtures are not approved real-world safety policies.

## Fresh clone
Requirements: Python 3.12+, Node 22, Docker Compose v2. Synthetic local data only.

```sh
python -m venv .venv
# Activate .venv (Windows: .venv\Scripts\Activate.ps1; POSIX: source .venv/bin/activate)
pip install -r services/api/requirements-dev.lock
ruff check --config services/api/pyproject.toml services/api
ruff format --check --config services/api/pyproject.toml services/api
mypy --config-file services/api/pyproject.toml services/api/app
pytest services/api/tests
python scripts/export_openapi.py --check
cd apps/web
npm ci
npm run lint
npm run format
npm run typecheck
npm test
npm run build
```
On PowerShell with script execution disabled use npm.cmd / npx.cmd and .venv/Scripts/python.exe directly.

Copy .env.example to .env, replace local passwords, then from repository root:
```sh
docker compose up --build -d --wait
curl http://localhost:8000/api/v1/health/ready
curl http://localhost:3000
docker compose down
```
Open http://localhost:3000/workspace and sign in as `operator` or `reviewer` with the local-only password `synthetic-demo-only`. API docs: http://localhost:8000/docs. Missing critical settings fail startup. Local S3 emulator is ephemeral; never use real data. See [infrastructure](infra/README.md) and [operations, staging and recovery](docs/RUNBOOKS.md).

With the stack running, install root test dependencies with `npm ci`, install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. CI also runs the Python suite against PostgreSQL, including concurrent review and row-level security tests. Set `CC_TEST_POSTGRES_URL` to a disposable PostgreSQL database with schema/role creation rights to run those tests locally.

## Contracts and review
- [PRD](docs/Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md)
- [Architecture](docs/ARCHITECTUR.md), [API](docs/API.md), [database](docs/DATABASE.md)
- [S0 ADR and open owner decisions](docs/adr/0001-foundation.md)
- [Backlog](docs/TASKS.md), [execution evidence](docs/EXECUTION.md)
- [UX wireframe](docs/UX.md), [synthetic oracles](tests/fixtures/README.md)
- [Operating contract](AGENT.md)

One PR per sprint, stacked S0 → S6. The project owner reviews the whole stack. No automatic merge or deployment. Real QA-policy approval and production infrastructure sign-off remain OPEN.

## Conventions
Python snake_case; TypeScript components PascalCase; conventional commit prefixes. Keep HTTP adapters separate from domain calculations. New API routes update generated OpenAPI and contract tests. Persistence begins with reversible S1 migrations; no S0 schema migration is implied.
