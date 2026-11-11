# Operations and release runbooks

## Review and deployment boundaries
All seven sprint PRs remain open for owner review. CI is a disposable release-candidate environment, not a deployed customer staging site. No production deployment or actual quality-policy approval has occurred.
Local Compose creates synthetic identities, ephemeral S3 and a persistent local PostgreSQL volume. Never load real customer evidence there. Operator/reviewer password is `synthetic-demo-only`, intentionally public fixture data.

## Start / stop local candidate
Copy `.env.example` to `.env`; set local passwords/session secret. Run `docker compose up --build -d --wait`. Open `http://localhost:3000/workspace`; sign in as operator or reviewer through Keycloak. Use operator for shipment/policy authoring and reviewer for independent QA. Synthetic fixture limits are only test data.
Stop via `docker compose down` (no `-v`). PostgreSQL volume remains; S3 emulator content does not survive storage recreation. To preserve a local demonstration, export evidence before recreating storage. Production must use durable versioned private S3.

## Staging release order
1. Owner supplies isolated staging infrastructure, HTTPS OIDC/client registration, secret manager, private versioned object bucket, residency/retention policy and TLS ingress. `infra/compose.staging.yaml` refuses missing settings and does not include demo services.
2. Back up DB + object versions and record release commit, schema revision, file hashes and restore target. Use migration-owner credentials only for Alembic, never application traffic.
3. Run `alembic -c services/api/alembic.ini upgrade head` as an explicit release job on the approved target; migrations are transactional on PostgreSQL.
4. Create a non-owner, non-superuser, NOBYPASSRLS application role. Grant schema USAGE, SELECT/INSERT/UPDATE on application tables and DELETE only on sessions. Revoke UPDATE/DELETE on audit_logs, reference_documents and immutable artifact tables. Never grant DDL, table ownership or BYPASSRLS. RLS is forced on domain tables; request/worker transactions set `cc.organization_id` after trusted tenant resolution. Identity/membership lookup remains server-authorized.
5. Deploy API/worker/Web pinned to the same reviewed commit, set public API build argument, secure cookies and approved HTTPS origins. Route only web/API; DB, Redis, storage and readiness ingress remain private.
6. Run the full OIDC-to-PDF E2E with synthetic accounts on that environment. Obtain separate owner engineering signoff and qualified domain QA signoff before real-shipment use.

## Rollback
Prefer redeploying the previous compatible app while retaining evidence. Never downgrade a live schema or delete rows to make old code work. For a destructive rollback, stop writers, obtain explicit owner approval, restore DB and corresponding object versions into a NEW isolated environment, verify snapshot/report hashes, then switch traffic. Alembic downgrade tests apply only to disposable databases.

## Backup and restore
Production schedule/RPO/RTO are owner decisions (proposed RPO <=24h, RTO <=8h). Encrypt backups, separate credentials, retain according to approved policy. `pg_dump --no-owner --no-privileges` plus versioned object backup is the minimum logical export. Restore into a new database/bucket; compare every dataset/reference/report SHA256 and decision snapshot hash before cutover. CI runs a disposable PostgreSQL restore and `python -m app.recovery` to prove object archive round-trip checksums. This is technical drill evidence, not a production recovery SLA.

## Failed jobs / outbox
DB jobs and outbox are the source of truth. A transaction commits the resource and outbox together. Dispatcher retries pending events, and re-enqueues queued work older than five minutes after Redis loss. Workers lock tenant/job, commit effects atomically and skip completed jobs; processing failures retry at most three attempts, then remain FAILED with generic code. Never manually mark READY/COMPLETED.
Investigate source integrity/configuration, then create a new upload/analysis/simulation/report request with a new idempotency key. Preserve the failed job. Monitor failed counts, oldest queued age and `worker_dispatch_unavailable`; page the operator when queued age exceeds five minutes or any hash mismatch occurs.

## Orphan evidence reconciliation
Object writes precede DB commit. Orphans can therefore exist after a DB rollback. List objects by tenant prefix and compare with dataset/reference/report object keys in a read-only reconciliation report. Do not auto-delete. Owner authorizes removal only after retention/legal checks and a minimum quarantine longer than retry/backup windows. Approved/submitted evidence is never overwritten.

## Access / secret incidents

### Provision a pending tenant membership

This is a platform-operator procedure, not a public API or tenant email search. Verify an approved access request, target organization UUID and the existing user's exact OIDC issuer/subject binding. Resolve their user UUID through the trusted identity administration process; do not identify a user by an unverified email. The command does not create OIDC identities or grant application roles.

Using the operator-controlled deployment environment (existing `CC_*` configuration and authorized DB credentials), run:

```sh
docker compose exec -T api python -m app.provision_membership --organization-id <organization-uuid> --user-id <verified-user-uuid>
```

For managed staging, use `docker compose -f infra/compose.staging.yaml exec -T api ...` with the same arguments. The command requires ACTIVE organization/user records, locks the organization, and creates one PENDING membership. Repeating it returns the existing PENDING/ACTIVE membership without modifying status or roles; disabled/other states fail for investigation. Record the request, operator, IDs and returned membership ID in the access ticket. Do not expose database credentials or this command to tenant users.

The tenant ADMIN then uses authenticated, CSRF-protected `POST /api/v1/organizations/current/members` with that identity's verified email and the approved role allowlist. This activates the tenant-scoped pending record and writes ADD_MEMBER to audit. Before activation the user has no tenant access; the operator command never activates an account or grants roles. No email invitation is sent.

### Respond to an incident

Revoke affected server sessions, disable membership/user, rotate credentials through the secret manager, and review append-only audit. Do not paste tokens/CSV contents into logs or tickets. Keep Secure/HttpOnly/SameSite session cookies, CSRF, origin allowlist and request/body/rate limits enabled. External explanation providers are optional and receive known deterministic fact text only; no raw CSV or credentials.

## Monitoring
Check live/ready separately. Alert on readiness failure, sustained 5xx/429, worker failures, queue age, DB connection exhaustion, low disk, backup failures and hash mismatches. Logs include request IDs but omit raw exception payloads. Dashboard metrics are tenant-scoped. Host disk exhaustion during development demonstrated why disk alerts are required.

## Open external gates
Named owner approval for retention/residency, real OIDC deployment, backup schedule/RPO/RTO and TLS ingress is required before onboarding. Qualified QA must supply and approve commodity-specific reference evidence. Neither synthetic fixture tests nor an agent can satisfy those human gates.
