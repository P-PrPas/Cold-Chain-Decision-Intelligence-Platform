# AGENT.md — Shared Coding Agent Operating Contract

**Project:** Cold Chain Decision Intelligence Platform (Transport Simulation)  
**Scope:** MVP v1.0 | **Version:** 1.0.0 | **Updated:** 2026-11-11  
**Audience:** Codex, Claude Code, and other human-supervised coding agents.

> **Agent-discovery note:** This file uses the exact name requested by the project owner. Some coding agents auto-discover `AGENTS.md` rather than `AGENT.md`. In an actual repository, copy or rename this file to `AGENTS.md` at the repository root for such agents. Do not assume the current file is auto-loaded by any agent.

## 1. Mission and boundaries

Build a multi-tenant B2B web MVP for `shipment → CSV → validated temperature dataset → excursion analysis → quality-policy evaluation → what-if scenarios → QA-reviewed decision → report`. The software **supports operational decisions; it does not certify food safety, release goods autonomously, or dispatch vehicles**.

The team's core principle: **Every recommendation must be reproducible, explainable, constrained by approved rules, and subject to appropriate human review.**

### Never violate these invariants

1. **Safety precedes economics.** A `HARD_BLOCK` may never be overridden, made eligible, or outweighed by a lower price or shorter delivery time.
2. **Unknown does not mean safe.** Gaps, missing approvals, ambiguous sensors, unknown recipient acceptance and insufficient evidence result in `INSUFFICIENT_DATA` / `REVIEW_REQUIRED`, not inferred eligibility.
3. **LLM is never an authority.** AI may summarize or explain the deterministic engine's persisted results, but must not set or edit policies, eligibility, scores, approvals or source measurements.
4. **Tenant isolation is mandatory.** Backend authorization applies to every resource and background job. IDs supplied by clients are untrusted; out-of-tenant resources return 404 without disclosing existence.
5. **Immutable evidence.** Imported source files, approved policy versions, completed simulation runs, submitted decisions and published reports must retain version/hash links. Updates create versions or revisions.
6. **QA is separate from Admin.** Admin-only roles cannot approve quality policies or decisions. Enforce separation of duties when configured.
7. **No invented safety constants.** Example temperatures, excursion times, shelf-life estimates and probabilities are demo data only until explicitly signed off by a qualified QA/domain reviewer.
8. **No silent real-world effects.** No autonomous release, reroute, disposal, dispatch or external notification that implies approval.

## 2. Source-of-truth hierarchy

1. `Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md` — **product intent and scope**.
2. `ARCHITECTUR.md` — **proposed system design, boundaries, algorithms and infrastructure**.
3. `API.md` — **HTTP contract, validation, idempotency, RBAC and response semantics**.
4. ADRs under `docs/adr/` — **approved project-specific changes** to the above.
5. `AGENT.md` / `AGENTS.md` and `claude.md` / `CLAUDE.md` — **agent workflow**, subordinate to the specifications above.

If documents disagree, **do not silently choose a convenient interpretation**. Identify the exact conflict, prefer safety and backward-compatible behavior, propose an ADR/spec patch, and ask the project owner only for a truly blocking decision. Never treat a generated design proposal as an already implemented feature.

## 3. Baseline architecture (proposed, not proof of repository state)

| Area | Baseline |
|---|---|
| Client | Next.js, TypeScript, Tailwind CSS, shadcn/ui, Apache ECharts |
| Server | FastAPI, Python, Pydantic v2 |
| Database | PostgreSQL, SQLAlchemy, Alembic |
| Worker queue | Redis + RQ |
| File evidence | Private S3-compatible object storage |
| Authentication | Managed OIDC identity + secure backend session |
| AI | Optional provider-agnostic adapter with structured-output validation |
| Operations | Docker Compose initial environments |
| Architecture | Modular monolith; REST `/api/v1`; OpenAPI 3.1 |

**Important:** No actual application repository, commands, scripts, package names or environment secrets are proven to exist solely because the documents mention them. Inspect the tree and available manifests before running anything.

Suggested layout from architecture design:

