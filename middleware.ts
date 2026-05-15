// middleware.ts
// Sets an x-cuentana-lang header on every request so the root layout can
// render <html lang="..."> matching the actual URL language. This matters
// for SEO (Google reads <html lang>), accessibility (screen readers), and
// browser behavior (spell-check, auto-translate).

import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LANGS = new Set(["en", "es"]);
const DEFAULT_LANG = "en";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // First path segment is the language for routes under /[lng]/...
  const first = pathname.split("/")[1] ?? "";
  const lang = SUPPORTED_LANGS.has(first) ? first : DEFAULT_LANG;

  const response = NextResponse.next();
  response.headers.set("x-cuentana-lang", lang);
  response.headers.set("x-cuentana-pathname", pathname);
  return response;
}

// Skip Next internals, static assets, and the auto-generated SEO files.
// Everything else goes through so we can tag the response with the language.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images/|fonts/).*)",
  ],
};
