import hashlib
import logging
import time
from datetime import timedelta
from typing import Any

from redis import Redis
from rq import Queue, SimpleWorker
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import connect, now, set_tenant
from app.models import (
    Analysis,
    Dataset,
    Explanation,
    Job,
    Organization,
    Outbox,
    Reading,
    Report,
    Simulation,
)
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
        if rows:
            db.bulk_insert_mappings(
                Reading.__mapper__,
                [
                    {**row, "organization_id": job.organization_id, "dataset_id": dataset.id}
                    for row in rows
                ],
            )
        dataset.status = "INVALID" if summary["errors"] else "READY"
    elif job.type == "ANALYSIS":
        from app.analyses import execute_analysis

        execute_analysis(db, job)
    elif job.type == "SIMULATION":
        from app.simulations import execute_simulation

        execute_simulation(db, job)
    elif job.type == "EXPLANATION":
        from app.explanations import execute_explanation

        execute_explanation(db, job)
    elif job.type == "REPORT":
        from app.reports import execute_report

        execute_report(db, job, store)
    else:
        raise ValueError("UNKNOWN_JOB")
    job.status = "COMPLETED"


def run_job(job_id: str, organization_id: str) -> None:
    settings = Settings()
    engine = connect(settings.database_url)
    try:
        with Session(engine) as db:
            set_tenant(db, organization_id)
            job = db.scalar(
                select(Job)
                .where(Job.id == job_id, Job.organization_id == organization_id)
                .with_for_update()
            )
            if not job or job.status == "COMPLETED" or job.attempt_count >= 3:
                return
            job.attempt_count += 1
            try:
                with db.begin_nested():
                    job.status = "RUNNING"
                    execute(db, job, S3Store(settings))
                    db.flush()
            except Exception as exc:
                logging.getLogger(__name__).error(
                    "job_failed type=%s error_type=%s", job.type, type(exc).__name__
                )
                job.status = "FAILED"
                job.error_code = "PROCESSING_FAILED"
                resource_models: dict[str, Any] = {
                    "DATASET_IMPORT": Dataset,
                    "ANALYSIS": Analysis,
                    "SIMULATION": Simulation,
                    "EXPLANATION": Explanation,
                    "REPORT": Report,
                }
                model = resource_models.get(job.type)
                if model:
                    resource = db.scalar(
                        select(model).where(
                            model.id == job.resource_id,
                            model.organization_id == job.organization_id,
                        )
                    )
                    if resource and resource.status not in {"READY", "COMPLETED", "INVALID"}:
                        resource.status = "FAILED"
                if job.attempt_count < 3:
                    event = db.scalar(
                        select(Outbox).where(
                            Outbox.organization_id == job.organization_id, Outbox.job_id == job.id
                        )
                    )
                    if event:
                        event.status = "PENDING"

            db.commit()
    finally:
        engine.dispose()


def dispatch(db: Session, queue: Any) -> None:
    for event in db.scalars(
        select(Outbox)
        .join(Job, (Job.id == Outbox.job_id) & (Job.organization_id == Outbox.organization_id))
        .where(
            Job.status != "COMPLETED",
            Job.attempt_count < 3,
            (Outbox.status == "PENDING")
            | ((Job.status == "QUEUED") & (Outbox.created_at < now() - timedelta(minutes=5))),
        )
        .with_for_update(skip_locked=True)
        .limit(25)
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
                organizations = list(
                    db.scalars(select(Organization.id).where(Organization.status == "ACTIVE"))
                )
                for organization_id in organizations:
                    set_tenant(db, organization_id)
                    dispatch(db, queue)
            SimpleWorker([queue], connection=redis).work(burst=True)
        except Exception:
            logging.getLogger(__name__).error("worker_dispatch_unavailable")
        time.sleep(2)


if __name__ == "__main__":
    main()
