# Local infrastructure
Root compose.yaml is the canonical local stack. Only API 8000 and Web 3000 bind to loopback. PostgreSQL, Redis and Moto have no host port.
Copy .env.example to .env and replace local passwords (URL-safe PostgreSQL password). Never use production secrets or data. Run docker compose up --build -d, then query /api/v1/health/live and /api/v1/health/ready. Stop with docker compose down; volumes are retained. Do not use down -v unless intentionally deleting synthetic local data.
No database schema exists in S0: migrations start in S1. No worker consumes jobs yet; durable jobs start in S2. Missing required settings prevent startup. Readiness verifies PostgreSQL, Redis and bucket access; liveness remains independent.

Local S3 uses Moto (ephemeral, unauthenticated emulator on private Compose network only) because MinIO registry images were unavailable during verification. Never deploy this stack with real data; durable private S3 remains the production design. Restarting storage loses synthetic objects; recreate bucket via storage-init.
