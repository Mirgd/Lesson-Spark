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

type UiLanguageContextValue = {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  toggleLanguage: () => void;
  dir: "rtl" | "ltr";
};

const UiLanguageContext =
  createContext<UiLanguageContextValue | null>(null);

export function UiLanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguageState] =
    useState<UiLanguage>("ar");

  useEffect(() => {
    const saved = window.localStorage.getItem(
      STORAGE_KEY
    );

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
    setLanguage(language === "ar" ? "en" : "ar");
  };

const dir: "rtl" | "ltr" =
  language === "ar" ? "rtl" : "ltr";
  
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
    }),
    [language, dir]
  );

  return (
    <UiLanguageContext.Provider value={value}>
      {children}
    </UiLanguageContext.Provider>
  );
}

export function useUiLanguage() {
  const context = useContext(UiLanguageContext);

  if (!context) {
    throw new Error(
      "useUiLanguage must be used inside UiLanguageProvider"
    );
  }

  return context;
}