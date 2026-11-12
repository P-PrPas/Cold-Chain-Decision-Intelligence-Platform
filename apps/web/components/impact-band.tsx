import type { ReactNode } from "react";
import { formatAmount } from "@/lib/simulation-assumptions";

function cents(v: string): bigint {
  const [whole, fraction = ""] = v.split(".");
  return (
    BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2))
  );
}
/** Signed Decimal-safe difference of two money strings. */
function moneyDelta(value: string, base: string): string {
  const d = cents(value) - cents(base);
  const abs = d < BigInt(0) ? -d : d;
  const text = `${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
  return `${d < BigInt(0) ? "-" : "+"}${formatAmount(text)}`;
}

/** Value against its baseline. Money is only formatted as a string, never summed here. */
export function ImpactBand({
  label,
  value,
  baseline,
  unit,
  money = false,
  chip,
  unavailable = "Unavailable",
  baselineWord = "Baseline",
  checkInput = "Check input",
}: {
  label: string;
  value?: string;
  baseline: string;
  unit: string;
  money?: boolean;
  chip?: ReactNode;
  unavailable?: string;
  baselineWord?: string;
  checkInput?: string;
}) {
  const valid = !!value && /^\d+(\.\d+)?$/.test(value);
  const n = valid ? Number(value) : 0,
    base = Number(baseline) || 0;
  const scale = Math.max(n, base, money ? 100 : 60);
  return (
    <div className="impact-band" aria-label={label}>
      <div>
        <span>
          {label} {chip}
        </span>
        <strong className="num">
          {valid
            ? (money ? formatAmount(value) : value) + " " + unit
            : unavailable}
        </strong>
      </div>
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: baseline ${baseline} ${unit}; current ${valid ? value : "invalid"}`}
      >
        <rect
          className="baseline-bar"
          x="0"
          y="1"
          width={(base / scale) * 100}
          height="3"
        />
        {valid && (
          <rect
            className="current-bar"
            x="0"
            y="7"
            width={(n / scale) * 100}
            height="4"
          />
        )}
      </svg>
      <small className="num">
        {baselineWord} {money ? formatAmount(baseline) : baseline} /{" "}
        {valid
          ? `${money ? moneyDelta(value!, /^\d+(\.\d+)?$/.test(baseline) ? baseline : "0") : `${n >= base ? "+" : ""}${n - base}`} ${unit}`
          : checkInput}
      </small>
    </div>
  );
}
