# API.md — REST API Contract

**Product:** Cold Chain Decision Intelligence Platform (Transport Simulation)  
**API version:** `v1` | **Document version:** 1.0.1 | **Status:** Proposed / contract-first MVP
**Date:** 2026-11-11 | **References:** `Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md`, `ARCHITECTUR.md`

> This is a human-readable contract for building the MVP, not a deployed API. Generate an OpenAPI 3.1 spec from implemented FastAPI schemas and verify it matches this document. Example identifiers, data and amounts are synthetic and do not constitute approved food-quality thresholds.

## 1. Protocol and global conventions

| Item | Rule |
|---|---|
| Base URL | `https://<host>/api/v1` |
| Format | JSON UTF-8, except `multipart/form-data` file upload and binary report download |
| Auth | OIDC-backed secure session cookie, `Secure; HttpOnly; SameSite=Lax` preferred; use CSRF token for unsafe cookie operations |
| Tenant context | `X-Organization-Id: <uuid>` selects an authorized membership; server enforces actual tenant ownership |
| IDs | UUID v4 strings for resources; IDs in examples are placeholders |
| Datetimes | ISO 8601 RFC3339 in UTC with `Z` response; inputs with explicit offsets accepted |
| Temperature | Celsius `temperature_c`, string decimal to preserve precision |
| Money | ISO 4217 currency code + decimal string, never JSON float amounts |
| Pagination | `limit` (default 25, max 100) + opaque `cursor`; response `next_cursor` |
| Sorting | Whitelisted per endpoint; default newest first |
| Request trace | `X-Request-Id`; server generates if absent, echoes in response |
| Writes | `Idempotency-Key` required on documented create/submit operations |
| Resource concurrency | `ETag` on revisioned GET; `If-Match` on update/review operations |
| Async | `202 Accepted` with job/resource IDs; poll status; do not promise immediate completion |
| Error format | `application/problem+json` with stable `code`, per RFC 9457 style |
| Content type | Clients set `Content-Type: application/json` for JSON operations |

`POST /auth/login` below is defined as an OIDC login bootstrap, **not** a plaintext username/password endpoint. For a managed OIDC provider, backend verifies tokens/callback and then creates a secure session; production OAuth/OIDC redirection may live under a dedicated identity gateway. Do not implement a homegrown password flow just to mirror a draft route.

