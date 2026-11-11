# claude.md — Claude Code Project Instructions

**Project:** Cold Chain Decision Intelligence Platform / Transport Simulation  
**Target:** MVP v1.0 | **Version:** 1.0.0 | **Updated:** 2026-11-11

> **Claude Code discovery note:** Claude Code normally auto-loads a file named **`CLAUDE.md`** (uppercase) in its recognized project locations. The requested `claude.md` filename on a case-sensitive system may **not** be discovered automatically. When installing this into the repository, copy/rename it to `CLAUDE.md`. Keep `AGENT.md` (`AGENTS.md` for agents that expect that spelling) as the shared cross-agent contract.

## 1. Read this first

You are a senior software engineering contributor implementing a safety-sensitive, multi-tenant cold-chain **decision-support MVP**. Optimize for correct and testable engineering, not broad autonomous code changes.

**Read in this order before nontrivial changes:**

1. `AGENT.md` or its installed `AGENTS.md` equivalent (shared instructions).
2. `Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md` (scope and product behavior).
3. `ARCHITECTUR.md` (architecture, domain boundaries, persistence).
4. `API.md` (actual public HTTP contract).
5. Relevant existing source, tests and ADRs; repository contents override assumptions about what has already been implemented.

If this file and `AGENT.md` conflict, keep the stricter safety requirement and explicitly flag the discrepancy. If specs disagree, propose an ADR and contract update rather than implementing an undocumented change.

## 2. Non-negotiable domain rules

- This is **not** a tool for automatic product release, food-safety certification, route dispatch or disposal orders.
- Approved, versioned, deterministic rules control eligibility. `HARD_BLOCK` is non-overridable by LLM, cost weights or ordinary QA review.
- Missing evidence and time-series gaps are **unknown**, not compliant.
- QA approval must be explicit and recorded, separately authorized from Admin rights.
- No cross-tenant access; every API handler, job, query and artifact has tenant ownership enforcement.
- Re-analysis and changed policy cannot mutate immutable previously submitted decisions or reports.
- LLM explains verified engine outputs only; no AI-generated thresholds, probabilities, approval states or cost facts without substantiation.
- One fresh-strawberry reference product for MVP; its operational temperature/quality limits require expert approval. **Never treat fixture values as real safety limits.**

## 3. Claude Code working style

### Plan-first triggers

Before modifying code for any of the following, present a short implementation plan and likely test impact: schema/migrations, public API changes, identity/RBAC, policy/safety rules, simulation ranking, decision workflow, job lifecycle, report provenance, cross-module refactors.

For a small local fix, inspect the nearest call sites/tests, implement only the smallest correct change and report verification.

### Execution cycle

1. **Inspect:** `git status`, directory tree, project manifests, existing tests and relevant docs. Do not assume this scaffold exists yet.
2. **Define:** write or identify acceptance criteria and negative tests first; clarify only genuine blockers.
3. **Implement:** use bounded edits, typed boundaries, pure domain logic, explicit failure behavior and immutable evidence.
4. **Verify:** run the narrow test set, type check/linter, then broader checks when available and reasonable.
5. **Report:** changed files, behavior, test commands/results, remaining risk and any spec changes required.

Do not claim deployment, test passes or live customer validation without verifying them.

## 4. Suggested commands — only if the repository contains these scripts

These are **examples**, not commands guaranteed to work today. Inspect `package.json`, `pyproject.toml`, `Makefile`, `docker-compose*.yml` and workflow files for authoritative commands.

```bash
# Discovery
git status --short
find . -maxdepth 3 -type f | head -80

# Backend: after locating and installing project dependencies
cd services/api
python -m pytest tests/unit -q
python -m pytest tests/integration -q
python -m pytest tests/contract -q
ruff check .
mypy app

# Frontend: after confirming package scripts and package manager
cd apps/web
npm run lint
npm run typecheck
npm run test

# Contract / E2E: use only if scripts exist
# npm run test:e2e
# python -m pytest tests/e2e -q

# Local Compose: verify config before starting containers
# docker compose config
# docker compose up --build
```

Do not install libraries, invoke external AI providers, run irreversible migrations or start paid infrastructure without authorization. Never use `alembic downgrade` against shared or production data without an approved rollback plan.

## 5. Code organization and design constraints

Baseline is modular monolith:

