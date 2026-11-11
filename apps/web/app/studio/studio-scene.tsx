"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./studio.css";
import { useT } from "../i18n-provider";
import { useTheme } from "../prefs";
import { ProvenanceChip } from "../ui/provenance-chip";
import { formatAmount } from "../simulation-assumptions";
import type { CameraMode, Diorama, DioramaConfig } from "./diorama";
import { useReducedMotion, useTime } from "./hooks";
import type { Player } from "./player";
import SchematicSvg from "./schematic-svg";
import { scenarioKey, type Acceptance } from "./scenarios";
import {
  DESTINATION,
  compareFrames,
  findGaps,
  type Frame,
  type NodeKey,
  type Reading,
} from "./sim-clock";

export type ScenarioView = {
  type: string;
  delayMinutes: number;
  totalCost: string;
  acceptance: Acceptance;
  blocked?: boolean;
};

export type Ghost = { key: number; text: string };

type Mode = CameraMode | "2d";
const EMPTY: Reading[] = [];

export default function StudioScene({
  player,
  readings,
  startMinute,
  stepMinutes,
  scenarios,
  selected,
  originLabel,
  destinationLabel,
  compare,
  onCompare,
  currency,
  ghost,
  children,
}: {
  player: Player;
  /** null: no time series is available in this view. */
  readings: Reading[] | null;
  startMinute: number;
  stepMinutes: number;
  scenarios: ScenarioView[];
  selected: string;
  originLabel: string;
  destinationLabel: string;
  compare: boolean;
  onCompare?: () => void;
  currency: string;
  ghost?: Ghost | null;
  children?: ReactNode;
}) {
  const t = useT();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const time = useTime(player);
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Diorama | null>(null);
  const [mode, setMode] = useState<Mode>("overview");
  const [failed, setFailed] = useState(false);

  const series = readings ?? EMPTY;
  const gaps = useMemo(
    () => findGaps(series, startMinute, stepMinutes),
    [series, startMinute, stepMinutes],
  );
  const order = scenarios.map((s) => s.type);
  const selIdx = Math.max(0, order.indexOf(selected));
  const frames: Frame[] = compareFrames(
    { readings: series, startMinute, stepMinutes },
    scenarios,
    time,
  );
  const main = frames[selIdx];
  const acceptance = Object.fromEntries(
    scenarios.map((s) => [s.type, s.acceptance]),
  ) as Record<string, Acceptance>;
  const blocked = Object.fromEntries(
    scenarios.map((s) => [s.type, !!s.blocked]),
  );
  const effective2d = mode === "2d" || failed;

  const labels = {
    origin: originLabel,
    decision: t("nodeDecision"),
    receiver: destinationLabel,
    alt: t("nodeAltShort"),
    inspection: t("nodeInspectionShort"),
    quarantine: t("nodeQuarantineShort"),
    gap: t("gapNoReadings"),
    blocked: t("barrierBlocked"),
  };
  const config: DioramaConfig = {
    readings: series,
    stepMinutes,
    journeyEnd: main.journeyEnd,
    gaps,
    hasTrace: readings !== null,
    scenarios: order,
    selected,
    acceptance,
    blocked,
    labels,
    camera: mode === "follow" ? "follow" : "overview",
    compare,
    reducedMotion: reduced,
  };
  const latest = useRef({ config, frames });
  useEffect(() => {
    latest.current = { config, frames };
    engine.current?.setConfig(config);
    engine.current?.setFrames({ all: frames });
  });

  // Mount the diorama once. If WebGL is unavailable the 2D view takes over.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    const lost = (e: Event) => {
      e.preventDefault();
      if (!cancelled) setFailed(true);
    };
    el.addEventListener("webglcontextlost", lost, true);
    import("./diorama")
      .then((m) => {
        if (cancelled) return;
        try {
          const d = m.mountDiorama(el);
          engine.current = d;
          d.setConfig(latest.current.config);
          d.setFrames({ all: latest.current.frames });
        } catch {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      el.removeEventListener("webglcontextlost", lost, true);
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  const firstTheme = useRef(theme);
  useEffect(() => {
    if (firstTheme.current === theme) return;
    firstTheme.current = theme;
    engine.current?.refreshTheme();
    engine.current?.setConfig(latest.current.config);
    engine.current?.setFrames({ all: latest.current.frames });
  }, [theme]);

  useEffect(() => {
    if (ghost) engine.current?.pulseGhost();
  }, [ghost]);

  const sName = t(scenarioKey[selected] ?? "scnContinue");
  const destKey: NodeKey = DESTINATION[selected] ?? "receiver";
  const destName = {
    receiver: t("nodeReceiver"),
    alt: t("nodeAlt"),
    inspection: t("nodeInspection"),
    quarantine: t("nodeQuarantine"),
    origin: t("nodeOrigin"),
    decision: t("nodeDecision"),
  }[destKey];
  const sceneAria = t("sceneAria")
    .replace("{from}", originLabel)
    .replace("{to}", destName);

  const phaseKey = {
    journey: "phaseJourney",
    decision: "phaseDecision",
    branch: "phaseBranch",
    arrived: "phaseArrived",
  } as const;

  const modes: [Mode, string][] = [
    ["overview", t("camOverview")],
    ["follow", t("camFollow")],
    ["2d", t("cam2d")],
  ];

  return (
    <div className="stage" data-mode={effective2d ? "2d" : mode}>
      <div
        ref={host}
        className="network-canvas"
        role="img"
        aria-label={sceneAria}
        hidden={effective2d}
      />
      {effective2d && (
        <>
          <SchematicSvg
            frames={frames}
            selected={selIdx}
            scenarios={order}
            acceptance={acceptance}
            compare={compare}
            readings={readings}
            gaps={gaps}
            stepMinutes={stepMinutes}
            journeyEnd={main.journeyEnd}
            ariaLabel={sceneAria}
            labels={{
              ...labels,
              receiver: t("nodeReceiverShort"),
              origin: originLabel,
              title: t("svgTitle"),
            }}
          />
          <ol className="route-steps sr-only">
            <li>{originLabel}</li>
            <li>{t("nodeDecision")}</li>
            <li>{destName}</li>
          </ol>
        </>
      )}

      <div className="hud hud-tl" aria-hidden="true" data-phase={main.phase}>
        <span className="hud-time num">{main.timeLabel} UTC</span>
        {readings === null ? (
          <span className="hud-temp" data-state="unknown">
            {t("noTraceHere")}
          </span>
        ) : main.temperatureState === "observed" ? (
          <span className="hud-temp" data-state="observed">
            <span className="num hud-deg">{main.tempC?.toFixed(1)} &deg;C</span>
            <ProvenanceChip kind="observed" />
          </span>
        ) : main.temperatureState === "unknown" ? (
          <span className="hud-temp" data-state="unknown">
            <span className="hatch-swatch" />
            {t("hudUnknown")}
            {main.gap && (
              <span className="hud-sub">
                {t("gapNoReadings")} {main.gap.label}
              </span>
            )}
          </span>
        ) : (
          <span className="hud-temp" data-state="unknown">
            <span className="hatch-swatch" />
            {t("hudUnknown")}
            <span className="hud-sub">{t("hudBeyond")}</span>
          </span>
        )}
      </div>

      <div className="hud hud-tr">
        <div className="seg" role="group" aria-label={t("cameraGroup")}>
          {modes.map(([m, label]) => (
            <button
              key={m}
              type="button"
              className="seg-btn"
              aria-pressed={effective2d ? m === "2d" : mode === m}
              onClick={() => setMode(m)}
            >
              {label}
            </button>
          ))}
        </div>
        {onCompare && (
          <button
            type="button"
            className="seg-btn compare-btn"
            aria-pressed={compare}
            aria-keyshortcuts="C"
            title={t("compareHint")}
            onClick={onCompare}
          >
            {t("compare")} <kbd>C</kbd>
          </button>
        )}
      </div>

      <p className="schematic-note">{t("schematicNote")}</p>

      <div className="hud hud-br" aria-hidden="true">
        <span>
          {t("hudDelay")}{" "}
          <b className="num">
            {main.delayMinutes === null ? "–" : main.delayMinutes}{" "}
            {t("unitMin")}
          </b>
        </span>
        <span>
          {t("hudCost")}{" "}
          <b className="num">
            {main.costTicker === null ? "–" : formatAmount(main.costTicker)}{" "}
            {currency}
          </b>
        </span>
      </div>

      {ghost && (
        <p className="ghost-chip" key={ghost.key} aria-hidden="true">
          {t("whatIfWas")} {ghost.text}
        </p>
      )}
      {failed && (
        <p className="scene-note" role="status">
          {t("unavailable3d")}
        </p>
      )}
      <p className="sr-only" role="status">
        {sName}. {t(phaseKey[main.phase])}
      </p>
      {children}
    </div>
  );
}