### Common response envelopes
Single-resource successful responses return one named resource object, e.g. `{ "shipment": {...} }`. List responses use:

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": null
}
```

`total_count` is optional and may be null for performant pagination. Successful async responses use:

```json
{
  "job": {"id": "<uuid>", "type": "DATASET_IMPORT", "status": "QUEUED"},
  "resource_id": "<uuid>"
}
```

### Error envelope (all errors)
```json
{
  "type": "https://docs.example.invalid/errors/validation-error",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "The CSV mapping is missing timestamp.",
  "request_id": "req_01HXexample",
  "errors": [{"field": "mapping.timestamp", "code": "REQUIRED", "message": "Required field"}]
}
```

`type` is an illustrative namespace; replace with production documentation domain. Never leak stack traces, object keys or secrets in errors.

### Standard HTTP codes
- `200` success GET/update; `201` created; `202` queued; `204` successful no-body logout.
- `400` malformed query/bad operation; `401` unauthenticated; `403` authenticated but not allowed.
- `404` resource nonexistent **or outside tenant** (do not reveal other organizations' records).
- `409` state conflict / duplicate / idempotency misuse; `412` stale `If-Match`; `413` file too large; `415` unsupported media.
- `422` invalid domain/schema input; `429` rate limited; `500` internal error; `503` unavailable dependency.

### Stable business error codes
`VALIDATION_ERROR`, `AUTH_REQUIRED`, `PERMISSION_DENIED`, `RESOURCE_NOT_FOUND`, `TENANT_CONTEXT_REQUIRED`, `TENANT_MEMBERSHIP_INVALID`, `DUPLICATE_REFERENCE`, `INVALID_STATE_TRANSITION`, `STALE_REVISION`, `IDEMPOTENCY_KEY_REUSED`, `DATASET_INVALID`, `DATASET_NOT_READY`, `COLUMN_MAPPING_REQUIRED`, `TIMEZONE_REQUIRED`, `CONFLICTING_READINGS`, `UNAPPROVED_POLICY`, `POLICY_NOT_APPLICABLE`, `ANALYSIS_NOT_READY`, `SIMULATION_NOT_READY`, `SCENARIO_BLOCKED`, `INSUFFICIENT_DATA`, `QA_REVIEW_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `REPORT_NOT_READY`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`.

## 2. Authorization matrix

| Surface / operation | Admin | Logistics | QA |
|---|:---:|:---:|:---:|
| View shipments / analyses / simulations | ✓ | ✓ | ✓ |
| Create/edit open shipment | ✓ | ✓ | — |
| Upload datasets | ✓ | ✓ | ✓ |
| Create simulation / AI explanation | ✓ | ✓ | ✓ |
| Create/edit draft product-policy definitions | ✓ | — | ✓ |
| Approve policy versions | — | — | ✓ |
| Propose/submit decisions | ✓ | ✓ | ✓ |
| Approve/reject/request changes in QA review | — | — | ✓ |
| Manage organization members | ✓ | — | — |
| Read audit history | ✓ | — | ✓ |

User may have multiple roles. Server records the **acting role** for approval. An Admin-only role never inherits QA authorization. If separation-of-duties is enabled, proposer and reviewer must differ. Every endpoint must also check resource status and tenant context.

## 3. Endpoint inventory

| Method | Path | Role | Response |
|---|---|---|---|
| POST | `/auth/login` | public | `200` OIDC login URL/bootstrap |
| POST | `/auth/logout` | authenticated | `204` |
| GET | `/auth/me` | authenticated | `200` user + memberships |
| GET | `/organizations/current` | member | `200` organization |
| GET | `/organizations/current/members` | Admin | `200` list |
| POST | `/organizations/current/members` | Admin | `201` membership/invite |
| GET | `/shipments` | member | `200` paginated list |
| POST | `/shipments` | Admin/Logistics | `201` |
| GET | `/shipments/{shipment_id}` | member | `200` |
| PATCH | `/shipments/{shipment_id}` | Admin/Logistics | `200` + ETag |
| GET | `/products` | member | `200` list |
| POST | `/products` | Admin/QA | `201` |
| GET | `/products/{product_id}` | member | `200` |
| PATCH | `/products/{product_id}` | Admin/QA | `200` |
| GET | `/quality-policies` | member | `200` list |
| POST | `/quality-policies` | Admin/QA | `201` DRAFT version |
| GET | `/quality-policies/{policy_version_id}` | member | `200` |
| PATCH | `/quality-policies/{policy_version_id}` | Admin/QA, draft only | `200` |
| POST | `/quality-policies/{policy_version_id}/submit-review` | Admin/QA | `200` |
| POST | `/quality-policies/{policy_version_id}/approve` | QA | `200` |
| POST | `/quality-policies/{policy_version_id}/retire` | QA | `200` |
| POST | `/shipments/{shipment_id}/temperature-datasets` | member | `202` |
| GET | `/shipments/{shipment_id}/temperature-datasets` | member | `200` list |
| GET | `/temperature-datasets/{dataset_id}` | member | `200` |
| GET | `/temperature-datasets/{dataset_id}/validation` | member | `200` |
| GET | `/temperature-datasets/{dataset_id}/readings` | member | `200` downsampled/paginated |
| POST | `/shipments/{shipment_id}/analyses` | member | `202` |
| GET | `/analyses/{analysis_id}` | member | `200` |
| GET | `/analyses/{analysis_id}/excursions` | member | `200` list |
| POST | `/shipments/{shipment_id}/simulations` | member | `202` |
| GET | `/simulations/{simulation_id}` | member | `200` |
| GET | `/simulations/{simulation_id}/scenarios` | member | `200` list |
| POST | `/simulations/{simulation_id}/recalculate` | member | `202` new run |
| POST | `/simulations/{simulation_id}/explanations` | member | `202` optional AI job |
| GET | `/simulations/{simulation_id}/explanations/latest` | member | `200`/`404` |
| POST | `/decisions` | member | `201` draft |
| GET | `/decisions` | member | `200` list |
| GET | `/decisions/{decision_id}` | member | `200` |
| POST | `/decisions/{decision_id}/submit` | member | `200` |
| POST | `/decisions/{decision_id}/approve` | QA | `200` |
| POST | `/decisions/{decision_id}/reject` | QA | `200` |
| POST | `/decisions/{decision_id}/request-changes` | QA | `200` |
| POST | `/decisions/{decision_id}/reports` | member | `202` |
| GET | `/reports/{report_id}` | member | `200` metadata |
| GET | `/reports/{report_id}/download` | member | `302` short-lived signed URL or `200` binary |
| GET | `/audit-logs` | Admin/QA | `200` filtered list |
| GET | `/jobs/{job_id}` | member | `200` status |
| GET | `/health/live` | infrastructure | `200` liveness; no tenant secrets |
| GET | `/health/ready` | infrastructure | `200`/`503`, private ingress preferred |

The extra read/status/retire/explanation routes expand the PRD's draft inventory to make the contract executable without inventing downstream client behavior.

## 4. Identity and organization

### POST `/auth/login`
Request `{ "return_to": "/dashboard" }`; response `200 {"authorization_url":"https://<configured-idp>/..."}`. `return_to` must be allowlisted; OIDC callback handled by application/gateway and creates secure session. No passwords travel through this endpoint. For local development use a stub IdP, not a production auth bypass.

### POST `/auth/logout`
Requires valid cookie and CSRF; response `204`. Invalidate server session.

### GET `/auth/me`
```json
{
  "user": {"id": "<uuid>", "email": "operator@example.invalid", "name": "Sample Operator"},
  "memberships": [{"organization_id": "<uuid>", "roles": ["LOGISTICS"], "status": "ACTIVE"}]
}
```

### GET `/organizations/current`
Response `200 {"organization":{"id":"<uuid>","name":"Example Foods","status":"ACTIVE"}}`.

### GET/POST `/organizations/current/members`
GET: `limit,cursor`; POST (Admin): `{ "email":"new@example.invalid", "roles":["LOGISTICS"] }`. Activates a tenant-scoped PENDING membership prepared by trusted identity provisioning; returns `201 {"membership":{"id":"<uuid>","status":"ACTIVE", ...}}`. There is no global email-directory lookup or invitation delivery. Another tenant's email and an unknown email return the same 404. Roles use allowlist `ADMIN`, `LOGISTICS`, `QA`.

## 5. Shipments

### POST `/shipments`
Headers: `Idempotency-Key`, organization context.
```json
{
  "reference": "SH-2026-0001",
  "product_id": "<product-uuid>",
  "origin": {"name": "Origin warehouse", "country": "TH"},
  "destination": {"name": "Receiving warehouse", "country": "TH"},
  "departure_at": "2026-11-11T02:00:00Z",
  "estimated_arrival_at": "2026-11-11T10:00:00Z",
  "cargo_value": "120000.00",
  "currency": "THB",
  "batch_reference": "BATCH-DEMO-01"
}
```
Response `201`:
```json
{
  "shipment": {
    "id": "<shipment-uuid>", "reference": "SH-2026-0001",
    "product_id": "<product-uuid>", "status": "DRAFT",
    "cargo_value": "120000.00", "currency": "THB", "revision": 1,
    "created_at": "2026-11-11T01:00:00Z"
  }
}
```
Validation: unique per organization; `departure_at < estimated_arrival_at`; positive/zero cargo values; ISO currency. Request omitted `organization_id` intentionally: backend derives it.

### GET `/shipments`
Query: `status`, `product_id`, `reference`, `from`, `to`, `limit`, `cursor`, `sort` (`created_at`, descending). `from`/`to` filter departure times as an inclusive/exclusive UTC interval. Response paginated `items: [shipment]`. The candidate explicitly rejects `updated_at` sorting: it uses immutable creation-time keysets so edits cannot silently move records between pages (ADR 0003).

### GET `/shipments/{shipment_id}`
Response `{ "shipment": { ... } }`, header `ETag: "shipment-r3"`; includes `latest_dataset_id`, `latest_analysis_id` as optional refs, but prior decisions still pin their own versions.

### PATCH `/shipments/{shipment_id}`
Headers `If-Match: "shipment-r3"`; partial fields (`origin`, `destination`, `estimated_arrival_at`, `status`, notes). Do not change `product_id` once dataset/analysis exists; closed/cancelled shipments cannot be arbitrarily edited. Response updated shipment and new ETag. `412` if revision stale; `409` on forbidden lifecycle transition.

## 6. Products and policies

### POST `/products`
```json
{
  "name": "Fresh strawberry",
  "category": "FRESH_FRUIT",
  "packaging_type": "STANDARD_CRATE",
  "active": true,
  "notes": "Reference product for pilot"
}
```
Response `201 {"product":{"id":"<uuid>", ...}}`. `GET /products?active=true` list; GET details; PATCH editable metadata only. Product metadata itself is not evidence of safety.

### POST `/quality-policies`
Create **DRAFT version** tied to product:
```json
{
  "product_id": "<product-uuid>",
  "policy_key": "STRAWBERRY_STANDARD",
  "version": 1,
  "reference_document_id": "<document-uuid>",
  "effective_from": "2026-11-11T00:00:00Z",
  "rules": {
    "schema_version": "1.0",
    "required_sensor_ids": ["SENSOR001"],
    "max_valid_sampling_gap_seconds": 900,
    "temperature_bounds": {"min_c": null, "max_c": null},
    "continuous_excursion_limit_seconds": null,
    "cumulative_excursion_limit_seconds": null,
    "unknown_gap_effect": "REVIEW_REQUIRED",
    "action_constraints": []
  }
}
```
Null thresholds are permitted only in a DRAFT for iterative authoring. **Policy approval must reject** unset bounds/limits or missing source/approver and inconsistent rules; illustrative 900 seconds is a data-gap test setting, not a safe temperature limit. The approved policy must have domain-expert-reviewed values.

GET list filters: `product_id`, `status`, `policy_key`. GET details returns `quality_policy`, `ETag` and provenance. PATCH draft requires `If-Match`. Approved/retired policy payloads cannot be edited, except transition metadata via dedicated actions.

### POST `/quality-policies/{id}/submit-review`
Headers `Idempotency-Key`, `If-Match`; body `{ "note": "Prepared for QA review" }`. `DRAFT → PENDING_REVIEW`, response `200` policy object.

### POST `/quality-policies/{id}/approve`
QA only; headers `Idempotency-Key`, `If-Match`; body `{ "approval_note": "Source and criteria verified" }`. `PENDING_REVIEW → APPROVED`, `approved_by` set from auth. Fail `422` if invalid or placeholder rules, `409` if conflicting applicable approved versions/effective ranges.

### POST `/quality-policies/{id}/retire`
QA only; body `{ "reason": "Superseded by new version" }`, current APPROVED version → RETIRED; historical analyses remain pinned. Always preserve original approval/evidence.

## 7. Temperature data

### POST `/shipments/{shipment_id}/temperature-datasets`
Multipart upload (not JSON):
- `file`: `.csv`, UTF-8, max 10 MB and 100,000 rows by default.
- `mapping`: JSON string, e.g. `{"timestamp":"RecordedAt","temperature":"Temp","sensor_id":"Sensor"}`.
- `source_timezone`: IANA zone e.g. `Asia/Bangkok` required if timestamps lack offset.
- `default_unit`: `C` or `F` if units not per-row.
- `conflicting_duplicate_mode`: `REJECT` default (no silent overwrite).

Header `Idempotency-Key`. Response `202`:
```json
{
  "dataset": {"id":"<dataset-uuid>","shipment_id":"<shipment-uuid>","version":2,"status":"QUEUED"},
  "job": {"id":"<job-uuid>","type":"DATASET_IMPORT","status":"QUEUED"}
}
```
Return `413` for limit, `415` for file type, `422` for mapping/timezone issues known synchronously. Async validation errors appear in validation endpoint; never partially publish invalid readings as ready.

### GET `/shipments/{shipment_id}/temperature-datasets`
Paginated, ordered newest first; fields `id, version, status, sha256, row_count, uploaded_at, uploaded_by`. Re-upload always produces a version; previous decisions stay unchanged.

### GET `/temperature-datasets/{dataset_id}`
```json
{
  "dataset": {
    "id":"<uuid>","version":2,"status":"READY",
    "row_count":144,"sensor_ids":["SENSOR001"],
    "source_timezone":"Asia/Bangkok","sha256":"<64-hex>",
    "uploaded_at":"2026-11-11T03:00:00Z"
  }
}
```

### GET `/temperature-datasets/{dataset_id}/validation`
```json
{
  "dataset_id":"<uuid>","status":"READY",
  "valid_rows":144,"invalid_rows":0,"duplicate_rows":0,
  "warnings":[{"code":"OUT_OF_ORDER_ROWS","count":2}],
  "errors":[],
  "mapping":{"timestamp":"RecordedAt","temperature":"Temp"}
}
```
For failed import, include up to bounded `errors: [{"row":42,"column":"temperature","code":"NOT_NUMERIC","message":"..."}]`, plus downloadable restricted error artifact if errors exceed page limit. A missing timezone is a hard error.

### GET `/temperature-datasets/{dataset_id}/readings`
Query `sensor_id`, `start`, `end`, `limit`, `cursor`, `resolution` (`raw` or `aggregated`), `max_points` for chart rendering. Response `items` with `{timestamp_utc, temperature_c, sensor_id, quality_flag}` and `unknown_intervals` if computed. Aggregation must not conceal excursions: show envelope `min/max` per bucket, not averages alone. Responses are read-only and dataset pinned.

## 8. Analysis and excursions

### POST `/shipments/{shipment_id}/analyses`
Header `Idempotency-Key`. Body:
```json
{
  "dataset_id": "<ready-dataset-uuid>",
  "policy_version_id": "<approved-applicable-policy-uuid>",
  "selected_sensor_ids": ["SENSOR001"]
}
```
Response `202 {"analysis":{"id":"<analysis-uuid>","status":"QUEUED"},"job":{"id":"<job-uuid>","status":"QUEUED"}}`. Validate dataset belongs to shipment+tenant, policy approved/applicable to product and effective per configured event-time rule. If missing policy, return `422 UNAPPROVED_POLICY`, do **not** substitute LLM judgment. Optionally allow a distinct draft-only preview in later versions; not this API.

### GET `/analyses/{analysis_id}`
```json
{
  "analysis": {
    "id":"<uuid>","status":"COMPLETED",
    "dataset_id":"<uuid>","policy_version_id":"<uuid>",
    "engine_version":"1.0.0",
    "classification":"WARNING",
    "summary":{
      "excursion_count":1,"cumulative_excursion_seconds":1200,
      "unknown_seconds":0,"min_c":"3.000","max_c":"8.000"
    },
    "rule_results":[{"rule_id":"R-QUALITY-01","effect":"REVIEW_REQUIRED","matched":true,"source_ref":"policy:R-QUALITY-01"}],
    "input_sha256":"<64-hex>"
  }
}
```
All values are illustrative, not approved thresholds or assertions about cargo safety. `status`: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`.

