import os
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.access import digest
from app.db import Base, now, session
from app.main import create_app
from app.models import LoginSession, MemberRole, Membership, Organization, User


@pytest.fixture(autouse=True)
def disable_external_rate_limiter(monkeypatch):
    monkeypatch.setenv("CC_RATE_LIMIT_ENABLED", "false")


@pytest.fixture
def platform(monkeypatch):
    postgres_url = os.environ.get("CC_TEST_POSTGRES_URL")
    for key, value in {
        "DATABASE_URL": "sqlite://",
        "REDIS_URL": "redis://unused",
        "S3_ENDPOINT": "http://unused",
        "S3_ACCESS_KEY": "test",
        "S3_SECRET_KEY": "synthetic-secret-only",
        "S3_BUCKET": "evidence",
    }.items():
        monkeypatch.setenv("CC_" + key, value)
    schema = None
    admin_engine = None
    if postgres_url:
        from app.db import database_url

        admin_engine = create_engine(database_url(postgres_url))
        schema = "test_" + uuid4().hex
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        url = (
            make_url(database_url(postgres_url))
            .update_query_dict({"options": f"-csearch_path={schema}"})
            .render_as_string(hide_password=False)
        )
        monkeypatch.setenv("CC_DATABASE_URL", url)
        engine = create_engine(url)
        command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
    else:
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )

        @event.listens_for(engine, "connect")
        def foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(engine)
    identities = []
    with Session(engine) as db:
        for index, roles in enumerate([["ADMIN", "LOGISTICS"], ["QA"], ["LOGISTICS"]]):
            org_id = identities[0]["org"] if index == 1 else str(uuid4())
            if index != 1:
                db.add(Organization(id=org_id, name=f"Org {index}"))
                db.flush()
            user = User(
                identity_subject=f"issuer|{index}",
                email=f"user{index}@example.invalid",
                name=f"User {index}",
            )
            db.add(user)
            db.flush()
            membership = Membership(organization_id=org_id, user_id=user.id)
            db.add(membership)
            db.flush()
            for role in roles:
                db.add(MemberRole(membership_id=membership.id, role=role))
            token = f"token-{index}"
            csrf = f"csrf-{index}"
            db.add(
                LoginSession(
                    user_id=user.id,
                    token_hash=digest(token),
                    csrf_hash=digest(csrf),
                    expires_at=now() + timedelta(hours=1),
                )
            )
            identities.append({"org": org_id, "user": user.id, "token": token, "csrf": csrf})
        db.commit()

    def sessions():
        with Session(engine) as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app = create_app()
    app.dependency_overrides[session] = sessions
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, identities, engine
    engine.dispose()
    if admin_engine and schema:
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()


def use_identity(client, identity):
    client.cookies.set("cc_session", identity["token"])
    client.headers.update({"X-Organization-Id": identity["org"], "X-CSRF-Token": identity["csrf"]})
