/**
 * Pure simulation clock for the Studio. No DOM, no three.js, no React.
 *
 * Semantics (CLAUDE.md section 6): readings are held with a zero-order hold.
 * Slot i covers [i * step, (i + 1) * step). A null slot is UNKNOWN: it never
 * inherits the previous value and is never interpolated. After the last
 * reading there is no temperature model, so the cargo state is unknown there
 * too. Money stays a Decimal string; the ticker only eases the displayed
 * value and its final value is exactly the string it was given.
 */

export type Reading = number | null;

export type NodeKey =
  "origin" | "decision" | "receiver" | "alt" | "inspection" | "quarantine";

/** Schematic world coordinates (x, z). Not geographic. */
export const NODES: Record<NodeKey, { x: number; z: number }> = {
  origin: { x: -7.2, z: 0.4 },
  decision: { x: -0.6, z: 0.4 },
  receiver: { x: 6.6, z: 0.4 },
  alt: { x: 5.2, z: -4.6 },
  inspection: { x: 4.6, z: 4.8 },
  quarantine: { x: -1.6, z: 6.2 },
};

export const SCENARIO_ORDER = [
  "CONTINUE_DELIVERY",
  "HOLD_INSPECTION",
  "CONDITIONAL_REROUTE",
  "REJECT_QUARANTINE_DISPOSE",
] as const;

export const DESTINATION: Record<string, NodeKey> = {
  CONTINUE_DELIVERY: "receiver",
  HOLD_INSPECTION: "inspection",
  CONDITIONAL_REROUTE: "alt",
  REJECT_QUARANTINE_DISPOSE: "quarantine",
};

/**
 * Schematic drive time from the decision point to a scenario's node, in axis
 * minutes. It is not a modelled travel time and is never shown as a figure.
 */
export const LEG_MINUTES = 60;
/** Delays up to this many minutes are drawn to scale; longer ones are compressed. */
export const LINEAR_DELAY = 240;
/** Longest delay the inputs accept (one year). */
export const MAX_DELAY = 525600;
const COMPRESS_SCALE = 90;
/**
 * Where on its leg the truck waits out the delay: at the decision point
 * (delayed departure) for Continue, at the scenario node for the others.
 */
const DWELL_AT: Record<string, number> = { CONTINUE_DELIVERY: 0 };
/** Fraction of a blocked branch the truck reaches before the barrier. */
export const BARRIER_AT = 0.55;
/** Used when no readings are supplied. */
export const DEFAULT_JOURNEY_MINUTES = 240;
/** Simulated minutes per real second at 1x speed (240 min in 8 s). */
export const BASE_RATE = 30;

export type Phase = "journey" | "decision" | "branch" | "arrived";
export type Band = "cold" | "cool" | "warm" | "hot" | "unknown";

/**
 * Display-only colour bands for the thermal scale. These are NOT policy limits
 * and carry no safety meaning (CLAUDE.md section 2).
 */
export function thermalBand(tempC: number | null): Band {
  if (tempC === null || !Number.isFinite(tempC)) return "unknown";
  if (tempC < 4) return "cold";
  if (tempC < 6) return "cool";
  if (tempC < 8) return "warm";
  return "hot";
}

export type Gap = {
  startIndex: number;
  endIndex: number;
  /** Minutes from journey start where the first missing slot begins. */
  fromMin: number;
  /** Minutes from journey start where a reading exists again (or journey end). */
  untilMin: number;
  /** "HH:MM-HH:MM" of the first and last missing slots, UTC. */
  label: string;
};

export type ClockInput = {
  readings: Reading[];
  /** Minutes after UTC midnight of the first reading. */
  startMinute: number;
  stepMinutes: number;
  scenario: string;
  delayMinutes: number;
  /** Exact Decimal string from totalCost(), or "Unavailable". */
  totalCost: string;
  /** Set only when the engine says this option is blocked. */
  blocked?: boolean;
};

