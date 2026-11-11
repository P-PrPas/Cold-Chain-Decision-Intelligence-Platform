# Simulation workspace acceptance — review R01–R12

This iteration is a review candidate, not certification of a premium production release.

Production-build screenshots: [desktop simulation](review-evidence/simulation-desktop.png) and [375 px simulation](review-evidence/simulation-mobile.png).

## Data and workflow

- R01: analysis selection remounts the simulation scope and clears the proposal; recalculation clears results immediately and locks submissions. Polling and restoration ignore superseded responses. Browser regression covers switching a saved analysis after preparing a proposal and a failed job.
- R02/R03: queue search and status filters execute on the server, with cursor pagination; query/filter persist in session storage. Responses carry a request generation and data scope. An organization change hides previous data immediately, including on failure. API regression uses 31 shipments; browser regression delays organization responses, fails one request, searches server-side and loads another page.
- R04: saved latest completed analysis, simulation, latest decision and approved decision are loaded separately from the current selection. Starting a new cycle preserves saved history. Older analyses have scoped pagination.
- R05: decision inbox uses one shipment-filtered page per request, independent of other shipments' decision count. Loading, empty, retry and load-older states are separate. Tenant ownership is enforced by the API.
- R08: decision summaries prioritize classification, eligibility, temperature range, missing time, policy/dataset versions, cost/delay and review requirements. Traceability remains expandable; backend authorization, required actions, revision checks and snapshot validation remain authoritative.
- R11: landing example links to `?shipment=DEMO-003`; selection updates the URL, refresh restores it, invalid values display an explicit fallback notice.

## 3D and interaction

- R06/R07: Three.js orthographic scene has distinct warehouses, inspection facility, truck and quarantine area. A single selected scenario drives comparison, route highlight, numbered upright labels, impact summary and inspector/proposal. Original dashed and proposed solid paths have a text legend. Alternative acceptance and missing evidence remain visible.
- Positions are schematic, not GPS. No time playback or inferred events are generated. Costs/delays are engine output in the workspace and explicitly prepared examples in demo. No continuous animation: reduced-motion users receive the same static, event-rendered scene.
- Native keyboard controls provide 2D/3D, reset and zoom. WebGL initialization/context failure switches to 2D without changing scenario or blocking work. Both modes retain the same context, cost/delay, constraints and location legend.
- R09/R10: shared numeric formats and queue columns, status-specific actions, readable chart labels, journey summary outside the scroll region, selected table rows and mobile stacked inspector. Widths 1440/768/375/320 and a 200% text-zoom case are automated.

## Performance budget and measurement

Target baseline: current desktop Chromium with integrated graphics at 1440/768 CSS pixels; mobile Chromium at 375/320 CSS pixels. Real low-end Android and Safari hardware validation remains required before release. Prefer 2D when WebGL is unavailable.

Scene budget: fewer than 100 draw calls and 20,000 triangles, DPR capped at 1.5, no external model/texture downloads, no perpetual rendering loop. CPU initialization target below 250 ms and render submission below 33 ms on target hardware; these are not GPU frame-time claims. Three.js loads only for 3D. Measure actual device performance before adding detailed assets.

Local headless Chromium sample (development build, Windows, no CPU throttling): 42 draw calls / 696 triangles; initialization 80/72/67 ms at 1440/375/320; subsequent render submission 2 ms. All six markers remained within the viewport. These measurements do not establish mobile hardware performance. Automated checks enforce geometry budgets and label bounds, avoiding flaky wall-clock assertions.

## Release checks still requiring people/devices

Local verification: web lint/format/typecheck/unit tests/build and API ruff/mypy/OpenAPI checks passed. SQLite: 74 passed, 7 PostgreSQL-only skipped. PostgreSQL full run: 80 passed, benchmark failed at 10.02 s analysis against a 10 s limit while other verification was running. An isolated benchmark rerun passed without changing limits: import 19.44 s, analysis 3.49 s, simulation 0.28 s for 100,000 rows. Production Docker Playwright suite: 10/10 passed, including OIDC and independent QA through private PDF. The workflow test now waits for the exact shipment creation response instead of selecting a preexisting first row.

R12 is partially automated, not a completed usability study. Existing API/integration tests cover permissions, independent QA, idempotency and stale revisions; browser regressions cover scope changes, failures, fallback, focus/selection and acknowledgement. Full timeout and long-content state matrices, assistive technology audit, real-device GPU profiling and logistics/QA observation remain release gates.

Observe logistics users finding a shipment, reading evidence, comparing four scenarios and preparing a proposal; observe QA reviewing pinned evidence and recording an outcome. Record success, hesitation and mistakes without coaching. Capture empty/populated/missing/error/long-content screens and keyboard/200% zoom behavior. Do not infer product readiness solely from CI.
