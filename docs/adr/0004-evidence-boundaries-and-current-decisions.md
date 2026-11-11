# ADR 0004: shipment coverage and current decisions

Status: proposed for owner/domain review. Resolves the pre-merge review blockers with conservative, deterministic behavior; does not approve real safety limits.

## Analysis engine 1.2.0 (re-review correction)

Analysis creation pins departure and estimated arrival in the input digest and queued metadata. The worker uses this pinned window even if the shipment changes while queued. All readings are retained, including loading and delayed-arrival evidence. Each required sensor must cover the same window. ETA is an estimate, not authority to discard evidence.

Use consecutive real observations, including the last at/before departure and the first at/after ETA. Validate their ORIGINAL spacing against max_valid_sampling_gap_seconds, then clip the evaluated interval to the shipment window. Bounded zero-order-hold between those observations is supported; clipping a long original gap cannot make it valid. A logger need not sample exactly at either boundary. If no bracketing observation exists, the genuinely uncovered portion remains UNKNOWN, even if short; no tolerance or extrapolation is invented. A missing sensor contributes the whole window as unknown. Unknown seconds sum across required sensors and can overlap. Duration fields remain integers: measured intervals retain whole-second precision; unknown fractional seconds round upward so missing evidence never rounds down to zero.

Every out-of-range sample outside the window is preserved in unbounded_out_of_range_observations with reason OUT_OF_RANGE_OUTSIDE_SHIPMENT_WINDOW, and all samples contribute to summary min/max. These observations match R-DATA / REVIEW_REQUIRED even when every in-window interval is normal. An out-of-range final sample or one followed by an unknown long gap also matches R-DATA without inventing duration. Duration-based excursion totals describe the pinned window; out-of-window evidence cannot certify release and requires reconciliation of the actual trip and reanalysis. Missing window metadata also matches R-DATA. Confirmed HARD_BLOCK retains CRITICAL precedence over uncertainty.

Known excursions shorter than approved duration thresholds retain their measured duration and do not imply a threshold breach. `duration_limit_comparison: AT_OR_ABOVE` explicitly specifies inclusive `>=` semantics in the policy schema and approval-visible rules. This preserves the previous inclusive behavior; no alternative comparator is silently supported. Event classification uses that event's duration only; cumulative violations remain run-level rule results.

New simulations and decision submission/approval require engine 1.2.0 and a window matching the current shipment. Engine 1.0/1.1 results remain immutable historical evidence and require reanalysis; they are not silently rewritten. Historical PDFs retain status at report request. Reports are evidence records, not proof of a currently active authorization.

## One current decision per shipment

The API serializes decision create/submit/review and report snapshots using the organization transaction lock before any decision row lock. There may be at most one APPROVED decision and at most one PENDING_QA proposal per shipment. They may coexist only when the pending proposal explicitly corrects that approved decision. Unrelated current decisions or a second pending correction are rejected, across simulation runs.

A correction explicitly references a PENDING_QA, APPROVED or CHANGES_REQUESTED decision for the same shipment. A draft revokes nothing. On submission, a non-approved predecessor is superseded atomically with an audit event. An APPROVED predecessor remains APPROVED, with unchanged revision and snapshot, until independent QA approves the replacement; only that QA transaction supersedes it and records acting_role=QA. Rejection or request-changes on a pending correction leaves the prior approval intact. Failed submission/approval rolls back all effects. This replaces the earlier proposed behavior that allowed a proposer to revoke a QA approval; no owner sign-off for that behavior is assumed.

This is an API-level invariant (not a new database partial index, since shipment identity is reached through simulation_runs). Direct database writes must remain restricted to the documented runtime path. Preexisting contradictory approvals require explicit owner reconciliation; the application fails closed instead of choosing one.

## Tenant provisioning

Tenant administrators activate a PENDING membership scoped to their tenant by the operator-only `python -m app.provision_membership` command documented in RUNBOOKS.md. The command uses an existing verified identity UUID, is idempotent, grants no roles, and does not reactivate disabled records. The API never searches the global directory by email. Other-tenant and unregistered emails both return 404. Roleless membership is denied. No external invitation is sent.