export type Frame = {
  t: number;
  total: number;
  journeyEnd: number;
  phase: Phase;
  truck: {
    segment: "approach" | "branch";
    progress: number;
    x: number;
    z: number;
    heading: number;
  };
  tempC: number | null;
  band: Band;
  temperatureState: "observed" | "unknown" | "beyond-readings";
  inGap: boolean;
  gap: Gap | null;
  /** Wall-clock time of the last reading at or before t (UTC); it stops at the decision point. */
  timeLabel: string;
  /**
   * Whole minutes of the delay clock once the scenario run has started, or null
   * before it and when the delay is unknown. Schematic: no readings exist here.
   */
  branchElapsed: number | null;
  /** The truck is currently waiting out the delay. */
  dwelling: boolean;
  /** The delay is longer than LINEAR_DELAY, so its drawn length is compressed. */
  axisCompressed: boolean;
  /** The scenario run is finished. Never true while the delay is unknown. */
  complete: boolean;
  delayMinutes: number | null;
  delayTotal: number | null;
  costTicker: string | null;
  costTotal: string;
  destination: NodeKey;
  blockedAtBarrier: boolean;
};

export function formatClock(minuteOfDay: number): string {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function journeyMinutes(
  readings: Reading[],
  stepMinutes: number,
): number {
  return readings.length >= 2
    ? (readings.length - 1) * stepMinutes
    : DEFAULT_JOURNEY_MINUTES;
}

export function validDelay(delayMinutes: number): boolean {
  return (
    Number.isFinite(delayMinutes) &&
    delayMinutes >= 0 &&
    delayMinutes <= MAX_DELAY
  );
}

/**
 * Axis minutes that a delay of `delayMinutes` real minutes occupies. Up to
 * LINEAR_DELAY it is 1:1; beyond that the axis is compressed (log scale) so a
 * year-long delay stays playable. Monotonic, so longer delays always look
 * longer. Only the drawn length is compressed, never a displayed number.
 */
export function dwellAxis(delayMinutes: number): number {
  if (!(delayMinutes > LINEAR_DELAY)) return Math.max(0, delayMinutes);
  return (
    LINEAR_DELAY +
    COMPRESS_SCALE * Math.log1p((delayMinutes - LINEAR_DELAY) / COMPRESS_SCALE)
  );
}

/** Inverse of dwellAxis: real minutes after `axisMinutes` of dwell. */
export function dwellReal(axisMinutes: number): number {
  if (!(axisMinutes > LINEAR_DELAY)) return Math.max(0, axisMinutes);
  return (
    LINEAR_DELAY +
    COMPRESS_SCALE * Math.expm1((axisMinutes - LINEAR_DELAY) / COMPRESS_SCALE)
  );
}

export type Branch = {
  /** Axis minutes driving before the wait. */
  pre: number;
  /** Axis minutes of the wait (0 when the delay is unknown). */
  dwell: number;
  /** Axis minutes driving after the wait. */
  post: number;
  /** pre + dwell + post. */
  span: number;
  /** Fraction of the leg at which the truck waits. */
  at: number;
  delayKnown: boolean;
  /** The delay is longer than LINEAR_DELAY, so the axis is compressed. */
  compressed: boolean;
};

/**
 * Timeline of one scenario run after the decision point. A null, negative,
 * non-finite or over-limit delay is unknown, not 0: the truck gets as far as
 * its waiting point and never completes.
 */
export function branchOf(type: string, delayMinutes: number): Branch {
  const at = DWELL_AT[type] ?? 1;
  const delayKnown = validDelay(delayMinutes);
  const dwell = delayKnown ? dwellAxis(delayMinutes) : 0;
  const pre = at * LEG_MINUTES;
  const post = (1 - at) * LEG_MINUTES;
  return {
    pre,
    dwell,
    post,
    span: pre + dwell + post,
    at,
    delayKnown,
    compressed: delayKnown && delayMinutes > LINEAR_DELAY,
  };
}

export type DelayInput = { type: string; delayMinutes: number };

/** Longest scenario run on the shared axis; `only` limits it to one scenario. */
export function axisSpan(scenarios: DelayInput[], only?: string): number {
  const spans = scenarios
    .filter((s) => only === undefined || s.type === only)
    .map((s) => branchOf(s.type, s.delayMinutes).span);
  return spans.length ? Math.max(...spans) : LEG_MINUTES;
}

/** Axis length: the journey plus the longest scenario run shown. */
export function totalMinutes(
  readings: Reading[],
  stepMinutes: number,
  scenarios: DelayInput[],
  only?: string,
): number {
  return journeyMinutes(readings, stepMinutes) + axisSpan(scenarios, only);
}

export function findGaps(
  readings: Reading[],
  startMinute: number,
  stepMinutes: number,
): Gap[] {
  const gaps: Gap[] = [];
  const journey = journeyMinutes(readings, stepMinutes);
  let i = 0;
  while (i < readings.length) {
    if (readings[i] !== null) {
      i += 1;
      continue;
    }
    const startIndex = i;
    while (i < readings.length && readings[i] === null) i += 1;
    const endIndex = i - 1;
    gaps.push({
      startIndex,
      endIndex,
      fromMin: startIndex * stepMinutes,
      untilMin: i < readings.length ? i * stepMinutes : journey,
      label: `${formatClock(startMinute + startIndex * stepMinutes)}–${formatClock(startMinute + endIndex * stepMinutes)}`,
    });
  }
  return gaps;
}

export function easeOutCubic(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return 1 - Math.pow(1 - c, 3);
}

const MONEY = /^\d+\.\d{2}$/;

/** Eased Decimal-safe fraction of a money string; fraction 1 returns it exactly. */
export function moneyAt(total: string, eased: number): string | null {
  if (!MONEY.test(total)) return null;
  if (eased >= 1) return total;
  const [whole, fraction] = total.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction);
  const scaled =
    (cents * BigInt(Math.round(Math.max(0, eased) * 10000))) / BigInt(10000);
  return `${scaled / BigInt(100)}.${String(scaled % BigInt(100)).padStart(2, "0")}`;
}

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

