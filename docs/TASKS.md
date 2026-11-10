# TASKS.md — MVP Implementation Backlog & Sprint Execution Plan

**Product:** Cold Chain Decision Intelligence Platform / Transport Simulation  
**Target:** MVP v1.0 · **Version:** 1.0.0 · **Status:** Proposed engineering backlog  
**Date:** 2026-11-11 · **Planning baseline:** 7 sprints including Sprint 0  
**References:** `Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md`, `ARCHITECTUR.md`, `API.md`, `DATABASE.md`, `AGENT.md`, `claude.md`

> Execution-ready backlog for a small full-stack team or coding-agent workflow. Scope excludes business planning and commercial rollout. Estimates are relative (S/M/L), **not commitments**. Every task must conform to safety, provenance, tenancy, authorization and immutable-evidence invariants. Do not implement unapproved temperature thresholds as if they were real food-safety rules.

## 1. Operating rules

- **P0** blocks MVP release; **P1** desirable within MVP; **P2** after core acceptance unless time permits.
- States: `TODO → READY → IN_PROGRESS → IN_REVIEW → DONE`; alternate `BLOCKED` (document reason and owner).
- Dependencies refer to IDs in this document. Sprint placement is recommended; replan when technical discovery changes effort.
- Every coding task: tests, documentation, migrations (if relevant), role and tenant checks, error/empty/loading UI, failure-path handling.
- No ticket is DONE based only on AI-generated code. A human reviewer or independently verified CI evidence must confirm acceptance criteria.
- Avoid mixing unrelated modules in one PR. For safety logic, include deterministic fixtures and adversarial tests in same PR.
- Branch/PR naming: `feat/CC-###-short-title`, `fix/CC-###-short-title`; link task, design docs, sample request/response and test evidence.

## 2. Priority, scope and critical path

**Critical path:** Architecture + contract decisions → tenant-safe DB/auth → shipment & CSV → dataset validation → approved policy & excursion → deterministic simulation → decision workflow & audit → release hardening.

**Optional dependency:** AI explanation runs after deterministic simulation; its failure must never affect eligibility, analysis, or approval operation.

| Sprint | Goal | Required exit condition |
|---|---|---|
| S0 | Contracts and foundation | ADRs accepted; local env and CI boot |
| S1 | Secure core / shipment | multi-tenant authorization and shipment CRUD pass |
| S2 | CSV & data provenance | dataset versioned, validated, visualized |
| S3 | Policies & excursion | approved rules + repeatable excursion runs |
| S4 | What-if simulator | deterministic, eligibility-safe comparison |
| S5 | QA workflow & AI | immutable decisions, audit, bounded explanation |
| S6 | Reporting & release | critical E2E/security/performance tests pass |

**Capacity caution:** 2–3 developers in 1–2-week sprints is an assumption. S5/S6 may require a separate stabilization sprint; PM must revise plan if throughput shows this schedule is not feasible.

## 3. Sprint 0 — Architecture & developer experience

### CC-001 — Repository structure and engineering conventions [P0, M]
- **Depends on:** none · **Owner:** Tech Lead / Full-stack
- Create `apps/web`, `services/api`, `infra`, `docs`, `tests/fixtures` (or record alternate final structure in ADR).
- Add lint/format/typecheck, conventional naming, protected main and PR review checklist.
- **Acceptance:** fresh clone documents how to run checks; local CLI lint/typecheck passes; docs links resolve.

### CC-002 — Architecture Decision Records and unresolved contracts [P0, M]
- **Depends on:** CC-001 · **Owner:** Tech Lead + PM + QA Domain Owner
- Record ADRs for OIDC provider, DB RLS strategy, object storage, jobs, policy DSL/schema, temperature multi-sensor handling, file timezone selection, retention/RPO/RTO, observability.
- Align `API.md` and `DATABASE.md`; document any changes with version bump.
- **Acceptance:** each open design decision has owner, rationale, status, and review; QA domain gate remains explicitly OPEN until validated.

### CC-003 — Local development & CI [P0, M]
- **Depends on:** CC-001 · **Owner:** DevOps / Full-stack
- Docker Compose PostgreSQL + Redis + S3-compatible local storage + API + Web. Use `.env.example`, not committed secrets.
- CI for format, typecheck, pytest, frontend tests and build; health endpoints.
- **Acceptance:** `docker compose up --build` runs local stack; CI reproducible; startup fails safely for missing critical configuration.

