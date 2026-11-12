import { describe, expect, it } from "vitest";
import {
  BARRIER_AT,
  LEG_MINUTES,
  LINEAR_DELAY,
  MAX_DELAY,
  NODES,
  SCENARIO_ORDER,
  advance,
  axisSpan,
  branchOf,
  compareFrames,
  dwellAxis,
  dwellReal,
  findGaps,
  initialTime,
  isPastDecision,
  moneyAt,
  stateAt,
  thermalBand,
  totalMinutes,
  validDelay,
  type ClockInput,
  type Reading,
} from "./sim-clock";
import { freshAssumptions, totalCost } from "../simulation-assumptions";

const readings: Reading[] = [3, 3.2, 3.4, 4, 6.5, 8.1, 7.2, 5.1, 3.7];
const gapped: Reading[] = [4, 4.2, 4.5, null, null, null, 5.2, 4.8, 4.5];
const base = (r: Reading[], over: Partial<ClockInput> = {}): ClockInput => ({
  readings: r,
  startMinute: 480,
  stepMinutes: 30,
  scenario: "HOLD_INSPECTION",
  delayMinutes: 120,
  totalCost: "2800.00",
  ...over,
});
const J = 240;
// Default scenario: hold for inspection, 120 min delay (leg 60 + wait 120).
const TOTAL = J + LEG_MINUTES + 120;

describe("zero-order hold", () => {
  it("holds a reading until the next slot starts", () => {
    expect(stateAt(base(readings), 0).tempC).toBe(3);
    expect(stateAt(base(readings), 29.9).tempC).toBe(3);
    expect(stateAt(base(readings), 30).tempC).toBe(3.2);
    expect(stateAt(base(readings), 119.9).tempC).toBe(4);
    expect(stateAt(base(readings), 120).tempC).toBe(6.5);
  });

  it("never interpolates between readings", () => {
    // Halfway between 6.5 and 8.1 the value is still exactly 6.5.
    expect(stateAt(base(readings), 135).tempC).toBe(6.5);
    expect(stateAt(base(readings), 149.99).tempC).toBe(6.5);
  });

  it("reports observed state and a thermal band for known readings", () => {
    const f = stateAt(base(readings), 150);
    expect(f.temperatureState).toBe("observed");
    expect(f.band).toBe(thermalBand(8.1));
    expect(f.inGap).toBe(false);
  });
});

describe("gaps are unknown", () => {
  it("a null slot yields unknown, not the previous value", () => {
    const f = stateAt(base(gapped), 90);
    expect(f.tempC).toBeNull();
    expect(f.band).toBe("unknown");
    expect(f.temperatureState).toBe("unknown");
    expect(f.inGap).toBe(true);
  });

  it("gap boundaries: starts at the first null slot, ends when readings resume", () => {
    expect(stateAt(base(gapped), 89.9).inGap).toBe(false);
    expect(stateAt(base(gapped), 89.9).tempC).toBe(4.5);
    expect(stateAt(base(gapped), 90).inGap).toBe(true);
    expect(stateAt(base(gapped), 179.9).inGap).toBe(true);
    expect(stateAt(base(gapped), 180).inGap).toBe(false);
    expect(stateAt(base(gapped), 180).tempC).toBe(5.2);
  });

  it("labels the gap with the missing slot times in UTC", () => {
    const [g] = findGaps(gapped, 480, 30);
    expect(g.label).toBe("09:30–10:30");
    expect(g.fromMin).toBe(90);
    expect(g.untilMin).toBe(180);
    expect(stateAt(base(gapped), 100).gap?.label).toBe("09:30–10:30");
  });

  it("a trailing gap runs to the end of the journey", () => {
    const [g] = findGaps([4, 4, null, null], 480, 30);
    expect(g.untilMin).toBe(90);
  });

  it("no gap means no gaps found", () => {
    expect(findGaps(readings, 480, 30)).toEqual([]);
  });
});

