# Web Redesign Plan — Cold Chain Simulation Studio

Status: approved by product owner 2026-11-12. Scope: `apps/web` only. No API, schema, policy or eligibility logic changes. If a phase discovers it needs an API change, stop and raise it (CLAUDE.md §7).

## Decisions

- **Name:** keep "Cold Chain Simulation Studio" (short: "Cold Chain Studio" where space is tight).
- **Language:** bilingual EN + TH, user-toggleable, `<html lang>` follows the choice. English is the default.
- **Theme:** light "Frost paper" is the default; a dark theme is available through a toggle.
- **Logo:** concept A, "The Gap": a single route stroke whose colour runs from cold blue to amber, with one visible break in the middle. The break stands for a data gap the product never fills in. Variants: colour mark, monochrome mark, horizontal lockup with the wordmark, favicon (`app/icon.svg`).
- **Delivery:** one PR per phase, stacked branches.

## Principles

1. **Sim-first.** The 3D world is the stage. Everything else is an instrument around it.
2. **One screen, one question:** what happened to the cargo → what are the options → what does each cost → hand off to QA.
3. **Feedback under 300 ms.** A slider change moves the sim immediately.
4. **Motion is data, not decoration.** Every movement maps to time, temperature or scenario.
5. **Honesty is part of the visual language.** UNKNOWN is grey hatching everywhere (chart, 3D, badges). Never use green to mean "safe". Never label anything SAFE, CERTIFIED or APPROVED because it is cheap, fast or shows no excursion. Eligibility always comes from the engine; the demo shows "Not evaluated".

## Visual system (Phase 1)

- **Palette ("Frost paper"):** cold off-white ground, deep ink text, hairline grid lines. Saturated colour is reserved for temperature data: thermal scale cold blue → light blue → amber → red-orange. UNKNOWN uses grey diagonal hatching. No violet or lavender anywhere.
- **Status:** each of `ELIGIBLE`, `REVIEW_REQUIRED`, `BLOCKED`, `INSUFFICIENT_DATA` and `NOT_EVALUATED` has an icon shape, a text label and a colour. Colour is never the only signal.
- **Provenance chips:** `Observed` · `Entered` · `Calculated` · `Estimated` beside figures.
- **Type:** IBM Plex Sans + IBM Plex Sans Thai for UI, IBM Plex Mono with tabular numerals for figures (`next/font/google`).
- **Shape:** radius 4px, 8pt spacing grid, motion durations 120 / 240 / 600 ms, `prefers-reduced-motion` honoured.

## 3D Simulation Studio (Phase 2)

Layout at 1440:

```
┌ header: logo · shipment id · product · route · shipment picker · lang/theme ┐
├ left: 4 scenarios (one place only, keys 1-4) ┬ centre: 3D diorama ~65% ┬ right: factors + result card ┤
└ bottom: timeline scrubber = temperature chart + time axis + play/pause/speed ┘
```

Motion that tells the simulation:

1. **Journey playback.** A reefer truck drives from the origin. Its box glows with the temperature at that moment, using zero-order hold.
2. **Thermal ribbon (signature visual).** The truck leaves a ribbon behind it. Ribbon height is temperature and ribbon colour is the thermal band, so the chart lives inside the 3D world.
3. **Honest gap.** Where readings are missing the ribbon stops, a hatched ghost frame takes its place, the truck turns grey and a "No readings 09:30–10:30" label appears. No interpolation.
4. **Decision point.** The sim auto-pauses at the decision point, the camera pulls back and the four routes branch out.
5. **Scenario run.** The truck continues along the chosen branch. The delay clock counts up and the cost ticker counts up to the Decimal total.
6. **Compare mode (`C`).** Four ghost trucks run in parallel on the same time scale. A BLOCKED one stops at a barrier and shows the rule reason.
7. **What-if feedback.** After a slider change, a ghost of the previous value stays visible for about 1 s.

Ease of use:

- First run: DEMO-001 autoplays for about 8 s to the decision point, then one coach mark appears ("Choose how to proceed").
- Preset experiment chips, e.g. "Inspection takes 4 h?" and "New receiver rejects?". One click replays the sim.
- Keys: Space play/pause, ←/→ scrub, C compare, R reset, 1-4 scenario.
- Cameras: Overview (orthographic diorama), Follow (truck), 2D top-down (also the no-WebGL fallback).

Art direction: low-poly matte diorama, isometric orthographic camera, frost-paper ground, one soft shadow light. Colour only on temperature and status; buildings, roads and trucks in ink greys. A permanent "Schematic, not GPS" label in a corner.

Technical:

- Use the existing `three` dependency only, with one WebGL context per page.
- Instancing where it helps, DPR capped at 2, pause rendering when the tab is hidden or the canvas is offscreen.
- Reduced motion jumps straight to the final frame. The 2D SVG fallback carries the same information.
- Simulation clock is a pure, unit-tested function (`stateAt(t, readings, scenario)`) kept separate from the renderer.

Mobile (390): canvas sticky at the top (about 45vh), timeline under it, factors in a draggable bottom sheet.

## Information architecture

| Route | Role | Phase |
|---|---|---|
| `/` | Landing | 3 |
| `/studio` (was `/demo`; `/demo` redirects) | Synthetic sim sandbox | 2 |
| `/workspace` | Shipment list: status table with icons, search and filter, empty state that invites the first CSV upload | 4 |
| `/workspace/shipments/[id]` | Real work. Uses the same Studio shell as the sandbox, plus a stepper: Evidence → Policy → Simulate → Propose → QA → Report | 4 |

Demo and real work look the same, so a user who has tried the demo already knows the real tool. A stepper step that cannot be reached yet shows why (e.g. "An approved policy is required first") instead of hiding the button.

## Landing (Phase 3), kind: software

1. **Hero.** The h1 names what is sold and for whom (e.g. "Cold-chain excursion simulator for logistics and QA teams"). The real Studio runs in an app-frame, looping the DEMO-001 journey. One hard fact: "Gaps stay unknown. No interpolation." One primary action: Open the simulator.
2. **Evidence.** The thermal ribbon and the gap up close, with a short note on why missing data is never filled in.
3. **Scenarios.** Compare mode across all four options, cost and delay shown with provenance chips.
4. **QA handoff.** The decision snapshot and report UI, showing that a proposal is frozen once submitted.
5. **Close.** One large line and a button. The footer carries the safety disclaimer exactly once ("Decision support only. Does not certify food safety.").

## Phases

| Phase | Work | Verify |
|---|---|---|
| 1 Brand + tokens | Logo set, token-based `globals.css` (light + dark), fonts, i18n foundation + header toggles, internal `/brand` page | lint, typecheck, vitest, contrast |
| 2 Studio | sim clock (pure + tests), new renderer replacing `network-renderer.ts`, timeline, compare, presets, keyboard, mobile sheet, `/studio` route | vitest clock/gap tests, e2e scenario/reduced-motion/fallback |
| 3 Landing | as above, reusing the Studio component | taste-skill gate |
| 4 Workspace | shipment table, Studio shell in shipment detail, stepper, TH strings | e2e shipment → report |
| 5 Polish | keyboard, a11y, perf (DPR, offscreen pause), copy pass, 320 px | Lighthouse, e2e at 320 |
