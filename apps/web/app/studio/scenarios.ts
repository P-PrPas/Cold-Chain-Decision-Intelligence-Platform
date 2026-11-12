import type { DictKey } from "../i18n";

export const scenarioKey: Record<string, DictKey> = {
  CONTINUE_DELIVERY: "scnContinue",
  HOLD_INSPECTION: "scnHold",
  CONDITIONAL_REROUTE: "scnReroute",
  REJECT_QUARANTINE_DISPOSE: "scnQuarantine",
};

export const scenarioShortKey: Record<string, DictKey> = {
  CONTINUE_DELIVERY: "scnContinueShort",
  HOLD_INSPECTION: "scnHoldShort",
  CONDITIONAL_REROUTE: "scnRerouteShort",
  REJECT_QUARANTINE_DISPOSE: "scnQuarantineShort",
};

/** English names for pages that have not been translated yet (workspace). */
export const scenarioNames: Record<string, string> = {
  CONTINUE_DELIVERY: "Continue delivery",
  HOLD_INSPECTION: "Hold for inspection",
  CONDITIONAL_REROUTE: "Conditional reroute",
  REJECT_QUARANTINE_DISPOSE: "Reject / quarantine / dispose",
};

export type Acceptance = "UNKNOWN" | "ACCEPTED" | "REJECTED";
export function normAcceptance(v?: string): Acceptance {
  const u = (v || "").toUpperCase();
  return u === "ACCEPTED" || u === "REJECTED" ? u : "UNKNOWN";
}
export const acceptanceSymbol: Record<Acceptance, string> = {
  ACCEPTED: "✓",
  REJECTED: "×",
  UNKNOWN: "?",
};
/** Glyph plus the word, so acceptance never relies on a symbol alone. */
export function acceptanceTag(
  a: Acceptance | undefined,
  name: string,
  words: Record<Acceptance, string>,
): string {
  const k = a ?? "UNKNOWN";
  return `${acceptanceSymbol[k]} ${name} · ${words[k]}`;
}
export const acceptanceKey: Record<Acceptance, DictKey> = {
  ACCEPTED: "accAccepted",
  REJECTED: "accRejected",
  UNKNOWN: "accUnknown",
};
