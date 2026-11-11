"use client";
import { useT } from "../i18n-provider";
import type { DictKey } from "../i18n";

export type Provenance = "observed" | "entered" | "calculated" | "estimated";

const KEY: Record<Provenance, DictKey> = {
  observed: "provObserved",
  entered: "provEntered",
  calculated: "provCalculated",
  estimated: "provEstimated",
};

/** Marks where a figure comes from. Place beside the figure it describes. */
export function ProvenanceChip({ kind }: { kind: Provenance }) {
  const t = useT();
  return (
    <span className={`prov-chip prov-${kind}`} data-provenance={kind}>
      {t(KEY[kind])}
    </span>
  );
}
