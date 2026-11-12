"use client";
import { useRef, useState } from "react";
import { useT } from "../i18n-provider";
import {
  EDIT_MAX,
  EDIT_MIN,
  readingScale,
  restoredValue,
  valueAtY,
} from "./edit-readings";
import { usePlaying, useReducedMotion, useTime } from "./hooks";
import type { Player } from "./player";
import { scenarioKey, scenarioShortKey } from "./scenarios";
import {
  LINEAR_DELAY,
  branchOf,
  findGaps,
  formatClock,
  stateAt,
  thermalBand,
  type DelayInput,
  type Reading,
} from "./sim-clock";

const SPEEDS = [0.5, 1, 2];

/** Sandbox-only editing of the readings (nothing is sent or saved). */
export type TimelineEdit = {
  /** The readings differ from the prepared demo data. */
  edited: boolean;
  /** The prepared demo readings, for restoring a slot. */
  demo: Reading[];
  onChange: (index: number, value: number | null) => void;
  onReset: () => void;
};

export default function Timeline({
  player,
  readings,
  startMinute,
  stepMinutes,
  scenario,
  speed,
  onSpeed,
  scenarios,
  compare = false,
  edit,
}: {
  player: Player;
  readings: Reading[];
  startMinute: number;
  stepMinutes: number;
  scenario: string;
  speed: number;
  onSpeed: (s: number) => void;
  /** Delays per scenario; draws each run's length on the shared axis. */
  scenarios?: DelayInput[];
  /** Show every scenario's run, not only the selected one. */
  compare?: boolean;
  edit?: TimelineEdit;
}) {
  const t = useT();
  const time = useTime(player);
  const playing = usePlaying(player);
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragPoint = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const [frozen, setFrozen] = useState<{ lo: number; hi: number } | null>(null);
  const J = player.journeyEnd;
  const total = player.total;
  const all: DelayInput[] = scenarios ?? [{ type: scenario, delayMinutes: 0 }];
  const lanes = (compare ? all : all.filter((s) => s.type === scenario)).map(
    (s) => ({
      ...s,
      n: all.indexOf(s) + 1,
      br: branchOf(s.type, s.delayMinutes),
    }),
  );
  const mine = all.find((s) => s.type === scenario) ?? all[0];
  const gaps = findGaps(readings, startMinute, stepMinutes);
  const frame = stateAt(
    {
      readings,
      startMinute,
      stepMinutes,
      scenario,
      delayMinutes: mine?.delayMinutes ?? 0,
      totalCost: "0.00",
    },
    time,
  );
  const { lo, hi } = frozen ?? readingScale(readings, editing ? 2 : 0);
  const px = (m: number) => (m / total) * 100;
  const py = (v: number) => 16 + ((hi - v) / (hi - lo)) * 66;
  const compressed = lanes.some((l) => l.br.compressed);

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
  function valueFromPointer(
    clientY: number,
    scale: { lo: number; hi: number },
  ) {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.height === 0) return null;
    return valueAtY(((clientY - r.top) / r.height) * 100, scale);
  }

  const atEnd = time >= total;
  const ticks: number[] = [];
  for (let m = 0; m <= J; m += 60) ticks.push(m);
  const pickValue = pick === null ? undefined : readings[pick];

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
            ` + ${frame.branchElapsed} ${t("unitMin")} · ${t("hudBranchTime")}`}
        </span>
        {edit && (
          <button
            type="button"
            className="quiet tl-edit-toggle"
            aria-pressed={editing}
            onClick={() => {
              setEditing((v) => !v);
              setPick(null);
            }}
          >
            {editing ? t("editDone") : t("editReadings")}
          </button>
        )}
        {edit?.edited && (
          <span className="edited-pill" data-testid="edited-note">
            {t("editedNote")}
          </span>
        )}
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

      <div className="tl-wrap">
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
              {compare
                ? t("branchRegion")
                : `${t("branchRegion")}: ${t(scenarioKey[scenario] ?? "scnContinue")}`}
            </span>
          </div>
          {lanes.map((l, i) => (
            <div
              key={l.type}
              className="tl-lane"
              data-testid={`tl-lane-${l.type}`}
              data-selected={l.type === scenario}
              data-unknown={!l.br.delayKnown}
              data-compressed={l.br.compressed}
              aria-hidden="true"
              style={{
                left: `${px(J)}%`,
                width: `${px(l.br.span)}%`,
                top: `${24 + i * 14}px`,
              }}
            >
              {l.br.dwell > 0 && (
                <i
                  className="tl-wait"
                  style={{
                    left: `${(l.br.pre / l.br.span) * 100}%`,
                    width: `${(l.br.dwell / l.br.span) * 100}%`,
                  }}
                />
              )}
              {l.br.compressed && (
                <i
                  className="tl-break"
                  style={{
                    left: `${((l.br.pre + LINEAR_DELAY) / l.br.span) * 100}%`,
                  }}
                />
              )}
              <span>
                {l.n} {t(scenarioShortKey[l.type])}
                {l.br.delayKnown
                  ? ` · ${l.delayMinutes} ${t("unitMin")}`
                  : ` · ${t("delayUnknownShort")}`}
              </span>
            </div>
          ))}
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
        {edit && editing && (
          <div className="tl-edit-layer">
            {readings.map((v, i) => (
              <button
                key={i}
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
                type="button"
                role="slider"
                className={`tl-dot-edit band-${thermalBand(v)}`}
                data-null={v === null}
                data-selected={pick === i}
                data-testid={`edit-point-${i}`}
                aria-label={t("editPoint").replace(
                  "{time}",
                  formatClock(startMinute + i * stepMinutes),
                )}
                aria-valuemin={EDIT_MIN}
                aria-valuemax={EDIT_MAX}
                aria-valuenow={v ?? undefined}
                aria-valuetext={
                  v === null ? t("editNone") : `${v.toFixed(1)} °C`
                }
                style={{
                  left: `${px(i * stepMinutes)}%`,
                  top: `${py(v === null ? (lo + hi) / 2 : v)}%`,
                }}
                onFocus={() => setPick(i)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setPick(i);
                  if (v === null) return;
                  dragPoint.current = i;
                  setFrozen({ lo, hi });
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (dragPoint.current !== i || !frozen) return;
                  const next = valueFromPointer(e.clientY, frozen);
                  if (next !== null) edit.onChange(i, next);
                }}
                onPointerUp={(e) => {
                  dragPoint.current = null;
                  setFrozen(null);
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                  dragPoint.current = null;
                  setFrozen(null);
                }}
                onKeyDown={(e) => {
                  // Keep page shortcuts (scrub, compare, ...) out of point editing.
                  e.stopPropagation();
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    if (v === null) return;
                    const d =
                      (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowUp" ? 1 : -1);
                    edit.onChange(i, v + d);
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    dotRefs.current[
                      i + (e.key === "ArrowLeft" ? -1 : 1)
                    ]?.focus();
                  } else if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    edit.onChange(
                      i,
                      v === null ? restoredValue(edit.demo, i) : null,
                    );
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="tl-axis num" aria-hidden="true">
        {ticks.map((m) => (
          <span key={m} style={{ left: `${px(m)}%` }}>
            {formatClock(startMinute + m)}
          </span>
        ))}
        {compressed && (
          <small
            className="tl-compress"
            style={{ left: `${px(J)}%` }}
            title={t("axisCompressedNote").replace("{n}", String(LINEAR_DELAY))}
          >
            {t("axisCompressedNote").replace("{n}", String(LINEAR_DELAY))}
          </small>
        )}
      </div>
      {edit && editing && (
        <div className="tl-edit" role="group" aria-label={t("editReadings")}>
          <p>{t("editHint")}</p>
          <div className="tl-edit-actions">
            {pick !== null && (
              <span className="tl-edit-selected num">
                {t("editSelected").replace(
                  "{time}",
                  formatClock(startMinute + pick * stepMinutes),
                )}
                {` · ${pickValue === null ? t("editNone") : `${pickValue?.toFixed(1)} °C`}`}
              </span>
            )}
            <button
              type="button"
              className="quiet"
              disabled={pick === null}
              onClick={() => {
                if (pick === null) return;
                edit.onChange(
                  pick,
                  pickValue === null ? restoredValue(edit.demo, pick) : null,
                );
              }}
            >
              {pickValue === null && pick !== null
                ? t("editRestore")
                : t("editMarkNone")}
            </button>
            <button
              type="button"
              className="quiet"
              disabled={!edit.edited}
              onClick={() => {
                edit.onReset();
                setPick(null);
              }}
            >
              {t("editReset")}
            </button>
            <span>{t("editNoneNote")}</span>
          </div>
        </div>
      )}

      <ul className="sr-only" aria-label={t("tlSpansLabel")}>
        {lanes.map((l) => (
          <li key={l.type}>
            {l.br.delayKnown
              ? t("tlSpanAria")
                  .replace("{name}", t(scenarioKey[l.type]))
                  .replace("{d}", String(l.delayMinutes))
              : t("tlSpanUnknown").replace("{name}", t(scenarioKey[l.type]))}
          </li>
        ))}
        {compressed && (
          <li>
            {t("axisCompressedNote").replace("{n}", String(LINEAR_DELAY))}
          </li>
        )}
      </ul>
    </div>
  );
}
