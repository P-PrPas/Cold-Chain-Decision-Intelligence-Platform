"""Report presentation language (existing reports are English)."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"


def upgrade():
    # Fresh databases already receive the column from 0006's create_all of current metadata.
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("reports")}
    if "language" not in columns:
        # ADD COLUMN with a constant default fires no row triggers, so completed reports stay
        # untouched and immutable while existing rows read as 'en'.
        op.add_column(
            "reports",
            sa.Column("language", sa.String(2), nullable=False, server_default="en"),
        )
        op.create_check_constraint("report_language", "reports", "language IN ('en','th')")


def downgrade():
    op.drop_constraint("report_language", "reports", type_="check")
    op.drop_column("reports", "language")
