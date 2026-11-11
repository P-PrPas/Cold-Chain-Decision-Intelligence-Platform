import csv
import io
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.contracts import Problem


def timestamp(value: str, source_timezone: str | None) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo:
        return parsed.astimezone(UTC)
    if not source_timezone:
        raise ValueError("TIMEZONE_REQUIRED")
    zone = ZoneInfo(source_timezone)
    candidates = {
        parsed.replace(tzinfo=zone, fold=fold).astimezone(UTC)
        for fold in (0, 1)
        if parsed.replace(tzinfo=zone, fold=fold)
        .astimezone(UTC)
        .astimezone(zone)
        .replace(tzinfo=None)
        == parsed
    }
    if len(candidates) != 1:
        raise ValueError("AMBIGUOUS_OR_NONEXISTENT_TIME")
    return candidates.pop()


def normalize(
    content: bytes, mapping: dict[str, str], timezone: str | None, unit: str
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if len(content) > 10 * 1024 * 1024:
        raise Problem(413, "FILE_TOO_LARGE", "CSV exceeds 10 MB")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise Problem(422, "VALIDATION_ERROR", "CSV must be UTF-8") from None
    if "\x00" in text:
        raise Problem(422, "VALIDATION_ERROR", "NUL bytes are not allowed")
    reader = csv.DictReader(io.StringIO(text))
    if (
        not reader.fieldnames
        or len(reader.fieldnames) != len(set(reader.fieldnames))
        or not {mapping.get("timestamp"), mapping.get("temperature")}.issubset(reader.fieldnames)
    ):
        raise Problem(422, "COLUMN_MAPPING_REQUIRED", "Timestamp and temperature headers required")
    if any(column not in reader.fieldnames for column in mapping.values()):
        raise Problem(422, "COLUMN_MAPPING_REQUIRED", "Mapped column absent")
    if unit not in {"C", "F"}:
        raise Problem(422, "VALIDATION_ERROR", "Unit must be C or F")
    rows = []
    errors: list[dict[str, Any]] = []
    count = 0
    duplicates = 0
    seen = set()
    previous = None
    out_of_order = 0
    for count, row in enumerate(reader, start=1):
        if count > 100000:
            raise Problem(413, "FILE_TOO_LARGE", "CSV exceeds 100000 rows")
        try:
            if None in row or any(value is None for value in row.values()):
                raise ValueError("MALFORMED_ROW")
            at = timestamp(row[mapping["timestamp"]], timezone)
            value = Decimal(row[mapping["temperature"]])
            if not value.is_finite():
                raise ValueError("NOT_FINITE")
            if unit == "F":
                value = (value - Decimal(32)) * Decimal(5) / Decimal(9)
            value = value.quantize(Decimal("0.001"))
            if abs(value) >= Decimal("100000"):
                raise ValueError("OUT_OF_RANGE")
            sensor = row[mapping["sensor_id"]] if "sensor_id" in mapping else "default"
            if not sensor or len(sensor) > 100:
                raise ValueError("INVALID_SENSOR")
            identity = (sensor, at)
            if identity in seen:
                duplicates += 1
                raise ValueError("CONFLICTING_READINGS")
            seen.add(identity)
            if previous and at < previous:
                out_of_order += 1
            previous = at
            rows.append(
                {
                    "sensor_id": sensor,
                    "timestamp_utc": at,
                    "temperature_c": value,
                    "source_row": count + 1,
                }
            )
        except (ValueError, InvalidOperation, ZoneInfoNotFoundError, KeyError) as exc:
            if len(errors) < 100:
                errors.append(
                    {
                        "row": count + 1,
                        "column": "timestamp/temperature/sensor",
                        "code": str(exc)
                        if str(exc)
                        in {
                            "TIMEZONE_REQUIRED",
                            "AMBIGUOUS_OR_NONEXISTENT_TIME",
                            "CONFLICTING_READINGS",
                        }
                        else "INVALID_VALUE",
                        "message": "Row requires correction",
                    }
                )
    invalid = count - len(rows)
    if not count:
        errors.append(
            {"row": 1, "code": "EMPTY_DATASET", "message": "At least one reading required"}
        )
    summary = {
        "valid_rows": len(rows),
        "invalid_rows": invalid,
        "duplicate_rows": duplicates,
        "errors": errors,
        "errors_truncated": invalid > 100,
        "warnings": [{"code": "OUT_OF_ORDER_ROWS", "count": out_of_order}] if out_of_order else [],
        "mapping": mapping,
    }
    return (
        [] if errors else sorted(rows, key=lambda r: (r["sensor_id"], r["timestamp_utc"]))
    ), summary
