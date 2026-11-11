# ADR 0004: shipment coverage and current decisions

Status: proposed for owner/domain review. Resolves the pre-merge review blockers with conservative, deterministic behavior; does not approve real safety limits.

## Analysis engine 1.1.0

Analysis creation pins the shipment departure and estimated arrival in its input digest and queued result metadata. The worker uses that pinned window even if the shipment changes while queued. Samples outside that window do not establish in-transit compliance. Each required sensor must cover the same window.

Any unobserved leading or trailing interval is UNKNOWN, including intervals shorter than the maximum internal sampling gap. This deliberately chooses the conservative “require coverage” option from the review: the internal gap threshold permits bounded interpolation between observations, not extrapolation before the first or after the last. A missing required sensor contributes the whole window as unknown. Unknown seconds are summed across required sensors, so simultaneous unknown sensor intervals can overlap in the summary.

An out-of-range final sample, or one followed only by an unknown long gap, is recorded as an out-of-range observation with zero known duration. It matches R-DATA / REVIEW_REQUIRED; it never invents exposure duration. Missing window metadata also matches R-DATA. The run is INDETERMINATE unless a confirmed HARD_BLOCK takes precedence, in which case it remains CRITICAL and retains all unknown intervals.

Known excursions shorter than approved duration thresholds retain their measured duration and do not imply a threshold breach. `duration_limit_comparison: AT_OR_ABOVE` explicitly specifies inclusive `>=` semantics in the policy schema and approval-visible rules. This preserves the previous inclusive behavior; no alternative comparator is silently supported. Event classification uses that event's duration only; cumulative violations remain run-level rule results.

New simulations and decision submission/approval require engine 1.1.0 and a window matching the current shipment. Engine 1.0 results remain immutable historical evidence and require reanalysis; they are not silently rewritten. Historical PDFs retain the status at report request, as their existing printed heading states. Reports are evidence records, not proof of a currently active authorization.

## One current decision per shipment

The API serializes decision create/submit/review and report snapshots using the same organization transaction lock before any decision row lock. On submit it rejects another PENDING_QA or APPROVED decision for the same shipment, across all simulation runs. Approval repeats that guard. PostgreSQL concurrency tests cover two distinct simultaneous submissions.

A correction must explicitly reference a PENDING_QA, APPROVED or CHANGES_REQUESTED decision for the same shipment. Creating a draft does not revoke an existing decision. Submitting the correction atomically marks the old decision SUPERSEDED, increments its revision and appends a SUPERSEDE audit event; the new decision is PENDING_QA. Any failed submission rolls back both changes. The old snapshot and reports remain unchanged. A rejected correction does not automatically revive the old decision.

This is an API-level invariant (not a new database partial index, since shipment identity is reached through simulation_runs). Direct database writes must remain restricted to the documented runtime path. Preexisting contradictory approvals require explicit owner reconciliation; the application fails closed instead of choosing one.

## Tenant provisioning

Tenant administrators activate a PENDING membership already scoped to their tenant by trusted identity provisioning. The API no longer searches the global identity directory by email. A user in another tenant and an unregistered email return the same 404. An active membership without assigned roles is denied at tenant resolution. No email or external invitation is sent.