### GET `/analyses/{analysis_id}/excursions`
```json
{
  "items":[{
    "id":"<uuid>","sensor_id":"SENSOR001",
    "start_at":"2026-11-11T04:00:00Z","end_at":"2026-11-11T04:20:00Z",
    "duration_seconds":1200,"min_c":"6.000","max_c":"8.000",
    "peak_deviation_c":"3.000","rule_id":"R-QUALITY-01",
    "classification":"WARNING"
  }],
  "next_cursor":null
}
```
Half-open interval semantics, max sampling gap, unknown intervals and sensor aggregation are defined in `ARCHITECTUR.md`; charts must not fill unknown periods as compliant.

## 9. Simulations

### POST `/shipments/{shipment_id}/simulations`
Headers `Idempotency-Key`. Request:
```json
{
  "analysis_id": "<completed-analysis-uuid>",
  "dataset_id": "<ready-dataset-uuid>",
  "policy_version_id": "<approved-policy-uuid>",
  "scenario_types": ["CONTINUE_DELIVERY", "HOLD_INSPECTION", "CONDITIONAL_REROUTE"],
  "currency": "THB",
  "scenarios": [
    {
      "type": "HOLD_INSPECTION",
      "estimated_delay_minutes": 360,
      "receiver_acceptance": "UNKNOWN",
      "costs": {
        "additional_transport": {"amount":"0.00","source":"USER_ESTIMATE"},
        "inspection": {"amount":"1500.00","source":"USER_ESTIMATE"},
        "holding": {"amount":"2000.00","source":"USER_ESTIMATE"},
        "handling": {"amount":"0.00","source":"USER_ESTIMATE"},
        "disposal": {"amount":"0.00","source":"USER_ESTIMATE"},
        "other": {"amount":"0.00","source":"USER_ESTIMATE"}
      }
    }
  ],
  "ranking_weights": {"cost":"0.60","delay":"0.40"}
}
```

