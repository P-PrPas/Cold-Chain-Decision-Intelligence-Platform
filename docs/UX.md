# Foundation journey wireframe
Design status: proposed, human review pending. S0 homepage is a development notice only.

Shipment list ? create/details ? CSV mapping + timezone ? validation/job progress ? temperature timeline ? policy/rule evidence ? scenario comparison ? proposal ? QA review ? immutable report.

| Surface | Main content | Required alternatives |
|---|---|---|
| Shipment list/detail | reference, product, route, operational state | empty create prompt, loading, retry, forbidden |
| Upload | file, mapping, sensor, timezone, source hash | row errors, oversized file, pending job, failed retry |
| Timeline | per-sensor observations, unknown intervals, source versions | no connected line through gap; indeterminate text |
| Scenario compare | eligibility first, then decimal cost/delay, assumptions | blocked/unknown have no submit control |
| QA review | frozen evidence, proposer, reviewer, rationale | stale revision reload; QA permission required |
| Report | immutable decision snapshot and hashes | pending generation, failed retry, forbidden |

All controls require accessible labels, keyboard focus and status text in addition to color. No page implies food-safety certification or autonomous dispatch.
