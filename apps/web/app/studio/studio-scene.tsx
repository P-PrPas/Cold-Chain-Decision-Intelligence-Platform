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
  lazy = false,
  announce = false,
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
  /**
   * Show the 2D schematic first and load three.js only after first paint, once
   * the stage is near the viewport. The stage keeps its size, so nothing shifts.
   */
  lazy?: boolean;
  /** Announce the decision point and arrival to screen readers (politely, nothing else). */
  announce?: boolean;
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
  const [ready, setReady] = useState(!lazy);

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
  const pending = lazy && !ready && !failed;
  const effective2d = mode === "2d" || failed || pending;

  const labels = {
    origin: originLabel,
    decision: t("nodeDecision"),
    receiver: destinationLabel,
    alt: t("nodeAltShort"),
    inspection: t("nodeInspectionShort"),
    quarantine: t("nodeQuarantineShort"),
    gap: t("gapNoReadings"),
    blocked: t("barrierBlocked"),
    acc: {
      ACCEPTED: t("accAccepted"),
      REJECTED: t("accRejected"),
      UNKNOWN: t("accUnknown"),
    },
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
  // A lazy stage waits for first paint and for the viewport before it fetches
  // three.js, and shows the 2D schematic meanwhile.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let started = false;
    const cleanups: (() => void)[] = [];
    const lost = (e: Event) => {
      e.preventDefault();
      if (!cancelled) setFailed(true);
    };
    el.addEventListener("webglcontextlost", lost, true);
    const start = () => {
      if (started || cancelled) return;
      started = true;
      import("./diorama")
        .then((m) => {
          if (cancelled) return;
          try {
            const d = m.mountDiorama(el);
            engine.current = d;
            d.setConfig(latest.current.config);
            d.setFrames({ all: latest.current.frames });
            setReady(true);
          } catch {
            setFailed(true);
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    };
    if (!lazy) start();
    else {
      let painted = false;
      let near = false;
      const go = () => {
        if (painted && near) start();
      };
      const afterPaint = () => {
        const run = () => {
          painted = true;
          go();
        };
        const h = window.setTimeout(run, 300);
        cleanups.push(() => window.clearTimeout(h));
      };
      if (document.readyState === "complete") afterPaint();
      else {
        window.addEventListener("load", afterPaint, { once: true });
        cleanups.push(() => window.removeEventListener("load", afterPaint));
      }
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            near = true;
            io.disconnect();
            go();
          }
        },
        { rootMargin: "300px" },
      );
      io.observe(el);
      cleanups.push(() => io.disconnect());
    }
    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
      el.removeEventListener("webglcontextlost", lost, true);
      engine.current?.dispose();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const accWord = (type: string) => labels.acc[acceptance[type] ?? "UNKNOWN"];
  const sceneAria = `${t("sceneAria")
    .replace("{from}", originLabel)
    .replace("{to}", destName)} ${t("sceneAriaAcceptance")
    .replace("{a}", accWord("CONTINUE_DELIVERY"))
    .replace("{b}", accWord("CONDITIONAL_REROUTE"))}`;

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
    <div
      className="stage"
      data-mode={effective2d ? "2d" : mode}
      data-three={failed ? "failed" : ready ? "ready" : "pending"}
    >
      <div
        ref={host}
        className="network-canvas"
        role="img"
        aria-label={sceneAria}
        hidden={mode === "2d" || failed}
        data-pending={pending || undefined}
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

      <div
        className="hud hud-tl"
        aria-hidden="true"
        data-phase={main.phase}
        data-keepout
      >
        <span className="hud-time num">
          {main.timeLabel} UTC
          {main.branchElapsed !== null && (
            <>
              {" "}
              + {main.branchElapsed} {t("unitMin")}
            </>
          )}
        </span>
        {main.branchElapsed !== null && (
          <span className="hud-sub hud-branch-note">{t("hudBranchTime")}</span>
        )}
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
        <div
          className="seg"
          role="group"
          aria-label={t("cameraGroup")}
          data-keepout
        >
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
            data-keepout
            aria-pressed={compare}
            aria-keyshortcuts="C"
            title={t("compareHint")}
            onClick={onCompare}
          >
            {t("compare")} <kbd aria-hidden="true">C</kbd>
          </button>
        )}
      </div>

      <p className="schematic-note" data-keepout>
        {t("schematicNote")}
      </p>

      <div className="hud hud-br" aria-hidden="true" data-keepout>
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
      {announce && (
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-live-phase={main.phase}
        >
          {main.phase === "decision" || main.phase === "arrived"
            ? `${sName}. ${t(phaseKey[main.phase])}`
            : ""}
        </p>
      )}
      {children}
    </div>
  );
}