```text
apps/web/                       # Next.js, TS, Tailwind, shadcn/ui, ECharts
services/api/app/
  api/v1/                      # FastAPI handlers: validation, delegation, response mapping
  core/                        # config, errors, auth context
  identity/ shipments/ products/ policies/
  temperature/ analytics/ simulations/
  decisions/ ai/ reports/ audit/
  db/ jobs/
services/api/tests/
packages/contracts/            # OpenAPI snapshot and generated TS types/client
fixtures/{csv,policies,expected_outputs}/
docs/adr/
```

Keep data processing and rules in pure Python domain functions. Separate adapters, services, repositories and schemas. Do not inject a provider SDK, ORM session or FastAPI request directly into an excursion/cost/policy calculation. All incoming input must be validated with explicit types and bounded size.

### Backend priorities

- Typed Pydantic request/response models; validate all user-supplied data.
- Multi-tenant queries scoped via authenticated organization context, never client-supplied organization ID.
- SQLAlchemy repositories with restrictive ownership checks and transactional state transitions.
- Alembic migrations with constraints and indices; explicit API/domain version pinning.
- Idempotent RQ jobs, durable job status, bounded retries, transactional persistence; fail closed on partial imports.
- Decimal currency arithmetic and UTC timestamps with source timezone provenance.

### Frontend priorities

- Use generated/typed API contracts where available; don't invent fields or endpoint paths.
- Explicit loading, empty, failed, data-gap, review-required and permission-denied states.
- Quality/risk outcomes use readable labels and icons in addition to colors.
- Make it obvious which figures are observed, entered, calculated or estimated.
- Never label a recommendation `SAFE`, `CERTIFIED`, or `APPROVED` merely because it has low cost, low delay or no detected excursion.
- Design around the full journey: shipment → CSV → validation → chart → policies → simulation → decision → QA → report.

## 6. Canonical engine behavior

### Temperature ingestion and analytics

- CSV must contain timestamp and temperature, support schema mapping, enforce file/row limits and reject invalid types.
- A timezone-less timestamp requires explicit source timezone; normalize UTC and preserve original metadata.
- Use the specified zero-order-hold interval method; gap beyond configured tolerance is UNKNOWN. Treat duplicate/conflicting sensor data explicitly.
- Keep raw upload immutable and create new dataset versions on re-import.
- Pin `analysis_run` to exact dataset, policy and engine version/hash.

### Quality policies

- Editable draft → reviewed → approved/retired **versioned** policy; only an approved applicable version can govern an operational simulation.
- Rule types: `HARD_BLOCK`, `REVIEW_REQUIRED`, `ADVISORY`.
- Do not evaluate arbitrary user-authored Python or unrestricted expressions. Use schema-validated declarative rules.
- All product-specific numeric thresholds need QA evidence; fixture/mock thresholds remain demo-only.

### Simulations

- Controlled scenario templates: conditional continue, hold/inspect, conditional reroute, quarantine/reject/dispose per policy.
- Compute eligibility **before** optional cost/delay ranking. Only eligible options can be ranked as executable.
- Keep `ELIGIBLE`, `REVIEW_REQUIRED`, `BLOCKED`, `INSUFFICIENT_DATA` semantically separate.
- Use `Decimal` costs; label confirmed/user-estimated/model-estimated fields. Do not invent loss probabilities or receiver consent.
- Recalculate produces a new run/revision; originals are immutable.

### Decisions and reports

- Decision proposals refer to exact simulation/scenario and are protected by idempotency and optimistic concurrency.
- QA reviews record acting role, notes, provenance, timestamp; enforce role and configured self-approval restrictions.
- Submitted decision snapshot stores dataset hash, policy version, rule/engine/template versions, assumptions and AI explanation reference.
- Report is derived **only** from frozen snapshot; never recompute against the latest policy.

## 7. Public API contract rules

Use `API.md` as the canonical human-readable contract and generated OpenAPI as the machine contract. Base `/api/v1`. Do not silently change statuses or payload keys.

Important semantics:

| Concern | Required behavior |
|---|---|
| Auth/session | Managed OIDC + server-side secure session baseline; do not invent a password backend |
| Tenant isolation | Out-of-tenant ID → `404 RESOURCE_NOT_FOUND` |
| Auth vs role | Unauthenticated → `401`; insufficient role → `403` |
| Stale revisions | Stale `If-Match` → `412`; missing required precondition → `428` |
| Idempotency | Required on specified writes; same key/body replays; same key/different body → `409` |
| Invalid domain input | Structured `422` with stable error code |
| Async processing | `202` + job ID; poll `GET /jobs/{job_id}` |
| State transitions | Server validates ownership, current state, acting role and version |

