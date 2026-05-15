// src/app/sitemap.ts
// Next.js auto-generates /sitemap.xml from this file at build time.
// Granularity is one entry per (story, language, level), pointing at
// chapter 1 / page 1 — the start of the story at that level. This is
// what someone searching e.g. "A2 spanish reading materials" should
// land on: inside the story, ready to read. Per-page entries are
// intentionally omitted (thin content, dilutes signal).
//
// Excluded entirely: user-uploaded stories (auth-gated, personal),
// archived stories (hidden in the UI).

import type { MetadataRoute } from "next";
import { STORY_METADATA } from "@/lib/stories";
import { getNavigationUrl } from "@/utils/storyNavigation";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";

const BASE_URL = "https://cuentana.app";
const LANGUAGES: Language[] = ["en", "es"];
const ENTRY_CHAPTER = 1;
const ENTRY_PAGE = 1;

type SitemapEntry = MetadataRoute.Sitemap[number];

/** Top-level URLs (home, stories index). */
function staticEntries(now: Date): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const lang of LANGUAGES) {
    entries.push({
      url: `${BASE_URL}/${lang}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: {
        languages: {
          en: `${BASE_URL}/en`,
          es: `${BASE_URL}/es`,
        },
      },
    });
    entries.push({
      url: `${BASE_URL}/${lang}/stories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: {
          en: `${BASE_URL}/en/stories`,
          es: `${BASE_URL}/es/stories`,
        },
      },
    });
  }
  return entries;
}

/** For one story, emit one entry per (language, level) — each lands at ch1/page1. */
function entriesForStory(slug: string, levels: CEFRCode[], now: Date): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  for (const level of levels) {
    // Per-language entries with hreflang alternates pointing at each other.
    const enUrl = `${BASE_URL}${getNavigationUrl("en", slug, level, ENTRY_CHAPTER, ENTRY_PAGE, false)}`;
    const esUrl = `${BASE_URL}${getNavigationUrl("es", slug, level, ENTRY_CHAPTER, ENTRY_PAGE, false)}`;

    for (const lang of LANGUAGES) {
      entries.push({
        url: lang === "en" ? enUrl : esUrl,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: {
          languages: { en: enUrl, es: esUrl },
        },
      });
    }
  }

  return entries;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: SitemapEntry[] = [...staticEntries(now)];

  // Only include non-archived stories. Archived ones are hidden in the UI
  // and shouldn't be indexed.
  const visibleStories = STORY_METADATA.filter((s) => !s.isArchived);

  for (const story of visibleStories) {
    entries.push(...entriesForStory(story.slug, story.levels, now));
  }

  return entries;
}
