import { useMemo } from "react";

import { translations } from "../i18n/translations";
import { useAppStore } from "../store/appStore";
import type { AppLanguage } from "../types/settings";

type Vars = Record<string, string | number>;

const interpolate = (template: string, vars?: Vars) => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
};

export const useI18n = () => {
  const language = useAppStore((s) => s.language);

  return useMemo(() => {
    const dict = translations[language] ?? translations.en;
    const fallback = translations.en;
    const t = (key: string, vars?: Vars) => interpolate(dict[key] ?? fallback[key] ?? key, vars);
    const isRTL = language === "ar";
    const locale = language === "ar" ? "ar" : "en";

    return {
      language: language as AppLanguage,
      isRTL,
      locale,
      t,
      prayerName: (name: string) => t(`prayer.${name}`),
    };
  }, [language]);
};

