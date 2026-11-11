"""Synthetic-only object backup/restore drill. Never deletes source evidence."""

import hashlib
import io
import json
import os
import zipfile
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import Settings
from app.contracts import request_hash
from app.db import connect, set_tenant
from app.models import Dataset, Decision, Organization, ReferenceDocument, Report
from app.storage import S3Store


def main() -> None:
    settings = Settings()
    if not settings.synthetic_only:
        raise RuntimeError("Use an owner-approved production backup procedure")
    store = S3Store(settings)
    archive = io.BytesIO()
    manifest = {}
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as backup:
        for page in store.client.get_paginator("list_objects_v2").paginate(Bucket=store.bucket):
            for item in page.get("Contents", []):
                key = item["Key"]
                content = store.get(key)
                manifest[key] = hashlib.sha256(content).hexdigest()
                backup.writestr(key, content)
    assert manifest, "Restore drill requires nonempty synthetic evidence"
    database_url = settings.database_url
    if target := os.environ.get("CC_RECOVERY_DATABASE"):
        database_url = (
            make_url(database_url).set(database=target).render_as_string(hide_password=False)
        )
    verified_references = 0
    engine = connect(database_url)
    with Session(engine) as db:
        for organization in db.scalars(select(Organization)):
            set_tenant(db, organization.id)
            for statement in [
                select(Dataset.raw_object_key, Dataset.sha256).where(
                    Dataset.organization_id == organization.id
                ),
                select(ReferenceDocument.object_key, ReferenceDocument.sha256).where(
                    ReferenceDocument.organization_id == organization.id
                ),
                select(Report.object_key, Report.sha256).where(
                    Report.organization_id == organization.id, Report.object_key.is_not(None)
                ),
            ]:
                for object_key, checksum in db.execute(statement):
                    assert object_key is not None
                    assert manifest.get(object_key) == checksum, "Database/object evidence mismatch"
                    verified_references += 1
            for decision in db.scalars(
                select(Decision).where(
                    Decision.organization_id == organization.id,
                    Decision.snapshot_sha256.is_not(None),
                )
            ):
                assert decision.snapshot is not None
                assert request_hash(decision.snapshot) == decision.snapshot_sha256, (
                    "Decision snapshot mismatch"
                )
    engine.dispose()
    assert verified_references > 0, "No restored database evidence references"
    restored_bucket = "verify-restore-" + uuid4().hex
    store.client.create_bucket(Bucket=restored_bucket)
    with zipfile.ZipFile(io.BytesIO(archive.getvalue())) as backup:
        for key, checksum in manifest.items():
            content = backup.read(key)
            store.client.put_object(Bucket=restored_bucket, Key=key, Body=content)
            restored = store.client.get_object(Bucket=restored_bucket, Key=key)["Body"].read()
            assert hashlib.sha256(restored).hexdigest() == checksum
    print(
        json.dumps(
            {
                "restored_objects": len(manifest),
                "verified_database_references": verified_references,
                "archive_sha256": hashlib.sha256(archive.getvalue()).hexdigest(),
                "all_checksums_verified": True,
            }
        )
    )


if __name__ == "__main__":
    main()