```text
repo/
  apps/web/
  services/api/app/{api,core,identity,shipments,products,policies,temperature,analytics,simulations,decisions,ai,reports,audit,db,jobs}/
  services/api/tests/{unit,integration,contract,e2e}/
  packages/contracts/
  docs/{PRD.md,ARCHITECTUR.md,API.md,adr/}
  infrastructure/{compose,nginx,monitoring}/
  fixtures/{csv,policies,expected_outputs}/
```

The current source files may initially live at repository root. Link or copy them into `docs/` only as an intentional repo change, not as an accidental duplication.

## 4. Standard agent execution protocol

### Before implementation

1. Read this file, the relevant sections of PRD, architecture, API and existing ADRs.
2. Inspect the *actual* code, tests, configuration, migration history and Git status. Avoid overwriting human work or unrelated changes.
3. State objective, affected modules, expected API/data changes, safety impact and the verification plan in 3–8 concise lines.
4. Break work into small, reversible tasks; declare dependencies and assumptions.
5. If editing policy rules, approval behavior, money calculations or tenant security, identify affected tests **before** coding.

### During implementation

1. Preserve the existing code conventions if present; prefer minimal coherent diffs over large rewrites.
2. Keep domain calculation functions pure, deterministic and independently testable; never import API/provider SDKs into core domain logic.
3. Put authentication, authorization, row ownership and state-transition checks on the server.
4. Use service/repository boundaries and typed DTOs; don't embed simulation or policy logic inside HTTP handlers.
5. Create an Alembic migration for schema changes; preserve existing data and test upgrade/rollback procedures when feasible.
6. Update OpenAPI, `API.md` and contract tests together for any external contract change.
7. Treat uploaded files, CSV metadata, user notes and LLM responses as untrusted input; defend against injection and unsafe file processing.
8. Keep AI prompt/provider interactions out of tests by default; use fixtures/fakes and stable golden outputs.
9. Do not hard-code secrets, tokens, real customer data, cloud credentials or actual organization identifiers.

### After implementation

Report:
- What changed (file/module summary).
- Validation commands *actually run* and their actual outcomes.
- Important assumptions, remaining risks and unavailable checks.
- Whether API, DB, security, tests and documentation changed.
- Any follow-up issue with severity/owner suggestion.

Do not claim tests passed if you did not run them. Never fabricate benchmark numbers or approval from QA.

## 5. Task types and required checks

| Task | Minimum checks |
|---|---|
| CSV ingestion | invalid headers, timezone, unit conversion, duplicates, gaps, source-row provenance, file size limits |
| Time-series analytics | irregular intervals, zero-order-hold semantics, sampling-gap UNKNOWN, endpoint truncation, multi-sensor ambiguity |
| Policy engine | approved version, effective period, references, `HARD_BLOCK` vs review, no executable user-supplied code |
| Simulation | eligibility before ranking, decimal arithmetic, currency units, deterministic reruns, unknown risks visible |
| AI explanation | schema validation, citations to existing facts/rule IDs, adversarial text, timeout fallback |
| Approvals | QA-only, `If-Match`, `Idempotency-Key`, snapshot immutability, optional no-self-approval |
| API | tenant 404, auth 401, permission 403, conflict 409, stale 412, missing precondition 428, validation 422 |
| Reports | render from frozen decision snapshot; no recompute from current policy; checksum and access controls |
| Database | FK/unique constraints, tenant-scoped indexes, migrations, backward compatibility |
| UI | loading/empty/error/permission states, keyboard access, label plus color for risk, no implied certification |

### Critical automated scenarios (must remain green)

- Cross-tenant shipment, dataset, job, report, policy and decision IDs cannot be accessed.
- `HARD_BLOCK` never becomes `ELIGIBLE` through cost changes or LLM content.
- Missing approved policy or invalid dataset does not produce executable release/reroute recommendations.
- Admin without QA role cannot approve; self-approval prohibited if organization policy enables separation of duties.
- New CSV upload, policy version or re-simulation does not mutate an older decision/report.
- Retry with identical `Idempotency-Key` is safe; changed payload under same key yields `409`.
- Missing `If-Match` on revisioned operations yields `428`; stale version yields `412`.
- AI outage does not prevent deterministic calculation and QA work.
- Temperature sample gap does not get silently treated as in-range time.

## 6. Data correctness and precision rules

