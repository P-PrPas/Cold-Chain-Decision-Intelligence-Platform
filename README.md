# Cold Chain Decision Intelligence Platform

Multi-tenant cold-chain decision support: shipment → CSV → validated temperature data → deterministic analysis → scenarios → QA review → reproducible report.

This repository currently contains design documents only. No application, CI, or deployment has been implemented or verified. The software must not certify food safety or autonomously release or dispatch goods.

## Specifications

- [Product requirements](docs/Cold_Chain_Decision_Intelligence_PRD_MVP_v1.0.md)
- [Architecture](docs/ARCHITECTUR.md)
- [API contract](docs/API.md)
- [Database contract](docs/DATABASE.md)
- [Sprint backlog](docs/TASKS.md)
- [Agent operating contract](AGENT.md)
- [Execution status and handoff](docs/EXECUTION.md)

## Delivery

One implementation PR per sprint, S0 through S6, in dependency order. The lead reviews each worker submission and permits at most two correction rounds before taking over unresolved work. Merge to main only after review and relevant verification pass. Domain QA approval remains a separate gate for real-world use.