Rules: all selected resources must refer to the same shipment/tenant and pinned version; scenario type allowlist; money nonnegative decimal strings and same ISO currency; receiver acceptance `ACCEPTED | REJECTED | UNKNOWN`; rankings weight sum equals 1; only `ELIGIBLE` can be ranked as executable. No numeric probabilities unless accompanied by traceable approved provenance—omit expected cost by default.

Response `202`:
```json
{
  "simulation":{"id":"<simulation-uuid>","status":"QUEUED","parent_run_id":null},
  "job":{"id":"<job-uuid>","type":"SIMULATION_RUN","status":"QUEUED"}
}
```

### GET `/simulations/{simulation_id}`
```json
{
  "simulation": {
    "id":"<uuid>", "status":"COMPLETED",
    "shipment_id":"<uuid>","analysis_id":"<uuid>",
    "dataset_id":"<uuid>","policy_version_id":"<uuid>",
    "engine_version":"1.0.0", "template_version":"1.0.0",
    "input_sha256":"<64-hex>","currency":"THB",
    "created_at":"2026-11-11T05:00:00Z"
  }
}
```

### GET `/simulations/{simulation_id}/scenarios`
```json
{
  "items":[
    {
      "id":"<scenario-uuid>","type":"HOLD_INSPECTION",
      "eligibility":"REVIEW_REQUIRED",
      "requires_qa_approval":true,
      "direct_incremental_cost":"3500.00","expected_incremental_cost":null,
      "currency":"THB","additional_delay_minutes":360,
      "risk_classification":"REVIEW_REQUIRED","ranking_score":null,
      "rule_results":[{"rule_id":"R-QUALITY-01","effect":"REVIEW_REQUIRED","source_ref":"policy:R-QUALITY-01"}],
      "missing_information":["INSPECTION_RESULT"],
      "cost_components":{"inspection":"1500.00","holding":"2000.00"}
    }
  ],"next_cursor":null
}
```