describe("phases and decision pause", () => {
  it("moves journey, decision, branch, arrived", () => {
    expect(stateAt(base(readings), 10).phase).toBe("journey");
    expect(stateAt(base(readings), J).phase).toBe("decision");
    expect(stateAt(base(readings), J + 1).phase).toBe("branch");
    expect(stateAt(base(readings), TOTAL).phase).toBe("arrived");
  });

  it("after the last reading no temperature is modelled", () => {
    const f = stateAt(base(readings), J + 30);
    expect(f.tempC).toBeNull();
    expect(f.band).toBe("unknown");
    expect(f.temperatureState).toBe("beyond-readings");
  });

  it("playback auto-pauses exactly at the decision point once", () => {
    const hit = advance(235, 20, {
      journeyEnd: J,
      total: TOTAL,
      decided: false,
    });
    expect(hit).toEqual({ t: J, decisionHit: true, finished: false });
    const onward = advance(J, 20, {
      journeyEnd: J,
      total: TOTAL,
      decided: true,
    });
    expect(onward.t).toBe(J + 20);
    expect(onward.decisionHit).toBe(false);
  });

  it("playback clamps at the end", () => {
    const end = advance(TOTAL - 1, 50, {
      journeyEnd: J,
      total: TOTAL,
      decided: true,
    });
    expect(end).toEqual({ t: TOTAL, decisionHit: false, finished: true });
  });

  it("past-decision detection", () => {
    expect(isPastDecision(J, J)).toBe(false);
    expect(isPastDecision(J + 1, J)).toBe(true);
  });
});

describe("delay clock (branch elapsed)", () => {
  it("is null on the journey and at the decision point", () => {
    expect(stateAt(base(readings), 100).branchElapsed).toBeNull();
    expect(stateAt(base(readings), J).branchElapsed).toBeNull();
  });
  it("stays at 0 while the truck drives to the node, then counts the wait", () => {
    const driving = stateAt(base(readings), J + 30);
    expect(driving.phase).toBe("branch");
    expect(driving.branchElapsed).toBe(0);
    expect(driving.dwelling).toBe(false);
    expect(driving.timeLabel).toBe("12:00");
    const waiting = stateAt(base(readings), J + LEG_MINUTES + 45);
    expect(waiting.branchElapsed).toBe(45);
    expect(waiting.dwelling).toBe(true);
    expect(waiting.truck.progress).toBe(1);
  });
  it("ends on exactly the entered delay", () => {
    const f = stateAt(base(readings), TOTAL);
    expect(f.phase).toBe("arrived");
    expect(f.complete).toBe(true);
    expect(f.branchElapsed).toBe(120);
    expect(f.dwelling).toBe(false);
  });
});

describe("delay drives time", () => {
  const at = (delay: number, type = "HOLD_INSPECTION") =>
    base(readings, { scenario: type, delayMinutes: delay });
  it("delay 0 and delay 240 arrive at different times", () => {
    expect(stateAt(at(0), 0).total).toBe(J + LEG_MINUTES);
    expect(stateAt(at(240), 0).total).toBe(J + LEG_MINUTES + 240);
    // The same instant: one has arrived, the other is still waiting.
    const t = J + LEG_MINUTES + 10;
    expect(stateAt(at(0), t).phase).toBe("arrived");
    expect(stateAt(at(240), t).phase).toBe("branch");
    expect(stateAt(at(240), t).dwelling).toBe(true);
  });
  it("a longer delay never finishes sooner", () => {
    let prev = 0;
    for (const d of [0, 1, 30, 240, 241, 1000, 20000, MAX_DELAY]) {
      const span = branchOf("HOLD_INSPECTION", d).span;
      expect(span).toBeGreaterThanOrEqual(prev);
      prev = span;
    }
  });
  it("Continue waits at the decision point, then drives", () => {
    const o = at(100, "CONTINUE_DELIVERY");
    const waiting = stateAt(o, J + 50);
    expect(waiting.dwelling).toBe(true);
    expect(waiting.truck.x).toBeCloseTo(NODES.decision.x, 9);
    const driving = stateAt(o, J + 100 + 30);
    expect(driving.dwelling).toBe(false);
    expect(driving.branchElapsed).toBe(100);
    expect(driving.truck.progress).toBeCloseTo(0.5, 9);
    expect(stateAt(o, J + 160).phase).toBe("arrived");
  });
  it("the truck stands still while it waits at the node", () => {
    const hold = at(100);
    const a = stateAt(hold, J + LEG_MINUTES + 20).truck;
    const b = stateAt(hold, J + LEG_MINUTES + 80).truck;
    expect([a.x, a.z]).toEqual([b.x, b.z]);
  });
});

