from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, model_validator

from app.shipments import Strict

Effect = Literal["HARD_BLOCK", "REVIEW_REQUIRED", "ADVISORY"]
ENGINE_VERSION = "1.1.0"


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def coverage_window(start: datetime, end: datetime) -> dict[str, str]:
    return {
        "start_at": utc(start).isoformat(),
        "end_at": utc(end).isoformat(),
    }


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
    duration_limit_comparison: Literal["AT_OR_ABOVE"] = Field(
        default="AT_OR_ABOVE",
        description="Duration equal to the limit matches the rule; QA approves this inclusive threshold semantics.",
    )
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


def analyze(
    readings: list[dict[str, Any]],
    rules: Rules,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
) -> dict[str, Any]:
    if not rules.complete():
        raise ValueError("UNAPPROVED_POLICY")
    low = rules.temperature_bounds.min_c
    high = rules.temperature_bounds.max_c
    assert low is not None and high is not None
    readings = [{**row, "timestamp_utc": utc(row["timestamp_utc"])} for row in readings]
    window_known = window_start is not None and window_end is not None
    if window_known:
        assert window_start is not None and window_end is not None
        window_start = (
            window_start.replace(tzinfo=UTC)
            if window_start.tzinfo is None
            else window_start.astimezone(UTC)
        )
        window_end = (
            window_end.replace(tzinfo=UTC)
            if window_end.tzinfo is None
            else window_end.astimezone(UTC)
        )
        if window_end <= window_start:
            raise ValueError("INVALID_COVERAGE_WINDOW")
        readings = [
            r
            for r in readings
            if window_start <= r["timestamp_utc"].replace(tzinfo=UTC) <= window_end
        ]
    sensors: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in readings:
        sensors[row["sensor_id"]].append(row)
    events = []
    gaps = []
    sensor_results = []
    unknown = 0.0
    total = 0
    maximum = 0
    rule_results = []
    unbounded_observations = []
    missing = set(rules.required_sensor_ids) - set(sensors)
    ambiguous = set(sensors) - set(rules.required_sensor_ids)
    for sensor in sorted(set(sensors) | set(rules.required_sensor_ids)):
        samples = sorted(sensors[sensor], key=lambda row: row["timestamp_utc"])
        active = None
        cumulative = 0
        continuous = 0
        sensor_unknown = 0.0
        if window_known and sensor in rules.required_sensor_ids:
            assert window_start is not None and window_end is not None
            boundaries = (
                [
                    (window_start, samples[0]["timestamp_utc"].replace(tzinfo=UTC)),
                    (samples[-1]["timestamp_utc"].replace(tzinfo=UTC), window_end),
                ]
                if samples
                else [(window_start, window_end)]
            )
            for start, end in boundaries:
                seconds = (end - start).total_seconds()
                if seconds > 0:
                    sensor_unknown += seconds
                    gaps.append(
                        {
                            "sensor_id": sensor,
                            "start_at": start.isoformat(),
                            "end_at": end.isoformat(),
                            "duration_seconds": seconds,
                            "classification": "UNKNOWN",
                            "reason": "UNCOVERED_SHIPMENT_BOUNDARY",
                        }
                    )
        for index, sample in enumerate(samples):
            value = Decimal(str(sample["temperature_c"]))
            if (value < low or value > high) and (
                index == len(samples) - 1
                or (samples[index + 1]["timestamp_utc"] - sample["timestamp_utc"]).total_seconds()
                > rules.max_valid_sampling_gap_seconds
            ):
                unbounded_observations.append(
                    {
                        "sensor_id": sensor,
                        "at": sample["timestamp_utc"].replace(tzinfo=UTC).isoformat(),
                        "temperature_c": str(value),
                        "duration_seconds": 0,
                        "reason": "OUT_OF_RANGE_WITHOUT_OBSERVED_DURATION",
                    }
                )
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
        (
            "R-DATA",
            bool(unknown or missing or ambiguous or unbounded_observations or not window_known),
            "REVIEW_REQUIRED",
        ),
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
        "CRITICAL"
        if hard
        else "INDETERMINATE"
        if unknown or missing or ambiguous or unbounded_observations or not window_known
        else "WARNING"
        if review
        else "NORMAL"
    )
    for event in events:
        event_effects = [
            effect
            for limit, effect in [
                (rules.continuous_excursion_limit_seconds, rules.continuous_effect),
                (rules.cumulative_excursion_limit_seconds, rules.cumulative_effect),
            ]
            if event["duration_seconds"] >= int(limit or 0)
        ]
        event["classification"] = (
            "CRITICAL"
            if "HARD_BLOCK" in event_effects
            else "WARNING"
            if "REVIEW_REQUIRED" in event_effects
            else "NORMAL"
        )
        event["classification_basis"] = "EVENT_DURATION_ONLY"
    values = [Decimal(str(row["temperature_c"])) for row in readings]
    return {
        "classification": classification,
        "coverage_window": {"start_at": window_start.isoformat(), "end_at": window_end.isoformat()}
        if window_known and window_start and window_end
        else None,
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
            "unbounded_out_of_range_observations": unbounded_observations,
            "coverage_window_known": window_known,
        },
        "rule_results": rule_results,
        "excursions": events,
        "unknown_intervals": gaps,
    }
