from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import Field, model_validator
from sqlalchemy import select

from app.access import DB, Current, audit, owned, remember, replay
from app.analytics import Rules
from app.contracts import Problem, request_hash
from app.jobs import enqueue
from app.models import Analysis, Dataset, Job, Policy, Scenario, Shipment, Simulation
from app.shipments import Strict, serialized
from app.simulation_engine import ScenarioInput, ScenarioType, Weights, calculate

router = APIRouter(prefix="/api/v1")


class SimulationInput(Strict):
    analysis_id: UUID
    dataset_id: UUID
    policy_version_id: UUID
    scenario_types: list[ScenarioType] = Field(min_length=1, max_length=4)
    currency: str = Field(pattern="^[A-Z]{3}$")
    scenarios: list[ScenarioInput] = Field(min_length=1, max_length=4)
    ranking_weights: Weights

    @model_validator(mode="after")
    def types_match(self) -> "SimulationInput":
        types = [s.type for s in self.scenarios]
        if len(set(types)) != len(types) or sorted(types) != sorted(self.scenario_types):
            raise ValueError("Scenario types must match unique scenario inputs")
        return self


def submit(
    shipment_id: str,
    payload: SimulationInput,
    request: Request,
    db: DB,
    current: Current,
    parent: str | None = None,
) -> dict[str, Any]:
    shipment = owned(db, Shipment, shipment_id, current)
    analysis = owned(db, Analysis, str(payload.analysis_id), current)
    dataset = owned(db, Dataset, str(payload.dataset_id), current)
    policy = owned(db, Policy, str(payload.policy_version_id), current)
    if (
        analysis.shipment_id != shipment.id
        or analysis.dataset_id != dataset.id
        or analysis.policy_version_id != policy.id
        or dataset.shipment_id != shipment.id
        or policy.product_id != shipment.product_id
    ):
        raise Problem(422, "POLICY_NOT_APPLICABLE", "Source chain mismatch")
    if analysis.status != "COMPLETED":
        raise Problem(409, "ANALYSIS_NOT_READY", "Completed analysis required")
    if dataset.status != "READY" or policy.status != "APPROVED":
        raise Problem(
            422, "UNAPPROVED_POLICY", "Ready dataset and currently approved policy required"
        )
    if payload.currency != shipment.currency:
        raise Problem(422, "VALIDATION_ERROR", "Currency must match shipment")
    try:
        calculate(
            analysis.result,
            Rules.model_validate(policy.rules),
            payload.scenarios,
            payload.ranking_weights,
            payload.currency,
        )
    except ValueError as exc:
        raise Problem(422, "VALIDATION_ERROR", str(exc)) from None
    key, fingerprint, existing = replay(db, current, request, payload.model_dump(mode="json"))
    if existing:
        return existing
    item = Simulation(
        organization_id=current.organization_id,
        shipment_id=shipment.id,
        analysis_id=analysis.id,
        dataset_id=dataset.id,
        policy_version_id=policy.id,
        parent_run_id=parent,
        parameters=payload.model_dump(mode="json"),
        input_sha256=request_hash(
            {
                "analysis": analysis.input_sha256,
                "parameters": payload.model_dump(mode="json"),
                "engine": "1.0.0",
                "template": "1.0.0",
            }
        ),
        currency=payload.currency,
        created_by=current.user_id,
    )
    db.add(item)
    db.flush()
    job = enqueue(db, current.organization_id, "SIMULATION", item.id)
    body = {"simulation": serialized(item), "job": serialized(job)}
    remember(db, current, request, key, fingerprint, body, 202)
    audit(db, current, request, "CREATE", "simulation", item.id, body)
    return body


@router.post("/shipments/{shipment_id}/simulations", status_code=202)
def create(
    shipment_id: UUID, payload: SimulationInput, request: Request, db: DB, current: Current
) -> dict[str, Any]:
    return submit(str(shipment_id), payload, request, db, current)


@router.post("/simulations/{simulation_id}/recalculate", status_code=202)
def recalculate(
    simulation_id: UUID, payload: SimulationInput, request: Request, db: DB, current: Current
) -> dict[str, Any]:
    parent = owned(db, Simulation, str(simulation_id), current)
    return submit(parent.shipment_id, payload, request, db, current, parent.id)


@router.get("/simulations/{simulation_id}")
def simulation(simulation_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    return {"simulation": serialized(owned(db, Simulation, str(simulation_id), current))}


@router.get("/simulations/{simulation_id}/scenarios")
def scenarios(simulation_id: UUID, db: DB, current: Current) -> dict[str, Any]:
    run = owned(db, Simulation, str(simulation_id), current)
    return {
        "items": [
            {"id": item.id, **item.result}
            for item in db.scalars(
                select(Scenario)
                .where(
                    Scenario.organization_id == current.organization_id,
                    Scenario.simulation_run_id == run.id,
                )
                .order_by(Scenario.type)
            )
        ],
        "next_cursor": None,
    }


def execute_simulation(db: DB, job: Job) -> None:
    run = db.scalar(
        select(Simulation)
        .where(Simulation.id == job.resource_id, Simulation.organization_id == job.organization_id)
        .with_for_update()
    )
    if not run:
        raise ValueError("RESOURCE_NOT_FOUND")
    if run.status == "COMPLETED":
        return
    analysis = db.scalar(
        select(Analysis).where(
            Analysis.id == run.analysis_id, Analysis.organization_id == job.organization_id
        )
    )
    policy = db.scalar(
        select(Policy).where(
            Policy.id == run.policy_version_id, Policy.organization_id == job.organization_id
        )
    )
    if not analysis or not policy:
        raise ValueError("SOURCE_CHAIN_INVALID")
    payload = SimulationInput.model_validate(run.parameters)
    for result in calculate(
        analysis.result,
        Rules.model_validate(policy.rules),
        payload.scenarios,
        payload.ranking_weights,
        run.currency,
    ):
        db.add(
            Scenario(
                organization_id=run.organization_id,
                simulation_run_id=run.id,
                type=result["type"],
                eligibility=result["eligibility"],
                incremental_cost=Decimal(result["direct_incremental_cost"]),
                currency=run.currency,
                delay_minutes=result["additional_delay_minutes"],
                result=result,
            )
        )
    run.status = "COMPLETED"
