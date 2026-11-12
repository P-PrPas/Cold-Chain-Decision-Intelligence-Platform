"use client";
import { useRef } from "react";
import { useT } from "../i18n-provider";
import { usePlaying, useReducedMotion, useTime } from "./hooks";
import type { Player } from "./player";
import { scenarioKey } from "./scenarios";
import {
  findGaps,
  formatClock,
  stateAt,
  thermalBand,
  type Reading,
} from "./sim-clock";

const SPEEDS = [0.5, 1, 2];

export default function Timeline({
  player,
  readings,
  startMinute,
  stepMinutes,
  scenario,
  speed,
  onSpeed,
}: {
  player: Player;
  readings: Reading[];
  startMinute: number;
  stepMinutes: number;
  scenario: string;
  speed: number;
  onSpeed: (s: number) => void;
}) {
  const t = useT();
  const time = useTime(player);
  const playing = usePlaying(player);
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const J = player.journeyEnd;
  const total = player.total;
  const gaps = findGaps(readings, startMinute, stepMinutes);
  const frame = stateAt(
    {
      readings,
      startMinute,
      stepMinutes,
      scenario,
      delayMinutes: 0,
      totalCost: "0.00",
    },
    time,
  );
  const known = readings.filter((v): v is number => v !== null);
  const lo = Math.floor(Math.min(...known, 3)) - 1;
  const hi = Math.ceil(Math.max(...known, 6)) + 1;
  const px = (m: number) => (m / total) * 100;
  const py = (v: number) => 16 + ((hi - v) / (hi - lo)) * 66;

  const text =
    frame.phase === "decision"
      ? `${frame.timeLabel} UTC, ${t("sliderDecision")}`
      : frame.phase === "journey"
        ? `${frame.timeLabel} UTC, ${
            frame.tempC === null
              ? t("sliderNoReading")
              : `${frame.tempC.toFixed(1)} °C`
          }`
        : t("sliderRun").replace(
            "{p}",
            String(Math.round(((time - J) / (total - J)) * 100)),
          );

  function seekFrom(clientX: number) {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    player.seek(((clientX - r.left) / r.width) * total);
  }

  const atEnd = time >= total;
  const ticks: number[] = [];
  for (let m = 0; m <= J; m += 60) ticks.push(m);

  return (
    <div className="timeline" role="group" aria-label={t("timelineLabel")}>
      <div className="tl-bar">
        <button
          type="button"
          className="tl-play"
          disabled={reduced}
          aria-keyshortcuts="Space"
          onClick={() => player.toggle()}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            {playing ? (
              <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
            ) : atEnd ? (
              <path
                d="M13 8a5 5 0 1 1-1.6-3.7M13 2v3.5h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
            )}
          </svg>
          {playing ? t("pause") : atEnd ? t("replay") : t("play")}
        </button>
        <div className="seg" role="group" aria-label={t("speedGroup")}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className="seg-btn"
              aria-pressed={speed === s}
              onClick={() => onSpeed(s)}
            >
              {s}&times;
            </button>
          ))}
        </div>
        <span className="tl-readout num" aria-hidden="true">
          {frame.timeLabel} UTC
          {frame.branchElapsed !== null &&
            ` + ${frame.branchElapsed} ${t("unitMin")} (${t("hudBranchTime")})`}
        </span>
        <ul className="tl-legend" aria-label={t("legendScale")}>
          <li>
            <i className="sw band-cold" />
            {t("legendCold")}
          </li>
          <li>
            <i className="sw band-hot" />
            {t("legendHot")}
          </li>
          <li>
            <i className="sw sw-unknown" />
            {t("legendUnknown")}
          </li>
          <li className="tl-legend-note">{t("legendScale")}</li>
        </ul>
      </div>

      <div
        ref={track}
        className="tl-track"
        role="slider"
        tabIndex={0}
        aria-label={t("sliderLabel")}
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={text}
        aria-orientation="horizontal"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          player.pause();
          seekFrom(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) seekFrom(e.clientX);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "Home") {
            e.preventDefault();
            player.pause();
            player.seek(0);
          } else if (e.key === "End") {
            e.preventDefault();
            player.pause();
            player.seek(total);
          }
        }}
      >
        <div
          className="tl-branch"
          style={{ left: `${px(J)}%` }}
          aria-hidden="true"
        >
          <span>
            {t("branchRegion")}: {t(scenarioKey[scenario] ?? "scnContinue")}
          </span>
        </div>
        {gaps.map((g) => (
          <div
            key={g.startIndex}
            className="tl-gap"
            aria-hidden="true"
            style={{
              left: `${px(g.fromMin)}%`,
              width: `${px(g.untilMin - g.fromMin)}%`,
            }}
          >
            <span>
              {t("gapNoReadings")} {g.label}
            </span>
          </div>
        ))}
        <svg
          className="tl-chart"
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              x2="1000"
              y1={y}
              y2={y}
              className="tl-grid"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {readings.slice(0, -1).map((v, i) => {
            if (v === null) return null;
            const x0 = (px(i * stepMinutes) / 100) * 1000;
            const x1 = (px((i + 1) * stepMinutes) / 100) * 1000;
            const y = py(v);
            const next = readings[i + 1];
            return (
              <g key={i} className={`band-${thermalBand(v)}`}>
                <rect
                  x={x0}
                  y={y}
                  width={x1 - x0}
                  height={100 - y}
                  className="tl-fill"
                />
                <line
                  x1={x0}
                  x2={x1}
                  y1={y}
                  y2={y}
                  className="tl-step"
                  vectorEffect="non-scaling-stroke"
                />
                {next !== null && next !== undefined && (
                  <line
                    x1={x1}
                    x2={x1}
                    y1={y}
                    y2={py(next)}
                    className="tl-join"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}
        </svg>
        {readings.map((v, i) =>
          v === null ? null : (
            <i
              key={i}
              className={`tl-dot band-${thermalBand(v)}`}
              aria-hidden="true"
              style={{ left: `${px(i * stepMinutes)}%`, top: `${py(v)}%` }}
            />
          ),
        )}
        <span className="tl-y tl-y-hi num" aria-hidden="true">
          {hi}&deg;
        </span>
        <span className="tl-y tl-y-lo num" aria-hidden="true">
          {lo}&deg;
        </span>
        <div
          className="tl-decision"
          style={{ left: `${px(J)}%` }}
          aria-hidden="true"
        >
          <span>{t("decisionMark")}</span>
        </div>
        <div
          className="tl-head"
          style={{ left: `${px(time)}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="tl-axis num" aria-hidden="true">
        {ticks.map((m) => (
          <span key={m} style={{ left: `${px(m)}%` }}>
            {formatClock(startMinute + m)}
          </span>
        ))}
      </div>
    </div>
  );
}
