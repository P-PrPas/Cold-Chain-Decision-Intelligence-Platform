# Shipment-window re-review verification

Corrections are integrated only in PR #7. PRs #1 through #6 remain unchanged; no merge or deployment was performed. Engine 1.2.0 supersedes the historical engine 1.1.0 record in VERIFICATION-REVIEW.md.

## Evidence and interval boundaries

All observations remain available for summary extrema and evidence checks. Exposure intervals are clipped to the pinned shipment window, but sampling validity uses the original distance between real observations. Outside-window hot observations and a hot observation exactly at ETA with no in-window duration trigger R-DATA without inventing exposure duration.

The unchanged reviewer probe `claude_probe2.py` now returns INDETERMINATE / INSUFFICIENT_DATA with max_c=40 for both late-arrival heat and loading heat. Exact compliant coverage remains NORMAL / ELIGIBLE. A logger starting one second late with no earlier observation remains INDETERMINATE with one unknown second: there is no observation from which to bracket that boundary.

Golden fixtures additionally verify that real observations bracketing departure and ETA produce NORMAL / ELIGIBLE when their original spacing is valid. API import-to-analysis-to-simulation regressions cover loading heat, late-arrival heat and compliant bracketing, as well as the original final-hot and partial-trip cases. Tests also cover a long original gap clipped to a short overlap, fractional unknown gaps, entirely out-of-window datasets, clipped excursion duration and a hot ETA endpoint followed by a later normal observation. Unknown and event durations remain integers; positive fractional unknown duration is rounded up.

## Decisions and membership provisioning

Submitting a correction leaves an APPROVED predecessor unchanged. QA rejection or request for changes also preserves it. Only QA approval of the replacement atomically supersedes the predecessor and records the audit event. Tests cover both outcomes, duplicate pending corrections, preserved snapshots and PostgreSQL concurrent correction submissions.

The operator-only `app.provision_membership` command provisions a PENDING membership for an existing active identity in an active organization, without roles. Tests exercise idempotency, denied access before activation and successful tenant-admin activation. RUNBOOKS.md documents the trusted operator procedure. No real membership was provisioned during verification.

## Validation

- Final local suite: 72 passed, 7 PostgreSQL-only tests skipped. The local Docker environment is unavailable; live PostgreSQL and Compose/browser verification run in Linux CI.
- Ruff lint/format, mypy (25 source files) and generated OpenAPI consistency checks pass.
- Application source is committed at `f48b6b64a2432f5451a3a995df5b6f3a534607d3`. Subsequent changes add API regression cases and this verification record only. [Application-source CI](https://github.com/P-PrPas/Cold-Chain-Decision-Intelligence-Platform/actions/runs/42960426805) passes all four jobs: API, web, PostgreSQL concurrency, and stack (Compose/Playwright and restore checks). CI reruns on the final test/documentation commit; the linked result applies to the stated application-source commit.

ADR 0004 defines the current behavior. Older analyses require reanalysis. ETA remains an estimate: outside-window heat requires review rather than silently proving compliance, and missing boundary observations remain unknown. Historical reports retain their frozen status; they are not live release authorizations.
