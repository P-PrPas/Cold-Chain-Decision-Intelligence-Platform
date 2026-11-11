"""Immutable CSV datasets and durable jobs."""

from alembic import op

import app.models  # noqa: F401
from app.db import Base

revision = "0002"
down_revision = "0001"
names = ["temperature_datasets", "temperature_readings", "jobs", "outbox_events"]


def upgrade():
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables[name] for name in names])


def downgrade():
    for name in reversed(names):
        op.drop_table(name)
