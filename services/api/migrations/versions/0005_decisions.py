"""Immutable decision snapshots and optional grounded explanations."""

from alembic import op

import app.models  # noqa: F401
from app.db import Base

revision = "0005"
down_revision = "0004"
names = ["decisions", "ai_explanations"]


def upgrade():
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables[name] for name in names])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """CREATE FUNCTION protect_decision_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.snapshot IS NOT NULL AND (TG_OP='DELETE' OR NEW.snapshot::text IS DISTINCT FROM OLD.snapshot::text OR NEW.snapshot_sha256 IS DISTINCT FROM OLD.snapshot_sha256 OR NEW.simulation_run_id IS DISTINCT FROM OLD.simulation_run_id OR NEW.selected_scenario_id IS DISTINCT FROM OLD.selected_scenario_id) THEN RAISE EXCEPTION 'immutable decision snapshot'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER decision_immutable BEFORE UPDATE OR DELETE ON decisions FOR EACH ROW EXECUTE FUNCTION protect_decision_snapshot()"
        )


def downgrade():
    for name in reversed(names):
        op.drop_table(name)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP FUNCTION protect_decision_snapshot()")