describe("unknown delay is not zero", () => {
  for (const bad of [NaN, Infinity, -5, MAX_DELAY + 1]) {
    it(`${bad} is unknown and the run never completes`, () => {
      expect(validDelay(bad)).toBe(false);
      const f = stateAt(base(readings, { delayMinutes: bad }), 1e9);
      expect(f.delayMinutes).toBeNull();
      expect(f.delayTotal).toBeNull();
      expect(f.branchElapsed).toBeNull();
      expect(f.complete).toBe(false);
      expect(f.phase).toBe("branch");
      expect(f.dwelling).toBe(false);
    });
  }
  it("0 is a valid delay and completes", () => {
    expect(validDelay(0)).toBe(true);
    expect(stateAt(base(readings, { delayMinutes: 0 }), 1e9).complete).toBe(
      true,
    );
  });
  it("Continue with an unknown delay never leaves the decision point", () => {
    const f = stateAt(
      base(readings, { scenario: "CONTINUE_DELIVERY", delayMinutes: NaN }),
      1e9,
    );
    expect(f.truck.x).toBeCloseTo(NODES.decision.x, 9);
  });
});

describe("large delays and the compressed axis", () => {
  it("is 1:1 up to the linear limit and strictly increasing after it", () => {
    for (const d of [0, 1, 120, LINEAR_DELAY]) expect(dwellAxis(d)).toBe(d);
    expect(dwellAxis(LINEAR_DELAY + 1)).toBeGreaterThan(LINEAR_DELAY);
    expect(dwellAxis(1000)).toBeGreaterThan(dwellAxis(500));
    expect(dwellAxis(MAX_DELAY)).toBeGreaterThan(dwellAxis(MAX_DELAY - 1));
  });
  it("keeps a one-year delay playable", () => {
    expect(dwellAxis(MAX_DELAY)).toBeLessThan(1200);
  });
  it("dwellReal inverts dwellAxis", () => {
    for (const d of [0, 100, 240, 241, 700, 5000, 100000, MAX_DELAY])
      expect(dwellReal(dwellAxis(d))).toBeCloseTo(d, 3);
  });
  it("flags compression only beyond the linear limit", () => {
    expect(branchOf("HOLD_INSPECTION", LINEAR_DELAY).compressed).toBe(false);
    expect(branchOf("HOLD_INSPECTION", LINEAR_DELAY + 1).compressed).toBe(true);
    const f = stateAt(base(readings, { delayMinutes: 5000 }), J);
    expect(f.axisCompressed).toBe(true);
  });
  it("the clock counts real minutes, never exceeds the entered value, and ends on it", () => {
    const o = base(readings, { delayMinutes: MAX_DELAY });
    const end = stateAt(o, 1e9);
    expect(end.delayMinutes).toBe(MAX_DELAY);
    expect(end.branchElapsed).toBe(MAX_DELAY);
    let prev = -1;
    for (let t = J; t <= end.total; t += 7) {
      const c = stateAt(o, t).delayMinutes!;
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c).toBeLessThanOrEqual(MAX_DELAY);
      prev = c;
    }
  });
  it("a one-year delay still completes at the end of its axis", () => {
    const f = stateAt(base(readings, { delayMinutes: MAX_DELAY }), 1e9);
    expect(f.phase).toBe("arrived");
    expect(f.complete).toBe(true);
  });
});

describe("shared axis", () => {
  const four = [
    { type: "CONTINUE_DELIVERY", delayMinutes: 0 },
    { type: "HOLD_INSPECTION", delayMinutes: 240 },
    { type: "CONDITIONAL_REROUTE", delayMinutes: 90 },
    { type: "REJECT_QUARANTINE_DISPOSE", delayMinutes: 30 },
  ];
  it("is the journey plus the longest run, or only the selected run", () => {
    const longest = LEG_MINUTES + 240;
    expect(axisSpan(four)).toBe(longest);
    expect(totalMinutes(readings, 30, four)).toBe(J + longest);
    expect(totalMinutes(readings, 30, four, "CONTINUE_DELIVERY")).toBe(
      J + LEG_MINUTES,
    );
  });
  it("compare frames share one instant but arrive at different times", () => {
    const frames = compareFrames(
      { readings, startMinute: 480, stepMinutes: 30 },
      four.map((s) => ({ ...s, totalCost: "100.00" })),
      J + LEG_MINUTES + 40,
    );
    expect(new Set(frames.map((f) => f.t)).size).toBe(1);
    expect(frames.map((f) => f.complete)).toEqual([true, false, false, true]);
    expect(frames.map((f) => f.total)).toEqual([
      J + 60,
      J + 300,
      J + 150,
      J + 90,
    ]);
    // The longest run is still waiting at the node while the others are done.
    expect(frames[1].dwelling).toBe(true);
    expect(frames[1].delayMinutes).toBe(40);
  });
  it("totals tick up together and each ends on its own exact total", () => {
    const totals = ["10.00", "2800.00", "4500.10", "6000.05"];
    const frames = (t: number) =>
      compareFrames(
        { readings, startMinute: 480, stepMinutes: 30 },
        four.map((s, i) => ({ ...s, totalCost: totals[i] })),
        t,
      );
    const mid = frames(J + 40).map((f) => Number(f.costTicker));
    mid.forEach((v, i) => expect(v).toBeLessThan(Number(totals[i])));
    expect(frames(1e9).map((f) => f.costTicker)).toEqual(totals);
  });
});