Eligibility enum `ELIGIBLE | REVIEW_REQUIRED | BLOCKED | INSUFFICIENT_DATA`. Blocked scenarios may be displayed for explanation but cannot be submitted as executable release/reroute actions. `HOLD_INSPECTION` denotes containment, not product release.

### POST `/simulations/{simulation_id}/recalculate`
Headers `Idempotency-Key`. Body `{ "scenarios": [<full revised scenario objects>], "ranking_weights":{"cost":"0.50","delay":"0.50"} }`. **Creates a fresh simulation run** with `parent_run_id`; original stays unchanged. Response `202` with new run ID and job. A submitted decision does not follow a newer simulation automatically.

### POST `/simulations/{simulation_id}/explanations`
Optional feature, header `Idempotency-Key`. Body `{ "language":"en", "style":"CONCISE" }`. Response `202` with explanation job. AI may not compute or mutate rule outcomes; failure never prevents simulation display.

### GET `/simulations/{simulation_id}/explanations/latest`
```json
{
  "explanation": {
    "id":"<uuid>","status":"COMPLETED","model":"<provider-model-id>",
    "prompt_version":"1.0.0",
    "summary":"An excursion was recorded; QA review is required.",
    "key_findings":[{"text":"One interval exceeded a configured bound.","source_references":["analysis:<uuid>"]}],
    "scenario_explanations":[{"scenario_id":"<uuid>","text":"Inspection adds direct cost.","source_references":["scenario:<uuid>"]}],
    "uncertainties":["Quality cannot be certified from temperature readings alone."],
    "required_reviews":["QA inspection"],
    "source_references":["policy:R-QUALITY-01"]
  }
}
```
Reject or fall back to deterministic template if citations/numbers do not match source. No inline chat-agent authority.

