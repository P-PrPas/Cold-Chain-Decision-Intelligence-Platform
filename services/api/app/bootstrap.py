"""Provision synthetic identities matching local Keycloak realm. Never called at API startup."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import connect
from app.models import MemberRole, Membership, Organization, Product, User


def main() -> None:
    settings = Settings()
    if not settings.synthetic_only:
        raise RuntimeError("Synthetic bootstrap disabled")
    with Session(connect(settings.database_url)) as db:
        org = db.scalar(select(Organization).where(Organization.name == "Synthetic Foods"))
        if not org:
            org = Organization(name="Synthetic Foods")
            db.add(org)
            db.flush()
            db.add(
                Product(
                    organization_id=org.id,
                    name="Synthetic strawberry",
                    category="TEST",
                    packaging_type="DEMO",
                )
            )
        for index, (name, roles) in enumerate(
            [("operator", ["ADMIN", "LOGISTICS"]), ("reviewer", ["QA"])], 1
        ):
            subject = settings.oidc_issuer + "|" + f"00000000-0000-4000-8000-{index:012d}"
            if db.scalar(select(User).where(User.identity_subject == subject)):
                continue
            user = User(identity_subject=subject, email=name + "@example.invalid", name=name)
            db.add(user)
            db.flush()
            membership = Membership(user_id=user.id, organization_id=org.id)
            db.add(membership)
            db.flush()
            for role in roles:
                db.add(MemberRole(membership_id=membership.id, role=role))
        db.commit()


if __name__ == "__main__":
    main()
