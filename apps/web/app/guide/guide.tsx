"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./guide.css";
import manifestJson from "./guide-images.json";
import { FIGURES, type FigureId } from "./guide-figures";
import type { DictKey, Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import {
  ProvenanceChip,
  type Provenance,
} from "@/components/ui/provenance-chip";
import { StatusBadge, type Status } from "@/components/ui/status-badge";

type ImageInfo = {
  w: number;
  h: number;
  anchors: Record<string, { x: number; y: number }>;
};
const manifest = manifestJson as Record<string, Record<string, ImageInfo>>;

/** The screenshot with its numbered callout markers (percent positions, so they scale). */
function Shot({
  id,
  lang,
  alt,
  eager,
}: {
  id: FigureId;
  lang: Lang;
  alt: string;
  eager?: boolean;
}) {
  const info = manifest[lang]?.[id];
  if (!info) return null;
  return (
    <div className="gd-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/guide/${lang}/${id}.webp`}
        width={info.w}
        height={info.h}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      {Object.entries(info.anchors).map(([n, p]) => (
        <span
          key={n}
          className="gd-pin"
          aria-hidden="true"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function Enlarge({ id, lang, alt }: { id: FigureId; lang: Lang; alt: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="gd-enlarge"
        onClick={() => setOpen(true)}
      >
        {t("gdEnlarge")}
      </button>
      {open && (
        <dialog
          ref={ref}
          className="gd-dialog"
          aria-label={alt}
          onClose={() => setOpen(false)}
        >
          <button
            type="button"
            className="gd-dialog-close"
            autoFocus
            onClick={() => ref.current?.close()}
          >
            {t("gdClose")}
          </button>
          <div className="gd-dialog-scroll">
            <Shot id={id} lang={lang} alt={alt} eager />
          </div>
        </dialog>
      )}
    </>
  );
}

function Figure({ id, eager }: { id: FigureId; eager?: boolean }) {
  const { t, lang } = useI18n();
  const def = FIGURES[id];
  const alt = t(def.alt);
  const phone = id.startsWith("studio-mobile");
  return (
    <figure className={"gd-fig" + (phone ? " gd-fig--phone" : "")}>
      <div className="gd-fig-media">
        <Shot id={id} lang={lang} alt={alt} eager={eager} />
        <Enlarge id={id} lang={lang} alt={alt} />
      </div>
      <figcaption>
        <ol className="gd-steps" aria-label={t("gdStepsLabel")}>
          {def.steps.map((k, i) => (
            <li key={k}>
              <span className="gd-num" aria-hidden="true">
                {i + 1}
              </span>
              <span>{t(k)}</span>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

function Section({
  id,
  title,
  children,
  level = 2,
}: {
  id: string;
  title: string;
  children: ReactNode;
  level?: 2 | 3;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <section
      id={id}
      className={level === 2 ? "gd-sec" : "gd-sub"}
      aria-labelledby={id + "-h"}
    >
      <H id={id + "-h"}>{title}</H>
      {children}
    </section>
  );
}

type TocItem = { id: string; key: DictKey; children?: TocItem[] };
const TOC: TocItem[] = [
  { id: "quick-start", key: "gdTocQuick" },
  { id: "studio-tour", key: "gdTocTour" },
  { id: "playback", key: "gdTocPlayback" },
  { id: "honest-data", key: "gdTocHonest" },
  { id: "scenarios", key: "gdTocScenarios" },
  { id: "shortcuts", key: "gdTocKeys" },
  { id: "mobile", key: "gdTocMobile" },
  {
    id: "workspace",
    key: "gdTocWorkspace",
    children: [
      { id: "ws-shipments", key: "gdTocWsList" },
      { id: "ws-evidence", key: "gdTocWsEvidence" },
      { id: "ws-policy", key: "gdTocWsPolicy" },
      { id: "ws-simulate", key: "gdTocWsSim" },
      { id: "ws-qa", key: "gdTocWsQa" },
    ],
  },
  { id: "faq", key: "gdTocFaq" },
  { id: "safety", key: "gdTocSafety" },
];
const ALL_IDS = TOC.flatMap((i) => [
  i.id,
  ...(i.children ?? []).map((c) => c.id),
]);

function Toc() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  useEffect(() => {
    const els = ALL_IDS.map((id) => document.getElementById(id)).filter(
      (e): e is HTMLElement => !!e,
    );
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting);
        if (hit.length) setActive(hit[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  const link = (i: TocItem) => (
    <a
      href={`#${i.id}`}
      aria-current={active === i.id ? "location" : undefined}
      onClick={() => setOpen(false)}
    >
      {t(i.key)}
    </a>
  );
  return (
    <nav className="gd-toc" aria-label={t("gdToc")} data-open={open}>
      <button
        type="button"
        className="gd-toc-toggle"
        aria-expanded={open}
        aria-controls="gd-toc-list"
        onClick={() => setOpen((v) => !v)}
      >
        {t("gdTocToggle")}
      </button>
      <p className="gd-toc-title">{t("gdToc")}</p>
      <ol id="gd-toc-list" className="gd-toc-list">
        {TOC.map((i) => (
          <li key={i.id}>
            {link(i)}
            {i.children && (
              <ol>
                {i.children.map((c) => (
                  <li key={c.id}>{link(c)}</li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const STATUSES: [Status, DictKey][] = [
  ["ELIGIBLE", "gdStEligible"],
  ["REVIEW_REQUIRED", "gdStReview"],
  ["BLOCKED", "gdStBlocked"],
  ["INSUFFICIENT_DATA", "gdStInsufficient"],
  ["NOT_EVALUATED", "gdStNotEvaluated"],
];
const PROVENANCE: [Provenance, DictKey][] = [
  ["observed", "gdPvObserved"],
  ["entered", "gdPvEntered"],
  ["calculated", "gdPvCalculated"],
  ["estimated", "gdPvEstimated"],
];
const KEYS: [string[], DictKey][] = [
  [["Space"], "gdKeySpace"],
  [["←", "→"], "gdKeyArrows"],
  [["Shift", "←", "→"], "gdKeyShiftArrows"],
  [["C"], "gdKeyC"],
  [["R"], "gdKeyR"],
  [["1", "2", "3", "4"], "gdKey14"],
  [["↑", "↓"], "gdKeyPoint"],
  [["Delete"], "gdKeyDelete"],
  [["Esc"], "gdKeyEsc"],
];
const FAQ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export default function Guide() {
  const { t } = useI18n();
  return (
    <main className="guide" id="content">
      <header className="gd-head">
        <h1>{t("gdTitle")}</h1>
        <p className="gd-lead">{t("gdLead")}</p>
        <p className="gd-demo">{t("gdDemoNote")}</p>
        <div className="gd-cta">
          <Link className="gd-btn gd-btn--primary" href="/studio">
            {t("gdTryStudio")}
          </Link>
          <Link className="gd-btn" href="/workspace">
            {t("gdTryWorkspace")}
          </Link>
        </div>
      </header>
      <div className="gd-layout">
        <Toc />
        <div className="gd-body">
          <Section id="quick-start" title={t("gdQuickH")}>
            <p>{t("gdQuickLead")}</p>
            <p>{t("gdQuickP1")}</p>
            <p>{t("gdQuickP2")}</p>
            <Figure id="studio-first" eager />
          </Section>

          <Section id="studio-tour" title={t("gdTourH")}>
            <p>{t("gdTourLead")}</p>
            <Figure id="studio-overview" />
            <p>{t("gdTourNote")}</p>
          </Section>

          <Section id="playback" title={t("gdPlayH")}>
            <p>{t("gdPlayLead")}</p>
            <Figure id="studio-timeline" />
            <p>{t("gdPlayNote")}</p>
          </Section>

          <Section id="honest-data" title={t("gdHonestH")}>
            <p>{t("gdHonestLead")}</p>
            <Figure id="studio-gap" />
            <p>{t("gdHonestGapP")}</p>
            <Figure id="ref-thermal" />
            <Section id="status-badges" level={3} title={t("gdStatusH")}>
              <Figure id="ref-status" />
              <table className="gd-table">
                <thead>
                  <tr>
                    <th scope="col">{t("gdStatusColStatus")}</th>
                    <th scope="col">{t("gdStatusColMeaning")}</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUSES.map(([s, k]) => (
                    <tr key={s}>
                      <th scope="row">
                        <StatusBadge status={s} />
                        <code>{s}</code>
                      </th>
                      <td>{t(k)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section id="provenance" level={3} title={t("gdProvH")}>
              <table className="gd-table">
                <thead>
                  <tr>
                    <th scope="col">{t("gdProvColChip")}</th>
                    <th scope="col">{t("gdProvColMeaning")}</th>
                  </tr>
                </thead>
                <tbody>
                  {PROVENANCE.map(([p, k]) => (
                    <tr key={p}>
                      <th scope="row">
                        <ProvenanceChip kind={p} />
                      </th>
                      <td>{t(k)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </Section>

          <Section id="scenarios" title={t("gdScenH")}>
            <p>{t("gdScenLead")}</p>
            <Figure id="studio-scenario" />
            <Section id="what-if" level={3} title={t("gdWhatIfH")}>
              <p>{t("gdWhatIfLead")}</p>
              <Figure id="studio-factors" />
            </Section>
            <Section id="visible-factors" level={3} title={t("gdVisibleH")}>
              <p>{t("gdVisibleLead")}</p>
              <Figure id="studio-chart" />
              <p>{t("gdVisibleNote")}</p>
            </Section>
            <Section id="compare" level={3} title={t("gdCompareH")}>
              <p>{t("gdCompareLead")}</p>
              <Figure id="studio-compare" />
              <p>{t("gdAxisNote")}</p>
            </Section>
            <Section id="edit-readings" level={3} title={t("gdEditH")}>
              <p>{t("gdEditLead")}</p>
              <Figure id="studio-edit" />
              <p>{t("gdEditNote")}</p>
            </Section>
            <Section id="cameras" level={3} title={t("gdCameraH")}>
              <p>{t("gdCameraLead")}</p>
              <Figure id="studio-2d" />
              <p>{t("gdResetP")}</p>
            </Section>
          </Section>

          <Section id="shortcuts" title={t("gdKeysH")}>
            <p>{t("gdKeysLead")}</p>
            <table className="gd-table">
              <thead>
                <tr>
                  <th scope="col">{t("gdKeyCol")}</th>
                  <th scope="col">{t("gdKeyDoes")}</th>
                </tr>
              </thead>
              <tbody>
                {KEYS.map(([keys, k]) => (
                  <tr key={k}>
                    <th scope="row">
                      {keys.map((x, i) => (
                        <kbd key={i}>{x}</kbd>
                      ))}
                    </th>
                    <td>{t(k)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section id="mobile" title={t("gdMobileH")}>
            <p>{t("gdMobileLead")}</p>
            <Figure id="studio-mobile" />
            <Figure id="studio-mobile-sheet" />
          </Section>

          <Section id="workspace" title={t("gdWsH")}>
            <p>{t("gdWsLead")}</p>
            <h3 className="gd-h3">{t("gdWsStepsLead")}</h3>
            <ol className="gd-journey">
              {(
                [
                  "gdWsStep1",
                  "gdWsStep2",
                  "gdWsStep3",
                  "gdWsStep4",
                  "gdWsStep5",
                  "gdWsStep6",
                ] as const
              ).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ol>
            <p>{t("gdWsRolesP")}</p>

            <Section id="ws-shipments" level={3} title={t("gdWsListH")}>
              <Figure id="ws-list" />
              <h4>{t("gdWsCreateH")}</h4>
              <Figure id="ws-create" />
            </Section>

            <Section id="ws-evidence" level={3} title={t("gdWsEvH")}>
              <p>{t("gdWsEvLead")}</p>
              <Figure id="ws-evidence-empty" />
              <Figure id="ws-upload" />
              <Figure id="ws-evidence-chart" />
            </Section>

            <Section id="ws-policy" level={3} title={t("gdWsPolH")}>
              <p>{t("gdWsPolLead")}</p>
              <Figure id="ws-policy" />
              <Figure id="ws-analysis" />
              <p>{t("gdWsPolNote")}</p>
            </Section>

            <Section id="ws-simulate" level={3} title={t("gdWsSimH")}>
              <p>{t("gdWsSimLead")}</p>
              <Figure id="ws-simulate" />
              <p>{t("gdWsSimNote")}</p>
              <Figure id="ws-propose" />
            </Section>

            <Section id="ws-qa" level={3} title={t("gdWsQaH")}>
              <p>{t("gdWsQaLead")}</p>
              <Figure id="ws-qa" />
              <p>{t("gdWsQaNote")}</p>
              <Figure id="ws-report" />
              <p>{t("gdWsExplainP")}</p>
            </Section>
          </Section>

          <Section id="faq" title={t("gdFaqH")}>
            <dl className="gd-faq">
              {FAQ.map((n) => (
                <div key={n}>
                  <dt>{t(`gdFaq${n}Q`)}</dt>
                  <dd>{t(`gdFaq${n}A`)}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="safety" title={t("gdSafeH")}>
            <div className="gd-note">
              <p>{t("gdSafeP1")}</p>
              <p>{t("gdSafeP2")}</p>
              <p>{t("gdSafeP3")}</p>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
