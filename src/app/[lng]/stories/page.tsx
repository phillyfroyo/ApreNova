// src/app/[lng]/stories/page.tsx
// Server-component wrapper that exports SEO metadata for the stories
// home page. Real UI lives in StoriesPageClient (a client component
// since it has lots of state, modals, etc.).

import type { Metadata } from "next";
import StoriesPageClient from "./StoriesPageClient";

const SITE_URL = "https://cuentana.app";

type RouteParams = { lng: string };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { lng } = await params;
  if (lng !== "en" && lng !== "es") return {};

  const title =
    lng === "es"
      ? "Historias para aprender inglés en todos los niveles CEFR"
      : "Spanish Stories at Every CEFR Level (A1–C1) — Read Online";

  const description =
    lng === "es"
      ? "Lee historias originales y clásicos literarios en inglés, adaptados a cada nivel CEFR (A1–C1). Con traducción integrada, audio narrado y modo bilingüe."
      : "Read curated stories and literary classics in Spanish, adapted to every CEFR level (A1–C1). Includes built-in translation, narrated audio, and bilingual reading mode.";

  const enUrl = `${SITE_URL}/en/stories`;
  const esUrl = `${SITE_URL}/es/stories`;
  const canonicalUrl = lng === "en" ? enUrl : esUrl;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: { en: enUrl, es: esUrl },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalUrl,
      siteName: "Cuentana",
      locale: lng === "es" ? "es_ES" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default function StoriesPage() {
  return <StoriesPageClient />;
}
