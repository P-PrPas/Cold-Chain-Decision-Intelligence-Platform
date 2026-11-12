"use client";
import { useI18n } from "@/i18n/provider";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { scenarioKey } from "@/app/studio/scenarios";
import type { Item } from "./api";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { useFmt } from "./ui";

const text = (v: unknown) => (v == null || v === "" ? "—" : String(v));

/**
 * Read-only view of a submitted decision snapshot. Every value shown here was
 * frozen at submission; nothing is recomputed against the current policy or data.
 */
export default function FrozenSnapshot({ decision }: { decision: Item }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const s = (decision.snapshot ?? {}) as Item;
  const dataset = (s.dataset ?? {}) as Item;
  const policy = (s.policy ?? {}) as Item;
  const analysis = (s.analysis ?? {}) as Item;
  const run = (s.simulation ?? {}) as Item;
  const rawScenario = (s.scenario ?? {}) as Item;
  const scenario = {
    ...rawScenario,
    ...((rawScenario.result ?? {}) as Item),
  } as Item;
  const explanation = s.explanation as Item | null | undefined;
  const elig = String(scenario.eligibility ?? "");
  const known = ["ELIGIBLE", "REVIEW_REQUIRED", "BLOCKED", "INSUFFICIENT_DATA"];
  return (
    <section className="ws-card ws-snapshot" aria-label={t("wsSnapTitle")}>
      <div className="ws-card-head">
        <h3>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>{" "}
          {t("wsSnapTitle")}
        </h3>
        <span className="badge">{t("wsReadOnly")}</span>
      </div>
      <p className="ws-note">{t("wsSnapNote")}</p>
      <dl className="ws-facts ws-hashes">
        <div>
          <dt>{t("wsSnapDataset")}</dt>
          <dd>
            <span className="num">
              {t("wsVersion")} {text(dataset.version)}
            </span>
            <code>{text(dataset.sha256)}</code>
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapPolicy")}</dt>
          <dd>
            <span className="num">
              {text(policy.policy_key)} v{text(policy.version)}
            </span>
            <code>{text(policy.status)}</code>
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapAnalysis")}</dt>
          <dd>
            <span className="num">
              {t("wsEngineVersion")} {text(analysis.engine_version)}
            </span>
            <code>{text(analysis.input_sha256)}</code>
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapSimulation")}</dt>
          <dd>
            <span className="num">
              {t("wsEngineVersion")} {text(run.engine_version)} ·{" "}
              {t("wsTemplateVersion")} {text(run.template_version)}
            </span>
            <code>{text(run.input_sha256)}</code>
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapScenario")}</dt>
          <dd>
            <span>
              {scenarioKey[String(scenario.type)]
                ? t(scenarioKey[String(scenario.type)])
                : text(scenario.type)}{" "}
              {known.includes(elig) && <StatusBadge status={elig as Status} />}
            </span>
            <span className="num">
              {text(scenario.direct_incremental_cost)} {text(scenario.currency)}{" "}
              <ProvenanceChip kind="calculated" />
            </span>
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapExplanation")}</dt>
          <dd>
            {explanation ? (
              <code>{text(explanation.id)}</code>
            ) : (
              <span className="ws-dim">{t("wsSnapNoExplanation")}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t("wsSnapHash")}</dt>
          <dd>
            <code>{text(decision.snapshot_sha256)}</code>
            <span className="ws-dim">
              {t("wsSnapSubmitted")}: {fmt.dateTime(s.submitted_at)}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
