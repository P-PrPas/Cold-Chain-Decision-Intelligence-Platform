import type { ReactNode } from "react";
export function human(value: unknown): string {
  return String(value ?? "Not available")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
export function EvidenceView({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined) return <span>Not available</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="evidence-list">
        {value.map((v, i) => (
          <li key={i}>
            <EvidenceView value={v} />
          </li>
        ))}
      </ul>
    ) : (
      <span>None recorded</span>
    );
  if (typeof value === "object")
    return (
      <dl className="evidence-grid">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt>{human(k)}</dt>
            <dd>
              <EvidenceView value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span>
      {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
    </span>
  );
}
