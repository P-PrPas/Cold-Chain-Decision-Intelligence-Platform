"use client";
import { useI18n } from "../i18n-provider";
import type { DictKey } from "../i18n";
import type { StepId, StepInfo, StepState } from "./stepper";

const NAME: Record<StepId, DictKey> = {
  evidence: "wsStepEvidence",
  policy: "wsStepPolicy",
  simulate: "wsStepSimulate",
  propose: "wsStepPropose",
  qa: "wsStepQa",
  report: "wsStepReport",
};
const STATE: Record<StepState, DictKey> = {
  done: "wsStateDone",
  current: "wsStateCurrent",
  available: "wsStateAvailable",
  blocked: "wsStateBlocked",
};

function Icon({ state }: { state: StepState }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {state === "done" ? (
        <path
          d="M3 8.5l3.2 3L13 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : state === "blocked" ? (
        <path
          d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ) : state === "current" ? (
        <circle cx="8" cy="8" r="4" fill="currentColor" />
      ) : (
        <circle
          cx="8"
          cy="8"
          r="4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      )}
    </svg>
  );
}

/**
 * Evidence to Report. A blocked step is still focusable and always says why in
 * words; it never opens. Colour is never the only carrier of state.
 */
export default function Stepper({
  steps,
  selected,
  onSelect,
}: {
  steps: StepInfo[];
  selected: StepId;
  onSelect: (id: StepId) => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="ws-stepper" aria-label={t("wsStepperLabel")}>
      <ol>
        {steps.map((s, i) => {
          const blocked = s.state === "blocked";
          const why = s.reason ?? s.note;
          return (
            <li key={s.id} data-state={s.state} data-step={s.id}>
              <button
                type="button"
                className="ws-step"
                aria-current={selected === s.id ? "step" : undefined}
                aria-disabled={blocked || undefined}
                aria-describedby={why ? `ws-why-${s.id}` : undefined}
                onClick={() => {
                  if (!blocked) onSelect(s.id);
                }}
              >
                <span className="ws-step-icon">
                  <Icon state={s.state} />
                </span>
                <span className="ws-step-text">
                  <span className="ws-step-name">
                    <span className="num">{i + 1}</span> {t(NAME[s.id])}
                  </span>
                  <span className="ws-step-state">{t(STATE[s.state])}</span>
                </span>
              </button>
              {why && (
                <p
                  id={`ws-why-${s.id}`}
                  className="ws-step-why"
                  data-kind={s.reason ? "blocked" : "note"}
                >
                  {t(why)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
