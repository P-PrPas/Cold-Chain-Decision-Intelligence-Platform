"use client";
import type { ReactNode } from "react";
import { useI18n } from "../i18n-provider";
import type { DictKey } from "../i18n";
import { ApiError } from "./api";
import { ProvenanceChip, type Provenance } from "../ui/provenance-chip";

/** Stable API error codes with a translated sentence. Unmapped errors keep the server text. */
const ERROR_KEYS: Record<string, DictKey> = {
  AUTH_REQUIRED: "wsErrAuth",
  PERMISSION_DENIED: "wsErrPermission",
  RESOURCE_NOT_FOUND: "wsErrNotFound",
  TENANT_CONTEXT_REQUIRED: "wsErrTenant",
  TENANT_MEMBERSHIP_INVALID: "wsErrTenant",
  DUPLICATE_REFERENCE: "wsErrDuplicate",
  INVALID_STATE_TRANSITION: "wsErrTransition",
  STALE_REVISION: "wsErrStale",
  IDEMPOTENCY_KEY_REUSED: "wsErrIdempotency",
  DATASET_INVALID: "wsErrDatasetInvalid",
  DATASET_NOT_READY: "wsErrDatasetNotReady",
  COLUMN_MAPPING_REQUIRED: "wsErrMapping",
  TIMEZONE_REQUIRED: "wsErrTimezone",
  CONFLICTING_READINGS: "wsErrConflicting",
  UNAPPROVED_POLICY: "wsErrUnapproved",
  POLICY_NOT_APPLICABLE: "wsErrPolicyNA",
  ANALYSIS_NOT_READY: "wsErrAnalysisNotReady",
  SIMULATION_NOT_READY: "wsErrSimNotReady",
  SCENARIO_BLOCKED: "wsErrScenarioBlocked",
  INSUFFICIENT_DATA: "wsErrInsufficient",
  QA_REVIEW_REQUIRED: "wsErrQaRequired",
  SELF_APPROVAL_FORBIDDEN: "wsErrSelfApproval",
  REPORT_NOT_READY: "wsErrReportNotReady",
  RATE_LIMITED: "wsErrRate",
  DEPENDENCY_UNAVAILABLE: "wsErrDependency",
  ACTIVE_DECISION_EXISTS: "wsErrActiveDecision",
};

export function errorKey(e: unknown): DictKey | null {
  return e instanceof ApiError && ERROR_KEYS[e.code]
    ? ERROR_KEYS[e.code]
    : null;
}

/** Translated sentence for a stable code, followed by the server's own message for traceability. */
export function useErrorText() {
  const { t } = useI18n();
  return (e: unknown): string => {
    const key = errorKey(e);
    return key ? `${t(key)} [${(e as Error).message}]` : String(e);
  };
}

export function useFmt() {
  const { lang } = useI18n();
  const locale = lang === "th" ? "th-TH-u-ca-gregory" : "en-GB";
  return {
    dateTime: (v: unknown) => {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleString(locale, {
            timeZone: "UTC",
            dateStyle: "medium",
            timeStyle: "short",
          }) + " UTC";
    },
    /** Compact numeric stamp used in the saved-history strip. */
    stamp: (v: unknown) => {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime())
        ? "—"
        : lang === "th"
          ? `${d.toLocaleString(locale, { timeZone: "UTC", dateStyle: "short", timeStyle: "medium", hourCycle: "h23" })} UTC`
          : d.toLocaleString(locale, {
              timeZone: "UTC",
              timeZoneName: "short",
            });
    },
    date: (v: unknown) => {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString(locale, {
            timeZone: "UTC",
            dateStyle: "medium",
          });
    },
  };
}