## 10. Decisions and QA workflow

### POST `/decisions`
Headers `Idempotency-Key`. Request:
```json
{
  "simulation_run_id":"<completed-simulation-uuid>",
  "selected_scenario_id":"<scenario-uuid>",
  "justification":"Hold shipment pending additional QA inspection."
}
```
Response `201 {"decision":{"id":"<uuid>","status":"DRAFT","revision":1,"selected_scenario_id":"<uuid>"}}` plus `ETag: "decision-r1"`. Validate selected scenario belongs to run and tenant. For a `BLOCKED` or `INSUFFICIENT_DATA` release/reroute scenario, reject creation of a proposal to execute; safe `HOLD_INSPECTION` containment proposal is allowed when policy permits it.

### GET `/decisions`
Query `status`, `shipment_id`, `submitted_by`, `limit`, `cursor`. Response paginated.

### GET `/decisions/{decision_id}`
Returns `decision` with current status, scenario, pinned source versions and immutable `snapshot_sha256`; `ETag` as revision. Only authorized users see full QA notes.

### POST `/decisions/{decision_id}/submit`
Headers `If-Match`, `Idempotency-Key`. Request `{ "justification":"Requesting review before release decision" }`. `DRAFT → PENDING_QA`; creates immutable snapshot with source file hash, data/policy versions, calculation outputs, selected scenario and any grounded AI explanation. Server rejects blocked/unknown action proposal or absent evidence.

### POST `/decisions/{decision_id}/approve`
QA only, `If-Match` and `Idempotency-Key` required. Request:
```json
{
  "acting_role":"QA",
  "review_notes":"Evidence reviewed. Holding and inspection procedure approved.",
  "evidence_references":["inspection-record:<reference>"],
  "acknowledged_required_actions":["HOLD_IN_CONTROLLED_STORAGE"]
}
```
Response `200 {"decision":{"id":"<uuid>","status":"APPROVED","reviewed_by":"<qa-user-uuid>","reviewed_at":"2026-11-11T06:00:00Z","revision":3}}` and new ETag. **Approval authorizes the documented internal workflow only, not automatic product release or a regulatory food-safety determination.** Validate QA actor, required evidence, separation-of-duties, current `PENDING_QA` and no violated hard block. DB transaction locks row; stale concurrent approvals return `412`.

### POST `/decisions/{decision_id}/reject`
QA, `If-Match`, `Idempotency-Key`: `{ "review_notes":"Required evidence missing" }`. `PENDING_QA → REJECTED`.

### POST `/decisions/{decision_id}/request-changes`
QA, `If-Match`, `Idempotency-Key`: `{ "review_notes":"Please attach inspection outcome" }`. `PENDING_QA → CHANGES_REQUESTED`. A revised proposal must create a new revision/draft and preserve old evidence; MVP may require creating a fresh decision referencing a revised simulation rather than editing an immutable submitted snapshot.

### Decision status rules
`DRAFT → PENDING_QA → APPROVED | REJECTED | CHANGES_REQUESTED`. At most one APPROVED decision and one PENDING_QA proposal may coexist per shipment, only when the pending proposal explicitly corrects the approval. A correction links `supersedes_decision_id` to a same-shipment PENDING_QA, APPROVED or CHANGES_REQUESTED decision. Submission supersedes non-approved predecessors; an APPROVED predecessor is superseded only in the transaction where QA approves its replacement. Reject/request-changes leaves the existing approval intact. Both supersession paths increment the predecessor revision and append audit. Draft creation revokes nothing. Snapshots/PDFs stay immutable; conflicts return `409 ACTIVE_DECISION_EXISTS`. See ADR 0004.

## 11. Reports and audit

### POST `/decisions/{decision_id}/reports`
Header `Idempotency-Key`. Request `{ "format":"PDF", "language":"en" }`; response `202` with `report.id`/`job.id`. Render only from decision snapshot, not latest policy/dataset. Policy and decision states are labeled explicitly; report cannot imply regulatory release.

### GET `/reports/{report_id}`
Response `200 {"report":{"id":"<uuid>","decision_id":"<uuid>","status":"COMPLETED","format":"PDF","sha256":"<64-hex>","created_at":"..."}}`. If not ready, `status=QUEUED|RUNNING|FAILED`.

### GET `/reports/{report_id}/download`
Authenticated tenant-authorized. Return private binary `200 application/pdf` or `302` to a short-lived signed URL. `409 REPORT_NOT_READY` before completion. Avoid logging signed URLs.

