import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from test_temperature import MAPPING

from app.analytics import Rules, analyze
from app.temperature import normalize

ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures"


def rules():
    return Rules(
        required_sensor_ids=["A"],
        max_valid_sampling_gap_seconds=600,
        temperature_bounds={"min_c": "2", "max_c": "8"},
        continuous_excursion_limit_seconds=300,
        cumulative_excursion_limit_seconds=600,
    )


def test_engine_matches_checked_oracles():
    expected = json.loads((ROOT / "expected.json").read_text())
    for name in ["normal", "warning", "critical", "gaps", "irregular", "multi_sensor_conflict"]:
        rows, _ = normalize((ROOT / (name + ".csv")).read_bytes(), MAPPING, None, "C")
        result = analyze(rows, rules(), rows[0]["timestamp_utc"], rows[-1]["timestamp_utc"])
        assert result["classification"] == expected[name]["status"]
        if name != "multi_sensor_conflict":
            assert (
                result["summary"]["cumulative_excursion_seconds"]
                == expected[name]["out_of_band_seconds"]
            )
            assert result["summary"]["unknown_seconds"] == expected[name]["unknown_seconds"]
        assert analyze(rows, rules(), rows[0]["timestamp_utc"], rows[-1]["timestamp_utc"]) == result


def test_final_sample_and_unknown_never_extrapolated():
    rows, _ = normalize((ROOT / "gaps.csv").read_bytes(), MAPPING, None, "C")
    result = analyze(rows, rules())
    assert result["unknown_intervals"][0]["duration_seconds"] == 1200
    assert result["summary"]["cumulative_excursion_seconds"] == 0
    assert analyze(rows[:1], rules())["classification"] == "INDETERMINATE"


def test_boundary_golden_fixtures_cannot_release():
    from app.simulation_engine import ScenarioInput, Weights, calculate

    expected = json.loads((ROOT / "boundary_expected.json").read_text())
    scenario = ScenarioInput(
        type="CONTINUE_DELIVERY",
        estimated_delay_minutes=0,
        receiver_acceptance="ACCEPTED",
        costs={
            name: {"amount": "0.00", "source": "USER_ESTIMATE"}
            for name in [
                "additional_transport",
                "inspection",
                "holding",
                "handling",
                "disposal",
                "other",
            ]
        },
    )
    for name, oracle in expected.items():
        rows, _ = normalize((ROOT / (name + ".csv")).read_bytes(), MAPPING, None, "C")
        result = analyze(
            rows,
            rules(),
            datetime(2026, 1, 1, tzinfo=UTC),
            datetime.fromisoformat(oracle["arrival"]),
        )
        assert result["classification"] == oracle["classification"]
        assert result["summary"]["unknown_seconds"] == oracle["unknown_seconds"]
        assert result["summary"]["cumulative_excursion_seconds"] == oracle["excursion_seconds"]
        release = calculate(result, rules(), [scenario], Weights(cost="0.5", delay="0.5"), "THB")[0]
        assert release["eligibility"] == oracle["release"]
        assert release["ranking_score"] is None
        if name == "final_hot":
            assert (
                result["summary"]["unbounded_out_of_range_observations"][0]["temperature_c"]
                == "40.000"
            )
        if name == "hard_block_gap":
            assert result["excursions"][0]["classification"] == "CRITICAL"


def test_missing_window_and_missing_sensor_fail_closed():
    rows, _ = normalize((ROOT / "normal.csv").read_bytes(), MAPPING, None, "C")
    assert analyze(rows, rules())["classification"] == "INDETERMINATE"
    result = analyze(
        [], rules(), datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)
    )
    assert result["summary"]["unknown_seconds"] == 86400
    assert result["classification"] == "INDETERMINATE"


def test_inclusive_thresholds_and_event_severity_are_local():
    start = datetime(2026, 1, 1, tzinfo=UTC)
    for duration, expected in [(299, "NORMAL"), (300, "WARNING"), (301, "WARNING")]:
        rows = [
            {"sensor_id": "A", "timestamp_utc": start, "temperature_c": "10"},
            {
                "sensor_id": "A",
                "timestamp_utc": start + timedelta(seconds=duration),
                "temperature_c": "2",
            },
        ]
        result = analyze(rows, rules(), start, rows[-1]["timestamp_utc"])
        assert result["classification"] == expected
        assert result["excursions"][0]["classification"] == expected
    rows = [
        {
            "sensor_id": "A",
            "timestamp_utc": start + timedelta(seconds=i * 300),
            "temperature_c": value,
        }
        for i, value in enumerate(["10", "2", "10", "2"])
    ]
    result = analyze(rows, rules(), start, rows[-1]["timestamp_utc"])
    assert result["classification"] == "CRITICAL"
    assert [e["classification"] for e in result["excursions"]] == ["WARNING", "WARNING"]
    assert rules().model_dump()["duration_limit_comparison"] == "AT_OR_ABOVE"


def test_short_uncovered_boundaries_are_unknown_for_each_required_sensor():
    start = datetime(2026, 1, 1, tzinfo=UTC)
    rows = [
        {"sensor_id": sensor, "timestamp_utc": start + timedelta(seconds=at), "temperature_c": "4"}
        for sensor, times in [("A", [0, 300, 600, 900]), ("B", [300, 600])]
        for at in times
    ]
    policy = rules().model_copy(update={"required_sensor_ids": ["A", "B"]})
    result = analyze(rows, policy, start, start + timedelta(seconds=900))
    assert result["classification"] == "INDETERMINATE"
    assert result["summary"]["unknown_seconds"] == 600
    assert [(gap["sensor_id"], gap["duration_seconds"]) for gap in result["unknown_intervals"]] == [
        ("B", 300),
        ("B", 300),
    ]
