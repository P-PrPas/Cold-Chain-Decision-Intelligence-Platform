"use client";
import { useT } from "../i18n-provider";
import type { DictKey } from "../i18n";

export type Status =
  | "ELIGIBLE"
  | "REVIEW_REQUIRED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA"
  | "NOT_EVALUATED";

const META: Record<
  Status,
  { key: DictKey; cls: string; icon: React.ReactNode }
> = {
  // Eligibility is not safety: a plain check-in-circle outline, never a bright "safe" tick.
  ELIGIBLE: {
    key: "statusEligible",
    cls: "eligible",
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
  REVIEW_REQUIRED: {
    key: "statusReview",
    cls: "review",
    icon: (
      <path
        d="M8 2 14.5 13.5h-13Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  BLOCKED: {
    key: "statusBlocked",
    cls: "blocked",
    icon: (
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
  INSUFFICIENT_DATA: {
    key: "statusInsufficient",
    cls: "unknown",
    icon: (
      <path
        d="M3 13 13 3M3 8 8 3M8 13l5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  NOT_EVALUATED: {
    key: "statusNotEvaluated",
    cls: "neval",
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
};

/** Status is always icon + label + colour; colour alone never carries meaning. */
export function StatusBadge({ status }: { status: Status }) {
  const t = useT();
  const m = META[status];
  return (
    <span className={`status-badge st-${m.cls}`} data-status={status}>
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        aria-hidden="true"
        focusable="false"
      >
        {m.icon}
      </svg>
      {t(m.key)}
    </span>
  );
}
