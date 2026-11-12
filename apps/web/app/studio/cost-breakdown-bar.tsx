"use client";
import { useT } from "@/i18n/provider";
import type { DictKey } from "@/i18n";
import { formatAmount, type CostCategory } from "@/lib/simulation-assumptions";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { percentText, type CostBreakdown } from "./cost-breakdown";

const LABEL: Record<CostCategory, DictKey> = {
  additional_transport: "fcCostTransport",
  inspection: "fcCostInspection",
  holding: "fcCostHolding",
  handling: "fcCostHandling",
  disposal: "fcCostDisposal",
  other: "fcCostOther",
};

/**
 * Stacked bar of the six cost categories with the exact amounts. Segments are
 * numbered and listed, so the categories never depend on colour. After a
 * change, the previous bar stays faded for about a second.
 */
export default function CostBreakdownBar({
  breakdown,
  previous,
  ghostKey,
  currency,
}: {
  breakdown: CostBreakdown | null;
  previous?: CostBreakdown | null;
  ghostKey?: number;
  currency: string;
}) {
  const t = useT();
  if (!breakdown)
    return (
      <div
        className="cost-breakdown-card"
        role="group"
        aria-label={t("cbTitle")}
      >
        <h3>{t("cbTitle")}</h3>
        <p className="field-error" role="status">
          {t("cbUnavailable")}
        </p>
      </div>
    );
  // One chip in the header when every amount shares a source; per row otherwise.
  const kindOf = (src: string) =>
    src === "USER_ESTIMATE"
      ? "estimated"
      : src === "CONFIRMED"
        ? "entered"
        : null;
  const kinds = new Set(
    breakdown.parts
      .filter((p) => p.cents > BigInt(0))
      .map((p) => kindOf(p.source)),
  );
  const single = kinds.size === 1 ? [...kinds][0] : null;
  const aria = t("cbAria")
    .replace("{total}", formatAmount(breakdown.total))
    .replace("{cur}", currency);
  return (
    <div className="cost-breakdown-card" role="group" aria-label={t("cbTitle")}>
      <h3>
        {t("cbTitle")} {single && <ProvenanceChip kind={single} />}
      </h3>
      <div className="cb-bars">
        {previous && (
          <div
            key={ghostKey}
            className="cb-bar cb-ghost"
            aria-hidden="true"
            title={t("cbWasLabel")}
          >
            {previous.parts.map(
              (p, i) =>
                p.cents > BigInt(0) && (
                  <span
                    key={p.key}
                    className="cb-seg"
                    data-cat={i + 1}
                    style={{ flexGrow: p.bp }}
                  />
                ),
            )}
          </div>
        )}
        <div
          className="cb-bar"
          role="img"
          aria-label={aria}
          data-testid="cb-bar"
        >
          {breakdown.parts.map(
            (p, i) =>
              p.cents > BigInt(0) && (
                <span
                  key={p.key}
                  className="cb-seg"
                  data-cat={i + 1}
                  data-category={p.key}
                  style={{ flexGrow: p.bp }}
                >
                  {p.bp >= 1200 && <b aria-hidden="true">{i + 1}</b>}
                </span>
              ),
          )}
        </div>
      </div>
      <ul className="cb-legend">
        {breakdown.parts.map((p, i) => (
          <li
            key={p.key}
            data-category={p.key}
            data-zero={p.cents === BigInt(0)}
          >
            <i className="cb-sw" data-cat={i + 1} aria-hidden="true">
              {i + 1}
            </i>
            <span className="cb-name">
              {t(LABEL[p.key])}
              <span
                className="cb-pct num"
                title={t("cbShare").replace("{p}", percentText(p.bp))}
              >
                {percentText(p.bp)}%
              </span>
              {!single && p.cents > BigInt(0) && kindOf(p.source) && (
                <ProvenanceChip kind={kindOf(p.source)!} />
              )}
            </span>
            <span className="num cb-amt">
              {formatAmount(p.amount)} {currency}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
