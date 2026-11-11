export const scenarioNames: Record<string, string> = {
  CONTINUE_DELIVERY: "Continue delivery",
  HOLD_INSPECTION: "Hold for inspection",
  CONDITIONAL_REROUTE: "Conditional reroute",
  REJECT_QUARANTINE_DISPOSE: "Reject / quarantine / dispose",
};
export default function Scene({
  scenario = "CONTINUE_DELIVERY",
  origin = "Origin",
  destination = "Original receiver",
}: {
  scenario?: string;
  origin?: string;
  destination?: string;
}) {
  const target =
    scenario === "HOLD_INSPECTION"
      ? "Controlled inspection facility"
      : scenario === "CONDITIONAL_REROUTE"
        ? "Alternative receiver (unconfirmed)"
        : scenario === "REJECT_QUARANTINE_DISPOSE"
          ? "Isolation / quarantine facility"
          : destination;
  return (
    <figure className="route-diagram">
      <figcaption>
        Proposed route{" "}
        <span className="badge">Schematic, not live location</span>
      </figcaption>
      <ol>
        <li>
          <span>Origin</span>
          <strong>{origin}</strong>
        </li>
        <li>
          <span>Decision point</span>
          <strong>Shipment under review</strong>
        </li>
        <li>
          <span>Proposed destination</span>
          <strong>{target}</strong>
        </li>
      </ol>
      {scenario === "CONDITIONAL_REROUTE" && (
        <p>
          Original destination: {destination}. Alternative receiver acceptance
          is required.
        </p>
      )}
    </figure>
  );
}
