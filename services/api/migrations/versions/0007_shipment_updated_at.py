"""Shipment edit timestamp for list activity summaries."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"


def upgrade():
    # Fresh databases already receive the column from 0001's create_all of current metadata.
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("shipments")}
    if "updated_at" not in columns:
        # Nullable and unbackfilled: NULL means "never edited", so existing rows stay truthful
        # (and no UPDATE runs under forced row-level security).
        op.add_column("shipments", sa.Column("updated_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("shipments", "updated_at")
