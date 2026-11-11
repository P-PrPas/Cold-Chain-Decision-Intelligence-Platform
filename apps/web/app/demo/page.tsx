"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Scene, { scenarioNames } from "../scene";
import FactorControls from "../factor-controls";
import {
  freshAssumptions,
  totalCost,
  sameAssumptions,
  type Assumptions,
} from "../simulation-assumptions";
const shipments = [
  {
    id: "DEMO-001",
    product: "Strawberries",
    route: "Chiang Mai / Bangkok",
    status: "Temperature excursion",
    readings: [3, 3.2, 3.4, 4, 6.5, 8.1, 7.2, 5.1, 3.7],
    note: "An illustrative rise during the journey. Hold for inspection is highlighted for this demo; this is not a policy determination.",
    recommended: "HOLD_INSPECTION",
  },
  {
    id: "DEMO-002",
    product: "Chilled dairy",
    route: "Nakhon Ratchasima / Bangkok",
    status: "Complete sample data",
    readings: [3.1, 3.3, 3.2, 3.6, 3.5, 3.2, 3.1, 3.4, 3.3],
    note: "A stable illustrative temperature trace. Stable readings alone do not establish product safety.",
    recommended: "CONTINUE_DELIVERY",
  },
  {
    id: "DEMO-003",
    product: "Fresh produce",
    route: "Rayong / Bangkok",
    status: "Missing sensor evidence",
    readings: [4, 4.2, 4.5, null, null, null, 5.2, 4.8, 4.5],
    note: "Sensor readings are absent from 09:30 to 10:30. The gap stays visible; no temperature is inferred.",
    recommended: "HOLD_INSPECTION",
  },
];
const options = [
  {
    type: "CONTINUE_DELIVERY",
    cost: "1,200",
    delay: "0",
    detail:
      "Original destination. Review the temperature evidence and recipient requirements.",
  },
  {
    type: "HOLD_INSPECTION",
    cost: "2,800",
    delay: "120",
    detail:
      "Controlled inspection stop. Additional handling and inspection costs are illustrative.",
  },
  {
    type: "CONDITIONAL_REROUTE",
    cost: "4,500",
    delay: "90",
    detail:
      "Alternative receiving facility. Acceptance has not been confirmed.",
  },
  {
    type: "REJECT_QUARANTINE_DISPOSE",
    cost: "6,000",
    delay: "180",
    detail:
      "Isolation pathway. No disposal or other real-world action is performed.",
  },
];
function demoBaseline(): Assumptions {
  const value = freshAssumptions();
  value.scenarios = value.scenarios.map((s, i) => ({
    ...s,
    estimated_delay_minutes: Number(options[i].delay),
    costs: {
      ...s.costs,
      other: {
        amount: options[i].cost.replaceAll(",", "") + ".00",
        source: "USER_ESTIMATE",
      },
    },
  }));
  return value;
}
export default function Demo() {
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState("HOLD_INSPECTION");
  const [baseline] = useState(demoBaseline),
    [draft, setDraft] = useState(demoBaseline);
  const [panel, setPanel] = useState<"evidence" | "comparison" | null>(null);
  const [reviewed, setReviewed] = useState(false),
    [proposal, setProposal] = useState(false),
    [linkNotice, setLinkNotice] = useState("");
  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.search).get("shipment");
      const found = shipments.findIndex((s) => s.id === value),
        i = found >= 0 ? found : 0;
      setIndex(i);
      setSelected(shipments[i].recommended);
      setDraft(demoBaseline());
      setReviewed(false);
      setProposal(false);
      setLinkNotice(
        value && found < 0 ? "Unknown example link. Showing DEMO-001." : "",
      );
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  function chooseShipment(i: number) {
    setIndex(i);
    setSelected(shipments[i].recommended);
    setDraft(demoBaseline());
    setReviewed(false);
    setProposal(false);
    window.history.replaceState(null, "", `/demo?shipment=${shipments[i].id}`);
  }
  function change(value: Assumptions) {
    setDraft(value);
    setReviewed(false);
    setProposal(false);
  }
  const shipment = shipments[index],
    scenario = draft.scenarios.find((s) => s.type === selected)!;
  const original = baseline.scenarios.find((s) => s.type === selected)!;
  return (
    <main className="demo-studio">
      <header className="studio-heading">
        <div>
          <p className="context-label">SIMULATION EXPLORER / SYNTHETIC</p>
          <h1>
            {shipment.id} <span>{shipment.product}</span>
          </h1>
        </div>
        <label>
          Example shipment
          <select
            value={index}
            onChange={(e) => chooseShipment(Number(e.target.value))}
          >
            {shipments.map((s, i) => (
              <option key={s.id} value={i}>
                {s.id} / {s.product}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="quiet"
          onClick={() => chooseShipment(0)}
        >
          Reset demo
        </button>
      </header>
      {linkNotice && <p role="status">{linkNotice}</p>}
      <div className="studio-evidence-bar">
        <strong>Synthetic demo only</strong>
        <span>
          {shipment.readings.filter((v) => v !== null).length} / 9 readings
          available
        </span>
        <span>{shipment.status}</span>
        <span>Policy: not evaluated</span>
        <button
          type="button"
          onClick={() => setPanel(panel === "evidence" ? null : "evidence")}
        >
          Inspect evidence
        </button>
      </div>
      <div className="scenario-strip" role="group" aria-label="Select scenario">
        {options.map((option) => (
          <button
            type="button"
            key={option.type}
            aria-pressed={selected === option.type}
            onClick={() => {
              setSelected(option.type);
              setProposal(false);
              setReviewed(false);
            }}
          >
            {scenarioNames[option.type]}
          </button>
        ))}
      </div>
      <div className="studio-grid">
        <div className="studio-scene">
          <Scene
            scenario={selected}
            origin={shipment.route.split(" / ")[0]}
            destination={shipment.route.split(" / ")[1]}
            context={`${shipment.id} / illustrative draft, no saved run`}
            cost={totalCost(scenario)}
            delay={String(scenario.estimated_delay_minutes)}
            currency={draft.currency}
            acceptance={scenario.receiver_acceptance}
            eligibility="Not evaluated / demo estimates"
            missing={
              shipment.readings.some((v) => v === null)
                ? "Readings absent 09:30 to 10:30 UTC; no interpolation"
                : undefined
            }
            compact
          />
          <div className="baseline-delta">
            Against prepared baseline:{" "}
            {Number(totalCost(scenario)) - Number(totalCost(original)) >= 0
              ? "+"
              : ""}
            {(
              Number(totalCost(scenario)) - Number(totalCost(original))
            ).toFixed(2)}{" "}
            THB /{" "}
            {scenario.estimated_delay_minutes -
              original.estimated_delay_minutes >=
            0
              ? "+"
              : ""}
            {scenario.estimated_delay_minutes -
              original.estimated_delay_minutes}{" "}
            min. {sameAssumptions(draft, baseline) ? "Unchanged" : "Modified"}
          </div>
        </div>
        <aside className="studio-inspector" aria-label="Scenario factors">
          <FactorControls
            value={draft}
            baseline={baseline}
            selected={selected}
            onChange={change}
            baselineLabel="prepared demo estimates"
          />
          <p className="notice">
            Immediate illustrative preview. Engine eligibility and ranking are
            available in the connected workspace; this demo never saves runs.
          </p>
          <div
            className="weight-meter"
            aria-label={`Preference: cost ${Number(draft.ranking_weights.cost) * 100} percent, delay ${Number(draft.ranking_weights.delay) * 100} percent`}
          >
            <span
              style={{ width: `${Number(draft.ranking_weights.cost) * 100}%` }}
            >
              Cost
            </span>
            <span>Delay</span>
          </div>
        </aside>
      </div>
      <div className="studio-panel-controls">
        <button
          type="button"
          aria-expanded={panel === "evidence"}
          onClick={() => setPanel(panel === "evidence" ? null : "evidence")}
        >
          Evidence and readings
        </button>
        <button
          type="button"
          aria-expanded={panel === "comparison"}
          onClick={() => setPanel(panel === "comparison" ? null : "comparison")}
        >
          Compare estimates
        </button>
        <Link href="/workspace">Open connected workspace</Link>
      </div>
      {panel === "evidence" && (
        <div className="studio-evidence-panel">
          {" "}
          <section aria-label="Temperature evidence detail">
            <span className="eyebrow">TEMPERATURE EVIDENCE</span>
            <h2>Temperature evidence</h2>
            <div className="evidence-summary">
              <strong>{shipment.status}</strong>
              <span>
                {shipment.readings.filter((v) => v !== null).length} / 9
                readings available
              </span>
              <span>Policy evaluation: not performed</span>
              <span>
                Journey: 08:00 - 12:00 UTC / range{" "}
                {Math.min(
                  ...shipment.readings.filter((v): v is number => v !== null),
                )}{" "}
                -{" "}
                {Math.max(
                  ...shipment.readings.filter((v): v is number => v !== null),
                )}{" "}
                Celsius
              </span>
            </div>
            <p>
              Sample temperatures in Celsius, every 30 minutes from 08:00 to
              12:00 UTC. No approved temperature limits are implied.
            </p>
            <p className="chart-hint">
              Scroll the chart horizontally on smaller screens to inspect the
              full journey. Exact readings are available below.
            </p>
            <div
              className="chart-scroll"
              tabIndex={0}
              role="region"
              aria-label="Temperature chart; scroll horizontally for all times"
            >
              <svg
                className="demo-chart"
                viewBox="0 0 800 210"
                role="img"
                aria-label={`${shipment.product} example temperature trace. Exact readings are listed below.`}
              >
                {[0, 5, 10].map((value) => (
                  <g key={value}>
                    <line
                      x1="40"
                      x2="760"
                      y1={175 - value * 14}
                      y2={175 - value * 14}
                      stroke="var(--line)"
                    />
                    <text
                      x="5"
                      y={180 - value * 14}
                      fill="var(--muted)"
                      fontSize="12"
                    >
                      {value} C
                    </text>
                  </g>
                ))}
                {shipment.readings.map((value, i) => {
                  const previous = shipment.readings[i - 1];
                  return value === null ? (
                    <text
                      key={i}
                      x={40 + i * 90}
                      y="100"
                      fill="var(--muted)"
                      textAnchor="middle"
                      fontSize="11"
                    >
                      No data
                    </text>
                  ) : (
                    <g key={i}>
                      {i > 0 && previous != null && (
                        <line
                          x1={40 + (i - 1) * 90}
                          y1={175 - previous * 14}
                          x2={40 + i * 90}
                          y2={175 - value * 14}
                          stroke="var(--accent)"
                          strokeWidth="2"
                        />
                      )}
                      <circle
                        cx={40 + i * 90}
                        cy={175 - value * 14}
                        r="4"
                        fill="var(--accent)"
                      />
                    </g>
                  );
                })}
                {["08:00", "09:00", "10:00", "11:00", "12:00"].map(
                  (time, i) => (
                    <text
                      key={time}
                      x={40 + i * 180}
                      y="202"
                      textAnchor="middle"
                      fill="var(--muted)"
                      fontSize="12"
                    >
                      {time}
                    </text>
                  ),
                )}
              </svg>
            </div>
            <details>
              <summary>Exact sample readings</summary>
              <table>
                <thead>
                  <tr>
                    <th>Time (UTC)</th>
                    <th>Temperature</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.readings.map((value, i) => (
                    <tr key={i}>
                      <td>
                        {String(8 + Math.floor(i / 2)).padStart(2, "0")}:
                        {i % 2 ? "30" : "00"}
                      </td>
                      <td>
                        {value === null ? "Missing reading" : `${value} C`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
          <p>{shipment.note}</p>
          <label className="confirmation-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I reviewed the synthetic evidence and its limitations for this
            selection.
          </label>
        </div>
      )}
      {panel === "comparison" && (
        <section>
          <h2>Compare illustrative assumptions</h2>
          <p>No calculated eligibility or ranking is implied.</p>
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Direct cost (THB)</th>
                <th>Additional delay</th>
              </tr>
            </thead>
            <tbody>
              {draft.scenarios.map((s) => (
                <tr key={s.type} data-selected={s.type === selected}>
                  <td>
                    <button
                      type="button"
                      aria-pressed={s.type === selected}
                      onClick={() => {
                        setSelected(s.type);
                        setReviewed(false);
                        setProposal(false);
                      }}
                    >
                      {scenarioNames[s.type]}
                    </button>
                  </td>
                  <td>{totalCost(s)}</td>
                  <td>{s.estimated_delay_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="proposal-handoff">
        <h2>Prepare a decision</h2>
        <p>
          Inspect evidence before preparing a proposal. Real proposals require a
          saved engine run and QA review.
        </p>
        <button
          type="button"
          disabled={!reviewed}
          onClick={() => setProposal(true)}
        >
          Preview demo proposal
        </button>
        {!reviewed && (
          <button
            type="button"
            className="quiet"
            onClick={() => setPanel("evidence")}
          >
            Review evidence first
          </button>
        )}
        {proposal && (
          <div role="status">
            <strong>
              {shipment.id} / {scenarioNames[selected]}
            </strong>
            <p>
              {totalCost(scenario)} THB / {scenario.estimated_delay_minutes} min
              / illustrative draft, no engine run.
            </p>
            <p>No proposal was saved or submitted.</p>
          </div>
        )}
      </section>
    </main>
  );
}
