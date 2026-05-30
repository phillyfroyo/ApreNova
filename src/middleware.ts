// src/middleware.ts
// Sets x-cuentana-lang + x-cuentana-pathname REQUEST headers (not response
// headers — those only reach the browser) so the root and [lng] layouts can
// render <html lang="..."> and hreflang alternates matching the actual URL.
// This matters for SEO (Google reads <html lang>), accessibility (screen
// readers), and browser behavior (spell-check, auto-translate).
//
// Must live at src/middleware.ts (not the project root) because the app
// directory is under src/ — Next.js looks alongside the app directory.

import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LANGS = new Set(["en", "es"]);
// Primary audience is Spanish-native (LATAM); default un-prefixed/unknown
// paths to "es" so <html lang> and hreflang fall back to the primary
// language — matches the "es" default in [lng]/layout.tsx and constants/i18n.ts.
const DEFAULT_LANG = "es";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // First path segment is the language for routes under /[lng]/...
  const first = pathname.split("/")[1] ?? "";
  const lang = SUPPORTED_LANGS.has(first) ? first : DEFAULT_LANG;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-cuentana-lang", lang);
  requestHeaders.set("x-cuentana-pathname", pathname);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Skip Next internals, static assets, and the auto-generated SEO files.
// Everything else goes through so we can tag the response with the language.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images/|fonts/).*)",
  ],
};
