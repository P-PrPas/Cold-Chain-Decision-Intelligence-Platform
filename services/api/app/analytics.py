from collections import defaultdict
from datetime import UTC
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, model_validator

from app.shipments import Strict

Effect = Literal["HARD_BLOCK", "REVIEW_REQUIRED", "ADVISORY"]


class Bounds(Strict):
    min_c: Decimal | None = Field(default=None, allow_inf_nan=False)
    max_c: Decimal | None = Field(default=None, allow_inf_nan=False)


class Constraint(Strict):
    scenario_type: Literal[
        "CONTINUE_DELIVERY", "HOLD_INSPECTION", "CONDITIONAL_REROUTE", "REJECT_QUARANTINE_DISPOSE"
    ]
    effect: Effect


class Rules(Strict):
    schema_version: Literal["1.0"] = "1.0"
    required_sensor_ids: list[str] = Field(min_length=1, max_length=20)
    max_valid_sampling_gap_seconds: int = Field(gt=0, le=86400)
    temperature_bounds: Bounds
    continuous_excursion_limit_seconds: int | None = Field(default=None, gt=0)
    cumulative_excursion_limit_seconds: int | None = Field(default=None, gt=0)
    continuous_effect: Effect = "REVIEW_REQUIRED"
    cumulative_effect: Effect = "HARD_BLOCK"
    unknown_gap_effect: Literal["REVIEW_REQUIRED"] = "REVIEW_REQUIRED"
    action_constraints: list[Constraint] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def unique_sensors(self) -> "Rules":
        if len(set(self.required_sensor_ids)) != len(self.required_sensor_ids) or any(
            not s or len(s) > 100 for s in self.required_sensor_ids
        ):
            raise ValueError("Invalid sensor requirements")
        return self

    def complete(self) -> bool:
        bounds = self.temperature_bounds
        return (
            bounds.min_c is not None
            and bounds.max_c is not None
            and bounds.min_c < bounds.max_c
            and self.continuous_excursion_limit_seconds is not None
            and self.cumulative_excursion_limit_seconds is not None
        )


def analyze(readings: list[dict[str, Any]], rules: Rules) -> dict[str, Any]:
    if not rules.complete():
        raise ValueError("UNAPPROVED_POLICY")
    low = rules.temperature_bounds.min_c
    high = rules.temperature_bounds.max_c
    assert low is not None and high is not None
    sensors: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in readings:
        sensors[row["sensor_id"]].append(row)
    events = []
    gaps = []
    sensor_results = []
    unknown = 0
    total = 0
    maximum = 0
    rule_results = []
    missing = set(rules.required_sensor_ids) - set(sensors)
    ambiguous = set(sensors) - set(rules.required_sensor_ids)
    for sensor in sorted(sensors):
        samples = sorted(sensors[sensor], key=lambda row: row["timestamp_utc"])
        active = None
        cumulative = 0
        continuous = 0
        sensor_unknown = 0
        for left, right in zip(samples, samples[1:]):
            start = left["timestamp_utc"]
            end = right["timestamp_utc"]
            seconds = int((end - start).total_seconds())
            value = Decimal(str(left["temperature_c"]))
            if seconds <= 0:
                raise ValueError("CONFLICTING_READINGS")
            if seconds > rules.max_valid_sampling_gap_seconds:
                sensor_unknown += seconds
                active = None
                continuous = 0
                gaps.append(
                    {
                        "sensor_id": sensor,
                        "start_at": start.replace(tzinfo=UTC).isoformat(),
                        "end_at": end.replace(tzinfo=UTC).isoformat(),
                        "duration_seconds": seconds,
                        "classification": "UNKNOWN",
                    }
                )
            elif value < low or value > high:
                cumulative += seconds
                continuous += seconds
                maximum = max(maximum, continuous)
                if active is None:
                    active = {
                        "sensor_id": sensor,
                        "start_at": start.replace(tzinfo=UTC).isoformat(),
                        "end_at": end.replace(tzinfo=UTC).isoformat(),
                        "duration_seconds": 0,
                        "min_c": str(value),
                        "max_c": str(value),
                        "peak_deviation_c": "0",
                        "rule_id": "R-CONTINUOUS",
                    }
                    events.append(active)
                active["end_at"] = end.replace(tzinfo=UTC).isoformat()
                active["duration_seconds"] += seconds
                active["min_c"] = str(min(Decimal(active["min_c"]), value))
                active["max_c"] = str(max(Decimal(active["max_c"]), value))
                active["peak_deviation_c"] = str(
                    max(Decimal(active["peak_deviation_c"]), low - value, value - high)
                )
            else:
                active = None
                continuous = 0
        if len(samples) < 2:
            missing.add(sensor)
        sensor_results.append(
            {
                "sensor_id": sensor,
                "cumulative_excursion_seconds": cumulative,
                "unknown_seconds": sensor_unknown,
            }
        )
        total = max(total, cumulative)
        unknown += sensor_unknown
    for identifier, matched, effect in [
        (
            "R-CONTINUOUS",
            maximum >= int(rules.continuous_excursion_limit_seconds or 0),
            rules.continuous_effect,
        ),
        (
            "R-CUMULATIVE",
            total >= int(rules.cumulative_excursion_limit_seconds or 0),
            rules.cumulative_effect,
        ),
        ("R-DATA", bool(unknown or missing or ambiguous), "REVIEW_REQUIRED"),
    ]:
        rule_results.append(
            {
                "rule_id": identifier,
                "matched": matched,
                "effect": effect,
                "source_ref": "policy:" + identifier,
            }
        )
    hard = any(r["matched"] and r["effect"] == "HARD_BLOCK" for r in rule_results)
    review = any(r["matched"] and r["effect"] == "REVIEW_REQUIRED" for r in rule_results)
    classification = (
        "INDETERMINATE"
        if unknown or missing or ambiguous
        else ("CRITICAL" if hard else ("WARNING" if review else "NORMAL"))
    )
    for event in events:
        event["classification"] = classification
    values = [Decimal(str(row["temperature_c"])) for row in readings]
    return {
        "classification": classification,
        "summary": {
            "excursion_count": len(events),
            "cumulative_excursion_seconds": total,
            "maximum_continuous_seconds": maximum,
            "unknown_seconds": unknown,
            "min_c": str(min(values)) if values else None,
            "max_c": str(max(values)) if values else None,
            "sensor_results": sensor_results,
            "missing_sensors": sorted(missing),
            "unspecified_sensors": sorted(ambiguous),
        },
        "rule_results": rule_results,
        "excursions": events,
        "unknown_intervals": gaps,
    }
