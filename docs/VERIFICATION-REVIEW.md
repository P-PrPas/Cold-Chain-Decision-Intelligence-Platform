# Pre-merge review corrections

Fixes are integrated in PR #7 on top of the existing S0–S6 stack. No PR was merged, rebased or squashed. The complete candidate is the diff from main to `feat/sprint-6-release-hardening`.

## Reproductions and regressions

The reviewer's unchanged `claude_probe.py` now reports: A = CRITICAL with HARD_BLOCK and R-DATA retained; B/C = INDETERMINATE, CONTINUE_DELIVERY = INSUFFICIENT_DATA; single-sample sensor D remains INDETERMINATE. Without a supplied window, unknown duration cannot be quantified, but `coverage_window_known=false` and R-DATA prevent eligibility.

Checked-in golden fixtures provide explicit windows: final_hot (zero inferred duration, no release), partial_trip (85,800 unknown seconds over a one-day trip), and hard_block_gap (600 confirmed excursion seconds plus 1,200 unknown seconds, CRITICAL/BLOCKED). The API tests cover final-hot and partial-window import → analysis → simulation, queued window pinning despite shipment edits, and stale-window rejection.

Decision tests cover conflicting pending/approved decisions, atomic supersession, preserved predecessor snapshot, audit events, submit/review replay ETags and concurrent submissions of distinct drafts (PostgreSQL). Membership tests cover uniform cross-tenant/unknown-email responses, activation of tenant-scoped pending membership and denial of roleless membership. Threshold tests cover below/equal/above the inclusive duration limit and individual event classification under a cumulative run-level HARD_BLOCK.

Local Ruff, formatting, mypy, generated OpenAPI and pytest verification accompany the commits. PostgreSQL, browser workflow and restore checks run in CI; final results are appended after those checks complete. Original candidate timing results in VERIFICATION-S6.md are historical and are not claims about this corrected engine.

## Decisions requiring review

ADR 0004 explicitly chooses UNKNOWN for every uncovered leading/trailing interval, even shorter than the internal sampling-gap threshold. Old engine results require reanalysis for new simulations and approvals. Supersession takes effect on correction submission, not draft creation. Historical reports retain their printed “status at report request”; they are not live authorizations. These changes require owner/domain review before merging.
