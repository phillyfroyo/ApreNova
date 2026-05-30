// src/app/[lng]/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import FeedbackWidget from "@/components/FeedbackWidget";

const SITE_URL = "https://cuentana.app";

/** Default hreflang alternates for any /[lng]/* page that doesn't override
 *  its own metadata. Reads the actual pathname from middleware-set headers,
 *  swaps the language prefix, and emits both en/es siblings. */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const pathname = h.get("x-cuentana-pathname") ?? "/";

  // Strip leading /[lng]/ → bare path. e.g. /en/stories → /stories
  const stripped = pathname.replace(/^\/(en|es)(?=\/|$)/, "") || "/";

  return {
    alternates: {
      canonical: `${SITE_URL}${pathname}`,
      languages: {
        en: `${SITE_URL}/en${stripped === "/" ? "" : stripped}`,
        es: `${SITE_URL}/es${stripped === "/" ? "" : stripped}`,
        // Primary audience is Spanish-native — fall back to /es.
        "x-default": `${SITE_URL}/es${stripped === "/" ? "" : stripped}`,
      },
    },
  };
}

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lng: string }>;
}) {
  // Validate and fallback to "es"
  const { lng } = await params;
  const validLng = lng === "en" ? "en" : "es";

  return (
    <>
      {children}
      <FeedbackWidget lng={validLng} />
    </>
  );
}
