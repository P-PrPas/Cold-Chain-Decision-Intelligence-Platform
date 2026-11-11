# Pre-merge review corrections

Fixes are integrated in PR #7 on top of the existing S0–S6 stack. No PR was merged, rebased or squashed. The complete candidate is the diff from main to `feat/sprint-6-release-hardening`.

## Reproductions and regressions

The reviewer's unchanged `claude_probe.py` now reports: A = CRITICAL with HARD_BLOCK and R-DATA retained; B/C = INDETERMINATE, CONTINUE_DELIVERY = INSUFFICIENT_DATA; single-sample sensor D remains INDETERMINATE. Without a supplied window, unknown duration cannot be quantified, but `coverage_window_known=false` and R-DATA prevent eligibility.

Checked-in golden fixtures provide explicit windows: final_hot (zero inferred duration, no release), partial_trip (85,800 unknown seconds over a one-day trip), and hard_block_gap (600 confirmed excursion seconds plus 1,200 unknown seconds, CRITICAL/BLOCKED). The API tests cover final-hot and partial-window import → analysis → simulation, queued window pinning despite shipment edits, and stale-window rejection.

Decision tests cover conflicting pending/approved decisions, atomic supersession, preserved predecessor snapshot, audit events, submit/review replay ETags and concurrent submissions of distinct drafts (PostgreSQL). Membership tests cover uniform cross-tenant/unknown-email responses, activation of tenant-scoped pending membership and denial of roleless membership. Threshold tests cover below/equal/above the inclusive duration limit and individual event classification under a cumulative run-level HARD_BLOCK.

Local Ruff, formatting, mypy and generated OpenAPI checks pass. The complete local suite passes 61 tests, with six PostgreSQL-only cases skipped. The unchanged reviewer probe also runs successfully using the repository `.venv` (which contains boto3).

[CI run 42958367534 at 7b8abc3](https://github.com/P-PrPas/Cold-Chain-Decision-Intelligence-Platform/actions/runs/42958367534) passes API/Web, all 64 then-existing PostgreSQL tests, the real OIDC-to-PDF browser workflow (13.0 seconds), and restore verification of three objects and three database references. Application source is unchanged by subsequent test/documentation commits. Follow-up regressions additionally exercise legacy-engine rejection, rollback of failed correction submission and short uncovered boundaries per required sensor; CI runs again for these additions. Original candidate timing results in VERIFICATION-S6.md are historical and are not claims about this corrected engine.

## Decisions requiring review

ADR 0004 explicitly chooses UNKNOWN for every uncovered leading/trailing interval, even shorter than the internal sampling-gap threshold. Old engine results require reanalysis for new simulations and approvals. Supersession takes effect on correction submission, not draft creation. Historical reports retain their printed “status at report request”; they are not live authorizations. These changes require owner/domain review before merging.
