"use client";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import FactorControls from "../factor-controls";
import { ImpactBand } from "../impact-band";
import { useT } from "../i18n-provider";
import {
  draftErrors,
  formatAmount,
  totalCost,
  type Assumptions,
} from "../simulation-assumptions";
import { ProvenanceChip } from "../ui/provenance-chip";
import { StatusBadge } from "../ui/status-badge";
import {
  DEMO_START_MINUTE,
  DEMO_STEP_MINUTES,
  demoBaseline,
  demoShipments,
  type DemoShipment,
} from "./demo-data";
import { readFlag, useFlag, useReducedMotion, writeFlag } from "./hooks";
import { Player } from "./player";
import {
  acceptanceKey,
  acceptanceSymbol,
  normAcceptance,
  scenarioKey,
  scenarioShortKey,
} from "./scenarios";
import StudioScene, { type Ghost } from "./studio-scene";
import Timeline from "./timeline";
import { SCENARIO_ORDER, journeyMinutes, totalMinutes } from "./sim-clock";

const VISITED = "cc-studio-visited";
const COACH = "cc-studio-coach";

function subscribeUrl(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener("cc-url", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("cc-url", cb);
  };
}

export default function StudioPage() {
  const search = useSyncExternalStore(
    subscribeUrl,
    () => window.location.search,
    () => "",
  );
  const param = new URLSearchParams(search).get("shipment");
  const found = demoShipments.findIndex((s) => s.id === param);
  const index = found >= 0 ? found : 0;
  return (
    <StudioShipment
      key={index}
      index={index}
      unknownLink={!!param && found < 0}
    />
  );
}

/** The inspector is a modal-like bottom sheet only on small screens. */
function isSheetLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

/** Keep Tab inside the open bottom sheet. */
function trapTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab" || !isSheetLayout()) return;
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function choose(i: number) {
  window.history.replaceState(
    null,
    "",
    `/studio?shipment=${demoShipments[i].id}`,
  );
  window.dispatchEvent(new Event("cc-url"));
}

