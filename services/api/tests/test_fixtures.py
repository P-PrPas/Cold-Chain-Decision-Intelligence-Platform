import csv
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures"


def test_independent_interval_oracles():
    expected = json.loads((ROOT / "expected.json").read_text())
    policy = json.loads((ROOT / "policy.json").read_text())
    assert policy["synthetic_only"] and policy["status"] == "DRAFT"
    for name in ("normal", "warning", "critical", "gaps", "irregular"):
        with (ROOT / (name + ".csv")).open() as stream:
            rows = list(csv.DictReader(stream))
        totals = {"in_band_seconds": 0, "out_of_band_seconds": 0, "unknown_seconds": 0}
        for left, right in zip(rows, rows[1:]):
            seconds = int(
                (
                    datetime.fromisoformat(right["timestamp"])
                    - datetime.fromisoformat(left["timestamp"])
                ).total_seconds()
            )
            value = Decimal(left["temperature_c"])
            category = (
                "unknown_seconds"
                if seconds > policy["max_gap_seconds"]
                else (
                    "in_band_seconds"
                    if Decimal(policy["min_c"]) <= value <= Decimal(policy["max_c"])
                    else "out_of_band_seconds"
                )
            )
            totals[category] += seconds
        assert totals == {key: expected[name][key] for key in totals}
        status = (
            "INDETERMINATE"
            if totals["unknown_seconds"]
            else (
                "CRITICAL"
                if totals["out_of_band_seconds"] >= policy["critical_at_seconds"]
                else (
                    "WARNING"
                    if totals["out_of_band_seconds"] >= policy["warning_at_seconds"]
                    else "NORMAL"
                )
            )
        )
        assert status == expected[name]["status"]


def test_invalid_fixture_evidence():
    def rows(name):
        with (ROOT / (name + ".csv")).open() as stream:
            return list(csv.DictReader(stream))

    duplicate = rows("duplicates")
    assert duplicate[0]["timestamp"] == duplicate[1]["timestamp"]
    assert duplicate[0]["temperature_c"] != duplicate[1]["temperature_c"]
    assert all(
        datetime.fromisoformat(row["timestamp"]).tzinfo is None for row in rows("unknown_timezone")
    )
    sensors = rows("multi_sensor_conflict")
    assert {row["sensor_id"] for row in sensors} == {"A", "B"}
    assert len({row["temperature_c"] for row in sensors}) == 2
