import asyncio
from typing import Any, Protocol
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import Field
from sqlalchemy import select

from app.access import DB, Current, owned, remember, replay
from app.contracts import Problem
from app.jobs import enqueue
from app.models import Explanation, Job, Scenario, Simulation
from app.shipments import Strict, serialized


class Provider(Protocol):
    async def select_facts(self, facts: dict[str, str]) -> dict[str, Any]: ...


class Selection(Strict):
    fact_ids: list[str] = Field(max_length=20)


async def bounded_explanation(
    facts: dict[str, str], provider: Provider | None = None
) -> dict[str, Any]:
    selected = list(facts)
    model = "deterministic-template"
    if provider:
        try:
            response = Selection.model_validate(
                await asyncio.wait_for(provider.select_facts(dict(facts)), timeout=2)
            )
            if not response.fact_ids or any(key not in facts for key in response.fact_ids):
                raise ValueError("Ungrounded reference")
            selected = response.fact_ids
            model = "bounded-provider-selection"
        except Exception:
            pass
    # Provider selects known facts only: text, amounts and eligibility are never generated authority.
    return {
        "model": model,
        "summary": "Review the pinned deterministic scenario evidence.",
        "key_findings": [{"text": facts[key], "source_references": [key]} for key in selected],
        "scenario_explanations": [],
        "uncertainties": ["No validated loss probability or food-safety certification."],
        "required_reviews": ["Independent QA review"],
        "source_references": selected,
    }


router = APIRouter(prefix="/api/v1")


@router.post("/simulations/{simulation_id}/explanations", status_code=202)
def create(simulation_id: UUID, request: Request, db: DB, current: Current) -> dict[str, Any]:
    run = owned(db, Simulation, str(simulation_id), current)
    if run.status != "COMPLETED":
        raise Problem(409, "SIMULATION_NOT_READY", "Completed run required")
    key, fingerprint, existing = replay(db, current, request, {"simulation_id": run.id})
    if existing:
        return existing
    item = Explanation(
        organization_id=current.organization_id,
        simulation_run_id=run.id,
        source_digest=run.input_sha256,
    )
    db.add(item)
    db.flush()
    job = enqueue(db, current.organization_id, "EXPLANATION", item.id)
    body = {"explanation": serialized(item), "job": serialized(job)}
    remember(db, current, request, key, fingerprint, body, 202)
    return body


@router.get("/simulations/{simulation_id}/explanations/latest")
def latest(simulation_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    owned(db, Simulation, str(simulation_id), current)
    item = db.scalar(
        select(Explanation)
        .where(
            Explanation.organization_id == current.organization_id,
            Explanation.simulation_run_id == str(simulation_id),
        )
        .order_by(Explanation.created_at.desc(), Explanation.id.desc())
    )
    if not item:
        raise Problem(404, "RESOURCE_NOT_FOUND", "No explanation yet")
    return {"explanation": {**serialized(item), **item.content}}


def execute_explanation(db: DB, job: Job) -> None:
    item = db.scalar(
        select(Explanation)
        .where(
            Explanation.id == job.resource_id, Explanation.organization_id == job.organization_id
        )
        .with_for_update()
    )
    if not item:
        raise ValueError("RESOURCE_NOT_FOUND")
    if item.status == "COMPLETED":
        return
    scenarios = list(
        db.scalars(
            select(Scenario).where(
                Scenario.organization_id == job.organization_id,
                Scenario.simulation_run_id == item.simulation_run_id,
            )
        )
    )
    facts = {
        "scenario:"
        + s.id: f"{s.type}: {s.eligibility}; direct cost {s.incremental_cost} {s.currency}; delay {s.delay_minutes} minutes."
        for s in scenarios
    }
    item.content = asyncio.run(bounded_explanation(facts))
    item.model = item.content["model"]
    item.status = "COMPLETED"
