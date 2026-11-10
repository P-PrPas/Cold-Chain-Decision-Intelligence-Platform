# ADR 0001: S0 foundation and contract reconciliation
Status: PROPOSED for owner review in S0 PR. Owner: project owner / technical reviewer.
Review: pending; implementation choices below apply to synthetic development only.

## Decisions and consequences
| Topic | Decision / rationale | Owner / status |
|---|---|---|
| Layout / stack | apps/web Next.js, services/api FastAPI; infra documentation, root Compose, tests/fixtures. SQLAlchemy/Alembic begin in S1. Keep calculations pure. | Tech lead / proposed |
| OIDC | Standards-based authorization code + PKCE, issuer/subject binding, server sessions; Keycloak local IdP in S1, managed production issuer selected before staging. Avoid bespoke passwords. | Security + owner / production issuer OPEN |
| Tenant / RLS | Mandatory tenant-scoped repositories and composite FKs in S1; RLS defense in depth before production, transaction-local tenant context and non-bypass role. | Security / proposed; RLS production gate OPEN |
| Storage | Private S3, local Moto S3 emulator, no published storage port; content-addressed immutable evidence and versioned objects in S2. Local root credentials never suitable for production. | Platform / proposed |
| Jobs | Redis + RQ, DB outbox atomic with writes; bounded retries, durable job status and unique consumer keys. Queue is not source of truth. | Backend / proposed; implementation S2 |
| Policy DSL | Versioned closed JSON schema with enum rule types/effects, decimal bounds, positive durations, sensor requirements and source references. Reject unknown fields and executable expressions. | Backend + QA / proposed; schema implementation S3 |
| Sensors | Analyze per sensor; no averaging. Missing required sensors or unspecified aggregation gives INDETERMINATE. | QA / proposed |
| Timezone | Explicit offsets or importer-selected IANA timezone; ambiguous/nonexistent DST local times rejected. Preserve original bytes and selection. | Backend / proposed |
| Retention | No automatic deletion of evidence. Real-data onboarding blocked until retention, jurisdiction and deletion obligations signed off. | Owner / OPEN |
| Recovery | Proposed RPO 24h / RTO 8h; encrypted daily backups and restore drill required before staging acceptance. No claim of current recovery capability. | Operations / OPEN |
| Observability | Correlation IDs, generic errors, redacted logs, dependency readiness. Latency/queue/backup alerts added with corresponding modules. | Operations / proposed |
| QA / self approval | Production reference policy gate OPEN; separation of duties defaults enabled. Synthetic data cannot approve goods. | Qualified QA owner / OPEN |
| Product naming | Unique (organization_id, name), version numbers positive integers. | Backend / proposed |

## Conflicts resolved in companion specs v1.0.1
- DATABASE section 9 previously held the first part of a long gap; ARCHITECTUR section 7 marks the **whole** interval UNKNOWN. Adopt whole-interval UNKNOWN, the safer higher-priority contract.
- API shipment origin/destination are structured objects; DB TEXT would lose shape. Use JSONB validated by API schema, with name required and country optional.
- API batch_reference is canonical; rename proposed DB batch_lot before migrations exist.
- API section 5 requires shipment idempotency but section 16 omitted it: retain requirement.
- Generic stable error URNs replace the illustrative example.invalid domain.

## Common write protocol (implemented by persistence in later sprints)
Authenticate and authorize membership/resource first. Key scope is organization + actor + method/route + key. Hash canonical validated input, including If-Match for transitions and file digest/mapping for uploads. Reserve record and perform mutation/outbox insertion in the same transaction under unique constraint. Same hash replays stored status/body/ETag, different hash returns 409. Replay completed transitions before re-evaluating a now-stale revision, but never before current authorization. Missing key returns 422. Retain at least 24h; explicit expiry cleanup only. In-flight conflicts retry after transaction completion. No in-memory middleware substitute.
ETag writes must use compare-and-update or row locks; checking a header alone does not prevent races.
Cursor scope binds filters/sort; descending keyset order uses (created_at,id), not OFFSET. Cursor is never trusted to change tenant scope.

## Alternatives
Microservices add transactional complexity; deferred. Local passwords increase security responsibility; rejected. Partial gap extrapolation and sensor averaging conceal uncertainty; rejected. Global idempotency keys break tenant isolation; rejected.

## Review gates
S0 ADR acceptance is pending human review. Production IdP, RLS, retention, recovery and qualified QA approvals remain open. No production deployment or migration is authorized by this ADR.

Local S3 uses Moto (ephemeral, unauthenticated emulator on private Compose network only) because MinIO registry images were unavailable during verification. Never deploy this stack with real data; durable private S3 remains the production design. Restarting storage loses synthetic objects; recreate bucket via storage-init.
