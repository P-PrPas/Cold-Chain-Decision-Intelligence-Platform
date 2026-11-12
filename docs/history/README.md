# Delivery history

Records from the sprint-by-sprint build and its reviews. They explain how the project reached its current state and are kept as evidence. They are **not** living contracts: where they disagree with the documents in [`docs/`](../README.md) or the [ADRs](../adr/), the living documents win.

| Item | What it is |
| --- | --- |
| [TASKS.md](TASKS.md) | Original MVP backlog and sprint plan (S0 to S6). |
| [EXECUTION.md](EXECUTION.md) | Running execution status and hand-off notes. |
| [VERIFICATION-S0.md](VERIFICATION-S0.md), [VERIFICATION-S6.md](VERIFICATION-S6.md) | Verification evidence for the first and last sprint. |
| [VERIFICATION-REVIEW.md](VERIFICATION-REVIEW.md), [VERIFICATION-REREVIEW.md](VERIFICATION-REREVIEW.md) | Pre-merge review corrections (engine 1.1.0, then 1.2.0). |
| [UI_REVIEW_FOLLOWUP.md](UI_REVIEW_FOLLOWUP.md), [UI_ACCEPTANCE_R01_R12.md](UI_ACCEPTANCE_R01_R12.md) | UI review follow-up and acceptance notes. |
| [review-evidence/](review-evidence/) | Screenshots referenced by the UI acceptance notes. |
| [benchmark-synthetic.json](benchmark-synthetic.json), [benchmark-postgres.json](benchmark-postgres.json) | Recorded benchmark runs on synthetic data. Regenerate with `python scripts/benchmark.py --output <file>`. |
