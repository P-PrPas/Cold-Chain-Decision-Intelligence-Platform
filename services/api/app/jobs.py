import hashlib
import time
from typing import Any

from redis import Redis
from rq import Queue, SimpleWorker
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import connect
from app.models import Dataset, Job, Outbox, Reading
from app.storage import S3Store, Store
from app.temperature import normalize


def enqueue(db: Session, organization_id: str, kind: str, resource_id: str) -> Job:
    job = Job(
        organization_id=organization_id,
        type=kind,
        resource_id=resource_id,
        dedupe_key=kind + ":" + resource_id,
    )
    db.add(job)
    db.flush()
    db.add(Outbox(organization_id=organization_id, job_id=job.id))
    return job


def execute(db: Session, job: Job, store: Store) -> None:
    if job.status == "COMPLETED":
        return
    if job.type == "DATASET_IMPORT":
        dataset = db.scalar(
            select(Dataset)
            .where(Dataset.id == job.resource_id, Dataset.organization_id == job.organization_id)
            .with_for_update()
        )
        if not dataset:
            raise ValueError("RESOURCE_NOT_FOUND")
        if dataset.status == "READY":
            job.status = "COMPLETED"
            return
        content = store.get(dataset.raw_object_key)
        if hashlib.sha256(content).hexdigest() != dataset.sha256:
            raise ValueError("HASH_MISMATCH")
        rows, summary = normalize(
            content, dataset.mapping, dataset.source_timezone, dataset.default_unit
        )
        dataset.validation = summary
        dataset.row_count = summary["valid_rows"] + summary["invalid_rows"]
        dataset.status = "INVALID" if summary["errors"] else "READY"
        if rows:
            db.bulk_insert_mappings(
                Reading.__mapper__,
                [
                    {**row, "organization_id": job.organization_id, "dataset_id": dataset.id}
                    for row in rows
                ],
            )
    elif job.type == "ANALYSIS":
        from app.analyses import execute_analysis

        execute_analysis(db, job)
    elif job.type == "SIMULATION":
        from app.simulations import execute_simulation

        execute_simulation(db, job)
    else:
        raise ValueError("UNKNOWN_JOB")
    job.status = "COMPLETED"


def run_job(job_id: str, organization_id: str) -> None:
    settings = Settings()
    engine = connect(settings.database_url)
    try:
        with Session(engine) as db:
            job = db.scalar(
                select(Job)
                .where(Job.id == job_id, Job.organization_id == organization_id)
                .with_for_update()
            )
            if not job or job.status == "COMPLETED":
                return
            job.attempt_count += 1
            try:
                with db.begin_nested():
                    job.status = "RUNNING"
                    execute(db, job, S3Store(settings))
                    db.flush()
            except Exception:
                job.status = "FAILED"
                job.error_code = "PROCESSING_FAILED"
            db.commit()
    finally:
        engine.dispose()


def dispatch(db: Session, queue: Any) -> None:
    for event in db.scalars(
        select(Outbox).where(Outbox.status == "PENDING").with_for_update(skip_locked=True).limit(25)
    ):
        queue.enqueue(
            run_job, event.job_id, event.organization_id, job_timeout=300, result_ttl=3600
        )
        event.status = "DELIVERED"
        event.attempt_count += 1
    db.commit()


def main() -> None:
    settings = Settings()
    engine = connect(settings.database_url)
    redis = Redis.from_url(settings.redis_url)
    queue = Queue("coldchain", connection=redis)
    while True:
        try:
            with Session(engine) as db:
                dispatch(db, queue)
            SimpleWorker([queue], connection=redis).work(burst=True)
        except Exception:
            pass  # Durable PENDING events are retried; no payload/secrets in logs.
        time.sleep(2)


if __name__ == "__main__":
    main()