On API changes, update FastAPI model/route, generated OpenAPI schema, generated client, `API.md`, contract tests and any frontend consumers in the same change set.

## 8. AI implementation rules

The AI assistant is **optional explanation**, never the computation source. Use a provider-agnostic adapter with mocked providers in tests. Give the model only bounded, normalized facts already computed and the relevant approved rule identifiers. Treat original CSV text, customer notes and external documents as untrusted data. Never put secrets, private credentials or entire customer datasets into model prompts.

Require validated structured output such as:

```json
{
  "summary": "A temperature excursion was detected.",
  "key_findings": [],
  "scenario_explanations": [],
  "uncertainties": [],
  "required_reviews": [],
  "source_references": []
}
```

Post-validate facts and references against the persisted read model; reject unsupported action claims, fabricated rule IDs and contradictory eligibility. On provider timeout/format failure, show deterministic engine results with AI explanation unavailable. Do not fail the entire simulation or the approval workflow.

## 9. Mandatory test design

Use deterministic test fixtures and a human-reviewed expected-results oracle. Each core feature includes at least one happy path and one unsafe/failure path.

**Must-pass cases:**

1. CSV irregular sampling + missing interval yields UNKNOWN, not false compliance.
2. Unit/timezone conversion preserves original evidence; conflicting duplicate readings are rejected or handled explicitly.
3. No approved policy → no executable release/reroute.
4. `HARD_BLOCK` never becomes eligible after cost-weight or AI changes.
5. Tenant A cannot read Tenant B jobs/files/records even by guessed IDs.
6. Admin without QA cannot approve; optional no-self-approval enforced.
7. Repeated write with identical idempotency key does not duplicate side effects.
8. Missing/stale ETags produce `428`/`412` correctly.
9. Policy or dataset change does not mutate historical simulation, decision or report.
10. AI timeout or adversarial CSV metadata does not change authoritative outputs.
11. Decimal cost totals match independent oracle; missing probabilities do not produce fake expected losses.
12. Background worker retries do not create duplicate records.

Do not use LLM-generated expected outputs as a substitute for independent calculation or QA sign-off.

## 10. Repo safety and tool-use boundaries

- Prefer reading relevant files/searching symbol references before editing. Keep diffs scoped.
- Do not run destructive commands (`rm -rf`, database reset, forced push, mass rewrite) without explicit justification and approval when persistence or collaboration is at risk.
- Do not inspect or print `.env`, private keys, tokens or production data beyond what is necessary; redact any accidental exposure in logs.
- Do not call public web services or paid model APIs to evaluate customer data without explicit permission and approved privacy context.
- Never silently change a regulatory/business constraint simply to make a test pass.
- Keep user edits intact. If repository contents disagree with this proposal, report the mismatch rather than deleting code.

## 11. How to hand off work

After each significant implementation, provide:

```text
Task:
Implemented:
Files changed:
Behavior / API / schema impact:
Tests run + actual results:
Safety / tenant / QA checks:
Assumptions or blocked decisions:
Next recommended task:
```

For complex work, include precise migration and rollback notes. For changes to thresholds or approval behavior, explicitly state whether qualified QA approval is outstanding.

## 12. Initial implementation order

1. Verify repository state; establish migrations, CI, lint/test conventions and auth/tenant boundaries.
2. Build shipment CRUD, product/quality-policy versioning and signed-off fixture dataset.
3. Implement CSV parser/validation, immutable datasets and excursion analysis with golden tests.
4. Build deterministic policy and simulation/cost engines with fail-closed eligibility.
5. Add decision/QA workflow, immutable snapshots, reports and audit trail.
6. Add optional LLM explanations behind feature flag and fallback behavior.
7. Complete end-to-end tests, security/tenant tests, performance checks and release documentation.

**Release gate:** P0 scope complete, critical safety and tenancy tests green, QA-approved reference policies available for intended use, and no implication that simulation output by itself certifies real cargo safety.

**Status:** Draft Claude Code guidance. Copy into the actual repository using the canonical `CLAUDE.md` filename if automatic loading is required.
