"""Tenant core and server sessions."""

from alembic import op

import app.models  # noqa: F401
from app.db import Base

revision = "0001"
down_revision = None
names = [
    "organizations",
    "users",
    "organization_memberships",
    "membership_roles",
    "sessions",
    "products",
    "shipments",
    "idempotency_records",
    "audit_logs",
]


def upgrade():
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables[name] for name in names])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit is append only'; END $$"""
        )
        op.execute(
            "CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation()"
        )


def downgrade():
    for name in reversed(names):
        op.drop_table(name)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP FUNCTION prevent_audit_mutation()")
