export const LOCALES = ["en", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function hasLocale(value: string | undefined): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

function languageOf(tag: string) {
  return tag.split("-")[0].toLowerCase();
}

function closestLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase();
  return (
    LOCALES.find((locale) => locale.toLowerCase() === lower) ??
    LOCALES.find((locale) => languageOf(locale) === languageOf(tag)) ??
    null
  );
}

export function matchLocale(acceptLanguage: string | null): Locale {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      return { tag, q: quality ? Number(quality.trim().slice(2)) : 1 };
    })
    .filter(({ tag, q }) => tag && tag !== "*" && q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const locale = closestLocale(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function pathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];
  return hasLocale(segment) ? segment : null;
}

export function localePath(locale: Locale, path = "/") {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export function switchLocalePath(pathname: string, locale: Locale) {
  const current = pathLocale(pathname);
  const rest = current ? pathname.slice(current.length + 1) : pathname;
  return localePath(locale, rest || "/");
}

export function languageAlternates(path = "/") {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, localePath(locale, path)]),
  ) as Record<Locale, string>;
}
