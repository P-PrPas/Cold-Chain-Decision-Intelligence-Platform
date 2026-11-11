"""Policy versions and deterministic analyses."""

from alembic import op

import app.models  # noqa: F401
from app.db import Base

revision = "0003"
down_revision = "0002"
names = ["reference_documents", "quality_policy_versions", "analysis_runs"]


def upgrade():
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables[name] for name in names])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """CREATE FUNCTION protect_policy_body() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status IN ('APPROVED','RETIRED') AND (TG_OP = 'DELETE' OR NEW.rules::text IS DISTINCT FROM OLD.rules::text OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR NEW.reference_document_id IS DISTINCT FROM OLD.reference_document_id OR NEW.effective_from IS DISTINCT FROM OLD.effective_from OR NEW.effective_to IS DISTINCT FROM OLD.effective_to OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.version IS DISTINCT FROM OLD.version) THEN RAISE EXCEPTION 'immutable approved policy'; END IF; RETURN NEW; END $$"""
        )
        op.execute(
            "CREATE TRIGGER policy_immutable BEFORE UPDATE OR DELETE ON quality_policy_versions FOR EACH ROW EXECUTE FUNCTION protect_policy_body()"
        )


def downgrade():
    for name in reversed(names):
        op.drop_table(name)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP FUNCTION protect_policy_body()")
