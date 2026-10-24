"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";
import { dictionaryFor } from "./dictionary";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "./locales";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

async function rememberLocale(locale: Locale) {
  const saved = await cookieStore.get(LOCALE_COOKIE);
  if (saved?.value === locale) return;
  await cookieStore.set({
    name: LOCALE_COOKIE,
    value: locale,
    path: "/",
    expires: Date.now() + LOCALE_COOKIE_MAX_AGE * 1000,
    sameSite: "lax",
  });
}

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  useEffect(() => {
    if ("cookieStore" in window) rememberLocale(locale);
  }, [locale]);
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useDictionary() {
  return dictionaryFor(useLocale());
}