### GET `/audit-logs`
Admin/QA only. Filters: `entity_type`, `entity_id`, `action`, `actor_id`, `from`, `to`, `limit`, `cursor`. Example item:
```json
{
  "id":"<uuid>","actor_id":"<uuid>","acting_role":"QA",
  "action":"DECISION_APPROVED","entity_type":"DECISION","entity_id":"<uuid>",
  "before_digest":"<sha256>","after_digest":"<sha256>",
  "request_id":"req_01HXexample","created_at":"2026-11-11T06:00:00Z"
}
```
Audit append-only, redact secrets, retain according to tenant/legal policy.

## 12. Jobs

### GET `/jobs/{job_id}`
```json
{
  "job": {
    "id":"<uuid>","type":"DATASET_IMPORT","status":"RUNNING",
    "resource_id":"<uuid>","progress":{"completed":45000,"total":100000},
    "attempt_count":1,"error_code":null,
    "created_at":"2026-11-11T03:00:00Z","finished_at":null
  }
}
```
States `QUEUED | RUNNING | COMPLETED | FAILED | CANCELLED` (cancellation reserved for safe jobs; explicit support can defer). Poll recommended with exponential backoff; client stops at terminal state. Async jobs idempotent by durable input hash and key; internal queue delivery can be at least once, worker effect exactly once through unique persistence constraints. Avoid leaking resource existence across tenants.

## 13. Invariants, validation and conflict behavior

1. `organization_id` is never trusted from request payload; all nested IDs must resolve within current tenant and matching shipment/product.
2. All mutable versions use ETag; `If-Match` required for policy edits, shipment edits and decision transitions. Missing precondition → `428 PRECONDITION_REQUIRED` (also supported).
3. `Idempotency-Key` required for dataset upload, analysis create, simulation create/recalc, decision create/submit/review and report create. Replay same request returns original response; same key different body returns `409`.
4. A complete simulation must reference an APPROVED, applicable policy version and a READY dataset/completed analysis. Rejected datasets/unknown policy are not silently substituted.
5. Client cannot supply an authoritative `eligibility`, `risk_classification`, `rule_results`, `direct_incremental_cost`, `approved_by`, or `reviewed_by`; values are computed/set server-side.
6. An `INSUFFICIENT_DATA` or `BLOCKED` scenario cannot be ranked as executable, irrespective of cost. `REVIEW_REQUIRED` cannot execute before authorized QA review and required evidence.
7. Monetary strings parse with Decimal, reject NaN/Infinity/negative amounts and unsupported precision. Weights sum to exactly 1 within a documented decimal tolerance, no safety dimension is tradeable.
8. Datetime without offset requires explicit timezone at import; gap > configured max remains UNKNOWN; no inference from final sample. Multi-sensor ambiguity results in review.
9. Closed shipments, APPROVED policy bodies, completed simulations and submitted snapshots cannot be silently edited; create new version/run/revision.
10. A valid QA review is not a food-safety release certificate and does not trigger any physical action.

## 14. Suggested contract test suite

| ID | HTTP sequence | Expected |
|---|---|---|
| API-001 | Create shipment same reference twice with different idempotency keys | `409 DUPLICATE_REFERENCE` |
| API-002 | Repeat same `Idempotency-Key` and body | Original outcome replayed |
| API-003 | Reuse same key with different body | `409 IDEMPOTENCY_KEY_REUSED` |
| API-004 | Access another tenant's dataset/report/job | `404 RESOURCE_NOT_FOUND` |
| API-005 | Upload CSV missing timezone for naive timestamp | `422 TIMEZONE_REQUIRED` or dataset FAILED with row evidence |
| API-006 | Upload conflicting duplicate timestamp/sensor | FAILED validation, no READY dataset |
| API-007 | Analyze unapproved policy | `422 UNAPPROVED_POLICY` |
| API-008 | Recalculate simulation | New ID, prior snapshot identical |
| API-009 | Submit blocked release scenario | `409 SCENARIO_BLOCKED` |
| API-010 | Admin without QA role attempts approve | `403 PERMISSION_DENIED` |
| API-011 | QA attempts self-approve when SoD enabled | `403 SELF_APPROVAL_FORBIDDEN` |
| API-012 | Two concurrent decision approvals with same ETag | Exactly one succeeds, other `412` |
| API-013 | AI provider down | Simulation succeeds, explanation failure/fallback |
| API-014 | Export decision then update policy | Report still matches pinned snapshot |
| API-015 | Invalid money float/negative/NaN | `422 VALIDATION_ERROR` |
| API-016 | Analysis gap exceeds threshold | UNKNOWN interval, not normal |
| API-017 | Missing `If-Match` on revisioned mutation | `428 PRECONDITION_REQUIRED` |
| API-018 | Invalid CSRF on authenticated mutation | `403 PERMISSION_DENIED` |

Run generated OpenAPI schema validation and TypeScript client compilation in CI. Contract tests should use fixtures with independent expected results reviewed by domain QA; do not assert guessed strawberry safety thresholds.

## 15. Delivery and change management

