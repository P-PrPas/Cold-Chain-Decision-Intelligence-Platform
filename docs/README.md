# Documentation index

Living contracts sit at the top level of this folder. Historical delivery records live under [`history/`](history/README.md).

## Product

| Document | What it covers |
| --- | --- |
| [product/PRD.md](product/PRD.md) | Product requirements, scope and safety posture of the MVP. |
| [UX.md](UX.md) | Journey wireframe: shipment to CSV, chart, policy, simulation, decision, QA and report. |
| [design/redesign-plan.md](design/redesign-plan.md) | Approved plan for the web redesign (brand, Studio, landing, workspace, polish). |

## Engineering contracts

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, domain boundaries, algorithms, invariants and infrastructure. |
| [API.md](API.md) | Human-readable REST contract under `/api/v1`. The machine contract is [`packages/contracts/openapi.json`](../packages/contracts/openapi.json). |
| [DATABASE.md](DATABASE.md) | Physical data model, constraints, row-level security and persistence rules. |
| [FACTOR_PREVIEW_CONTRACT.md](FACTOR_PREVIEW_CONTRACT.md) | How the Studio and workspace factor controls map to the engine. |
| [RUNBOOKS.md](RUNBOOKS.md) | Start/stop, staging, backup and recovery, release boundaries. |
| [DOCKER_FOOTPRINT.md](DOCKER_FOOTPRINT.md) | Container image sizes and local recovery notes. |

## Decisions

Architecture decision records in [`adr/`](adr/):

- [0001 Foundation](adr/0001-foundation.md)
- [0002 Secure core](adr/0002-secure-core.md)
- [0003 Release candidate](adr/0003-release-candidate.md)
- [0004 Evidence boundaries and current decisions](adr/0004-evidence-boundaries-and-current-decisions.md)

## Related files outside this folder

- [../README.md](../README.md): project overview and getting started.
- [../AGENT.md](../AGENT.md) and [../CLAUDE.md](../CLAUDE.md): operating contract for contributors and coding agents.
- [../infra/README.md](../infra/README.md): local and staging infrastructure.
- [../tests/fixtures/README.md](../tests/fixtures/README.md): synthetic fixtures and hand-calculated oracles.
