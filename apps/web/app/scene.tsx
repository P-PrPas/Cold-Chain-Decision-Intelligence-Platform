"use client";
import { useState } from "react";
import { useI18n } from "./i18n-provider";
import StudioScene from "./studio/studio-scene";
import { Player } from "./studio/player";
import { normAcceptance, scenarioKey } from "./studio/scenarios";
import {
  DEFAULT_JOURNEY_MINUTES,
  SCENARIO_ORDER,
  totalMinutes,
} from "./studio/sim-clock";

/**
 * Stage used by the connected workspace: the same canvas as the Studio, fed
 * with the real saved or previewed figures. This view has no time series, so it
 * shows the final frame with the cargo state unknown; it never draws a
 * temperature it does not have.
 */
export default function Scene({
  scenario = "CONTINUE_DELIVERY",
  origin = "Origin",
  destination = "Original receiver",
  cost,
  delay,
  currency = "THB",
  acceptance = "Unknown",
  blocked = false,
  context = "",
  compact = false,
}: {
  scenario?: string;
  origin?: string;
  destination?: string;
  cost?: string;
  delay?: string;
  currency?: string;
  acceptance?: string;
  /** Engine eligibility is BLOCKED for the selected scenario. */
  blocked?: boolean;
  context?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [player] = useState(() => {
    const total = totalMinutes([], 30);
    const p = new Player(DEFAULT_JOURNEY_MINUTES, total);
    p.seek(total);
    return p;
  });
  const [compare, setCompare] = useState(false);
  const acc = normAcceptance(acceptance);
  const views = SCENARIO_ORDER.map((type) => ({
    type,
    delayMinutes: type === scenario ? Number(delay ?? 0) : 0,
    totalCost: type === scenario && cost ? cost : "0.00",
    acceptance: type === scenario ? acc : ("UNKNOWN" as const),
    blocked: type === scenario && blocked,
  }));
  const names = [
    origin,
    `${t("nodeDecision")} (${t("wsNotGps")})`,
    destination,
    acc === "ACCEPTED"
      ? t("altAccepted")
      : acc === "REJECTED"
        ? t("altRejected")
        : t("altUnconfirmed"),
    t("nodeInspection"),
    t("nodeQuarantine"),
  ];
  const target =
    scenario === "HOLD_INSPECTION"
      ? 4
      : scenario === "CONDITIONAL_REROUTE"
        ? 3
        : scenario === "REJECT_QUARANTINE_DISPOSE"
          ? 5
          : 2;
  return (
    <section className="network-explorer" aria-label={t("wsSceneLabel")}>
      <div className="scene-toolbar">
        <h3>{t(scenarioKey[scenario] ?? "scnContinue")}</h3>
      </div>
      <StudioScene
        player={player}
        readings={null}
        startMinute={0}
        stepMinutes={30}
        scenarios={views}
        selected={scenario}
        originLabel={origin}
        destinationLabel={destination}
        compare={compare}
        onCompare={() => setCompare((v) => !v)}
        currency={currency}
      />
      <details open={!compact}>
        <summary>{t("wsContextLocations")}</summary>
        <p>
          {context}. {t("wsSceneNote")}
        </p>
        <ol className="network-legend">
          {names.map((name, i) => (
            <li key={i} className={i === target ? "selected-location" : ""}>
              <span>{i + 1}</span>
              {name}
              {i === target && <strong> / {t("wsProposedDest")}</strong>}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
