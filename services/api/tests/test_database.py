from sqlalchemy import UniqueConstraint

from app.db import Base


def test_unique_constraint_names_are_schema_unique():
    names = [
        constraint.name
        for table in Base.metadata.tables.values()
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    ]
    assert len(names) == len(set(names))
