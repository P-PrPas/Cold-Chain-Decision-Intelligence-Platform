"use client";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { formatAmount } from "@/lib/simulation-assumptions";
import { placePoints, ticks, type ChartPoint } from "./chart-scale";
import { scenarioKey, scenarioShortKey } from "./scenarios";

const W = 216;
const H = 136;
const M = { l: 44, r: 14, t: 24, b: 32 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;
const SHAPE = ["circle", "square", "triangle", "diamond"] as const;

function Marker({
  shape,
  r,
  className,
}: {
  shape: (typeof SHAPE)[number];
  r: number;
  className?: string;
}) {
  if (shape === "circle") return <circle r={r} className={className} />;
  if (shape === "square")
    return (
      <rect
        x={-r}
        y={-r}
        width={2 * r}
        height={2 * r}
        rx="1.5"
        className={className}
      />
    );
  if (shape === "triangle")
    return (
      <polygon
        points={`0,${-r - 1.5} ${r + 1.5},${r} ${-r - 1.5},${r}`}
        className={className}
      />
    );
  return (
    <polygon
      points={`0,${-r - 2} ${r + 2},0 0,${r + 2} ${-r - 2},0`}
      className={className}
    />
  );
}

/**
 * Scatter of additional delay (x) against total cost (y), one point per
 * scenario. It shows position only: no best region, ranking or recommendation.
 * A faded ghost marks where each point was before the last change.
 */
export default function CompareChart({
  points,
  previous,
  ghostKey,
  selected,
  currency,
}: {
  points: ChartPoint[];
  previous?: ChartPoint[] | null;
  ghostKey?: number;
  selected: string;
  currency: string;
}) {
  const t = useT();
  const [table, setTable] = useState(false);
  const { xMax, yMax, place } = placePoints(points, previous ?? []);
  const sx = (v: number) => M.l + v * PW;
  const sy = (v: number) => M.t + (1 - v) * PH;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const unplotted = points.filter((p) => place(p) === null);
  const name = (type: string) => t(scenarioKey[type]);
  const header = (
    <thead>
      <tr>
        <th scope="col">{t("chartColScenario")}</th>
        <th scope="col">{t("chartColDelay")}</th>
        <th scope="col">
          {t("chartColCost")} ({currency})
        </th>
      </tr>
    </thead>
  );
  return (
    <div className="compare-chart" role="group" aria-labelledby="cc-title">
      <div className="cc-head">
        <h3 id="cc-title">{t("chartTitle")}</h3>
        <button
          type="button"
          className="quiet cc-toggle"
          aria-pressed={table}
          aria-label={t("chartTable")}
          onClick={() => setTable((v) => !v)}
        >
          {t("chartTableShort")}
        </button>
      </div>
      <p className="sr-only">{t("chartDesc")}</p>
      {table ? (
        <table className="cc-table">
          {header}
          <tbody>
            {points.map((p, i) => (
              <tr key={p.type}>
                <th scope="row">
                  {i + 1} {t(scenarioShortKey[p.type])}
                </th>
                <td className="num">{p.delay === null ? "–" : fmt(p.delay)}</td>
                <td className="num">
                  {p.cost === null ? "–" : formatAmount(p.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <svg
            className="cc-svg"
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden="true"
            focusable="false"
            data-testid="compare-chart"
          >
            {ticks(1, 2).map((v) => (
              <line
                key={v}
                x1={M.l}
                x2={M.l + PW}
                y1={sy(v)}
                y2={sy(v)}
                className="cc-grid"
              />
            ))}
            <line
              x1={M.l}
              x2={M.l}
              y1={M.t}
              y2={M.t + PH}
              className="cc-axis"
            />
            <line
              x1={M.l}
              x2={M.l + PW}
              y1={M.t + PH}
              y2={M.t + PH}
              className="cc-axis"
            />
            {ticks(1, 2).map((v) => (
              <text
                key={`y${v}`}
                x={M.l - 4}
                y={sy(v) + 3}
                textAnchor="end"
                className="cc-tick num"
              >
                {fmt(Math.round(yMax * v))}
              </text>
            ))}
            {ticks(1, 2).map((v) => (
              <text
                key={`x${v}`}
                x={sx(v)}
                y={M.t + PH + 12}
                textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"}
                className="cc-tick num"
              >
                {fmt(Math.round(xMax * v))}
              </text>
            ))}
            <text x={M.l + PW} y={H - 4} textAnchor="end" className="cc-unit">
              {t("chartAxisX")}
            </text>
            <text x={2} y={11} className="cc-unit">
              {t("chartAxisY").replace("{cur}", currency)}
            </text>
            {previous &&
              points.map((p, i) => {
                const now = place(p);
                const before = previous.find((q) => q.type === p.type);
                const was = before ? place(before) : null;
                if (
                  !now ||
                  !was ||
                  Math.hypot((now.x - was.x) * PW, (now.y - was.y) * PH) < 1
                )
                  return null;
                return (
                  <g key={`${p.type}-${ghostKey}`} className="cc-ghost">
                    <line
                      x1={sx(was.x)}
                      y1={sy(was.y)}
                      x2={sx(now.x)}
                      y2={sy(now.y)}
                      className="cc-trail"
                    />
                    <g transform={`translate(${sx(was.x)} ${sy(was.y)})`}>
                      <Marker shape={SHAPE[i % 4]} r={6} className="cc-mark" />
                    </g>
                  </g>
                );
              })}
            {points.map((p, i) => {
              const at = place(p);
              if (!at) return null;
              return (
                <g
                  key={p.type}
                  className="cc-point"
                  data-selected={p.type === selected}
                  data-testid={`chart-point-${p.type}`}
                  data-delay={p.delay}
                  data-cost={p.cost}
                  transform={`translate(${sx(at.x)} ${sy(at.y)})`}
                >
                  <Marker shape={SHAPE[i % 4]} r={7.5} className="cc-mark" />
                  <text y="3.6" textAnchor="middle" className="cc-n">
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          {unplotted.length > 0 && (
            <p className="field-error" role="status">
              {t("chartNotPlotted")}{" "}
              {unplotted
                .map(
                  (p) =>
                    `${points.indexOf(p) + 1} ${t(scenarioShortKey[p.type])}`,
                )
                .join(", ")}
            </p>
          )}
          <table className="sr-only">
            <caption>{t("chartTitle")}</caption>
            {header}
            <tbody>
              {points.map((p) => (
                <tr key={p.type}>
                  <th scope="row">{name(p.type)}</th>
                  <td>{p.delay === null ? "–" : p.delay}</td>
                  <td>{p.cost === null ? "–" : formatAmount(p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