export function stateAt(input: ClockInput, tRaw: number): Frame {
  const { readings, startMinute, stepMinutes: step } = input;
  const journeyEnd = journeyMinutes(readings, step);
  const br = branchOf(input.scenario, input.delayMinutes);
  const total = journeyEnd + br.span;
  // Shared time: not clamped to this run's end, so compared runs stay on one axis.
  const t = Math.max(0, Number.isFinite(tRaw) ? tRaw : 0);
  const dest: NodeKey = DESTINATION[input.scenario] ?? "receiver";
  const gaps = findGaps(readings, startMinute, step);
  const b = Math.min(br.span, Math.max(0, t - journeyEnd));
  const done = br.delayKnown && t >= total - 1e-9;

  const phase: Phase =
    t < journeyEnd - 1e-9
      ? "journey"
      : Math.abs(t - journeyEnd) <= 1e-9
        ? "decision"
        : done
          ? "arrived"
          : "branch";

  let temperatureState: Frame["temperatureState"];
  let tempC: number | null = null;
  let gap: Gap | null = null;
  if (phase === "journey" || phase === "decision") {
    if (readings.length === 0) {
      temperatureState = "unknown";
    } else {
      const idx = Math.min(readings.length - 1, Math.floor(t / step + 1e-9));
      const value = readings[idx];
      if (value === null || value === undefined) {
        temperatureState = "unknown";
        gap =
          gaps.find((g) => idx >= g.startIndex && idx <= g.endIndex) ?? null;
      } else {
        temperatureState = "observed";
        tempC = value;
      }
    }
  } else {
    temperatureState = "beyond-readings";
  }

  const O = NODES.origin;
  const D = NODES.decision;
  const T = NODES[dest];
  // Position on the leg: drive to the waiting point, wait, then finish the
  // leg. An unknown delay never ends the wait.
  const waitEnd = br.pre + br.dwell;
  const waited = Math.min(br.dwell, Math.max(0, b - br.pre));
  const branchFrac =
    b < br.pre
      ? b / LEG_MINUTES
      : !br.delayKnown || b < waitEnd
        ? br.at
        : Math.min(1, (b - br.dwell) / LEG_MINUTES);
  const blockedAtBarrier = !!input.blocked && b > 0;
  const progressOnBranch = input.blocked
    ? Math.min(branchFrac, BARRIER_AT)
    : branchFrac;
  const approach = phase === "journey";
  const a = approach ? t / journeyEnd : progressOnBranch;
  const from = approach ? O : D;
  const to = approach ? D : T;

  const eased = easeOutCubic(b / br.span);
  const started = phase === "branch" || phase === "arrived";
  // The clock counts real minutes; it ends on exactly the entered value.
  const clock = br.delayKnown
    ? b >= waitEnd - 1e-9
      ? input.delayMinutes
      : Math.floor(dwellReal(waited))
    : null;
  return {
    t,
    total,
    journeyEnd,
    phase,
    truck: {
      segment: approach ? "approach" : "branch",
      progress: a,
      x: lerp(from.x, to.x, a),
      z: lerp(from.z, to.z, a),
      heading: Math.atan2(to.z - from.z, to.x - from.x),
    },
    tempC,
    band: thermalBand(tempC),
    temperatureState,
    inGap: gap !== null,
    gap,
    timeLabel: formatClock(startMinute + Math.min(t, journeyEnd)),
    branchElapsed: started ? clock : null,
    dwelling:
      started &&
      br.delayKnown &&
      br.dwell > 0 &&
      b >= br.pre - 1e-9 &&
      b < waitEnd - 1e-9,
    axisCompressed: br.compressed,
    complete: done,
    delayMinutes: clock,
    delayTotal: br.delayKnown ? input.delayMinutes : null,
    costTicker: moneyAt(input.totalCost, eased),
    costTotal: input.totalCost,
    destination: dest,
    blockedAtBarrier,
  };
}