### CC-004 — API contracts / common errors / testing scaffolds [P0, M]
- **Depends on:** CC-001, CC-002 · **Owner:** Backend
- Centralize `application/problem+json`, request ID, cursor pagination, decimal/UTC serialization, ETags, idempotency middleware conventions, OpenAPI schemas.
- **Acceptance:** contract tests for 401/403/404/409/412/422, standard response envelopes; generated OpenAPI reviewed against `API.md`.

### CC-005 — Synthetic data, reference fixtures and safety criteria [P0, M]
- **Depends on:** CC-002 · **Owner:** QA Domain Owner + Backend
- Create synthetic shipments/CSV: normal, warning, critical, gaps, duplicates, irregular intervals, multi-sensor conflict, unknown timezone.
- Define oracle outputs *for synthetic policy only*; maintain clearly labeled non-production fixtures.
- **Acceptance:** deterministic expected results checked into repo; real-world quality thresholds not inferred or hardcoded.

**S0 Gate:** CC-001–005 completed and reviewed; outstanding QA policy approval tagged as blocking **real-world operational evaluation**, not blocking synthetic-engine development.

## 4. Sprint 1 — Tenant-safe platform, users, shipments

### CC-101 — Initial database migrations and composite FK model [P0, L]
- **Depends on:** CC-002, CC-003 · **Owner:** Backend
- Implement `DATABASE.md` core schema (all MVP tables or staged reversible migrations), extension management, indexes, checks and tenant-safe FK targets.
- **Acceptance:** `alembic upgrade head` on clean DB; DB-001/003/005/008 pass; migration no silent data loss; ERD updated.

### CC-102 — OIDC secure session and tenant membership [P0, L]
- **Depends on:** CC-101, CC-004 · **Owner:** Backend
- OIDC sign-in/bootstrap, session cookie + CSRF, membership resolution and `X-Organization-Id` authorized selection, logout, `/auth/me`.
- **Acceptance:** no homemade password storage flow; API rejects absent/wrong tenant; session expiration and CSRF tests pass.

### CC-103 — Roles, tenant policy and negative security tests [P0, L]
- **Depends on:** CC-102 · **Owner:** Backend / Security
- ADMIN, LOGISTICS, QA; optional RLS per ADR; cross-tenant 404 and QA-only approvals with acting role.
- **Acceptance:** tests for role matrix, nested resource lookup, malicious cross-tenant FK and worker context; Admin-only cannot approve QA action.

### CC-104 — Product and shipment CRUD API [P0, M]
- **Depends on:** CC-101, CC-103 · **Owner:** Backend
- `/products`, `/shipments`, pagination/filter/ETag, lifecycle validation, revision conflict handling.
- **Acceptance:** `API.md` request/response tests; duplicate references 409; closed shipment cannot be silently edited.

### CC-105 — Web app shell, login and shipment UI [P0, L]
- **Depends on:** CC-102, CC-104 · **Owner:** Frontend
- Responsive app shell, session/tenant selection, shipment list/create/detail, accessibility, guarded routes.
- **Acceptance:** E2E from login to create shipment; permission/empty/error/loading states and mobile fallback.

**S1 Gate:** secure tenant-isolated shipment flow; no endpoint trusts client-provided tenant ID.

## 5. Sprint 2 — CSV ingestion, data versions, visualization

### CC-201 — Secure file upload / immutable storage [P0, L]
- **Depends on:** CC-101, CC-103, CC-104 · **Owner:** Backend
- Multipart CSV upload, size/row limits (10MB/100k defaults), hash, raw object storage, dataset version allocation, import job + outbox.
- **Acceptance:** file type/size errors; duplicate request idempotency; version races; object rollback reconciliation; no public raw object URL.

### CC-202 — CSV mapping, timezone & normalization [P0, L]
- **Depends on:** CC-201, CC-005 · **Owner:** Backend
- Configurable column mapping; timezone required if naive, UTC conversion, Fahrenheit conversion, finite numeric validation, sensor IDs and source row provenance.
- **Acceptance:** errors are row-addressable; source file untouched; duplicates/conflicts not silently treated as valid.

### CC-203 — Dataset validation, status and async reliability [P0, M]
- **Depends on:** CC-201, CC-202 · **Owner:** Backend
- State transition UPLOADED/VALIDATING/READY/INVALID/FAILED, validation summary, job polling, retry and dead-letter/reconciliation workflow.
- **Acceptance:** transaction/outbox crash test; partial import cannot publish READY; import retry does not duplicate rows.

### CC-204 — CSV mapping/upload UI & data error review [P0, M]
- **Depends on:** CC-202, CC-203 · **Owner:** Frontend
- Upload wizard, column selector, timezone selector, validation summary, job progress and correction/retry.
- **Acceptance:** tested missing timezone, bad column map, oversized file, pending upload and successful import.

