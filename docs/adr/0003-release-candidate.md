# ADR 0003: release candidate contract and deployment boundary

Status: proposed for owner review, not independently approved.

- Shipment pagination uses descending `(created_at,id)` keysets. Departure `from`/`to` filters are inclusive/exclusive and bound to cursors. The proposed `updated_at` sort is not enabled: concurrent edits would move records between pages without a snapshot-pagination contract. Unsupported sort values fail validation. This is an explicit API limitation for owner review.
- Product PATCH is partial. Membership administration links an existing exact identity and has bounded pagination; external invitations remain outside the MVP's no-notifications boundary.
- Readings have chronological raw cursors and per-sensor min/max bucket aggregation, with no interpolation across gaps. Completed readings/scenarios cannot be appended to or mutated; dataset source metadata and reference documents are immutable.
- PostgreSQL migrations force RLS on domain tables. Application requests and jobs set transaction-local tenant context. CI tests a non-owner NOBYPASSRLS role; production runtime credentials must also use that role model.
- Local S3 remains ephemeral Moto. Staging configuration requires managed durable infrastructure and HTTPS identity supplied by the owner. CI is a disposable synthetic candidate environment, not a published staging deployment.
- Technical verification and owner/domain approval are separate. Keep all seven PRs open, no merges, no deployment and no real policy approval. The owner's all-sprint implementation instruction authorizes continuing without intermediate review.
