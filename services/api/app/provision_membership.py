"""Operator-only tenant provisioning. Never exposed as a public HTTP endpoint."""

import argparse
import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import connect
from app.models import Membership, Organization, User


def provision(db: Session, organization_id: str, user_id: str) -> Membership:
    organization = db.scalar(
        select(Organization).where(Organization.id == organization_id).with_for_update()
    )
    user = db.get(User, user_id)
    if not organization or organization.status != "ACTIVE" or not user or user.status != "ACTIVE":
        raise ValueError("Active organization and pre-provisioned identity required")
    existing = db.scalar(
        select(Membership).where(
            Membership.organization_id == organization_id, Membership.user_id == user_id
        )
    )
    if existing:
        if existing.status not in {"PENDING", "ACTIVE"}:
            raise ValueError("Membership requires explicit operator investigation")
        return existing
    membership = Membership(organization_id=organization_id, user_id=user_id, status="PENDING")
    db.add(membership)
    db.flush()
    return membership


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create an approved tenant provisioning record for an existing OIDC identity; grants no roles."
    )
    parser.add_argument("--organization-id", required=True, type=UUID)
    parser.add_argument("--user-id", required=True, type=UUID)
    args = parser.parse_args()
    engine = connect(Settings().database_url)
    try:
        with Session(engine) as db:
            membership = provision(db, str(args.organization_id), str(args.user_id))
            result = {"membership_id": membership.id, "status": membership.status}
            db.commit()
        print(json.dumps(result))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