const OP: Record<string, { key: DictKey; icon: ReactNode }> = {
  DRAFT: {
    key: "wsOpDraft",
    icon: (
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="2.5 2.5"
      />
    ),
  },
  READY: {
    key: "wsOpReady",
    icon: (
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
  IN_TRANSIT: {
    key: "wsOpTransit",
    icon: (
      <path
        d="M2.5 8h9M8 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  ARRIVED: {
    key: "wsOpArrived",
    icon: (
      <path
        d="M4 14V2.5M4 3h8l-2 3 2 3H4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  CLOSED: {
    key: "wsOpClosed",
    icon: (
      <rect
        x="3.5"
        y="3.5"
        width="9"
        height="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
  CANCELLED: {
    key: "wsOpCancelled",
    icon: (
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
};

/** Operational shipment status. It is workflow state, never a quality judgement. */
export function OpStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const m = OP[status];
  return (
    <span className="op-badge" data-op={status}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {m?.icon}
      </svg>
      {m ? t(m.key) : status}
    </span>
  );
}

const ANALYSIS: Record<string, { key: DictKey; cls: string }> = {
  NORMAL: { key: "wsAnNormal", cls: "neval" },
  WARNING: { key: "wsAnWarning", cls: "review" },
  CRITICAL: { key: "wsAnCritical", cls: "blocked" },
  INDETERMINATE: { key: "wsAnIndeterminate", cls: "unknown" },
};

/** Engine classification of an analysis run, labelled; never rendered as a safety verdict. */
export function AnalysisBadge({ value }: { value: unknown }) {
  const { t } = useI18n();
  const m = ANALYSIS[String(value)];
  if (!m) return <span className="ws-dim">{t("wsAnNone")}</span>;
  return (
    <span className={`status-badge st-${m.cls}`} data-analysis={String(value)}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {m.cls === "review" ? (
          <path
            d="M8 2 14.5 13.5h-13Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        ) : m.cls === "blocked" ? (
          <path
            d="M4.5 4.5l7 7M11.5 4.5l-7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : m.cls === "unknown" ? (
          <path
            d="M3 13 13 3M3 8 8 3M8 13l5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        ) : (
          <circle
            cx="8"
            cy="8"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="2.5 2.5"
          />
        )}
      </svg>
      {t(m.key)}
    </span>
  );
}

/** Provenance from the cost `source` field. Unknown sources get no chip rather than a guess. */
export function sourceProvenance(source: unknown): Provenance | null {
  if (source === "USER_ESTIMATE") return "estimated";
  if (source === "CONFIRMED") return "entered";
  return null;
}

export function Source({ source }: { source: unknown }) {
  const p = sourceProvenance(source);
  return p ? <ProvenanceChip kind={p} /> : null;
}

/** Skeleton rows used while a list loads. */
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ws-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "block";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="ws-callout" data-tone={tone}>
      {title && <strong>{title}</strong>}
      <p>{children}</p>
    </div>
  );
}

const STATUS_KEYS: Record<string, DictKey> = {
  DRAFT: "wsStDraft",
  PENDING_REVIEW: "wsStPendingReview",
  APPROVED: "wsStApproved",
  RETIRED: "wsStRetired",
  PENDING_QA: "wsStPendingQa",
  REJECTED: "wsStRejected",
  CHANGES_REQUESTED: "wsStChanges",
  READY: "wsStReady",
  QUEUED: "wsStQueued",
  RUNNING: "wsStRunning",
  COMPLETED: "wsStCompleted",
  FAILED: "wsStFailed",
};

/** Display label for a workflow status code. The code itself stays the API value. */
export function useStatusLabel() {
  const { t } = useI18n();
  return (code: unknown): string => {
    const key = STATUS_KEYS[String(code)];
    return key
      ? t(key)
      : String(code ?? "—")
          .replaceAll("_", " ")
          .toLowerCase()
          .replace(/^./, (c) => c.toUpperCase());
  };
}

type Rule = {
  rule_id?: unknown;
  code?: unknown;
  effect?: unknown;
  matched?: unknown;
};

/** Matched policy rules. HARD_BLOCK is shown as final: nothing on this page can override it. */
export function RuleList({ rules }: { rules: unknown }) {
  const { t } = useI18n();
  const list = (Array.isArray(rules) ? rules : []) as Rule[];
  const matched = list.filter((r) => r.matched);
  if (!matched.length) return <p className="ws-note">{t("wsNoMatchedRule")}</p>;
  return (
    <ul className="ws-rules">
      {matched.map((r, i) => {
        const effect = String(r.effect);
        return (
          <li key={i} data-effect={effect}>
            <code>{String(r.rule_id ?? r.code ?? "—")}</code>
            <span className={`ws-effect ws-effect-${effect}`}>
              {effect === "HARD_BLOCK" && (
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {effect}
            </span>
            {effect === "HARD_BLOCK" && <small>{t("wsHardBlockNote")}</small>}
          </li>
        );
      })}
    </ul>
  );
}