/** One frame per scenario on the same time scale, for compare mode. */
export function compareFrames(
  base: Omit<ClockInput, "scenario" | "delayMinutes" | "totalCost" | "blocked">,
  scenarios: {
    type: string;
    delayMinutes: number;
    totalCost: string;
    blocked?: boolean;
  }[],
  t: number,
): Frame[] {
  return scenarios.map((s) =>
    stateAt(
      {
        ...base,
        scenario: s.type,
        delayMinutes: s.delayMinutes,
        totalCost: s.totalCost,
        blocked: s.blocked,
      },
      t,
    ),
  );
}

/** Time to show on first paint: reduced motion goes straight to the final frame. */
export function initialTime(total: number, reducedMotion: boolean): number {
  return reducedMotion ? total : 0;
}

export type AdvanceResult = {
  t: number;
  decisionHit: boolean;
  finished: boolean;
};

/**
 * Advance playback. The first time playback crosses the decision point it
 * stops exactly there so the person can choose how to proceed.
 */
export function advance(
  t: number,
  dtMinutes: number,
  o: { journeyEnd: number; total: number; decided: boolean },
): AdvanceResult {
  if (!o.decided && t < o.journeyEnd && t + dtMinutes >= o.journeyEnd)
    return { t: o.journeyEnd, decisionHit: true, finished: false };
  const next = Math.min(o.total, t + dtMinutes);
  return { t: next, decisionHit: false, finished: next >= o.total };
}

/** A person has "decided" once the clock is past the decision point. */
export function isPastDecision(t: number, journeyEnd: number): boolean {
  return t > journeyEnd + 1e-9;
}
