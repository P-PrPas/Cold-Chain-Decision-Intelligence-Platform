# Factor exploration and saved results

The assumptions object loaded from a simulation is the baseline. Controls edit a clone of that complete object; all six cost categories, amount strings, sources, scenario types, per-scenario acceptance, source IDs and weights are retained. Changing a cost marks only that component USER_ESTIMATE. Reset restores the named saved baseline, not a new zero-cost run. A new analysis starts with explicitly labelled zero estimates and unknown acceptance.

| Factor | Unit and editing range | Immediate scene response | Engine responsibility |
| --- | --- | --- | --- |
| Additional delay | Integer minutes; slider 0–240 or extended to include baseline/current value; numeric input supports engine maximum 525,600 | Paired duration bars: baseline above current, attached to the selected activity scene | Delay and ranking; no temperature deterioration model |
| Cost component | Shipment currency; slider 0–10,000 or extended to include baseline/current amount; exact numeric input | Paired cost bars and exact formatted amount; route stays fixed | Decimal cost sum, currency precision, ranking |
| Receiver acceptance | UNKNOWN / ACCEPTED / REJECTED; explicitly an assumption | Alternative pad material, visible accepted/rejected/unknown symbol and text; no hover needed | Eligibility/missing-information constraints |
| Cost/delay weights | 0–1, complementary sum of 1 | Advanced preference control; demo explicitly does not calculate a ranking | Ranking of eligible alternatives only; never changes evidence |
| Scenario | Only scenarios present in restored assumptions/results | Selected path and destination | Scenario-specific constraints |

Controls have sliders plus numeric/select alternatives. Editing ranges are UI conveniences, not policy limits. Existing backend authorization and validation govern requests; the editor grants no new role or approval ability.

## Preview protocol

`POST /shipments/{shipment_id}/simulation-preview` takes the same schema as saved simulation creation. It applies the same tenant/source/current-analysis/policy/currency checks and calls the same calculation function. It returns `items`, `analysis_id`, `assumptions_sha256`, and `persisted: false`. It writes no simulation, job or scenario records. A regression compares its results to a completed saved run and verifies unchanged record counts.

Workspace edits update the draft/scene immediately. After 400 ms without another edit, a preview request is sent. Cancellation plus full-payload result keys prevent old responses being presented as current. Changed/failed previews hide old eligibility and disable proposal handoff. Explicit Run/Recalculate persists one job; controls lock during that save. Only a completed saved run with matching assumptions can prepare a real proposal. Network failure retains draft inputs. Saved-history refreshes do not reset the user's current exploration.

The unauthenticated demo remains an illustrative, local cost/delay/acceptance preview. It does **not** claim engine eligibility or rankings; weights are in Advanced and explicitly describe preference only. It writes no runs and explicitly directs users to the connected workspace for engine results. Demo proposal preview requires evidence acknowledgement, and any factor/scenario/shipment change clears that acknowledgement.

## Scene lifetime and verification

The renderer mounts once per 3D session. Factor changes update paired SVG impact bars and visible receiver status; scenario changes replace only route geometry and highlight colors; zoom updates the camera. No time playback is synthesized. WebGL failure keeps selection in 2D. Regression checks canvas identity after factor/zoom changes, first viewport scene and delay-control visibility at every supported width, 320/375/768/1440 layouts, baseline round-trip, a single-scenario run, delayed/out-of-order preview, failure recovery, and saved-summary refresh.

Real-device profiling and uncoached logistics/QA usability sessions remain required. Desktop headless timing is not mobile performance certification.

## F01–F08 interaction revision

Demo uses a compact shipment toolbar and a native scenario selector on mobile. The scene stays above one active factor group (Delay, Cost, Receiver, Advanced) while editing; desktop puts the group beside the scene without a nested scroll area. Mobile scene names remain visible after the header scrolls away. Context/limits/sources are disclosures. Opening scene context or using a short viewport releases sticky positioning so expanded content can be read.

Duration and cost bands share a scale within each baseline/current pair (not across currencies or factors). Baseline is the upper gray band; the current estimate is the lower cyan band, with explicit numeric delta. These are assumption comparisons, not temperature, GPS or time-evolving engine results. Acceptance updates the alternative pad and a visible symbol plus text. The same impact bands and statuses are present in 2D fallback.

Every draft is validated before preview and Save. Empty/negative/incomplete-decimal costs, excessive precision, amounts beyond the backend's 16 whole digits, invalid delay and non-unit ranking weights produce field errors. A bad component makes the total unavailable instead of silently contributing zero. Amount text is retained while invalid. Factor-group buttons indicate errors outside the active group. Sources and unedited component amounts are preserved.

Automated acceptance includes pointer drags at 320/375 px, Chromium touch-event dispatch, first-viewport canvas and delay control at 320/375/768/1440 px (900 px height), current/baseline bar ratios, visible receiver rejection, focus clearance, invalid Save gating, and no preview request for an invalid draft. Touch dispatch is emulation, not physical-device/GPU validation. Real-device, screen-reader and uncoached logistics/QA studies remain outstanding.
