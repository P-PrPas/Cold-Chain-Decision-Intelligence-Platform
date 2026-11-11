from alembic import context

import app.models  # noqa: F401
from app.config import Settings
from app.db import Base, connect

engine = connect(Settings().database_url)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