### CC-205 — Temperature time-series API & chart [P0, M]
- **Depends on:** CC-203 · **Owner:** Full-stack
- Tenant-safe `/temperature-datasets/{id}/readings`, paging/downsampling, chart, gaps, multi-sensor series and states.
- **Acceptance:** source/sensor identities preserved; no deceptive connected line through unknown gaps; 100k rows not sent wholesale to UI.

**S2 Gate:** upload synthetic CSV → validated immutable dataset version → chart with transparent missing-data states.

## 6. Sprint 3 — Quality policy and excursion analysis

### CC-301 — Product policy schema, authoring and versioning [P0, L]
- **Depends on:** CC-101, CC-103, CC-005 · **Owner:** Backend + QA Domain Owner
- Draft, submit-review, QA approval, retire; JSON schema validation and approved reference document; immutable approved rules and digest.
- **Acceptance:** no production-style evaluation with unapproved policy; DB-006 pass; approval RBAC and policy applicability tests.

### CC-302 — Policy management UX [P0, M]
- **Depends on:** CC-301 · **Owner:** Frontend
- Product/profile UI, draft policy editor, status/history, QA review, source document link.
- **Acceptance:** no editing approved bodies; confirmation and audit-appropriate status display.

### CC-303 — Deterministic excursion detector [P0, L]
- **Depends on:** CC-203, CC-301, CC-005 · **Owner:** Backend
- Zero-order-hold interval interpretation with max allowed sample gap, per-sensor events, cumulative/continuous duration, unknown intervals.
- **Acceptance:** fixtures for irregular sampling, boundary events, missing/duplicate data, multiple sensors; no unknown-safe inference.

### CC-304 — Analysis jobs, persisted provenance and policy evaluation [P0, L]
- **Depends on:** CC-303, CC-203 · **Owner:** Backend
- `/analyses` async pipeline, pin dataset+policy, compute summary/event rows, hash + engine version, rule precedence HARD_BLOCK > REVIEW_REQUIRED > ADVISORY.
- **Acceptance:** replay deterministic; invalid dataset or unapproved policy fails closed with documented error; no cross-product policy.

### CC-305 — Excursion results UI [P0, M]
- **Depends on:** CC-304, CC-205 · **Owner:** Frontend
- Timeline overlay, max/min/peak and cumulative duration, rule IDs, warning/critical/indeterminate statuses.
- **Acceptance:** visually distinct unknown gap and hard block, screen-reader labels and data provenance display.

**S3 Gate:** reference QA-approved policy for operational testing (or clearly synthetic-only mode) and validated excursion fixtures with traceable versions.

## 7. Sprint 4 — Deterministic what-if engine

### CC-401 — Scenario templates & eligibility contract [P0, L]
- **Depends on:** CC-304, CC-301 · **Owner:** Backend + QA Domain Owner
- `CONTINUE_DELIVERY`, `HOLD_INSPECTION`, `CONDITIONAL_REROUTE`, `REJECT_QUARANTINE_DISPOSE`; compute ELIGIBLE/REVIEW_REQUIRED/BLOCKED/INSUFFICIENT_DATA.
- **Acceptance:** hard blocks never ranked as eligible; missing evidence fails closed; hold proposal separate from product release.

### CC-402 — Monetary, delay & optional expected-loss calculators [P0, M]
- **Depends on:** CC-401 · **Owner:** Backend
- `Decimal` money and currency, direct incremental cost, separately labeled estimated cost and conditional expected loss with sourced probabilities.
- **Acceptance:** fixture totals match exactly; unknown probabilities remain unknown; currency mismatch rejected unless explicit conversion contract added.

### CC-403 — Versioned simulation run and recalculation [P0, L]
- **Depends on:** CC-401, CC-402 · **Owner:** Backend
- Simulation async endpoints, source chain validation, input hash, engine/template versions, immutable completed scenarios, `parent_run_id` on recalculate.
- **Acceptance:** older run unchanged; no cross-tenant references; completed run replay and DB-007 pass.

### CC-404 — Scenario comparison workspace [P0, L]
- **Depends on:** CC-403 · **Owner:** Frontend
- Comparison of cost/delay/eligibility/risk; parameter editing; simulation rerun, spinner/error states, explicit estimated and unknown values.
- **Acceptance:** UI cannot enable blocked action; recalculation creates new run; no unsupported claims of food safety.

