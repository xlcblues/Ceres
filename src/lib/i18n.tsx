import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { enUS } from "../locales/en-US";
import { zhCN, type CeresMessages } from "../locales/zh-CN";

export type Language = "zh-CN" | "en-US";

const STORAGE_KEY = "ceres.language";

const messagesByLanguage: Record<Language, CeresMessages> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

function detectLanguage(): Language {
  if (
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("zh")
  ) {
    return "zh-CN";
  }
  return "en-US";
}

function resolvePath(messages: CeresMessages, key: string): unknown {
  let value: unknown = messages;
  for (const part of key.split(".")) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  messages: CeresMessages;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh-CN" || saved === "en-US") return saved;
    return detectLanguage();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (next: Language) => setLanguageState(next),
    [],
  );

  const messages = messagesByLanguage[language];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = resolvePath(messages, key);
      if (typeof value === "string") return interpolate(value, params);
      return key;
    },
    [messages],
  );

  const value = useMemo(
    () => ({ language, setLanguage, messages, t }),
    [language, setLanguage, messages, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return value;
}
