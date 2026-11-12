"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { dictionaries, type Dict, type DictKey, type Lang } from "./index";
import { setLang, useLang } from "@/lib/prefs";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useLang();
  const value = useMemo<Ctx>(() => {
    const dict: Dict = dictionaries[lang];
    return { lang, setLang, t: (k) => dict[k] };
  }, [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export const useT = () => useI18n().t;
