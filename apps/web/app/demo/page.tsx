"use client";
import { useState } from "react";
import Link from "next/link";
import Scene, { scenarioNames } from "../scene";
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
export default function Demo() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("HOLD_INSPECTION");
  const [proposal, setProposal] = useState(false);
  const shipment = shipments[index];
  const option = options.find((item) => item.type === selected)!;
  function reset() {
    setIndex(0);
    setSelected("HOLD_INSPECTION");
    setProposal(false);
  }
  return (
    <main>
      <div className="demo-heading">
        <div>
          <span className="eyebrow">INTERACTIVE DEMO / NO SETUP REQUIRED</span>
          <h1>Shipment evidence workspace</h1>
          <p>
            Choose a shipment, inspect its evidence, and explore four possible
            paths.
          </p>
        </div>
        <button className="quiet" onClick={reset}>
          Reset demo
        </button>
      </div>
      <p className="demo-notice">
        <strong>Synthetic demo only.</strong> All readings, costs and outcomes
        below are prepared examples, not backend engine results. Nothing is
        saved or submitted to QA.
      </p>
      <label className="compact-selector">
        Example shipment
        <select
          value={index}
          onChange={(e) => {
            const i = Number(e.target.value);
            setIndex(i);
            setSelected(shipments[i].recommended);
            setProposal(false);
          }}
        >
          {shipments.map((item, i) => (
            <option value={i} key={item.id}>
              {item.id} / {item.product} / {item.status}
            </option>
          ))}
        </select>
      </label>
      <section>
        <span className="eyebrow">TEMPERATURE EVIDENCE</span>
        <h2>Temperature evidence</h2>
        <div className="evidence-summary">
          <strong>{shipment.status}</strong>
          <span>
            {shipment.readings.filter((v) => v !== null).length} / 9 readings
            available
          </span>
          <span>Policy evaluation: not performed</span>
        </div>
        <p>
          Sample temperatures in Celsius, every 30 minutes from 08:00 to 12:00
          UTC. No approved temperature limits are implied.
        </p>
        <p className="chart-hint">
          Scroll the chart horizontally on smaller screens to inspect the full
          journey. Exact readings are available below.
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
            {["08:00", "09:00", "10:00", "11:00", "12:00"].map((time, i) => (
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
            ))}
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
                  <td>{value === null ? "Missing reading" : `${value} C`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <section>
        <span className="eyebrow">SCENARIO COMPARISON</span>
        <h2>Understand the trade-offs.</h2>
        <p>
          These are fixed example costs and delays. There is no calculated
          eligibility or ranking in this demo.
        </p>
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Direct cost (THB)</th>
              <th>Additional delay</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {options.map((item) => (
              <tr key={item.type}>
                <td>
                  <button
                    className="quiet"
                    onClick={() => {
                      setSelected(item.type);
                      setProposal(false);
                    }}
                  >
                    {scenarioNames[item.type]}
                  </button>
                </td>
                <td>{item.cost}</td>
                <td>{item.delay} minutes</td>
                <td>QA review required</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="demo-studio">
        <section className="demo-stage">
          <span className="eyebrow">01 / EXPLORE THE NETWORK</span>
          <h2>{shipment.route}</h2>
          <div className="scenario-tabs" role="group" aria-label="Scenario">
            {options.map((item) => (
              <button
                key={item.type}
                aria-pressed={selected === item.type}
                onClick={() => {
                  setSelected(item.type);
                  setProposal(false);
                }}
              >
                {scenarioNames[item.type]}
              </button>
            ))}
          </div>
          <Scene
            scenario={selected}
            origin={shipment.route.split(" / ")[0]}
            destination={shipment.route.split(" / ")[1]}
          />
        </section>
        <section className="demo-inspector">
          <span className="eyebrow">02 / SCENARIO DETAILS</span>
          <h2>{scenarioNames[selected]}</h2>
          <span className="badge">Illustrative / QA review required</span>
          <p>{option.detail}</p>
          <dl className="demo-metrics">
            <div>
              <dt>Example direct cost</dt>
              <dd>
                {option.cost} <small>THB</small>
              </dd>
            </div>
            <div>
              <dt>Example additional delay</dt>
              <dd>
                {option.delay} <small>min</small>
              </dd>
            </div>
          </dl>
          <p>{shipment.note}</p>
          <button onClick={() => setProposal(true)} disabled={proposal}>
            Preview demo proposal
          </button>
          {proposal && (
            <div role="status">
              <h3>Demo proposal preview</h3>
              <p>
                {shipment.id}: {scenarioNames[selected]}. In the connected
                workspace, the backend checks eligibility and an independent QA
                reviewer reviews the evidence.
              </p>
              <p>No proposal was saved or submitted.</p>
            </div>
          )}
          <p>
            <Link href="/workspace">Open connected workspace &rarr;</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