- **Source of truth:** PRD describes product requirements, `ARCHITECTUR.md` describes design/invariants, and `API.md` defines external behavior. Code-generated `openapi.json` is the mechanically checkable interface and must match `API.md`.
- **Breaking changes:** add `/api/v2` or versioned schema migration; never silently alter interpretations of stored quality evidence or monetary results.
- **Minimum API acceptance:** P0 routes implemented, 401/403/404 tenant behavior consistent, approval guards correct, async jobs recoverable, ETag/idempotency verified, OpenAPI schema published, golden workflow E2E passes.
- **Open design choices:** exact OIDC provider/callback route, PDF delivery mode, member invitation delivery, tenant retention defaults, domain-policy evidence fields, and production limits must be documented by ADR and customer security review before onboarding real cargo records.

**Implementation warning:** A `200/APPROVED` decision means the permitted **workflow proposal** was reviewed. It is not a declaration that perishable goods are safe to consume, and it must never dispatch an automatic transport or release command in MVP.

## Sprint 0 implementation boundary (1.0.1)
Only health/live and health/ready are implemented in S0. All business endpoints above remain planned.
Health responses are {"status":"alive"} and {"status":"ready"}; readiness returns 503 problem JSON when PostgreSQL, Redis or the private evidence bucket is unavailable.
Error type uses `urn:cold-chain:error:<lowercase_code>` until a documentation domain exists.
Missing If-Match returns 428 PRECONDITION_REQUIRED. Shipment create also requires Idempotency-Key (as specified in section 5).
Cursor payload includes tenant, query scope (including filters), created_at and id. It is opaque, not an authorization grant; every query still enforces membership and tenant ownership.
See [S0 ADR](adr/0001-foundation.md) for contract reconciliation and durable idempotency conventions.

## S1 implementation
Auth login/callback/logout/me, organization current/members read, product CRUD and shipment CRUD are implemented. Callback GET /auth/callback verifies OIDC and issues server session plus CSRF cookie. Unsafe authenticated requests require X-CSRF-Token. See ADR 0002 for local identity provisioning and supported currency contract.

## S2 implementation
CSV upload uses UPLOADED (not QUEUED) dataset status, with a separate QUEUED job. Validation errors yield INVALID; infrastructure failures yield failed jobs. Raw readings use chronological timestamp/ID cursors and bounded pages; aggregated resolution returns per-sensor min/max buckets without interpolation. See generated OpenAPI for supported resolution values and bounds. Error samples are capped at 100 with errors_truncated indicator.

## S3 implementation
Policy version is a positive integer (aligned with DB), not semantic version text. POST /reference-documents uploads private evidence for policy approval. Rules include explicit continuous_effect and cumulative_effect; defaults are REVIEW_REQUIRED and HARD_BLOCK respectively. Unknown gaps cannot grant clearance. Dataset sampling times must lie within the policy effective interval. Analysis selects exactly required sensors; unspecified extra sensors produce INDETERMINATE. Excursions and gaps are pinned JSON result arrays on analysis_runs, not separately mutable tables.

## S4 implementation
Simulation create and recalculate require a complete SimulationInput body. Costs explicitly include all six components and their sources. No unsourced loss probabilities accepted. Cumulative duration is maximum per required sensor (never sums simultaneous exposures). Ranking score is weighted normalized cost/delay, lower first, only ELIGIBLE; equal values contribute zero. All scenarios still require human QA.

## S5 implementation
Decision approvals require at least one tenant-owned stored reference document, encoded reference:<document UUID>, instead of unverifiable free-text inspection references. HOLD_INSPECTION requires HOLD_IN_CONTROLLED_STORAGE acknowledgement; other permitted actions require REVIEW_PINNED_EVIDENCE. Provider-agnostic explanation adapters may select only existing fact IDs; rendered text remains deterministic. No external provider is configured or called by default.

## S6 implementation
Decision report requests freeze the submitted snapshot and review metadata, then queue PDF generation. Downloads require tenant authorization and verify the stored SHA256. Dashboard counts and recent activity are tenant-scoped. Request size and Redis rate limits apply before business processing. `/organizations/current/members` activates trusted tenant-scoped provisioning records; no external invitation email is sent. Generated `packages/contracts/openapi.json` records the complete executable route and DTO contract.

## Pre-merge re-review corrections: engine 1.2.0

Analyses pin the shipment coverage window but retain ALL readings. Consecutive real observations may bracket boundaries; their original spacing must satisfy the gap limit before their interval is clipped to the window. Genuinely uncovered portions stay UNKNOWN. Every out-of-range sample outside the window matches R-DATA and contributes to summary min/max; final hot observations still match R-DATA. Duration fields remain integer seconds, with unknown fractional time rounded upward. Confirmed HARD_BLOCK keeps CRITICAL precedence. Event severity uses its own duration. `duration_limit_comparison: AT_OR_ABOVE` makes inclusive threshold behavior explicit.

Simulation creation and decision submission/approval reject legacy engine results or a changed shipment window with `409 ANALYSIS_RECOMPUTE_REQUIRED`. Submit/review idempotency replays return the original decision ETag. Full rationale and historical-data handling: [ADR 0004](adr/0004-evidence-boundaries-and-current-decisions.md).