describe("delay clock and cost ticker", () => {
  it("are zero before the branch starts", () => {
    const f = stateAt(base(readings), J);
    expect(f.delayMinutes).toBe(0);
    expect(f.costTicker).toBe("0.00");
  });

  it("final frame equals the totals exactly", () => {
    const a = freshAssumptions();
    const s = a.scenarios[1];
    s.estimated_delay_minutes = 137;
    s.costs.other = { amount: "2800.10", source: "USER_ESTIMATE" };
    s.costs.holding = { amount: "0.07", source: "USER_ESTIMATE" };
    const exact = totalCost(s);
    expect(exact).toBe("2800.17");
    const f = stateAt(
      base(readings, { delayMinutes: 137, totalCost: exact }),
      J + LEG_MINUTES + 137,
    );
    expect(f.costTicker).toBe(exact);
    expect(f.delayMinutes).toBe(137);
    expect(f.costTotal).toBe(exact);
  });

  it("eases up monotonically without exceeding the total", () => {
    let prev = -1;
    for (let t = J; t <= TOTAL; t += 6) {
      const v = Number(stateAt(base(readings), t).costTicker);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(2800);
      prev = v;
    }
  });

  it("huge amounts stay exact (no float math)", () => {
    expect(moneyAt("9999999999999999.99", 1)).toBe("9999999999999999.99");
    expect(moneyAt("9999999999999999.99", 0.5)).toBe("4999999999999999.99");
  });

  it("an unavailable total yields no ticker, and invalid delay yields no clock", () => {
    const f = stateAt(
      base(readings, { totalCost: "Unavailable", delayMinutes: NaN }),
      TOTAL,
    );
    expect(f.costTicker).toBeNull();
    expect(f.delayMinutes).toBeNull();
  });
});

describe("destinations", () => {
  const expected = {
    CONTINUE_DELIVERY: "receiver",
    HOLD_INSPECTION: "inspection",
    CONDITIONAL_REROUTE: "alt",
    REJECT_QUARANTINE_DISPOSE: "quarantine",
  } as const;
  for (const type of SCENARIO_ORDER)
    it(`${type} ends at ${expected[type]}`, () => {
      const f = stateAt(base(readings, { scenario: type }), TOTAL);
      expect(f.destination).toBe(expected[type]);
      expect(f.truck.x).toBeCloseTo(NODES[expected[type]].x, 9);
      expect(f.truck.z).toBeCloseTo(NODES[expected[type]].z, 9);
      expect(f.truck.segment).toBe("branch");
    });

  it("starts at the origin and reaches the decision point", () => {
    const s = stateAt(base(readings), 0).truck;
    expect([s.x, s.z]).toEqual([NODES.origin.x, NODES.origin.z]);
    const d = stateAt(base(readings), J).truck;
    expect(d.x).toBeCloseTo(NODES.decision.x, 9);
  });

  it("a blocked option stops at a barrier and never reaches the destination", () => {
    const f = stateAt(base(readings, { blocked: true }), TOTAL);
    expect(f.blockedAtBarrier).toBe(true);
    expect(f.truck.progress).toBeCloseTo(BARRIER_AT, 9);
    expect(f.truck.x).not.toBeCloseTo(NODES.inspection.x, 3);
  });
});

describe("compare and reduced motion", () => {
  it("returns one frame per scenario on the same time scale", () => {
    const frames = compareFrames(
      { readings, startMinute: 480, stepMinutes: 30 },
      SCENARIO_ORDER.map((type, i) => ({
        type,
        delayMinutes: i * 30,
        totalCost: `${i}00.00`,
      })),
      J + 60,
    );
    expect(frames).toHaveLength(4);
    expect(new Set(frames.map((f) => f.t)).size).toBe(1);
    expect(new Set(frames.map((f) => f.destination)).size).toBe(4);
  });

  it("reduced motion starts on the final frame", () => {
    expect(initialTime(TOTAL, true)).toBe(TOTAL);
    expect(initialTime(TOTAL, false)).toBe(0);
    expect(stateAt(base(readings), initialTime(TOTAL, true)).phase).toBe(
      "arrived",
    );
  });
});
