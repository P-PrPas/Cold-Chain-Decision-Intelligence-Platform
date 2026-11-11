# Cold Chain Decision Intelligence Platform

Decision support for shipment ? CSV ? analysis ? scenarios ? human QA ? report.
S0 provides developer foundations only. No shipment operations, authentication, production policy, or release certification is implemented yet.

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
API docs: http://localhost:8000/docs. Health live/ready are the only implemented routes. Missing critical settings fail startup. Local S3 emulator is ephemeral; never use real data. See [infrastructure](infra/README.md).

## Contracts and review
- [PRD](docs/Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md)
- [Architecture](docs/ARCHITECTUR.md), [API](docs/API.md), [database](docs/DATABASE.md)
- [S0 ADR and open owner decisions](docs/adr/0001-foundation.md)
- [Backlog](docs/TASKS.md), [execution evidence](docs/EXECUTION.md)
- [UX wireframe](docs/UX.md), [synthetic oracles](tests/fixtures/README.md)
- [Operating contract](AGENT.md)

One PR per sprint. The current agent implements directly; the project owner reviews. Do not auto-merge or deploy. S1 follows reviewed S0. Real QA-policy approval remains OPEN.

## Conventions
Python snake_case; TypeScript components PascalCase; conventional commit prefixes. Keep HTTP adapters separate from domain calculations. New API routes update generated OpenAPI and contract tests. Persistence begins with reversible S1 migrations; no S0 schema migration is implied.
