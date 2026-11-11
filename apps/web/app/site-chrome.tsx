"use client";
import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { useI18n, useT } from "./i18n-provider";
import { LANGS, type Lang } from "./i18n";
import { setTheme, useTheme } from "./prefs";

const LANG_LABEL: Record<Lang, string> = { en: "EN", th: "ไทย" };

export function SkipLink() {
  const t = useT();
  return (
    <a className="skip-link" href="#content">
      {t("skipToContent")}
    </a>
  );
}

function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="seg" role="group" aria-label={t("language")}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className="seg-btn"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const t = useT();
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="seg-btn theme-btn"
      aria-pressed={dark}
      aria-label={t("theme") + ": " + (dark ? t("themeDark") : t("themeLight"))}
      title={dark ? t("switchToLight") : t("switchToDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        {dark ? (
          <path
            d="M16 12.5A7 7 0 0 1 7.5 4a7 7 0 1 0 8.5 8.5Z"
            fill="currentColor"
          />
        ) : (
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
          </g>
        )}
      </svg>
      <span className="theme-label">
        {dark ? t("themeDark") : t("themeLight")}
      </span>
    </button>
  );
}

export function SiteHeader() {
  const t = useT();
  return (
    <header className="app-header">
      <Link className="brand" href="/" aria-label={t("siteName")}>
        <BrandMark size={36} />
        <span className="brand-word">Cold Chain</span>
        <span className="brand-sub">Simulation Studio</span>
      </Link>
      <nav aria-label={t("navPrimary")}>
        <Link href="/demo">{t("navDemo")}</Link>
        <Link href="/workspace">{t("navWorkspace")}</Link>
        <span className="environment">{t("environment")}</span>
        <LangToggle />
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="app-footer">
      <span>{t("footerDisclaimer")}</span>
      <span>{t("footerEvidence")}</span>
    </footer>
  );
}
