"""Synthetic-only object backup/restore drill. Never deletes source evidence."""

import hashlib
import io
import json
import zipfile
from uuid import uuid4

from app.config import Settings
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
                "archive_sha256": hashlib.sha256(archive.getvalue()).hexdigest(),
                "all_checksums_verified": True,
            }
        )
    )


if __name__ == "__main__":
    main()
