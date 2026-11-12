"use client";
import { useSyncExternalStore } from "react";
import { LANG_KEY, THEME_KEY, isLang, type Lang } from "./i18n";

export type Theme = "light" | "dark";

/**
 * Tiny external store for the two display preferences. The source of truth is
 * the <html> element (lang, data-theme), which an inline script in layout sets
 * before first paint from localStorage. Storage access is always guarded.
 */
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this page view only */
  }
}

export function setLang(lang: Lang) {
  document.documentElement.lang = lang;
  store(LANG_KEY, lang);
  emit();
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  store(THEME_KEY, theme);
  emit();
}

const getLang = (): Lang => {
  const v = document.documentElement.lang;
  return isLang(v) ? v : "en";
};
const getTheme = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

export const useLang = () =>
  useSyncExternalStore<Lang>(subscribe, getLang, () => "en");
export const useTheme = () =>
  useSyncExternalStore<Theme>(subscribe, getTheme, () => "light");
