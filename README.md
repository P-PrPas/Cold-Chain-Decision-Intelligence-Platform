<div align="center">

<img src="apps/web/public/brand/lockup.svg" alt="Cold Chain Simulation Studio" height="72" />

# Cold Chain Simulation Studio

**Decision support for temperature-sensitive shipments: from a sensor CSV to a QA-reviewed, frozen report, with every unknown kept honest.**

[![CI](https://github.com/P-PrPas/Cold-Chain-Decision-Intelligence-Platform/actions/workflows/ci.yml/badge.svg)](https://github.com/P-PrPas/Cold-Chain-Decision-Intelligence-Platform/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-0.187-000000?logo=threedotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![i18n: EN | TH](https://img.shields.io/badge/i18n-EN%20%7C%20TH-1f6f5c)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[Quick start](#quick-start-docker) ·
[Features](#key-features) ·
[Architecture](#architecture) ·
[Testing](#testing-and-quality) ·
[API](#api-overview) ·
[Documentation](#documentation) ·
[Status](#project-status)

</div>

<br />

<table>
  <tr>
    <td width="50%"><img src="apps/web/public/guide/en/studio-first.webp" alt="The Studio on first load: a 3D diorama of the route with the temperature ribbon and the four response scenarios" /></td>
    <td width="50%"><img src="apps/web/public/guide/en/studio-compare.webp" alt="Compare mode in the Studio: four scenarios side by side with delay and cost" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Studio sandbox.</b> A 3D diorama of the trip with a thermal ribbon that shows gaps as gaps.</sub></td>
    <td align="center"><sub><b>Compare mode.</b> Four response scenarios on one time axis, each with its own delay and cost.</sub></td>
  </tr>
  <tr>
    <td><img src="apps/web/public/guide/en/ws-policy.webp" alt="Workspace: a versioned quality policy awaiting QA approval" /></td>
    <td><img src="apps/web/public/guide/en/ws-qa.webp" alt="Workspace: an independent QA review of a proposed decision" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Workspace, policy.</b> Versioned policies; only an approved version can govern a simulation.</sub></td>
    <td align="center"><sub><b>Workspace, QA review.</b> Explicit, recorded approval, separate from Admin rights.</sub></td>
  </tr>
</table>

<details>
<summary>Thai UI screenshots</summary>

<table>
  <tr>
    <td width="50%"><img src="apps/web/public/guide/th/studio-first.webp" alt="Studio in Thai" /></td>
    <td width="50%"><img src="apps/web/public/guide/th/ws-qa.webp" alt="Workspace QA review in Thai" /></td>
  </tr>
</table>

</details>

> [!IMPORTANT]
> **This is decision support, not a safety authority.** It does not certify food safety, release product, dispatch routes or order disposal.
>
> - Missing evidence and time-series gaps are **UNKNOWN**, never "compliant".
> - Eligibility comes only from an **approved, versioned, deterministic policy** plus explicit **human QA** approval. `HARD_BLOCK` rules cannot be overridden by cost weights, an AI explanation or ordinary review.
> - Every fixture, threshold and cost in this repository is **synthetic and for demonstration only**. Never treat them as real safety limits. Real product limits require expert approval that has **not** been given.

---

## Contents

- [What it is](#what-it-is)
- [Key features](#key-features)
- [End-to-end workflow](#end-to-end-workflow)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing and quality](#testing-and-quality)
- [API overview](#api-overview)
- [Domain and safety principles](#domain-and-safety-principles)
- [Conventions](#conventions)
- [Documentation](#documentation)
- [Project status](#project-status)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## What it is

Cold Chain Simulation Studio (repository name: *Cold Chain Decision Intelligence Platform*) is a safety-sensitive, multi-tenant MVP that helps logistics and quality teams reason about a strawberry shipment whose temperature record shows trouble. It has two faces:

- **A sandbox (`/studio`)** where anyone can replay a synthetic trip in 3D, change the delay, costs and individual readings, and see how four response options compare. It runs entirely in the browser on demo data.
- **A workspace (`/workspace`)** where authenticated operators and QA reviewers do the real work: ingest sensor data, apply an approved policy, run deterministic analysis and simulation, propose a decision, get an independent QA review, and freeze the result into a report.

It is aimed at logistics operators, quality assurance reviewers and the engineers who maintain the rules. The MVP covers one reference product (fresh strawberries) and one decision flow.

## Key features

### Studio sandbox

- **3D diorama and 2D schematic** of the route, with a playable timeline you can scrub, pause and edit.
- **Thermal ribbon with honest gaps.** Missing intervals are drawn as unknown, not filled in.
- **Four response scenarios:** continue delivery, hold for inspection, conditional reroute, and reject / quarantine / dispose.
- **Compare mode** runs all four scenarios on one shared time axis. The sandbox never ranks options or claims eligibility: it shows *Not evaluated*, because eligibility comes only from the engine.
- **Delay-driven timing.** Changing the delay changes when things happen in the scene.
- **Cost breakdown** by category and a **delay-versus-cost chart**.
- **Editable readings.** Drag a temperature point, or mark it as *No reading*, and watch the 3D scene, ribbon and gaps update. Edits are synthetic and never saved.
- **Provenance everywhere.** Each figure is labelled observed, entered, calculated or estimated.

### Workspace

- **Shipments** with product, route and operational state.
- **CSV ingest** with column mapping, explicit source timezone, unit handling and bounded file size. Raw uploads are immutable; re-imports create new dataset versions.
- **Versioned quality policies** (draft, reviewed, approved, retired) made of schema-validated declarative rules: `HARD_BLOCK`, `REVIEW_REQUIRED`, `ADVISORY`. No user-authored code is evaluated.
- **Deterministic analysis** with zero-order-hold intervals; gaps beyond tolerance become UNKNOWN.
- **Simulation** of the four scenario templates with `Decimal` cost arithmetic. Eligibility (`ELIGIBLE`, `REVIEW_REQUIRED`, `BLOCKED`, `INSUFFICIENT_DATA`) stays separate from ranking.
- **Decision proposal, QA review and frozen snapshots.** The snapshot pins dataset hash, policy version and engine versions; a changed policy or re-analysis never mutates it.
- **PDF reports** in English and Thai, derived only from the frozen snapshot.
- **Audit trail**, an operations dashboard and an optional, bounded AI explanation adapter that can only explain verified engine output (deterministic results are shown if it is unavailable).

### Platform

- **Multi-tenant** with PostgreSQL row-level security; an out-of-tenant ID returns `404`.
- **OIDC sign-in** (Keycloak locally) with server-side sessions, plus role separation: Admin never implies QA.
- **Idempotency keys** on writes, **ETag / `If-Match`** optimistic concurrency, and durable **background jobs** (RQ).
- **Bilingual UI (English and Thai)**, light and dark themes, readable labels and icons alongside colour, and reduced-motion support.

## End-to-end workflow

```mermaid
flowchart LR
    A[Shipment] --> B[CSV upload]
    B --> C[Validation<br/>timezone, units, duplicates]
    C --> D[Analysis<br/>excursions and UNKNOWN gaps]
    D --> E[Approved policy]
    E --> F[Simulation<br/>eligibility, then cost and delay]
    F --> G[Decision proposal]
    G --> H{QA review}
    H -->|approve| I[Frozen snapshot]
    H -->|reject or request changes| G
    I --> J[PDF report EN / TH]
```

## Architecture

```mermaid
flowchart TB
    user([Browser]) --> web
    subgraph compose [Docker Compose stack]
        web["web<br/>Next.js 16 / React 19<br/>:3000"]
        api["api<br/>FastAPI<br/>:8000"]
        worker["worker<br/>RQ jobs"]
        pg[("PostgreSQL 16<br/>RLS, audit, outbox")]
        redis[("Redis 7<br/>job queue")]
        s3[("S3-compatible storage<br/>evidence, reports")]
        kc["Keycloak 26<br/>OIDC<br/>:8080"]
    end
    web -->|REST /api/v1| api
    web -. sign-in redirect .-> kc
    api -->|token and JWKS| kc
    api --> pg
    api --> redis
    api --> s3
    worker --> redis
    worker --> pg
    worker --> s3
```

The backend is a modular monolith: HTTP handlers validate and delegate, while parsing, excursion analysis, policy evaluation and cost calculation are pure Python functions with no ORM, request or provider dependency. The API and worker share one image.

| Layer | Technology |
| --- | --- |
| Web | Next.js 16 (App Router, standalone output), React 19, TypeScript 6, three.js, plain CSS with design tokens |
| API | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, Authlib (OIDC), ReportLab (PDF) |
| Jobs | RQ on Redis, with a transactional outbox |
| Data | PostgreSQL 16 with forced row-level security; S3-compatible object storage (Moto locally) |
| Identity | Keycloak 26 with a synthetic realm locally; any OIDC provider in staging |
| Tests | pytest, Vitest, Playwright; Ruff and strict mypy; ESLint and Prettier |
| Delivery | Docker Compose, GitHub Actions |

## Repository structure

```text
.
├── apps/web/                  Next.js application
│   ├── app/                   Routes: / (landing), /studio, /guide, /workspace, /brand
│   ├── components/            Shared UI (site chrome, brand mark, evidence and decision views)
│   │   └── ui/                Status badge, provenance chip, contrast helpers
│   ├── lib/                   Shared logic (preferences, simulation assumptions and costs)
│   ├── i18n/                  English and Thai dictionaries and the language provider
│   └── public/                Brand SVGs, guide screenshots (en/th), motion assets
├── services/api/              FastAPI service and RQ worker
│   ├── app/                   Handlers and pure domain modules (analytics, simulation_engine, ...)
│   ├── migrations/            Alembic migrations
│   └── tests/                 pytest suite
├── packages/contracts/        openapi.json snapshot checked in CI
├── infra/                     Keycloak realm, storage image, staging compose, infra notes
├── tests/
│   ├── e2e/                   Playwright specs (run against the Compose stack)
│   └── fixtures/              Synthetic CSVs, policy and hand-calculated oracles
├── scripts/                   export_openapi.py, benchmark.py, optimize_guide_images.py
├── docs/                      Living contracts, ADRs, design, and history (see docs/README.md)
├── compose.yaml               Canonical local stack
├── .env.example               Local environment template
├── AGENT.md / CLAUDE.md       Contributor and coding-agent operating contract
└── .github/                   CI workflow and pull request template
```

## Getting started

### Prerequisites

- Docker with Compose v2
- Node.js 22 and npm (web development and Playwright)
- Python 3.12 or newer (backend checks)
- Git

### Quick start (Docker)

```sh
git clone https://github.com/P-PrPas/Cold-Chain-Decision-Intelligence-Platform.git
cd Cold-Chain-Decision-Intelligence-Platform

cp .env.example .env        # then replace the placeholder passwords
docker compose up --build -d --wait
```

Compose refuses to start if `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` or `SESSION_SECRET` is missing. Use a URL-safe PostgreSQL password, and keep `SESSION_SECRET` at 32 characters or more.

| Service | URL | Notes |
| --- | --- | --- |
| Web | <http://localhost:3000> | Landing page. Try `/studio`, `/guide`, `/workspace`. |
| API docs | <http://localhost:8000/docs> | Interactive OpenAPI. |
| API health | <http://localhost:8000/api/v1/health/ready> | Checks PostgreSQL, Redis and the bucket. `/health/live` is independent. |
| Keycloak | <http://localhost:8080> | Synthetic `coldchain` realm, imported on start. |

All ports bind to `127.0.0.1` only. PostgreSQL, Redis and storage have no host port.

Sign in at <http://localhost:3000/workspace> with one of the local-only demo users. Their shared password is `synthetic-demo-only`, which is intentionally public and exists only in the local realm.

| User | Roles | Use it for |
| --- | --- | --- |
| `operator` | Admin, Logistics | Shipments, uploads, policy authoring, simulations, proposals |
| `reviewer` | QA | Policy approval and decision review |

Stop the stack with `docker compose down`. **Do not add `-v`** unless you mean to delete the local PostgreSQL volume. The S3 emulator is ephemeral and loses its objects when the storage container is recreated.

> [!NOTE]
> Use synthetic data only. The local stack runs with `CC_SYNTHETIC_ONLY=true` and insecure cookies, and is not a place for real customer data.

### Local development without Docker for the app code

The API needs PostgreSQL, Redis and an S3-compatible store, so the simplest loop is to run the stack in Docker and develop the web app against it.

**Web (hot reload)**

```sh
cd apps/web
npm ci
npm run dev                 # http://localhost:3000
```

The web app talks to `http://localhost:8000/api/v1` by default. Override it with `NEXT_PUBLIC_API_URL` (it is a build-time variable for production images). Sign-in only works from the `http://localhost:3000` origin because the Keycloak client registers that callback. Stop the Compose `web` container first (`docker compose stop web`) to free the port.

**Backend checks**

```sh
python -m venv .venv
source .venv/bin/activate   # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r services/api/requirements-dev.lock
```

The pytest suite uses an in-memory SQLite database and fakes, so it needs no running services. See [Testing and quality](#testing-and-quality).

<details>
<summary>Windows and PowerShell notes</summary>

- If script execution is disabled, call `npm.cmd` and `npx.cmd` instead of `npm` and `npx`, and run tools through `.venv\Scripts\python.exe -m ...`.
- Activate the virtual environment with `.venv\Scripts\Activate.ps1`.
- Replace `cp .env.example .env` with `Copy-Item .env.example .env`.
- Line endings are LF (see `.gitattributes`); keep your editor from converting them.

</details>

## Configuration

Copy [`.env.example`](.env.example) to `.env`. Docker Compose reads these variables and passes the rest of the API settings itself.

| Variable | Purpose | Example in `.env.example` |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Password for the local PostgreSQL user `coldchain` (URL-safe characters only). Required. | `replace-with-local-password` |
| `MINIO_ROOT_USER` | Access key for the local S3 emulator. Required. | `local-storage` |
| `MINIO_ROOT_PASSWORD` | Secret key for the local S3 emulator (16 characters or more). Required. | `replace-with-local-storage-password` |
| `SESSION_SECRET` | Signs server-side sessions (32 characters or more). Required. | `synthetic-local-only-replace-before-use-32chars` |

<details>
<summary>API settings (<code>CC_*</code>) and web build variable</summary>

`compose.yaml` wires these for the local stack. [`infra/compose.staging.yaml`](infra/compose.staging.yaml) shows the staging set. Defaults come from `services/api/app/config.py`. Missing critical settings fail startup.

| Variable | Purpose | Default |
| --- | --- | --- |
| `CC_DATABASE_URL` | PostgreSQL connection URL | required |
| `CC_REDIS_URL` | Redis URL for the job queue | required |
| `CC_S3_ENDPOINT` | S3-compatible endpoint | required |
| `CC_S3_ACCESS_KEY` / `CC_S3_SECRET_KEY` | Object-store credentials (secret 16+ characters) | required |
| `CC_S3_BUCKET` | Evidence bucket name | required (`evidence` locally) |
| `CC_OIDC_ISSUER` | Browser-visible OIDC issuer | empty |
| `CC_OIDC_BACKCHANNEL` | Private issuer URL used for token and JWKS calls | empty |
| `CC_OIDC_CLIENT_ID` / `CC_OIDC_CLIENT_SECRET` | OIDC client registration | empty |
| `CC_OIDC_CALLBACK` | OIDC redirect URI | `http://localhost:8000/api/v1/auth/callback` |
| `CC_WEB_ORIGIN` | Allowed web origin | `http://localhost:3000` |
| `CC_SESSION_SECRET` | Session signing secret (32+ characters when OIDC is configured) | empty |
| `CC_SECURE_COOKIES` | Send cookies as `Secure` | `true` (Compose sets `false`) |
| `CC_SYNTHETIC_ONLY` | Marks the deployment as demo-data only; `false` demands HTTPS identity and storage | `true` |
| `CC_RATE_LIMIT_ENABLED` / `CC_RATE_LIMIT_PER_MINUTE` | Request rate limiting | `true` / `120` |
| `NEXT_PUBLIC_API_URL` | Web build argument for the API base URL | `http://localhost:8000/api/v1` |

</details>

Never commit `.env`. Never use production secrets or data in the local stack.

## Usage

| Where | What you will find |
| --- | --- |
| `/` | Landing page with a live, miniature simulation. |
| `/studio` | The 3D sandbox. Pick a shipment, play the trip, edit readings, compare scenarios. |
| `/guide` | An illustrated, bilingual walkthrough with every screenshot taken from the real UI. |
| `/workspace` | The authenticated workflow, from shipment to QA-reviewed report. |
| `/brand` | Internal reference for the logo, tokens, status badges and provenance chips. |

Use the header to switch between English and Thai and between light and dark themes. Both choices are remembered in the browser.

### Studio keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `←` / `→` | Move the playhead 5 minutes back or forward |
| `Shift` + `←` / `→` | Move the playhead 30 minutes back or forward |
| `C` | Turn compare mode on or off |
| `R` | Reset |
| `1` to `4` | Select continue, hold, reroute or quarantine |
| `↑` / `↓`, `Delete` | While editing readings with a point focused: nudge it by 0.1 °C (`Shift`: 1 °C), or toggle it to *No reading* |
| `Esc` | Dismiss the coach mark, or close the assumptions sheet on a phone |

### Regenerating the guide screenshots

The guide images are committed, so this is only needed after a UI change. With the Compose stack running on port 3000:

```sh
CC_GUIDE_CAPTURE=1 npx playwright test tests/e2e/guide-capture.spec.ts
pip install pillow
python scripts/optimize_guide_images.py
```

The capture spec writes raw PNGs to `tests/e2e/.guide-raw/` (git-ignored). The script converts them to `apps/web/public/guide/<lang>/*.webp` and rewrites `apps/web/app/guide/guide-images.json`. The spec is skipped unless `CC_GUIDE_CAPTURE=1`.

## Testing and quality

### Backend

Run from the repository root with the virtual environment active.

```sh
ruff check --config services/api/pyproject.toml services/api
ruff format --check --config services/api/pyproject.toml services/api
mypy --config-file services/api/pyproject.toml services/api/app
pytest services/api/tests
python scripts/export_openapi.py --check      # fails if packages/contracts/openapi.json is stale
```

Some tests need a real PostgreSQL: concurrent QA review, row-level security, the non-owner role model and migration downgrade/upgrade. They are skipped unless you point `CC_TEST_POSTGRES_URL` at a **disposable** database where the user may create schemas and roles:

```sh
CC_TEST_POSTGRES_URL=postgresql://user:pass@localhost:5432/test pytest services/api/tests -q
```

Add `CC_BENCHMARK_OUTPUT=benchmark.json` to also write the PostgreSQL benchmark. `python scripts/benchmark.py --output <file>` runs the in-process synthetic benchmark.

### Web

```sh
cd apps/web
npm ci
npm run lint
npm run format          # prettier --check; use `npx prettier --write .` to fix
npm run typecheck       # next typegen && tsc --noEmit
npm test                # vitest
npm run build
```

### End-to-end (Playwright)

With the Compose stack running, from the repository root:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

The specs in [`tests/e2e`](tests/e2e) drive the real stack on port 3000 (Keycloak sign-in, upload, analysis, simulation, QA, report) plus UI and accessibility reviews of the Studio, guide and landing page.

### What CI runs

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request.

| Job | Checks |
| --- | --- |
| `api` | Ruff lint and format, strict mypy, pytest, OpenAPI snapshot check |
| `web` | ESLint, Prettier, typecheck, Vitest, production build |
| `postgres` | Full pytest against PostgreSQL 16, including RLS and concurrency; uploads the benchmark |
| `stack` | Builds the Compose stack, waits for health, runs Playwright, then a disposable `pg_dump` restore drill and recovery check |

## API overview

Base path `/api/v1`. The human-readable contract is [docs/API.md](docs/API.md); the machine contract is [packages/contracts/openapi.json](packages/contracts/openapi.json), and CI fails if it drifts from the code. Interactive docs are served at `/docs` when the API is running.

Resource groups include `shipments`, `temperature-datasets`, `analyses`, `simulations`, `quality-policies`, `products`, `decisions`, `reports`, `jobs`, `audit-logs`, `dashboard`, `auth` and `organizations/current`.

| Concern | Behavior |
| --- | --- |
| Authentication | OIDC sign-in, then a server-side session cookie. No local password backend. |
| `401` / `403` | Unauthenticated / authenticated but lacking the role. |
| `404` | Out-of-tenant IDs look exactly like missing ones (`RESOURCE_NOT_FOUND`). |
| `409` | Same idempotency key with a different body. Same key and body replays the first result. |
| `412` / `428` | Stale `If-Match` / missing required precondition. |
| `422` | Structured domain validation error with a stable code. |
| `202` | Work accepted as a background job; poll `GET /jobs/{job_id}`. |

## Domain and safety principles

1. **Unknown is not compliant.** Gaps and missing evidence stay UNKNOWN end to end.
2. **Approved rules decide eligibility.** Versioned, deterministic, schema-validated policy rules; eligibility is computed before cost or delay ranking.
3. **`HARD_BLOCK` is final.** No LLM, cost weight or ordinary QA review can override it.
4. **QA is explicit.** Approval is recorded with role, notes and provenance, and is authorised separately from Admin rights. Self-approval can be restricted.
5. **Immutable evidence.** Raw uploads, dataset versions, submitted decisions and reports are never mutated. Re-analysis creates a new run.
6. **Reports come from frozen snapshots**, never from the latest policy.
7. **AI explains, never decides.** It sees only bounded, verified engine facts; its output is validated, and failure never blocks the workflow.
8. **Tenant isolation everywhere**: handlers, jobs, queries and artifacts.
9. **Money is `Decimal`.** Costs are labelled confirmed, user-estimated or model-estimated; no invented loss probabilities.
10. **Fixtures are demo-only.** One reference product for the MVP, and its limits need expert approval.

## Conventions

- Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`), one focused pull request at a time, and no automatic merge.
- Python `snake_case`; TypeScript components in PascalCase; web code imports shared modules through the `@/` alias (`@/components`, `@/lib`, `@/i18n`).
- Keep HTTP adapters separate from domain calculations.
- API changes update the FastAPI model, the OpenAPI snapshot, [docs/API.md](docs/API.md), contract tests and web consumers in the same change.
- Schema changes go through Alembic; never downgrade shared data.
- Text files use LF line endings.
- Contributors and coding agents follow [AGENT.md](AGENT.md) and [CLAUDE.md](CLAUDE.md).

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/README.md](docs/README.md) | Index of all documentation |
| [docs/product/PRD.md](docs/product/PRD.md) | Product requirements and scope |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, boundaries, algorithms |
| [docs/API.md](docs/API.md) | REST contract |
| [docs/DATABASE.md](docs/DATABASE.md) | Data model, RLS, persistence rules |
| [docs/RUNBOOKS.md](docs/RUNBOOKS.md) | Operations, staging release, backup and recovery |
| [docs/UX.md](docs/UX.md) | Journey wireframe |
| [docs/adr/](docs/adr/) | Architecture decision records (0001 to 0004) |
| [docs/design/redesign-plan.md](docs/design/redesign-plan.md) | Web redesign plan |
| [docs/history/](docs/history/README.md) | Sprint delivery and review records |
| [infra/README.md](infra/README.md) | Local and staging infrastructure |
| [tests/fixtures/README.md](tests/fixtures/README.md) | Synthetic fixtures and oracles |

## Project status

This is an **MVP**. The sprint work (S0 to S6) and the Studio and workspace redesign are merged to `main`: OIDC sessions, tenant-scoped operations, immutable temperature evidence, versioned policies, deterministic analysis and cost scenarios, independent QA decisions, private PDF reports and an operations dashboard.

Still **open** and required before any real use:

- **Real QA-policy approval.** No product-specific threshold has been approved by a qualified domain expert; all shipped policies are synthetic demonstrations.
- **Production infrastructure sign-off.** The Compose stack is a disposable local and CI candidate. Staging needs owner-supplied managed PostgreSQL, Redis, private versioned S3, HTTPS OIDC and TLS. See [docs/RUNBOOKS.md](docs/RUNBOOKS.md) and [infra/compose.staging.yaml](infra/compose.staging.yaml).
- **Live customer validation.** None has taken place.

The ADRs under [docs/adr](docs/adr) record the reconciled decisions and the owner decisions that remain open.

## Contributing

Read [AGENT.md](AGENT.md) first. Open an issue or a draft pull request before large changes. Keep changes scoped, include a happy-path and an unsafe-path test for core behavior, and fill in the [pull request template](.github/pull_request_template.md). Do not add real customer data or real safety thresholds, and do not weaken a safety rule to make a test pass.

## License

Released under the [MIT License](LICENSE).

The license covers the code. It does not make this software a food-safety authority: the synthetic fixtures, thresholds and costs are for demonstration only, and any real use needs QA-approved policies (see the safety notice above).

## Acknowledgements

- [IBM Plex Sans, Plex Sans Thai and Plex Mono](https://github.com/IBM/plex) (SIL Open Font License), loaded through `next/font`
- [Noto Sans Thai](https://fonts.google.com/noto/specimen/Noto+Sans+Thai) (SIL OFL), embedded for Thai PDF reports (license text in [`services/api/app/fonts/OFL.txt`](services/api/app/fonts/OFL.txt))
- [three.js](https://threejs.org/), [Next.js](https://nextjs.org/), [React](https://react.dev/), [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/), [RQ](https://python-rq.org/), [ReportLab](https://docs.reportlab.com/)
- [Keycloak](https://www.keycloak.org/) and [Moto](https://github.com/getmoto/moto) for the local identity and storage stack
- [Playwright](https://playwright.dev/) and [Vitest](https://vitest.dev/)
