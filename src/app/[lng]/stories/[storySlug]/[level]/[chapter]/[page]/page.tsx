// src/app/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA, getStoryTitle, getAuthorName } from "@/lib/stories";
import StoryLayoutWithAzureTTS from "@/components/StoryLayoutWithAzureTTS";
import JsonLd from "@/components/JsonLd";
import type { Language } from "@/types/i18n";
import { getStoryMap } from "@/lib/getStoryMap";
import LevelUnavailablePage from "@/components/LevelUnavailablePage";
import { toCEFR, toFolderName, type CEFRCode } from "@/lib/cefr";
import { getNavigationUrl } from "@/utils/storyNavigation";

const SITE_URL = "https://cuentana.app";

type RouteParams = { lng: string; storySlug: string; level: string; chapter: string; page: string };

/** Per-story metadata: unique title + description + canonical + hreflang for every story page.
 *  This is the SEO headline fix — Google's previously seeing "Cuentana / Learn language through
 *  stories" on every page. With this, it sees "The Last Word — B1 Spanish | Cuentana" etc. */
export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { lng, storySlug, level } = await params;
  if (lng !== "en" && lng !== "es") return {};

  const storyMeta = STORY_METADATA.find((s) => s.slug === storySlug);
  if (!storyMeta) return {};

  const cefrLevel = toCEFR(level) as CEFRCode;
  const isLevelAvailable = storyMeta.levels.includes(cefrLevel);
  if (!isLevelAvailable) return {};

  const title = getStoryTitle(lng as Language, storySlug);
  const langLabel = lng === "es" ? "Inglés" : "Spanish";
  const fullTitle = `${title} — ${cefrLevel} ${langLabel}`;

  // Description: prefer the hand-tuned hook/summary, fall back to a template.
  const hook = storyMeta.descriptions?.hook?.[lng];
  const summary = storyMeta.descriptions?.summary?.[lng];
  const description = (summary || hook ||
    (lng === "es"
      ? `Lee "${title}" en inglés al nivel ${cefrLevel}. Traducción integrada, audio con resaltado palabra por palabra, y modo bilingüe.`
      : `Read "${title}" in Spanish at ${cefrLevel} level. Built-in translation, word-by-word audio, and bilingual reading mode.`)
  ).slice(0, 300);

  // URLs (the story's chapter-1 page-1 entry, language alternates).
  const enUrl = `${SITE_URL}${getNavigationUrl("en", storySlug, cefrLevel, 1, 1, false)}`;
  const esUrl = `${SITE_URL}${getNavigationUrl("es", storySlug, cefrLevel, 1, 1, false)}`;
  const canonicalUrl = lng === "en" ? enUrl : esUrl;

  const ogImage = storyMeta.image?.startsWith("/") ? `${SITE_URL}${storyMeta.image}` : storyMeta.image;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
      // x-default → /es: primary audience is Spanish-native.
      languages: { en: enUrl, es: esUrl, "x-default": esUrl },
    },
    openGraph: {
      type: "article",
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

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { lng, storySlug, level, chapter, page } = await params;

  if (lng !== "en" && lng !== "es") return notFound();

  // Find the story metadata to check available levels
  const storyMeta = STORY_METADATA.find(s => s.slug === storySlug);
  if (!storyMeta) return notFound();

  // Convert URL level to CEFR code (handles both A1 and l1 formats)
  const cefrLevel = toCEFR(level);
  const isLevelAvailable = storyMeta.levels.includes(cefrLevel as CEFRCode);

  // If level not available, show level selector page
  if (!isLevelAvailable) {
    return (
      <LevelUnavailablePage
        storySlug={storySlug}
        storyTitle={getStoryTitle(lng as Language, storySlug)}
        availableLevels={storyMeta.levels}
        requestedLevel={cefrLevel}
        lng={lng as Language}
      />
    );
  }

  const session = await getServerSession(authOptions);

  // Convert CEFR to folder name for content loading (l1, l2, etc.)
  const folderLevel = toFolderName(cefrLevel);
  const storyMap = await getStoryMap(storySlug, folderLevel);

  // Handle both formats: numeric (1) and prefixed (ch1, page-1)
  const fullChapter = chapter.startsWith('ch') ? chapter : `ch${chapter}`;
  const fullPage = page.startsWith('page-') ? page : `page-${page}`;

  const story = await getStoryContent(storySlug, folderLevel, fullChapter, fullPage, lng);

  if (!story || !story.lines) return notFound();

  // ---- JSON-LD structured data for SEO rich results ----
  const storyTitle = getStoryTitle(lng, storySlug);
  const storyUrl = `${SITE_URL}${getNavigationUrl(lng as Language, storySlug, cefrLevel, 1, 1, false)}`;
  const author = storyMeta.origin.isOriginal
    ? "Cuentana"
    : storyMeta.origin.attribution
      ? getAuthorName(storyMeta.origin.attribution)
      : "Unknown";
  const targetLanguage = lng === "es" ? "English" : "Spanish";
  const targetLanguageCode = lng === "es" ? "en" : "es";
  const storyImage = storyMeta.image?.startsWith("/") ? `${SITE_URL}${storyMeta.image}` : storyMeta.image;

  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Book",
        "@id": `${storyUrl}#book`,
        name: storyTitle,
        author: { "@type": "Person", name: author },
        inLanguage: targetLanguageCode,
        url: storyUrl,
        ...(storyImage ? { image: storyImage } : {}),
        ...(storyMeta.descriptions?.summary?.[lng as Language] ? { description: storyMeta.descriptions.summary[lng as Language] } : {}),
      },
      {
        "@type": "LearningResource",
        "@id": `${storyUrl}#learning-resource`,
        name: `${storyTitle} — ${cefrLevel} ${targetLanguage}`,
        url: storyUrl,
        inLanguage: targetLanguageCode,
        learningResourceType: "Reading material",
        educationalLevel: `CEFR ${cefrLevel}`,
        teaches: targetLanguage,
        about: { "@id": `${storyUrl}#book` },
        isAccessibleForFree: true,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/${lng}` },
          { "@type": "ListItem", position: 2, name: "Stories", item: `${SITE_URL}/${lng}/stories` },
          { "@type": "ListItem", position: 3, name: storyTitle, item: storyUrl },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLdGraph} />
      <StoryLayoutWithAzureTTS
        title={storyTitle}
        storySlug={storySlug}
        sentences={story.lines}
        stanzas={story.stanzas}
        initialLevel={cefrLevel}
        storyMap={storyMap}
        availableLevels={storyMeta.levels}
        storyType={storyMeta.type}
        structureType={storyMeta.structureType}
        detectedLevel={storyMeta.originalLevel}
      />
    </>
  );
}







