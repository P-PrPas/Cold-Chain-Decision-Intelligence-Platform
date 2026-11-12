import { describe, expect, it } from "vitest";
import {
  BARRIER_AT,
  BRANCH_MINUTES,
  NODES,
  SCENARIO_ORDER,
  advance,
  compareFrames,
  findGaps,
  initialTime,
  isPastDecision,
  moneyAt,
  stateAt,
  thermalBand,
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
const TOTAL = J + BRANCH_MINUTES;

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

describe("branch elapsed time", () => {
  it("is null on the journey and at the decision point", () => {
    expect(stateAt(base(readings), 100).branchElapsed).toBeNull();
    expect(stateAt(base(readings), J).branchElapsed).toBeNull();
  });
  it("counts scenario minutes while the reading time stays at the last reading", () => {
    const f = stateAt(base(readings), J + 45);
    expect(f.phase).toBe("branch");
    expect(f.branchElapsed).toBe(45);
    expect(f.timeLabel).toBe("12:00");
  });
  it("ends at the full branch length", () => {
    const f = stateAt(base(readings), TOTAL);
    expect(f.phase).toBe("arrived");
    expect(f.branchElapsed).toBe(BRANCH_MINUTES);
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
      TOTAL,
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
