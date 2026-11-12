"use client";
import { useId } from "react";
import { useI18n } from "../i18n-provider";
import { ProvenanceChip } from "../ui/provenance-chip";
import type { Item } from "./api";

type Span = { start: number; end: number; sensor: string };

function spans(list: unknown): Span[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((v: Item) => ({
      start: Date.parse(String(v.start_at)),
      end: Date.parse(String(v.end_at)),
      sensor: String(v.sensor_id ?? ""),
    }))
    .filter((v) => Number.isFinite(v.start) && Number.isFinite(v.end));
}

/**
 * Observed readings on a real time axis. Unknown intervals reported by the
 * analysis are drawn as hatched bands. Points are never joined, so a gap is
 * never drawn as a line and never counted as in range. Nothing is interpolated.
 */
export default function EvidenceTimeline({
  rows,
  analysis,
}: {
  rows: Item[];
  analysis?: Item | null;
}) {
  const { t } = useI18n();
  const id = useId();
  const unknown = spans(analysis?.unknown_intervals);
  const excursions = spans(analysis?.excursions);
  const points = rows
    .map((r) => ({
      id: String(r.id),
      at: Date.parse(String(r.timestamp_utc)),
      value: Number(r.temperature_c),
      sensor: String(r.sensor_id),
      iso: String(r.timestamp_utc),
    }))
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.value));
  if (!points.length && !unknown.length)
    return (
      <div className="ws-timeline ws-timeline-empty" role="status">
        <strong>{t("wsTlEmptyTitle")}</strong>
        <p>{t("wsTlEmpty")}</p>
      </div>
    );
  const all = [
    ...points.map((p) => p.at),
    ...unknown.flatMap((s) => [s.start, s.end]),
  ];
  const t0 = Math.min(...all);
  const t1 = Math.max(...all);
  const values = points.map((p) => p.value);
  const lo = (values.length ? Math.min(...values) : 0) - 1;
  const hi = (values.length ? Math.max(...values) : 10) + 1;
  const L = 44;
  const W = 600;
  const x = (ms: number) => L + ((ms - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => 14 + ((hi - v) / (hi - lo || 1)) * 150;
  const unknownTotal = unknown.reduce((a, s) => a + (s.end - s.start), 0);
  const summary = t("wsTlAria")
    .replace("{n}", String(points.length))
    .replace("{g}", String(unknown.length));
  return (
    <figure className="ws-timeline">
      <figcaption>
        <strong>{t("wsTlTitle")}</strong>
        <span className="ws-dim">
          {t("wsTlUtc")} <ProvenanceChip kind="observed" />
        </span>
      </figcaption>
      <div
        className="chart-scroll"
        tabIndex={0}
        role="region"
        aria-label={t("wsTlScroll")}
      >
        <svg viewBox="0 0 660 200" role="img" aria-label={summary}>
          <defs>
            <pattern
              id={`${id}-h`}
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="7" height="7" fill="var(--st-unknown-bg)" />
              <rect width="2" height="7" fill="var(--st-unknown-line)" />
            </pattern>
          </defs>
          <line
            x1={L}
            x2={L + W}
            y1="170"
            y2="170"
            stroke="var(--line-strong)"
          />
          {values.length > 0 && (
            <>
              <text x="4" y={y(Math.max(...values)) + 4} className="tl-t">
                {Math.max(...values)}
              </text>
              <text x="4" y={y(Math.min(...values)) + 4} className="tl-t">
                {Math.min(...values)}
              </text>
              <text x="4" y="196" className="tl-t">
                °C
              </text>
            </>
          )}
          {unknown.map((s, i) => (
            <g key={`u${i}`}>
              <rect
                x={x(s.start)}
                y="8"
                width={Math.max(2, x(s.end) - x(s.start))}
                height="162"
                fill={`url(#${id}-h)`}
                stroke="var(--st-unknown-line)"
                strokeDasharray="3 3"
              >
                <title>
                  {t("wsTlUnknown")} {s.sensor}:{" "}
                  {new Date(s.start).toISOString()} –{" "}
                  {new Date(s.end).toISOString()}
                </title>
              </rect>
            </g>
          ))}
          {excursions.map((s, i) => (
            <rect
              key={`e${i}`}
              x={x(s.start)}
              y="8"
              width={Math.max(2, x(s.end) - x(s.start))}
              height="162"
              fill="none"
              stroke="var(--st-review-line)"
              strokeWidth="2"
            >
              <title>
                {t("wsTlExcursion")} {s.sensor}
              </title>
            </rect>
          ))}
          {points.map((p) => (
            <circle
              key={p.id}
              cx={x(p.at)}
              cy={y(p.value)}
              r="3.5"
              fill="var(--accent)"
            >
              <title>
                {p.sensor}: {p.iso} / {p.value} °C
              </title>
            </circle>
          ))}
          <text x={L} y="188" className="tl-t">
            {new Date(t0).toISOString().slice(0, 16).replace("T", " ")}
          </text>
          <text x={L + W} y="188" textAnchor="end" className="tl-t">
            {new Date(t1).toISOString().slice(0, 16).replace("T", " ")}
          </text>
        </svg>
      </div>
      <ul className="ws-legend">
        <li>
          <span className="ws-dot" aria-hidden="true" /> {t("wsTlObserved")}
        </li>
        <li>
          <span className="ws-hatch" aria-hidden="true" /> {t("wsTlUnknown")}
          {unknown.length > 0 && (
            <span className="num">
              {" "}
              ({unknown.length} / {Math.round(unknownTotal / 60000)}{" "}
              {t("unitMin")})
            </span>
          )}
        </li>
        {excursions.length > 0 && (
          <li>
            <span className="ws-box" aria-hidden="true" /> {t("wsTlExcursion")}{" "}
            <ProvenanceChip kind="calculated" />
          </li>
        )}
      </ul>
      <p className="ws-note">{t("wsTlNote")}</p>
    </figure>
  );
}
