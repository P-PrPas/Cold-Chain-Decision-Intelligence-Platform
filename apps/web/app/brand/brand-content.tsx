"use client";
import { useEffect, useRef } from "react";
import { BrandMark } from "../brand-mark";
import { useT } from "../i18n-provider";
import { useTheme } from "../prefs";
import { contrastRatio, parseColor } from "../ui/contrast";
import { ProvenanceChip, type Provenance } from "../ui/provenance-chip";
import { StatusBadge, type Status } from "../ui/status-badge";

const SWATCHES = [
  "bg",
  "panel",
  "panel-2",
  "line",
  "line-strong",
  "accent",
  "accent-soft",
];
const PAIRS: [string, string][] = [
  ["text", "bg"],
  ["text", "panel"],
  ["muted", "bg"],
  ["muted", "panel"],
  ["accent", "bg"],
  ["accent-ink", "accent"],
  ["st-eligible-fg", "st-eligible-bg"],
  ["st-review-fg", "st-review-bg"],
  ["st-blocked-fg", "st-blocked-bg"],
  ["st-unknown-fg", "st-unknown-bg"],
];
const THERMAL = ["temp-cold", "temp-cool", "temp-warm", "temp-hot"];
const STATUSES: Status[] = [
  "ELIGIBLE",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "INSUFFICIENT_DATA",
  "NOT_EVALUATED",
];
const PROVS: Provenance[] = ["observed", "entered", "calculated", "estimated"];

/** Reads the live computed colours so the shown ratio always matches the active theme. */
function ContrastRow({ fg, bg }: { fg: string; bg: string }) {
  const row = useRef<HTMLTableRowElement>(null);
  const out = useRef<HTMLSpanElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const el = row.current;
    if (!el || !out.current) return;
    const cs = getComputedStyle(el);
    const a = parseColor(cs.getPropertyValue("--" + fg));
    const b = parseColor(cs.getPropertyValue("--" + bg));
    out.current.textContent =
      a && b ? contrastRatio(a, b).toFixed(2) + " : 1" : "n/a";
  }, [fg, bg, theme]);
  return (
    <tr ref={row}>
      <td>
        <span
          className="contrast-sample"
          style={{ color: `var(--${fg})`, background: `var(--${bg})` }}
        >
          Aa
        </span>
      </td>
      <td className="num">
        --{fg} / --{bg}
      </td>
      <td className="num">
        <span ref={out} />
      </td>
    </tr>
  );
}

function LogoPanel({ scope }: { scope: "light" | "dark" }) {
  const t = useT();
  return (
    <div className="logo-panel" data-theme-scope={scope}>
      <h3>{scope === "light" ? t("brandOnLight") : t("brandOnDark")}</h3>
      <div className="logo-row">
        <figure>
          <BrandMark size={72} />
          <figcaption>{t("brandMarkColour")}</figcaption>
        </figure>
        <figure>
          <BrandMark size={72} mono />
          <figcaption>{t("brandMarkMono")}</figcaption>
        </figure>
        <figure>
          <span className="lockup">
            <BrandMark size={44} />
            <span>
              <strong>Cold Chain</strong>
              <small>Simulation Studio</small>
            </span>
          </span>
          <figcaption>{t("brandLockup")}</figcaption>
        </figure>
        <figure>
          <span className="favicon-demo">
            <BrandMark size={32} />
          </span>
          <figcaption>{t("brandFavicon")}</figcaption>
        </figure>
      </div>
    </div>
  );
}

const SCALE: [string, string][] = [
  ["h1", "36 / 68"],
  ["h2", "27"],
  ["h3", "20"],
  ["body", "16"],
  ["small", "13"],
];

export function BrandContent() {
  const t = useT();
  return (
    <main className="brand-page" id="content">
      <h1>{t("brandTitle")}</h1>
      <p>{t("brandIntro")}</p>

      <section aria-labelledby="b-logo">
        <h2 id="b-logo">{t("brandLogo")}</h2>
        <p>{t("brandLogoNote")}</p>
        <div className="logo-grid">
          <LogoPanel scope="light" />
          <LogoPanel scope="dark" />
        </div>
      </section>

      <section aria-labelledby="b-colour">
        <h2 id="b-colour">{t("brandColour")}</h2>
        <p>{t("brandColourNote")}</p>
        <ul className="swatches">
          {SWATCHES.map((s) => (
            <li key={s}>
              <span className="swatch" style={{ background: `var(--${s})` }} />
              <code className="num">--{s}</code>
            </li>
          ))}
        </ul>
        <table className="contrast-table">
          <thead>
            <tr>
              <th scope="col"> </th>
              <th scope="col">{t("brandPair")}</th>
              <th scope="col">{t("brandRatio")}</th>
            </tr>
          </thead>
          <tbody>
            {PAIRS.map(([fg, bg]) => (
              <ContrastRow key={fg + bg} fg={fg} bg={bg} />
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="b-thermal">
        <h2 id="b-thermal">{t("brandThermal")}</h2>
        <p>{t("brandThermalNote")}</p>
        <div className="thermal-scale" aria-hidden="true">
          {THERMAL.map((s) => (
            <span key={s} style={{ background: `var(--${s})` }} />
          ))}
        </div>
        <ul className="swatches">
          {THERMAL.map((s) => (
            <li key={s}>
              <span className="swatch" style={{ background: `var(--${s})` }} />
              <code className="num">--{s}</code>
            </li>
          ))}
        </ul>
        <h3>{t("brandUnknown")}</h3>
        <p>{t("brandUnknownNote")}</p>
        <div className="hatch-sample">
          <span>{t("brandNoReadings")}</span>
        </div>
      </section>

      <section aria-labelledby="b-status">
        <h2 id="b-status">{t("brandStatus")}</h2>
        <p>{t("brandStatusNote")}</p>
        <div className="chip-row">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
        <h3>{t("brandProvenance")}</h3>
        <p>{t("brandProvenanceNote")}</p>
        <div className="chip-row">
          {PROVS.map((p) => (
            <span key={p} className="prov-demo">
              <span className="num">4.2 °C</span>
              <ProvenanceChip kind={p} />
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="b-type">
        <h2 id="b-type">{t("brandType")}</h2>
        <p>{t("brandTypeNote")}</p>
        {SCALE.map(([name, size]) => (
          <div className="type-row" key={name}>
            <code className="num">
              {name} · {size}
            </code>
            <span className={"type-" + name}>{t("brandSample")}</span>
          </div>
        ))}
        <p className="num type-mono">
          0123456789 · 2.0 – 8.0 °C · 09:30 – 10:30 UTC
        </p>
      </section>
    </main>
  );
}
