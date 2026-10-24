import { type NextRequest, NextResponse } from "next/server";
import {
  hasLocale,
  LOCALE_COOKIE,
  localePath,
  matchLocale,
} from "./i18n/locales";

function preferredLocale(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(saved)) return saved;
  return matchLocale(request.headers.get("accept-language"));
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = localePath(preferredLocale(request), url.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/|en/|en$|pt-BR/|pt-BR$|relics/[^/]+/[^/]+/?$|.*\\.[^/]+$).*)",
  ],
};
