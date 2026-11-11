# S6 release candidate evidence

The candidate is synthetic decision support. Automated evidence does not grant real cargo safety approval or owner acceptance. The complete review stack is PR #1 (S0) through PR #7 (S6); no PR is merged.

## Automated verification

- Local API: 49 tests pass; five PostgreSQL-only cases skip locally. Ruff check/format, mypy and generated OpenAPI check pass.
- PostgreSQL CI at `a07b843`: all 54 tests passed, including concurrent QA review, concurrent shipment reference/version allocation, non-owner RLS, immutable evidence, the RQ entrypoint regression and full Alembic downgrade/upgrade in a disposable schema.
- Web: ESLint, Prettier, TypeScript, Vitest and production Next.js build pass. Browser E2E uses real Keycloak operator/reviewer contexts and private S3/Redis/PostgreSQL through Compose.
- Local Docker became unavailable after host disk exhaustion; final live-stack evidence comes from Linux CI. SQLite tests are not presented as proof of PostgreSQL behavior.
- [Integrated CI run 42954919512](https://github.com/P-PrPas/Cold-Chain-Decision-Intelligence-Platform/actions/runs/42954919512): browser OIDC → shipment → queued CSV → policy approval → analysis → simulation → independent QA → private PDF passed in 14.6 seconds. Restore into a new PostgreSQL database and S3 bucket verified all three objects, three database references and decision snapshot hashes. The final stack merges preserve the same application source as this verified commit.

## Measured reference workload

CI run [42954764856](https://github.com/P-PrPas/Cold-Chain-Decision-Intelligence-Platform/actions/runs/42954764856), Ubuntu hosted runner, PostgreSQL 16, Python 3.12, one concurrent synthetic workflow:

| Operation | Measured | Budget |
|---|---:|---:|
| Import 100,000 readings and commit | 10.042 s | <30 s |
| Load, analyze and persist result | 1.723 s | <10 s |
| Calculate and persist four scenarios | 0.036 s | <3 s |

These measurements include HTTP adapters and PostgreSQL persistence. The object store is in-memory and the job executor is called directly, so queue/network/storage latency is excluded. Full live-stack workflow is tested separately, without extrapolating these timings to a production SLA. Machine-readable evidence: `benchmark-postgres.json`; earlier parser-only evidence remains `benchmark-synthetic.json` with its narrower scope.

## Coverage guide

| Concern | Executable evidence |
|---|---|
| Authentication, membership, CSRF, cross-tenant denial | `test_core.py`, browser OIDC flow |
| Composite FK, RLS, immutable evidence, concurrent approvals | `test_hardening.py`, `test_postgres.py` |
| Idempotency, stale revisions, bounded member pages | `test_core.py`, `test_decisions.py` |
| CSV provenance, duplicates, timezone/DST, Decimal normalization | `test_temperature.py`, `test_fixtures.py` |
| Whole-gap UNKNOWN, per-sensor effects, independent policy QA | `test_analytics.py`, `test_policy_flow.py` |
| Hard blocks, unknown probabilities, exact costs, immutable recalculation | `test_simulations.py` |
| Snapshot provenance, QA separation, bounded explanation fallback | `test_decisions.py` |
| PDF bytes/hash and immutable report source | `test_reports.py` |
| Outbox failure and importable RQ target | `test_hardening.py` |
| Request/body/rate limits | `test_hardening.py` |
| Migration round-trip, 100k persistence workload | `test_postgres.py`, `test_performance.py` |
| Restored database snapshots and private object checksums | CI restore step, `app/recovery.py` |

## Human release gates

Owner review of the seven PRs and proposed ADRs is pending. Qualified QA policies, isolated staging infrastructure, production OIDC/HTTPS, durable object retention, operational alert routing and RPO/RTO approval are not fabricated by this implementation. `infra/compose.staging.yaml` and `RUNBOOKS.md` supply the deployment/recovery procedure; no external environment has been deployed. The explicit creation-time-only shipment sorting limitation is recorded in ADR 0003.
