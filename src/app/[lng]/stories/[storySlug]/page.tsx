// src/app/[lng]/stories/[storySlug]/page.tsx
//
// Story info-card landing route. Server-rendered for SEO.
//
// This is where Google sends people who searched for a specific story.
// It renders the full info card (image, title, hook, description, level
// badges, author, rights) with its own metadata + JSON-LD, and a "Start
// reading" CTA that points the right reader URL for the visitor.
//
// Per the SEO Stage 5+ addendum in dev/SEO_PLAN.md:
// - Sitemap priority 0.8 (above reader URLs at 0.7)
// - Canonical points at itself, not the reader
// - Distinct hreflang en↔es alternates
// - JSON-LD Book + BreadcrumbList (no LearningResource — no specific level implied)

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { STORY_METADATA, getStoryTitle, getAuthorName } from "@/lib/stories";
import { getNavigationUrl } from "@/utils/storyNavigation";
import { toCEFR, type CEFRCode } from "@/lib/cefr";
import type { Language } from "@/types/i18n";
import Link from "next/link";
import StoryDetailContent from "@/components/StoryDetailContent";
import JsonLd from "@/components/JsonLd";
import Logo from "@/components/Logo";
import { t } from "@/lib/t";

const SITE_URL = "https://cuentana.app";

type RouteParams = { lng: string; storySlug: string };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { lng, storySlug } = await params;
  if (lng !== "en" && lng !== "es") return {};

  const storyMeta = STORY_METADATA.find((s) => s.slug === storySlug);
  if (!storyMeta || storyMeta.isArchived) return {};

  const title = getStoryTitle(lng as Language, storySlug);
  const langLabel = lng === "es" ? "Inglés" : "Spanish";
  const fullTitle = lng === "es"
    ? `${title} — Historias en ${langLabel}`
    : `${title} — ${langLabel} Stories`;

  // Description: prefer registry hand-tuned summary, then hook, else template.
  const hook = storyMeta.descriptions?.hook;
  const summary = storyMeta.descriptions?.summary;
  const description = (summary || hook ||
    (lng === "es"
      ? `Lee "${title}" en inglés con traducción integrada, audio palabra por palabra y modo bilingüe en Cuentana.`
      : `Read "${title}" in Spanish with built-in translation, word-by-word audio, and bilingual reading mode on Cuentana.`)
  ).slice(0, 300);

  const enUrl = `${SITE_URL}/en/stories/${storySlug}`;
  const esUrl = `${SITE_URL}/es/stories/${storySlug}`;
  const canonicalUrl = lng === "en" ? enUrl : esUrl;

  const ogImage = storyMeta.image?.startsWith("/") ? `${SITE_URL}${storyMeta.image}` : storyMeta.image;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: { en: enUrl, es: esUrl },
    },
    openGraph: {
      type: "book",
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: "Cuentana",
      locale: lng === "es" ? "es_ES" : "en_US",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Resolve the URL the "Start reading" CTA should point at.
 *
 * For authenticated users: look up their bookmark for this story. If one exists,
 * point at it. Otherwise use their profile level (or A1 fallback).
 *
 * For unauthenticated visitors (the typical Google-referred case): use the
 * story's lowest available level at ch1/page1.
 */
async function resolveReadUrl(
  lng: Language,
  storySlug: string,
  storyLevels: CEFRCode[]
): Promise<string> {
  const lowestLevel = storyLevels[0] || ("A1" as CEFRCode);

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const bookmark = await prisma.storyBookmark.findFirst({
        where: { userId: session.user.id, storySlug },
      });
      if (bookmark) {
        return getNavigationUrl(lng, storySlug, toCEFR(bookmark.level), bookmark.chapter, bookmark.page, false);
      }
      // No bookmark — use the user's quiz level if available
      const userLevel = (session.user as { quizLevel?: string }).quizLevel;
      if (userLevel) {
        const cefr = toCEFR(userLevel);
        if (storyLevels.includes(cefr as CEFRCode)) {
          return getNavigationUrl(lng, storySlug, cefr, 1, 1, false);
        }
      }
    }
  } catch {
    // fall through to default
  }

  return getNavigationUrl(lng, storySlug, lowestLevel, 1, 1, false);
}

export default async function StoryInfoPage({ params }: { params: Promise<RouteParams> }) {
  const { lng, storySlug } = await params;

  if (lng !== "en" && lng !== "es") return notFound();

  const story = STORY_METADATA.find((s) => s.slug === storySlug);
  if (!story || story.isArchived) return notFound();

  const typedLang = lng as Language;
  const storyLevels = story.levels.map((l) => toCEFR(l) as CEFRCode);
  const readUrl = await resolveReadUrl(typedLang, storySlug, storyLevels);

  // ---- JSON-LD ----
  const title = getStoryTitle(typedLang, storySlug);
  const author = story.origin.isOriginal
    ? "Cuentana"
    : story.origin.attribution
      ? getAuthorName(story.origin.attribution)
      : "Unknown";
  const targetLanguageCode = lng === "es" ? "en" : "es";
  const ogImage = story.image?.startsWith("/") ? `${SITE_URL}${story.image}` : story.image;
  const infoUrl = `${SITE_URL}/${lng}/stories/${storySlug}`;

  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Book",
        "@id": `${infoUrl}#book`,
        name: title,
        author: { "@type": "Person", name: author },
        inLanguage: targetLanguageCode,
        url: infoUrl,
        ...(ogImage ? { image: ogImage } : {}),
        ...(story.descriptions?.summary ? { description: story.descriptions.summary } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/${lng}` },
          { "@type": "ListItem", position: 2, name: "Stories", item: `${SITE_URL}/${lng}/stories` },
          { "@type": "ListItem", position: 3, name: title, item: infoUrl },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLdGraph} />
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white pt-4 pb-8 px-4">
        <div className="max-w-5xl mx-auto mb-4">
          <Link
            href={`/${lng}/stories`}
            className="inline-flex items-center gap-2 text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {t(typedLang, "stories", "backToStories")}
          </Link>
        </div>
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden md:flex md:flex-row md:max-h-[calc(100vh-120px)] md:[overscroll-behavior:contain]">
          <StoryDetailContent
            story={story}
            lang={typedLang}
            readUrl={readUrl}
          />
        </div>

        {/* Cuentana context block — for cold visitors (Google-referred) who land here without knowing the app */}
        <div className="max-w-3xl mx-auto mt-4 px-4 pt-4 pb-8 text-center">
          <Link href={`/${lng}`} className="inline-block">
            <Logo variant="storiesmain" size="text-[48px]" plain />
          </Link>
          <p className="mt-2 text-xl text-gray-700 mb-6">
            {t(typedLang, "about", "tagline")}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-4 max-w-xl mx-auto">
            {t(typedLang, "stories", "storyLandingIntro")}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-6 max-w-xl mx-auto">
            {t(typedLang, "stories", "storyLandingSubtagline")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={readUrl}
              className="inline-flex items-center px-5 py-2.5 bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {t(typedLang, "stories", "readStoryByName", { title })}
            </a>
            <Link
              href={`/${lng}/stories`}
              className="inline-flex items-center px-5 py-2.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 text-sm font-semibold rounded-lg transition-colors"
            >
              {t(typedLang, "stories", "browseAllStories")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
