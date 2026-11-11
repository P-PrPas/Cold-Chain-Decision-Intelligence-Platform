"""Pinned scenario simulations."""

from alembic import op

import app.models  # noqa: F401
from app.db import Base

revision = "0004"
down_revision = "0003"
names = ["simulation_runs", "simulation_scenarios"]


def upgrade():
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables[name] for name in names])


def downgrade():
    for name in reversed(names):
        op.drop_table(name)