### CC-405 — Optional ranking of eligible options [P1, M]
- **Depends on:** CC-403 · **Owner:** Backend + Frontend
- User-set weighting cost/delay, normalized scoring only for eligible scenarios; explanation of sensitivity and excluded options.
- **Acceptance:** BLOCKED/UNKNOWN not ranked; same inputs+weights reproduce score, and safety rules unaffected by scoring weights.

**S4 Gate:** CSV → analysis → simulation works **with AI disabled**, including safe fallback when every operational release option is blocked.

## 8. Sprint 5 — Decisions, approvals, audit and AI

### CC-501 — Draft and submit decision; frozen snapshot [P0, L]
- **Depends on:** CC-403, CC-103 · **Owner:** Backend
- `/decisions`, `/submit`; verify scenario belongs to run, evidence requirements, snapshot canonical hash, ETag/idempotency.
- **Acceptance:** rejected blocked/unknown release proposal; submitted snapshot remains unmodified; DB-008/010/011/012 pass.

### CC-502 — QA workflow and concurrent transition guards [P0, L]
- **Depends on:** CC-501, CC-301 · **Owner:** Backend
- QA approve/reject/request-changes; row locks, revision/If-Match, separation of duties and evidence checks, correction via new decision record.
- **Acceptance:** two concurrent approvals do not both succeed; `412` stale request; Admin-only fails; hard blocks never overridable.

### CC-503 — Append-only audit log & tenant filtering [P0, M]
- **Depends on:** CC-501, CC-502 · **Owner:** Backend
- Server-only audit events with actor+role+request id+digests for policy, dataset, decision events; read API Admin/QA.
- **Acceptance:** no update/delete for app role, no secrets/raw data, cross-tenant audit access blocked.

### CC-504 — Decisions inbox & QA review UI [P0, L]
- **Depends on:** CC-502, CC-503 · **Owner:** Frontend
- Submit decision, QA inbox, evidence/policy review, rejection/change note, terminal history.
- **Acceptance:** role-specific controls, stale-version conflict prompt, mandatory review evidence, E2E submit→QA approval.

### CC-505 — Provider-agnostic bounded AI explanations [P1, M]
- **Depends on:** CC-403, CC-004 · **Owner:** Backend / AI Engineer
- Structured prompt from grounded calculation/rule outputs, schema validation, source digests, limits, hallucination/prompt-injection checks, retry/fallback.
- **Acceptance:** model cannot mutate eligibility; invalid output rejected; no AI means deterministic results still accessible; source references valid.

### CC-506 — AI explanation UI [P1, S]
- **Depends on:** CC-505, CC-404 · **Owner:** Frontend
- Display sourced summary and uncertainty; distinguish AI explanation from QA disposition.
- **Acceptance:** UI handles unavailable/invalid model output without preventing scenario review.

**S5 Gate:** protected decision workflow, immutable provenance and auditable QA outcome; LLM unavailable does not block core service.

## 9. Sprint 6 — Reports, hardening and release

### CC-601 — PDF generation and private download [P1, M]
- **Depends on:** CC-501, CC-503 · **Owner:** Backend
- Generate from frozen decision snapshot, hash PDF, private artifact URL, job status and auth; no retroactive policy changes.
- **Acceptance:** snapshot and PDF agree; unauthorized tenant download denied; export cannot claim regulatory safety release.

### CC-602 — Operations dashboard [P1, M]
- **Depends on:** CC-104, CC-304, CC-502 · **Owner:** Frontend
- Shipment counts, excursion summaries, pending QA, recent decisions, pagination/filters, loading/error/empty states.
- **Acceptance:** stats tenant-scoped; query performance verified with reference fixture.

### CC-603 — Contract and E2E test suite [P0, L]
- **Depends on:** all P0 implementation tasks · **Owner:** QA Engineer / Full-stack
- Full flow login→create→upload→validate→analyze→simulate→submit→approve→report; run HTTP contract tests and adversarial state transitions.
- **Acceptance:** PRD TC-001 to TC-020 + DATABASE DB-001 to DB-016 mapped to executable tests/evidence; 100% high-severity scenarios pass.

### CC-604 — Performance, security and reliability verification [P0, L]
- **Depends on:** CC-603, CC-003 · **Owner:** DevOps + Backend
- Load test reference env: 100k CSV/30s, excursion analysis/10s, simulation/3s excluding AI; tenant/RLS, CSRF, file handling, rate limit, backup/restore/outbox resilience.
- **Acceptance:** measured results reported against PRD NFR baselines (or deviation approved); no open critical/high security findings; restore verified.

