from sqlalchemy import UniqueConstraint

import app.models  # noqa: F401
from app.db import Base


def test_constraint_names_include_all_unique_columns():
    names = [
        constraint.name
        for table in Base.metadata.tables.values()
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    ]
    assert len(names) == len(set(names))
