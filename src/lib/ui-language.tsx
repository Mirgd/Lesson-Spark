import { uiTranslations } from "@/lib/ui-translations";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UiLanguage = "ar" | "en";

const STORAGE_KEY = "lesson_spark_ui_language";

type UiTranslations =
  (typeof uiTranslations)[UiLanguage];

type UiLanguageContextValue = {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  toggleLanguage: () => void;
  dir: "rtl" | "ltr";
  t: UiTranslations;
};

const UiLanguageContext =
  createContext<UiLanguageContextValue | null>(
    null
  );

export function UiLanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguageState] =
    useState<UiLanguage>("ar");

  useEffect(() => {
    const saved =
      window.localStorage.getItem(STORAGE_KEY);

    if (saved === "ar" || saved === "en") {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (next: UiLanguage) => {
    setLanguageState(next);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        STORAGE_KEY,
        next
      );
    }
  };

  const toggleLanguage = () => {
    setLanguage(
      language === "ar" ? "en" : "ar"
    );
  };

  const dir: "rtl" | "ltr" =
    language === "ar" ? "rtl" : "ltr";

  const t = uiTranslations[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      dir,
      t,
    }),
    [language, dir, t]
  );

  return (
    <UiLanguageContext.Provider value={value}>
      {children}
    </UiLanguageContext.Provider>
  );
}

export function useUiLanguage() {
  const context =
    useContext(UiLanguageContext);

  if (!context) {
    throw new Error(
      "useUiLanguage must be used inside UiLanguageProvider"
    );
  }

  return context;
}