### CC-605 — Staging deployment, runbooks and release sign-off [P0, M]
- **Depends on:** CC-603, CC-604 · **Owner:** Tech Lead + PM
- Staging/prod config, migration release order, monitoring alerts, rollback, incident handling, data retention/deletion process, release checklist.
- **Acceptance:** release-candidate demo in staging; owner signs off engineering and domain-safety gates; known limitations documented.

**S6 Gate:** critical automated scenarios pass, reproducible release and recovery procedure proven, QA safety signoff recorded separately from technical completion.

## 10. Backlog traceability matrix

| PRD requirement family | Primary tasks | Gate tests |
|---|---|---|
| FR-A Auth & tenant | CC-101–103 | tenant/isolation/RBAC |
| FR-B Shipments | CC-104–105 | CRUD, revision, lifecycle |
| FR-C CSV/data | CC-201–205 | TC-001–005, TC-017 |
| FR-D Excursions | CC-303–305 | TC-006–008 |
| FR-E Products/policies | CC-301–302 | TC-009–010, TC-016 |
| FR-F Scenarios/cost | CC-401–405 | TC-011–012, deterministic fixtures |
| FR-G AI | CC-505–506 | TC-015, TC-020 |
| FR-H Decisions/QA | CC-501–504 | TC-013, TC-018 |
| FR-I Dashboard/reports | CC-601–602 | TC-019 |
| NFR & security | CC-003, CC-603–605 | DB-001–016, performance + restore |

## 11. Testing ownership and Definition of Done

**Minimum ticket DoD:**
- [ ] Requirements and dependencies satisfied; unit/integration/E2E test appropriate to change.
- [ ] Tenant and role authorization tested server-side for every new endpoint.
- [ ] Immutable evidence, source hashes and version chains preserved.
- [ ] OpenAPI/API and DB docs updated when contracts change.
- [ ] Loading, error, empty and permission states built for UI changes.
- [ ] Logging redacts sensitive input and carries request/trace ID.
- [ ] CI passes (lint, types, tests, build, migration smoke).
- [ ] Reviewer independently confirms acceptance with evidence and PR link.

**Release blockers:** hard block treated as eligible; missing data interpreted as safe; cross-tenant leakage; unsupported QA approval; mutable submitted snapshot; unsafe model-generated eligibility; incorrect direct cost computation; unrecoverable upload/job workflow.

## 12. Recommended issue template

```markdown
### CC-### — Short title
Priority: P0 | Sprint: S# | Owner: TBD | Size: M
Depends on: CC-...
PRD refs: FR-...
API routes: ...
DB tables: ...

**Outcome**
One verifiable user/developer result.

**Implementation notes**
- Boundary of work, excluded behavior, relevant modules.

**Acceptance criteria**
- [ ] Given ... When ... Then ...
- [ ] Unauthorized tenant/role attempt handled.
- [ ] Failure/unknown case handled safely.

**Tests**
- Unit: ...
- Integration: ...
- Contract/E2E: ...

**Evidence**
PR link, CI run, screenshots where useful, migration ID.
```

## 13. AI coding-agent execution protocol

1. Read `AGENT.md`/`AGENTS.md`, `CLAUDE.md` (if on Claude), the PRD, `ARCHITECTUR.md`, `API.md`, `DATABASE.md`, then this backlog.
2. Pick one **READY** issue with dependencies DONE; clarify ADR scope **in repository ticket**, not by inventing behavior.
3. Produce implementation plan and list affected contracts, migration, tests and known risk.
4. Implement smallest vertical slice; protect P0 invariants; do not alter business/safety rules to make a failing test pass.
5. Run targeted tests, full affected module suite and lint/type checks; record actual commands and results.
6. Mark issue `IN_REVIEW`; request review for permissions, domain safety and evidence snapshot changes.
7. Only move to DONE after acceptance evidence. Update any downstream tasks if contract changed.

**No autonomous production modifications** involving real customer policy approval, product release, actual transport dispatch, or deletion of evidence.

## 14. Product / technical sign-off checklist

- [ ] MVP scope and no-go actions aligned with PRD.
- [ ] Approved domain policy available for any real shipment trial; synthetic policies labeled unmistakably.
- [ ] Dataset/policy/engine versions used for every analysis/simulation/decision.
- [ ] Simulations function with LLM intentionally disabled.
- [ ] Tenant isolation and QA role enforcement demonstrated with negative tests.
- [ ] Decision snapshot and report provenance reproducible.
- [ ] Technical docs, API contract, schema migrations, runbooks and automated tests reviewed.
- [ ] All P0 tasks DONE; incomplete P1 explicitly deferred with approved limitation.

**Release decision:** PM + Tech Lead + QA Domain Owner sign off independently. This document is an implementation plan, not evidence of completed features or product safety validation.