function StudioShipment({
  index,
  unknownLink,
}: {
  index: number;
  unknownLink: boolean;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const shipment: DemoShipment = demoShipments[index];
  const readings = shipment.readings;
  const journeyEnd = journeyMinutes(readings, DEMO_STEP_MINUTES);
  const total = totalMinutes(readings, DEMO_STEP_MINUTES);

  const [player] = useState(() => new Player(journeyEnd, total));
  const [baseline] = useState(demoBaseline);
  const [draft, setDraft] = useState(demoBaseline);
  const [selected, setSelected] = useState(shipment.recommended);
  const [compare, setCompare] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [proposal, setProposal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [coach, setCoach] = useState(false);
  const coachSeen = useFlag(COACH);
  const ghostRef = useRef<{ text: string; timer: number } | null>(null);
  const ghostCount = useRef(0);
  const sheetHandle = useRef<HTMLButtonElement>(null);

  function startFromBeginning() {
    player.pause();
    if (reduced) player.seek(total);
    else {
      player.seek(0);
      player.play();
    }
  }

  // First visit autoplays to the decision point; later visits start there.
  useEffect(() => {
    player.setOnDecision(() => {
      writeFlag(VISITED);
      if (!readFlag(COACH)) setCoach(true);
    });
    const reducedNow = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedNow) player.seek(total);
    else if (!readFlag(VISITED)) {
      player.seek(0);
      player.play();
    } else player.seek(journeyEnd);
    return () => {
      player.pause();
      player.setOnDecision(null);
      if (ghostRef.current) window.clearTimeout(ghostRef.current.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replayBranch() {
    player.pause();
    player.seek(journeyEnd);
    player.continueFromDecision();
    if (reduced) player.seek(total);
    else player.play();
  }
  function dismissCoach() {
    setCoach(false);
    writeFlag(COACH);
  }
  function select(type: string, replay = true) {
    setSelected(type);
    setProposal(false);
    setReviewed(false);
    dismissCoach();
    if (replay && player.getT() >= journeyEnd - 1e-6) replayBranch();
  }
  function toggleCompare() {
    const next = !compare;
    setCompare(next);
    if (next && player.getT() >= journeyEnd - 1e-6) replayBranch();
  }
  function reset() {
    setDraft(demoBaseline());
    setSelected(shipment.recommended);
    setCompare(false);
    setReviewed(false);
    setProposal(false);
    setGhost(null);
    startFromBeginning();
  }
  function togglePlay() {
    if (!reduced) player.toggle();
  }
  function changeSpeed(s: number) {
    setSpeed(s);
    player.setSpeed(s);
  }

  const scenario = draft.scenarios.find((s) => s.type === selected)!;
  const original = baseline.scenarios.find((s) => s.type === selected)!;
  const summaryOf = (a: Assumptions) => {
    const s = a.scenarios.find((x) => x.type === selected)!;
    return `${s.estimated_delay_minutes} ${t("unitMin")} · ${formatAmount(totalCost(s, a.currency))} ${a.currency}`;
  };
  function change(next: Assumptions) {
    const before = summaryOf(draft);
    setDraft(next);
    setReviewed(false);
    setProposal(false);
    if (reduced || summaryOf(next) === before) return;
    if (!ghostRef.current) ghostRef.current = { text: before, timer: 0 };
    window.clearTimeout(ghostRef.current.timer);
    const text = ghostRef.current.text;
    ghostCount.current += 1;
    setGhost({ key: ghostCount.current, text });
    ghostRef.current.timer = window.setTimeout(() => {
      ghostRef.current = null;
      setGhost(null);
    }, 1200);
  }
  function applyPreset(kind: "inspection" | "receiver") {
    const next = structuredClone(draft);
    if (kind === "inspection") {
      next.scenarios.find(
        (s) => s.type === "HOLD_INSPECTION",
      )!.estimated_delay_minutes = 240;
      setSelected("HOLD_INSPECTION");
    } else {
      next.scenarios.find(
        (s) => s.type === "CONDITIONAL_REROUTE",
      )!.receiver_acceptance = "REJECTED";
      setSelected("CONDITIONAL_REROUTE");
    }
    setDraft(next);
    setProposal(false);
    setReviewed(false);
    dismissCoach();
    // A preset always replays the branch, even when playback was still on the journey.
    replayBranch();
  }

  function closeSheet() {
    setSheet(false);
    sheetHandle.current?.focus();
  }
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") {
      // Coach mark first, then the mobile bottom sheet.
      if (coach && !coachSeen) {
        e.preventDefault();
        dismissCoach();
      } else if (sheet && isSheetLayout()) {
        e.preventDefault();
        closeSheet();
      }
      return;
    }
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName ?? "";
    if (
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA" ||
      el?.isContentEditable
    )
      return;
    const k = e.key;
    if (k === " ") {
      if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return;
      e.preventDefault();
      togglePlay();
    } else if (k === "ArrowLeft" || k === "ArrowRight") {
      if (tag === "SUMMARY") return;
      e.preventDefault();
      const d = (e.shiftKey ? 30 : 5) * (k === "ArrowLeft" ? -1 : 1);
      player.pause();
      player.seek(player.getT() + d);
    } else if (k === "c" || k === "C") toggleCompare();
    else if (k === "r" || k === "R") reset();
    else if (k >= "1" && k <= "4") select(SCENARIO_ORDER[Number(k) - 1]);
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const errors = draftErrors(draft);
  const currency = draft.currency;
  const views = draft.scenarios.map((s) => ({
    type: s.type,
    delayMinutes: s.estimated_delay_minutes,
    totalCost: totalCost(s, currency),
    acceptance: normAcceptance(s.receiver_acceptance),
  }));
  const acc = normAcceptance(scenario.receiver_acceptance);
  const cost = totalCost(scenario, currency);
  const known = readings.filter((v): v is number => v !== null);
  const origin = t(shipment.originKey);
  const destination = t(shipment.destinationKey);
  const delayChanged =
    scenario.estimated_delay_minutes !== original.estimated_delay_minutes;
  const costChanged = cost !== totalCost(original, currency);
  const illustrative = selected === shipment.recommended;

  return (
    <main className="studio" id="content" data-studio>
      <header className="studio-head">
        <div className="studio-id">
          <h1>
            <span className="num">{shipment.id}</span>
            <span className="studio-product">{t(shipment.productKey)}</span>
          </h1>
          <p className="studio-route">
            <span>
              {t("studioRoute")}: {origin} &rarr; {destination}
            </span>
            <span className="demo-pill">{t("studioDemoOnly")}</span>
          </p>
        </div>
        <div className="studio-actions">
          <label className="studio-picker">
            <span className="sr-only">{t("studioShipment")}</span>
            <select
              value={index}
              onChange={(e) => choose(Number(e.target.value))}
            >
              {demoShipments.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.id} / {t(s.productKey)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="quiet"
            aria-keyshortcuts="R"
            title={t("studioResetHint")}
            onClick={reset}
          >
            {t("studioReset")}
          </button>
        </div>
      </header>
      {unknownLink && (
        <p role="status" className="studio-notice">
          {t("studioUnknownLink")}
        </p>
      )}

      <div className="studio-body">
        <div className="rail" role="group" aria-label={t("scenarioGroup")}>
          <p className="rail-title">
            {t("railTitle")} <span>{t("railHint")}</span>
          </p>
          {draft.scenarios.map((s, i) => {
            const name = t(scenarioKey[s.type]);
            return (
              <button
                key={s.type}
                type="button"
                className="rail-item"
                aria-pressed={selected === s.type}
                aria-label={name}
                aria-keyshortcuts={String(i + 1)}
                onClick={() => select(s.type)}
              >
                <kbd aria-hidden="true">{i + 1}</kbd>
                <span className="rail-name" aria-hidden="true">
                  <span className="full">{name}</span>
                  <span className="short">{t(scenarioShortKey[s.type])}</span>
                </span>
                <span className="rail-meta num" aria-hidden="true">
                  {s.estimated_delay_minutes} {t("unitMin")} &middot;{" "}
                  {formatAmount(totalCost(s, currency))}
                </span>
                {s.type === shipment.recommended && (
                  <span
                    className="rail-tag"
                    title={t("illustrativeNote")}
                    aria-hidden="true"
                  >
                    {t("illustrativePick")}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="studio-stage">
          <div className="presets" role="group" aria-label={t("presetsLabel")}>
            <span>{t("presetsLabel")}</span>
            <button
              type="button"
              className="chip"
              onClick={() => applyPreset("inspection")}
            >
              {t("presetInspection")}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => applyPreset("receiver")}
            >
              {t("presetReceiver")}
            </button>
          </div>
          <StudioScene
            player={player}
            readings={readings}
            startMinute={DEMO_START_MINUTE}
            stepMinutes={DEMO_STEP_MINUTES}
            scenarios={views}
            selected={selected}
            originLabel={origin}
            destinationLabel={t("nodeReceiverShort")}
            compare={compare}
            onCompare={toggleCompare}
            currency={currency}
            ghost={ghost}
            announce
          >
            {coach && !coachSeen && (
              <div className="coach" role="status">
                <strong>{t("coachTitle")}</strong>
                <span>{t("coachBody")}</span>
                <button type="button" onClick={dismissCoach}>
                  {t("coachDismiss")}
                </button>
              </div>
            )}
          </StudioScene>
        </div>

        <aside
          className="inspector"
          data-open={sheet}
          aria-label={t("resultTitle")}
          onKeyDown={sheet ? trapTab : undefined}
        >
          <button
            ref={sheetHandle}
            type="button"
            className="sheet-handle"
            aria-expanded={sheet}
            aria-controls="sheet-body"
            onClick={() => setSheet((v) => !v)}
          >
            <span className="sheet-grip" aria-hidden="true" />
            <span className="sheet-summary num">{summaryOf(draft)}</span>
            <span className="sheet-toggle">
              {sheet ? t("sheetClose") : t("sheetOpen")}
            </span>
          </button>
          <div id="sheet-body" className="sheet-body">
            <div className="result-card">
              <h2>
                {t("resultTitle")}: {t(scenarioKey[selected])}
              </h2>
              {illustrative && (
                <p className="result-illustrative">
                  <span className="rail-tag">{t("illustrativePick")}</span>{" "}
                  {t("illustrativeNote")}
                </p>
              )}
              <div className="scene-impact">
                <ImpactBand
                  label={t("resultDelay")}
                  value={String(scenario.estimated_delay_minutes)}
                  baseline={String(original.estimated_delay_minutes)}
                  unit={t("unitMin")}
                  chip={
                    <ProvenanceChip
                      kind={delayChanged ? "entered" : "estimated"}
                    />
                  }
                  unavailable={t("resultUnavailable")}
                  baselineWord={t("resultBaseline")}
                />
                <ImpactBand
                  label={t("resultCost")}
                  value={cost}
                  baseline={totalCost(original, currency)}
                  unit={currency}
                  money
                  chip={
                    <ProvenanceChip
                      kind={costChanged ? "entered" : "estimated"}
                    />
                  }
                  unavailable={t("resultUnavailable")}
                  baselineWord={t("resultBaseline")}
                />
              </div>
              <dl className="result-rows">
                <div>
                  <dt>{t("resultReceiver")}</dt>
                  <dd>
                    <span className="acceptance-state" data-state={acc}>
                      {acceptanceSymbol[acc]} {t("receiverWord")}:{" "}
                      {t(acceptanceKey[acc])} ({t("assumedWord")})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{t("resultEligibility")}</dt>
                  <dd>
                    <StatusBadge status="NOT_EVALUATED" />
                  </dd>
                </div>
              </dl>
              <p className="result-note">
                {t("resultEligibilityNote")} {t("resultNoModel")}
              </p>
            </div>
            <FactorControls
              value={draft}
              baseline={baseline}
              selected={selected}
              onChange={change}
              demo
              baselineLabel="prepared demo estimates"
            />
          </div>
        </aside>

        <Timeline
          player={player}
          readings={readings}
          startMinute={DEMO_START_MINUTE}
          stepMinutes={DEMO_STEP_MINUTES}
          scenario={selected}
          speed={speed}
          onSpeed={changeSpeed}
        />
        <p className="kbd-hint">{t("kbdHint")}</p>

        <div
          className="evidence-strip"
          role="region"
          aria-label={t("evidenceTitle")}
        >
          <div className="evidence-facts">
            <strong>{t(shipment.statusKey)}</strong>
            <span className="num">
              {t("evReadings")
                .replace("{n}", String(known.length))
                .replace("{N}", String(readings.length))}
            </span>
            <span>{t("evPolicy")}</span>
            {known.length > 0 && (
              <span className="num">
                {t("evRange")
                  .replace("{a}", String(Math.min(...known)))
                  .replace("{b}", String(Math.max(...known)))}
              </span>
            )}
            <span>{t("evJourney")}</span>
          </div>
          <p>
            {t(shipment.noteKey)} {t("evLimits")}
          </p>
          <details>
            <summary>{t("evExact")}</summary>
            <table>
              <thead>
                <tr>
                  <th>{t("evTime")}</th>
                  <th>{t("evTemp")}</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((value, i) => (
                  <tr key={i}>
                    <td className="num">
                      {String(8 + Math.floor(i / 2)).padStart(2, "0")}:
                      {i % 2 ? "30" : "00"}
                    </td>
                    <td className="num">
                      {value === null ? t("evMissing") : `${value} °C`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <div className="prepare">
          <h2>{t("prepTitle")}</h2>
          <p>{t("prepIntro")}</p>
          <label className="confirmation-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t("prepReview")}
          </label>
          <div className="prepare-actions">
            <button
              type="button"
              disabled={!reviewed || Object.keys(errors).length > 0}
              onClick={() => setProposal(true)}
            >
              {t("prepPreview")}
            </button>
            <Link className="prepare-link" href="/workspace">
              {t("studioOpenWorkspace")}
            </Link>
          </div>
          {proposal && (
            <div role="status" className="prepare-result">
              <strong>
                {shipment.id} / {t(scenarioKey[selected])}
              </strong>
              <p className="num">
                {formatAmount(cost)} {currency} /{" "}
                {scenario.estimated_delay_minutes} {t("unitMin")} /{" "}
                {t("prepLine")}
              </p>
              <p>{t("prepNotSaved")}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
