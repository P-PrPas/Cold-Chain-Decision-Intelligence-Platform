"""Frozen reports and immutable source-chain guards."""

from alembic import op

import app.models  # noqa: F401
from app.db import Base

revision = "0006"
down_revision = "0005"


def upgrade():
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables["reports"]])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """CREATE FUNCTION protect_completed_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status IN ('READY','COMPLETED') THEN RAISE EXCEPTION 'immutable completed evidence'; END IF; RETURN NEW; END $$"""
        )
        for name in [
            "temperature_datasets",
            "analysis_runs",
            "simulation_runs",
            "reports",
            "ai_explanations",
        ]:
            op.execute(
                f"CREATE TRIGGER completed_immutable BEFORE UPDATE OR DELETE ON {name} FOR EACH ROW EXECUTE FUNCTION protect_completed_evidence()"
            )
        op.execute(
            """CREATE FUNCTION protect_readings() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM temperature_datasets WHERE id=OLD.dataset_id AND organization_id=OLD.organization_id AND status='READY') THEN RAISE EXCEPTION 'immutable readings'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER readings_immutable BEFORE UPDATE OR DELETE ON temperature_readings FOR EACH ROW EXECUTE FUNCTION protect_readings()"
        )
        op.execute(
            """CREATE FUNCTION protect_scenarios() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM simulation_runs WHERE id=OLD.simulation_run_id AND organization_id=OLD.organization_id AND status='COMPLETED') THEN RAISE EXCEPTION 'immutable scenarios'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER scenarios_immutable BEFORE UPDATE OR DELETE ON simulation_scenarios FOR EACH ROW EXECUTE FUNCTION protect_scenarios()"
        )
        op.execute(
            """CREATE FUNCTION validate_analysis_chain() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM temperature_datasets d JOIN shipments s ON s.id=d.shipment_id AND s.organization_id=d.organization_id JOIN quality_policy_versions p ON p.product_id=s.product_id AND p.organization_id=s.organization_id WHERE d.id=NEW.dataset_id AND d.organization_id=NEW.organization_id AND s.id=NEW.shipment_id AND p.id=NEW.policy_version_id) THEN RAISE EXCEPTION 'invalid analysis source chain'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER analysis_chain BEFORE INSERT OR UPDATE ON analysis_runs FOR EACH ROW EXECUTE FUNCTION validate_analysis_chain()"
        )
        op.execute(
            """CREATE FUNCTION validate_simulation_chain() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM analysis_runs a WHERE a.id=NEW.analysis_id AND a.organization_id=NEW.organization_id AND a.shipment_id=NEW.shipment_id AND a.dataset_id=NEW.dataset_id AND a.policy_version_id=NEW.policy_version_id) THEN RAISE EXCEPTION 'invalid simulation source chain'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER simulation_chain BEFORE INSERT OR UPDATE ON simulation_runs FOR EACH ROW EXECUTE FUNCTION validate_simulation_chain()"
        )

    if op.get_bind().dialect.name == "postgresql":
        for table in Base.metadata.sorted_tables:
            if "organization_id" in table.c and table.name != "organization_memberships":
                op.execute(f"ALTER TABLE {table.name} ENABLE ROW LEVEL SECURITY")
                op.execute(f"ALTER TABLE {table.name} FORCE ROW LEVEL SECURITY")
                op.execute(
                    f"CREATE POLICY tenant_scope ON {table.name} USING (organization_id = current_setting('cc.organization_id',true)) WITH CHECK (organization_id = current_setting('cc.organization_id',true))"
                )
        op.create_index(
            "ix_readings_tenant_dataset_sensor_time",
            "temperature_readings",
            ["organization_id", "dataset_id", "sensor_id", "timestamp_utc"],
        )

    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """CREATE OR REPLACE FUNCTION protect_policy_body() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status IN ('APPROVED','RETIRED') AND (TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['status','revision']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision']) OR NEW.status NOT IN ('APPROVED','RETIRED') OR (OLD.status='RETIRED' AND NEW.status!='RETIRED')) THEN RAISE EXCEPTION 'immutable approved policy'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER reference_immutable BEFORE UPDATE OR DELETE ON reference_documents FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation()"
        )
        op.execute(
            """CREATE FUNCTION prevent_late_readings() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM temperature_datasets WHERE id=NEW.dataset_id AND organization_id=NEW.organization_id AND status='READY') THEN RAISE EXCEPTION 'immutable ready readings'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER late_readings BEFORE INSERT ON temperature_readings FOR EACH ROW EXECUTE FUNCTION prevent_late_readings()"
        )
        op.execute(
            """CREATE FUNCTION prevent_late_scenarios() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM simulation_runs WHERE id=NEW.simulation_run_id AND organization_id=NEW.organization_id AND status='COMPLETED') THEN RAISE EXCEPTION 'immutable completed scenarios'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER late_scenarios BEFORE INSERT ON simulation_scenarios FOR EACH ROW EXECUTE FUNCTION prevent_late_scenarios()"
        )
        op.execute(
            """CREATE FUNCTION protect_dataset_source() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.raw_object_key IS DISTINCT FROM OLD.raw_object_key OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.mapping::text IS DISTINCT FROM OLD.mapping::text OR NEW.source_timezone IS DISTINCT FROM OLD.source_timezone OR NEW.shipment_id IS DISTINCT FROM OLD.shipment_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.version IS DISTINCT FROM OLD.version THEN RAISE EXCEPTION 'immutable dataset source'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER dataset_source BEFORE UPDATE ON temperature_datasets FOR EACH ROW EXECUTE FUNCTION protect_dataset_source()"
        )


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        for trigger, table in [
            ("reference_immutable", "reference_documents"),
            ("late_readings", "temperature_readings"),
            ("late_scenarios", "simulation_scenarios"),
            ("dataset_source", "temperature_datasets"),
        ]:
            op.execute(f"DROP TRIGGER {trigger} ON {table}")
        for function in [
            "prevent_late_readings",
            "prevent_late_scenarios",
            "protect_dataset_source",
        ]:
            op.execute(f"DROP FUNCTION {function}()")

    if op.get_bind().dialect.name == "postgresql":
        op.drop_index("ix_readings_tenant_dataset_sensor_time", table_name="temperature_readings")
        for table in Base.metadata.sorted_tables:
            if "organization_id" in table.c and table.name != "organization_memberships":
                op.execute(f"DROP POLICY tenant_scope ON {table.name}")
                op.execute(f"ALTER TABLE {table.name} DISABLE ROW LEVEL SECURITY")

    if op.get_bind().dialect.name == "postgresql":
        for name in [
            "temperature_datasets",
            "analysis_runs",
            "simulation_runs",
            "reports",
            "ai_explanations",
        ]:
            op.execute(f"DROP TRIGGER completed_immutable ON {name}")
        for trigger, table in [
            ("readings_immutable", "temperature_readings"),
            ("scenarios_immutable", "simulation_scenarios"),
            ("analysis_chain", "analysis_runs"),
            ("simulation_chain", "simulation_runs"),
        ]:
            op.execute(f"DROP TRIGGER {trigger} ON {table}")
        for function in [
            "protect_completed_evidence",
            "protect_readings",
            "protect_scenarios",
            "validate_analysis_chain",
            "validate_simulation_chain",
        ]:
            op.execute(f"DROP FUNCTION {function}()")
    op.drop_table("reports")
