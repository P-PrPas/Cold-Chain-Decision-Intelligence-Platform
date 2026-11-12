"use client";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import "./landing.css";
import { BrandMark } from "../brand-mark";
import { useT } from "../i18n-provider";
import { FOOTER_CLOSE_ID } from "../site-chrome";
import { useTheme } from "../prefs";
import { formatAmount, totalCost } from "../simulation-assumptions";
import {
  DEMO_START_MINUTE,
  DEMO_STEP_MINUTES,
  demoBaseline,
  demoShipments,
} from "../studio/demo-data";
import { usePlaying, useReducedMotion } from "../studio/hooks";
import { Player } from "../studio/player";
import SchematicSvg from "../studio/schematic-svg";
import { scenarioKey } from "../studio/scenarios";
import StudioScene, { type ScenarioView } from "../studio/studio-scene";
import Timeline from "../studio/timeline";
import {
  compareFrames,
  findGaps,
  journeyMinutes,
  thermalBand,
  totalMinutes,
} from "../studio/sim-clock";
import { ProvenanceChip } from "../ui/provenance-chip";
import { StatusBadge } from "../ui/status-badge";

const HERO = demoShipments[0];
const GAP_DEMO = demoShipments[2];
const CHOSEN = "HOLD_INSPECTION";

/** Arrow drawn by the kit's motion layer (stem grows, head moves 3px). */
function Arrow() {
  return (
    <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path className="m-arrow__stem" d="M1 6h8" />
      <path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}

function OpenSimulator() {
  const t = useT();
  return (
    <Link className="btn btn--primary" href="/studio">
      {t("lpOpenSim")}
      <Arrow />
    </Link>
  );
}

/** One view of the demo scenarios, as the Studio builds them. */
function useViews(): ScenarioView[] {
  return useMemo(() => {
    const draft = demoBaseline();
    return draft.scenarios.map((s) => ({
      type: s.type,
      delayMinutes: s.estimated_delay_minutes,
      totalCost: totalCost(s, draft.currency),
      acceptance: "UNKNOWN" as const,
    }));
  }, []);
}

/* ------------------------------------------------------------------ hero */

function HeroStudio() {
  const t = useT();
  const views = useViews();
  const reduced = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const readings = HERO.readings;
  const journeyEnd = journeyMinutes(readings, DEMO_STEP_MINUTES);
  const total = totalMinutes(readings, DEMO_STEP_MINUTES, views, CHOSEN);
  const [player] = useState(() => new Player(journeyEnd, total));
  const playing = usePlaying(player);
  // The visitor can stop the loop; the loop then stays stopped.
  const [stopped, setStopped] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (reduced) {
      player.pause();
      player.seek(total);
      return;
    }
    let visible = true;
    let idleSince = 0;
    const el = frame.current;
    const io = el
      ? new IntersectionObserver((e) => {
          visible = e[e.length - 1].isIntersecting;
        })
      : null;
    if (el) io?.observe(el);
    player.seek(0);
    player.play();
    // A small state machine: pause offscreen or in a hidden tab, wait a beat at
    // the decision point and at the end, then run the journey again.
    const id = window.setInterval(() => {
      const active = visible && !document.hidden && !stoppedRef.current;
      if (!active) {
        if (player.getPlaying()) player.pause();
        return;
      }
      if (player.getPlaying()) {
        idleSince = 0;
        return;
      }
      const now = Date.now();
      if (!idleSince) idleSince = now;
      const at = player.getT();
      if (at >= total) {
        if (now - idleSince > 3000) {
          player.seek(0);
          player.play();
          idleSince = 0;
        }
      } else if (!player.decided && Math.abs(at - journeyEnd) < 1e-6) {
        if (now - idleSince > 1400) {
          player.continueFromDecision();
          player.play();
          idleSince = 0;
        }
      } else {
        player.play();
        idleSince = 0;
      }
    }, 250);
    return () => {
      window.clearInterval(id);
      io?.disconnect();
      player.pause();
    };
  }, [reduced, player, total, journeyEnd]);

  function toggle() {
    const next = !stoppedRef.current;
    stoppedRef.current = next;
    setStopped(next);
    if (next) player.pause();
  }

  const running = playing && !stopped;
  return (
    <div
      data-visual
      data-ui
      className="hero__media frame lp-frame lp-frame--hero"
      ref={frame}
    >
      <div className="lp-frame__bar">
        <p className="lp-frame__title">
          <span className="num">{HERO.id}</span>
          <span>{t(HERO.productKey)}</span>
          <span className="lp-frame__route">
            {t(HERO.originKey)} &rarr; {t(HERO.destinationKey)}
          </span>
        </p>
        <span className="demo-pill">{t("studioDemoOnly")}</span>
        {!reduced && (
          <button
            type="button"
            className="lp-iconbtn"
            aria-label={running ? t("lpReplayPause") : t("lpReplayPlay")}
            aria-pressed={stopped}
            onClick={toggle}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              {running ? (
                <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
              ) : (
                <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
              )}
            </svg>
          </button>
        )}
      </div>
      <StudioScene
        player={player}
        readings={readings}
        startMinute={DEMO_START_MINUTE}
        stepMinutes={DEMO_STEP_MINUTES}
        scenarios={views}
        selected={CHOSEN}
        originLabel={t(HERO.originKey)}
        destinationLabel={t("nodeReceiverShort")}
        compare={false}
        currency="THB"
        lazy
      />
      <ol className="lp-rail" aria-label={t("railTitle")}>
        {views.map((v, i) => (
          <li
            key={v.type}
            aria-current={v.type === CHOSEN ? "true" : undefined}
          >
            <span className="num" aria-hidden="true">
              {i + 1}
            </span>
            <span>{t(scenarioKey[v.type])}</span>
            {v.type === CHOSEN && (
              <span className="lp-rail__tag">{t("lpReplaying")}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Hero() {
  const t = useT();
  return (
    <section
      className="hero hero--split lp-hero"
      data-enter
      aria-labelledby="hero-h"
    >
      <div className="wrap">
        <div className="hero-text lp-grid">
          <div className="hero__text">
            <h1 id="hero-h">{t("lpHeroH1")}</h1>
            <p className="hero__lead">{t("lpHeroLead")}</p>
            <p className="hero__fact">{t("lpHeroFact")}</p>
            <div className="btn-row">
              <OpenSimulator />
              <a className="btn btn--secondary" href="#scenarios">
                {t("lpSeeOptions")}
              </a>
              <Link className="btn btn--secondary" href="/guide">
                {t("gdHowTo")}
              </Link>
            </div>
          </div>
          <HeroStudio />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- evidence */

function Evidence() {
  const t = useT();
  const views = useViews();
  const readings = GAP_DEMO.readings;
  const journeyEnd = journeyMinutes(readings, DEMO_STEP_MINUTES);
  const total = totalMinutes(readings, DEMO_STEP_MINUTES, views, CHOSEN);
  const [player] = useState(() => {
    const p = new Player(journeyEnd, total);
    p.seek(165); // inside the gap, so the readout says "no readings"
    return p;
  });
  const [speed, setSpeed] = useState(1);
  const known = readings.filter((v) => v !== null).length;
  const missing = readings.length - known;
  useEffect(() => () => player.pause(), [player]);
  return (
    <section className="lp-section" id="evidence" aria-labelledby="ev-h">
      <div className="wrap">
        <div className="lp-head">
          <h2 id="ev-h">{t("lpEvH2")}</h2>
          <p className="lp-lede">{t("lpEvLead")}</p>
        </div>
        <div data-visual data-ui className="frame lp-frame lp-frame--plain">
          <div className="lp-frame__bar">
            <p className="lp-frame__title">
              <span className="num">{GAP_DEMO.id}</span>
              <span>{t(GAP_DEMO.productKey)}</span>
              <span className="lp-frame__route">
                {t(GAP_DEMO.originKey)} &rarr; {t(GAP_DEMO.destinationKey)}
              </span>
            </p>
            <span className="demo-pill">{t("studioDemoOnly")}</span>
          </div>
          <Timeline
            player={player}
            readings={readings}
            startMinute={DEMO_START_MINUTE}
            stepMinutes={DEMO_STEP_MINUTES}
            scenario={CHOSEN}
            speed={speed}
            onSpeed={(s) => {
              setSpeed(s);
              player.setSpeed(s);
            }}
          />
        </div>
        <div className="lp-figures" data-moment="counter-rolls">
          <div>
            <p className="t-stat num">{known}</p>
            <p className="lp-cap">{t("lpEvObserved")}</p>
          </div>
          <div>
            <p className="t-stat num">{missing}</p>
            <p className="lp-cap">{t("lpEvMissing")}</p>
          </div>
          <div>
            <p className="t-stat num">{DEMO_STEP_MINUTES}</p>
            <p className="lp-cap">{t("lpEvStep")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- scenarios */

const BRANCH_END: Record<string, [number, number]> = {
  CONTINUE_DELIVERY: [50, 18],
  HOLD_INSPECTION: [44, 31],
  CONDITIONAL_REROUTE: [44, 5],
  REJECT_QUARANTINE_DISPOSE: [26, 32],
};

/** Route glyph: origin, decision point and where this option ends. */
function BranchGlyph({ type }: { type: string }) {
  const [x, y] = BRANCH_END[type];
  return (
    <svg
      className="lp-glyph"
      viewBox="0 0 56 36"
      width="56"
      height="36"
      aria-hidden="true"
      focusable="false"
      data-visual
    >
      <path
        d="M4 18H24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={"M24 18L" + x + " " + y}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 3"
        fill="none"
      />
      <circle
        cx="24"
        cy="18"
        r="3.5"
        fill="var(--panel)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x={x - 3.5} y={y - 3.5} width="7" height="7" fill="currentColor" />
    </svg>
  );
}

function Scenarios() {
  const t = useT();
  const theme = useTheme();
  const views = useViews();
  const readings = HERO.readings;
  const journeyEnd = journeyMinutes(readings, DEMO_STEP_MINUTES);
  const total = totalMinutes(readings, DEMO_STEP_MINUTES, views);
  const gaps = useMemo(
    () => findGaps(readings, DEMO_START_MINUTE, DEMO_STEP_MINUTES),
    [readings],
  );
  const frames = useMemo(
    () =>
      compareFrames(
        {
          readings,
          startMinute: DEMO_START_MINUTE,
          stepMinutes: DEMO_STEP_MINUTES,
        },
        views,
        total,
      ),
    [readings, views, total],
  );
  const order = views.map((v) => v.type);
  const acceptance = Object.fromEntries(
    views.map((v) => [v.type, v.acceptance]),
  );
  const aria = t("lpScSchemAria");
  // The band is the inverse of the page ground, so it reads as a band in both themes.
  const scope = theme === "dark" ? "light" : "dark";
  return (
    <section
      className="lp-section lp-band"
      id="scenarios"
      data-theme-scope={scope}
      aria-labelledby="sc-h"
    >
      <div className="wrap">
        <div className="lp-head">
          <h2 id="sc-h">{t("lpScH2")}</h2>
          <p className="lp-lede">{t("lpScLead")}</p>
        </div>
        <div className="lp-grid lp-split">
          <ul className="lp-options" aria-label={t("lpScH2")}>
            {views.map((v) => (
              <li key={v.type} className="card m-nolift">
                <BranchGlyph type={v.type} />
                <h3>{t(scenarioKey[v.type])}</h3>
                <dl>
                  <div>
                    <dt>{t("lpScDelay")}</dt>
                    <dd>
                      <span className="num">
                        {v.delayMinutes} {t("unitMin")}
                      </span>
                      <ProvenanceChip kind="estimated" />
                    </dd>
                  </div>
                  <div>
                    <dt>{t("lpScCost")}</dt>
                    <dd>
                      <span className="num">
                        {formatAmount(v.totalCost)} THB
                      </span>
                      <ProvenanceChip kind="estimated" />
                    </dd>
                  </div>
                </dl>
                <StatusBadge status="NOT_EVALUATED" />
              </li>
            ))}
          </ul>

          <div
            data-visual
            data-ui
            className="frame lp-frame lp-frame--plain lp-compare"
          >
            <div className="stage lp-schematic" data-mode="2d">
              <SchematicSvg
                frames={frames}
                selected={order.indexOf(CHOSEN)}
                scenarios={order}
                acceptance={acceptance}
                compare
                readings={readings}
                gaps={gaps}
                stepMinutes={DEMO_STEP_MINUTES}
                journeyEnd={journeyEnd}
                ariaLabel={aria}
                labels={{
                  origin: t(HERO.originKey),
                  decision: t("nodeDecision"),
                  receiver: t("nodeReceiverShort"),
                  alt: t("nodeAltShort"),
                  inspection: t("nodeInspectionShort"),
                  quarantine: t("nodeQuarantineShort"),
                  gap: t("gapNoReadings"),
                  blocked: t("barrierBlocked"),
                  unit: t("unitMin"),
                  currency: "THB",
                  title: t("svgTitle"),
                  acc: {
                    ACCEPTED: t("accAccepted"),
                    REJECTED: t("accRejected"),
                    UNKNOWN: t("accUnknown"),
                  },
                }}
              />
              <p className="schematic-note">{t("schematicNote")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ QA handoff */

function Lock() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M3 8.5 6.5 12 13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The frozen dataset as bars: one per reading, coloured by display band. */
function FrozenTrace({ readings }: { readings: (number | null)[] }) {
  const known = readings.filter((v): v is number => v !== null);
  const lo = Math.min(...known) - 1;
  const hi = Math.max(...known) + 1;
  const w = 100 / readings.length;
  return (
    <svg
      className="lp-trace"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-visual
    >
      {readings.map((v, i) =>
        v === null ? null : (
          <rect
            key={i}
            className={"band-" + thermalBand(v)}
            x={i * w + 0.6}
            y={40 - ((v - lo) / (hi - lo)) * 36}
            width={w - 1.2}
            height={((v - lo) / (hi - lo)) * 36}
            fill="var(--band)"
          />
        ),
      )}
    </svg>
  );
}

function QaHandoff() {
  const t = useT();
  const draft = useMemo(() => demoBaseline(), []);
  const s = draft.scenarios.find((x) => x.type === CHOSEN)!;
  return (
    <section className="lp-section" id="handoff" aria-labelledby="qa-h">
      <div className="wrap">
        <div className="lp-head">
          <h2 id="qa-h">{t("lpQaH2")}</h2>
          <p className="lp-lede">{t("lpQaLead")}</p>
        </div>
        <div className="lp-grid lp-split lp-split--qa">
          <div
            data-visual
            data-ui
            className="frame lp-frame lp-frame--plain lp-snapshot"
          >
            <div className="lp-frame__bar">
              <p className="lp-frame__title">{t("lpSnapTitle")}</p>
              <span className="lp-frozen">
                <Lock />
                {t("lpSnapFrozen")}
              </span>
            </div>
            <FrozenTrace readings={HERO.readings} />
            <dl className="lp-rows">
              <div>
                <dt>{t("lpSnapShipment")}</dt>
                <dd>
                  <span className="num">{HERO.id}</span> {t(HERO.productKey)}
                </dd>
              </div>
              <div>
                <dt>{t("lpSnapScenario")}</dt>
                <dd>{t(scenarioKey[CHOSEN])}</dd>
              </div>
              <div>
                <dt>{t("lpScDelay")}</dt>
                <dd>
                  <span className="num">
                    {s.estimated_delay_minutes} {t("unitMin")}
                  </span>
                  <ProvenanceChip kind="estimated" />
                </dd>
              </div>
              <div>
                <dt>{t("lpScCost")}</dt>
                <dd>
                  <span className="num">
                    {formatAmount(totalCost(s, draft.currency))} THB
                  </span>
                  <ProvenanceChip kind="estimated" />
                </dd>
              </div>
              <div>
                <dt>{t("lpSnapDataset")}</dt>
                <dd>
                  {t("lpSnapDatasetVal").replace(
                    "{n}",
                    String(HERO.readings.length),
                  )}
                  <ProvenanceChip kind="observed" />
                </dd>
              </div>
              <div>
                <dt>{t("lpSnapPolicy")}</dt>
                <dd>
                  <StatusBadge status="NOT_EVALUATED" />
                </dd>
              </div>
              <div>
                <dt>{t("lpSnapAi")}</dt>
                <dd>{t("lpSnapAiVal")}</dd>
              </div>
            </dl>
          </div>
          <div
            data-visual
            data-ui
            className="frame lp-frame lp-frame--plain lp-review"
          >
            <div className="lp-frame__bar">
              <p className="lp-frame__title">{t("lpQaTitle")}</p>
              <StatusBadge status="REVIEW_REQUIRED" />
            </div>
            <ul className="lp-points">
              {(["lpQaPoint1", "lpQaPoint2", "lpQaPoint3"] as const).map(
                (k) => (
                  <li key={k}>
                    <Tick />
                    {t(k)}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- close */

const noopSubscribe = () => () => {};

/** The close lives inside the shared footer, so footer and close are one screen. */
function Close() {
  const t = useT();
  const slot = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(FOOTER_CLOSE_ID),
    () => null,
  );
  if (!slot) return null;
  return createPortal(
    <div className="lp-close" id="close">
      <div className="lp-close__row">
        <h2 id="close-h">{t("lpCloseH2")}</h2>
        <OpenSimulator />
      </div>
      <p className="lp-close__name" aria-hidden="true">
        <BrandMark size={56} />
        {t("siteNameShort")}
      </p>
    </div>,
    slot,
  );
}

/* ------------------------------------------------------------- kit hooks */

/**
 * Loads the skill's motion layer (hover, press, hero entrance) and the dealt
 * counter moment from /public/assets, and mirrors the header height into --hdr.
 */
/** Plain files from /public, loaded by URL at runtime (not bundled). */
function loadKit(url: string) {
  return import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ url
  ).catch(() => {});
}

function KitLoader() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.type = "software";
    html.dataset.buttons = "arrow";
    html.dataset.radius = "sharp";
    const header = document.querySelector<HTMLElement>(".app-header");
    let ro: ResizeObserver | null = null;
    if (header) {
      const sync = () =>
        html.style.setProperty("--hdr", `${header.offsetHeight}px`);
      sync();
      ro = new ResizeObserver(sync);
      ro.observe(header);
    }
    void loadKit("/assets/motion/motion.js");
    void loadKit("/assets/moments/moments.js");
    return () => {
      ro?.disconnect();
      html.style.removeProperty("--hdr");
      delete html.dataset.type;
      delete html.dataset.buttons;
      delete html.dataset.radius;
    };
  }, []);
  return null;
}

export default function Landing() {
  return (
    <main className="landing lp" id="content">
      <KitLoader />
      <Hero />
      <Evidence />
      <Scenarios />
      <QaHandoff />
      <Close />
    </main>
  );
}
