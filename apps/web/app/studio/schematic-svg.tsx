"use client";
import {
  NODES,
  type Band,
  type Frame,
  type Gap,
  type NodeKey,
  type Reading,
} from "./sim-clock";
import { acceptanceSymbol, type Acceptance } from "./scenarios";

const SX = (x: number) => 340 + x * 34;
const SY = (z: number) => 205 + z * 28;

export type SvgLabels = {
  origin: string;
  decision: string;
  receiver: string;
  alt: string;
  inspection: string;
  quarantine: string;
  gap: string;
  blocked: string;
  title: string;
};

const destKeys: NodeKey[] = ["receiver", "inspection", "alt", "quarantine"];

function band(v: number): Band {
  return v < 4 ? "cold" : v < 6 ? "cool" : v < 8 ? "warm" : "hot";
}

/**
 * Plan-view schematic. Used as the "2D" camera and as the no-WebGL fallback,
 * so it carries the same information as the 3D scene: route, branches,
 * temperature ribbon, gap, truck(s) and the chosen branch.
 */
export default function SchematicSvg({
  frames,
  selected,
  scenarios,
  acceptance,
  compare,
  readings,
  gaps,
  stepMinutes,
  journeyEnd,
  labels,
  ariaLabel,
}: {
  frames: Frame[];
  selected: number;
  scenarios: string[];
  acceptance: Record<string, Acceptance>;
  compare: boolean;
  readings: Reading[] | null;
  gaps: Gap[];
  stepMinutes: number;
  journeyEnd: number;
  labels: SvgLabels;
  ariaLabel: string;
}) {
  const main = frames[selected] ?? frames[0];
  const O = NODES.origin;
  const D = NODES.decision;
  const approach = D.x - O.x;
  const rear =
    main.phase === "journey"
      ? Math.max(0, main.truck.progress - 1.0 / approach)
      : 1;
  const toX = (s: number) => O.x + (D.x - O.x) * s;
  const branching = main.phase === "branch" || main.phase === "arrived";
  const showAll = compare && branching;
  const nodeLabel: Record<NodeKey, string> = {
    origin: labels.origin,
    decision: labels.decision,
    receiver: `${acceptanceSymbol[acceptance.CONTINUE_DELIVERY ?? "UNKNOWN"]} ${labels.receiver}`,
    alt: `${acceptanceSymbol[acceptance.CONDITIONAL_REROUTE ?? "UNKNOWN"]} ${labels.alt}`,
    inspection: labels.inspection,
    quarantine: labels.quarantine,
  };
  const roadY = SY(D.z);
  return (
    <svg
      className="schematic-svg"
      viewBox="0 0 680 440"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{labels.title}</title>
      <defs>
        <pattern
          id="svg-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" className="hatch-bg" />
          <rect width="3" height="8" className="hatch-line" />
        </pattern>
      </defs>
      <rect
        x="6"
        y="6"
        width="668"
        height="428"
        rx="4"
        className="svg-ground"
      />
      {/* roads */}
      <line
        x1={SX(O.x - 1.2)}
        y1={roadY}
        x2={SX(D.x)}
        y2={roadY}
        className="svg-road"
      />
      {destKeys.map((k, i) => {
        const n = NODES[k];
        const isSel = i === selected;
        return (
          <line
            key={k}
            x1={SX(D.x)}
            y1={SY(D.z)}
            x2={SX(n.x)}
            y2={SY(n.z)}
            className={
              "svg-road" + (isSel || (showAll && branching) ? " is-chosen" : "")
            }
            strokeDasharray={isSel ? undefined : "6 6"}
          />
        );
      })}
      {/* thermal ribbon: stepped, zero-order hold, nothing across gaps */}
      {readings &&
        readings.slice(0, -1).map((value, i) => {
          if (value === null) return null;
          const s0 = (i * stepMinutes) / journeyEnd;
          const e = Math.min(((i + 1) * stepMinutes) / journeyEnd, rear);
          if (e <= s0) return null;
          const h = 6 + Math.min(14, Math.max(0, value)) * 5;
          return (
            <rect
              key={i}
              x={SX(toX(s0))}
              width={Math.max(0, SX(toX(e)) - SX(toX(s0)) - 1)}
              y={roadY - 8 - h}
              height={h}
              className={`svg-band band-${band(value)}`}
            />
          );
        })}
      {readings &&
        gaps.map((g, i) => {
          const s0 = g.fromMin / journeyEnd;
          const e = Math.min(g.untilMin / journeyEnd, rear);
          if (e <= s0) return null;
          const x0 = SX(toX(s0));
          const w = SX(toX(e)) - x0;
          return (
            <g key={i}>
              <rect
                x={x0}
                y={roadY - 8 - 52}
                width={w}
                height={52}
                className="svg-gap"
                fill="url(#svg-hatch)"
              />
              <text
                x={x0 + w / 2}
                y={roadY - 8 - 60}
                textAnchor="middle"
                className="svg-label gap-text"
              >
                {labels.gap} {g.label}
              </text>
            </g>
          );
        })}
      {/* nodes */}
      {(Object.keys(NODES) as NodeKey[]).map((k) => {
        const n = NODES[k];
        const i = destKeys.indexOf(k);
        const sel = i === selected;
        return (
          <g key={k}>
            {k === "decision" ? (
              <circle cx={SX(n.x)} cy={SY(n.z)} r="14" className="svg-node" />
            ) : (
              <rect
                x={SX(n.x) - 32}
                y={SY(n.z) - 15}
                width="64"
                height="30"
                rx="3"
                className={"svg-node" + (sel ? " is-chosen" : "")}
              />
            )}
            <text
              x={SX(n.x)}
              y={SY(n.z) + (k === "decision" ? 30 : 32)}
              textAnchor="middle"
              className={
                "svg-label" +
                (sel || k === "decision" || k === "origin" ? " strong" : "")
              }
            >
              {nodeLabel[k]}
            </text>
          </g>
        );
      })}
      {/* trucks */}
      {frames.map((f, i) => {
        const visible = showAll || i === selected;
        if (!visible) return null;
        const b: Band = f.temperatureState === "observed" ? f.band : "unknown";
        return (
          <g
            key={scenarios[i]}
            transform={`translate(${SX(f.truck.x)} ${SY(f.truck.z)}) rotate(${(f.truck.heading * 180) / Math.PI})`}
            opacity={i === selected ? 1 : 0.6}
          >
            <rect
              x="-14"
              y="-7"
              width="22"
              height="14"
              rx="2"
              className={`svg-truck band-${b}`}
            />
            <rect
              x="8"
              y="-6"
              width="8"
              height="12"
              rx="2"
              className="svg-cab"
            />
            {b === "unknown" && (
              <rect
                x="-14"
                y="-7"
                width="22"
                height="14"
                rx="2"
                fill="url(#svg-hatch)"
              />
            )}
          </g>
        );
      })}
      {showAll &&
        frames.map((f, i) => (
          <text
            key={i}
            x={SX(f.truck.x)}
            y={SY(f.truck.z) - 14}
            textAnchor="middle"
            className={"svg-label strong" + (i === selected ? "" : " dim")}
          >
            {f.blockedAtBarrier ? `${i + 1} × ${labels.blocked}` : i + 1}
          </text>
        ))}
    </svg>
  );
}
