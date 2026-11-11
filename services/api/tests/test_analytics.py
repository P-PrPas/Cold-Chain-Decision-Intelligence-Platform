import json
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
        result = analyze(rows, rules())
        assert result["classification"] == expected[name]["status"]
        if name != "multi_sensor_conflict":
            assert (
                result["summary"]["cumulative_excursion_seconds"]
                == expected[name]["out_of_band_seconds"]
            )
            assert result["summary"]["unknown_seconds"] == expected[name]["unknown_seconds"]
        assert analyze(rows, rules()) == result


def test_final_sample_and_unknown_never_extrapolated():
    rows, _ = normalize((ROOT / "gaps.csv").read_bytes(), MAPPING, None, "C")
    result = analyze(rows, rules())
    assert result["unknown_intervals"][0]["duration_seconds"] == 1200
    assert result["summary"]["cumulative_excursion_seconds"] == 0
    assert analyze(rows[:1], rules())["classification"] == "INDETERMINATE"