- Convert source timestamps to UTC, preserve timezone and original upload provenance. For naive timestamps, require explicit timezone input.
- Document and test zero-order-hold interval calculation and maximum valid sampling gap; uncertainty is never silently filled.
- Use decimal money values (Python `Decimal`, DB `NUMERIC`); never binary floating-point for financial totals.
- Store policy/engine/template versions and input hashes with results; ensure same versions + canonical inputs reproduce the same deterministic outputs.
- Use `Probability = unknown` when no validated model/source exists; don't invent likelihoods, shelf-life or food-safety conclusions.
- Show the difference between quality acceptance, food safety, customer acceptance and internal QA procedural approval.

## 7. Interface and state machine guardrails

- Follow `API.md` endpoint inventory exactly unless an approved contract change is made.
- Standardize errors and `request_id`. Hide internal paths, database IDs belonging to other tenants, stack traces and secrets.
- Long-running dataset import, analysis, simulation or reporting uses durable jobs (`QUEUED/RUNNING/COMPLETED/FAILED`) and tenant-scoped polling.
- Keep `Shipment`, `Dataset`, `Analysis`, `Simulation`, `Policy`, and `Decision` lifecycle states distinct. A shipment marked `ARRIVED` does not imply QA approved product acceptance.
- Use ETag/`If-Match` on revisioned mutation and `Idempotency-Key` on specified create/transition APIs. Workers must safely retry.
- `BLOCKED` or `INSUFFICIENT_DATA` release/reroute options are not executable proposals; safe hold/escalation can remain available per policy.

## 8. Allowed automation and prohibited actions

**Allowed without additional human authorization in a normal coding task:** read repository files, add or edit source code within the requested scope, create tests/fixtures, run local non-destructive tests/formatters, draft migrations/documentation, produce sample-only seed data.

**Require explicit approval:** deploy to production; apply migrations to a real/shared database; delete persistent data; rotate/replace live secrets; access or export real customer datasets; send external notifications; incur paid third-party API/cloud costs; add a security-sensitive dependency; change QA rules or real-world approval semantics.

**Never:** bypass safety gates; mark a user-provided temperature CSV as safe by fiat; silently disable audits/security checks; commit credentials; fake test results; turn LLM output into an authoritative decision.

## 9. Branching, review and commit style

- Work on the branch/task assigned; don't force-push or rewrite unrelated history.
- Prefer one logical change per PR. Include purpose, implementation summary, tests and risk notes.
- Proposed commit labels: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- Any sensitive boundary change should receive human review by the relevant owner (QA for policy, security for access, tech lead for architecture).
- Record major choices in `docs/adr/NNN-short-title.md`, with context, alternatives, decision and consequences.

## 10. Definition of Done

- [ ] Scope and acceptance criteria met; no unapproved feature expansion.
- [ ] Deterministic calculations and failure paths covered by tests.
- [ ] Auth/RBAC and tenant access tests included where relevant.
- [ ] Migrations, API schema and documentation aligned.
- [ ] UI states and accessibility reviewed where relevant.
- [ ] No hard-coded food-safety thresholds or unsupported AI claims.
- [ ] CI or reproducible local checks executed and summarized truthfully.
- [ ] Immutable evidence and approval semantics preserved.
- [ ] No critical unresolved safety/security issues concealed.

## 11. Working with multiple agents

Partition tasks by ownership (`web`, `API`, `policy/simulation`, `data`, `tests/docs`). Avoid simultaneous edits to the same files. Define interface contracts before parallelization. One integrator owns schema migrations, OpenAPI regeneration and merge conflict resolution. Cross-cutting security/safety requirements remain shared; no agent can waive them unilaterally.

## 12. Quick start for a newly connected agent

1. Locate repository root and inspect `git status`, project manifests and readme.
2. Read `Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md`, `ARCHITECTUR.md`, `API.md` and any ADRs.
3. Confirm actual stack/scripts versus proposed stack.
4. Find the smallest current task and write its acceptance tests.
5. Implement with safeguards; validate; summarize evidence and unresolved decisions.

**Status:** Project-wide coding guidance, pending adoption into the actual repository. Not a substitute for approved commodity safety policies or human QA review.
