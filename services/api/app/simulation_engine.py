from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, model_validator

from app.analytics import Rules
from app.contracts import Money
from app.shipments import Strict

ScenarioType = Literal[
    "CONTINUE_DELIVERY", "HOLD_INSPECTION", "CONDITIONAL_REROUTE", "REJECT_QUARANTINE_DISPOSE"
]


class Cost(Strict):
    amount: Money
    source: Literal["USER_ESTIMATE", "CONFIRMED"]


class Costs(Strict):
    additional_transport: Cost
    inspection: Cost
    holding: Cost
    handling: Cost
    disposal: Cost
    other: Cost


class ScenarioInput(Strict):
    type: ScenarioType
    estimated_delay_minutes: int = Field(ge=0, le=525600)
    receiver_acceptance: Literal["ACCEPTED", "REJECTED", "UNKNOWN"] = "UNKNOWN"
    costs: Costs


class Weights(Strict):
    cost: Decimal = Field(ge=0, le=1, allow_inf_nan=False)
    delay: Decimal = Field(ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def sum_one(self) -> "Weights":
        if self.cost + self.delay != Decimal(1):
            raise ValueError("Weights must sum to exactly one")
        return self


def calculate(
    analysis: dict[str, Any],
    rules: Rules,
    scenarios: list[ScenarioInput],
    weights: Weights,
    currency: str,
) -> list[dict[str, Any]]:
    results = []
    hard = any(
        rule["matched"] and rule["effect"] == "HARD_BLOCK" for rule in analysis["rule_results"]
    )
    review = any(
        rule["matched"] and rule["effect"] == "REVIEW_REQUIRED" for rule in analysis["rule_results"]
    )
    for scenario in scenarios:
        missing = []
        eligibility = "ELIGIBLE"
        release = scenario.type in {"CONTINUE_DELIVERY", "CONDITIONAL_REROUTE"}
        constraints = [c for c in rules.action_constraints if c.scenario_type == scenario.type]
        if any(c.effect == "HARD_BLOCK" for c in constraints) or (release and hard):
            eligibility = "BLOCKED"
        elif release and (
            analysis["classification"] == "INDETERMINATE"
            or scenario.receiver_acceptance == "UNKNOWN"
        ):
            eligibility = "INSUFFICIENT_DATA"
            missing = ["VALID_DATA_AND_RECEIVER_ACCEPTANCE"]
        elif release and scenario.receiver_acceptance == "REJECTED":
            eligibility = "BLOCKED"
        elif not release or review or any(c.effect == "REVIEW_REQUIRED" for c in constraints):
            eligibility = "REVIEW_REQUIRED"
        components = {
            name: format(getattr(scenario.costs, name).amount, ".2f") for name in Costs.model_fields
        }
        total = sum((Decimal(v) for v in components.values()), Decimal(0))
        if currency == "JPY" and any(
            Decimal(v) != Decimal(v).to_integral_value() for v in components.values()
        ):
            raise ValueError("JPY requires integral amounts")
        if total >= Decimal("10000000000000000"):
            raise ValueError("Total exceeds supported precision")
        results.append(
            {
                "type": scenario.type,
                "eligibility": eligibility,
                "requires_qa_approval": True,
                "direct_incremental_cost": format(total, ".2f"),
                "expected_incremental_cost": None,
                "probability": "unknown",
                "currency": currency,
                "additional_delay_minutes": scenario.estimated_delay_minutes,
                "risk_classification": analysis["classification"],
                "ranking_score": None,
                "rule_results": analysis["rule_results"],
                "missing_information": missing,
                "cost_components": components,
                "cost_sources": {
                    name: getattr(scenario.costs, name).source for name in Costs.model_fields
                },
                "receiver_acceptance": scenario.receiver_acceptance,
            }
        )
    eligible = [r for r in results if r["eligibility"] == "ELIGIBLE"]
    if eligible:
        costs = [Decimal(r["direct_incremental_cost"]) for r in eligible]
        delays = [Decimal(r["additional_delay_minutes"]) for r in eligible]
        for result in eligible:
            cost = (Decimal(result["direct_incremental_cost"]) - min(costs)) / (
                max(costs) - min(costs) or Decimal(1)
            )
            delay = (Decimal(result["additional_delay_minutes"]) - min(delays)) / (
                max(delays) - min(delays) or Decimal(1)
            )
            result["ranking_score"] = format(
                (cost * weights.cost + delay * weights.delay).quantize(Decimal("0.000001")), ".6f"
            )
    return results
