// src/components/StoryDetailContent.tsx
//
// Shared content body for the story info card. Used by:
//   - StoryDetailModal (wraps it in a modal shell for /stories grid clicks)
//   - /[lng]/stories/[storySlug] (renders it as a full server-rendered page for SEO/Google landing)
//
// Pure presentational + interactive (level-badge clicks, primary CTA click)
// — no modal-shell concerns. Stays a client component because of those
// click handlers and the bookmark fetch.
//
// The new server route passes a pre-resolved `readUrl` so the primary CTA
// has a stable href baked into initial HTML (good for crawlers). The modal
// keeps using its existing client-side bookmark resolution via `onReadClick`.
"use client";

import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui";
import { STORY_TYPE_LABELS, STORY_TAG_LABELS, getAuthorName, getYearPublished, getAuthorLifespan, getPublicDomainNote } from "@/lib/stories";
import { getStoryUrl } from "@/utils/getStoryUrl";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";
import { getStoryTitle, getStoryDescription, getStoryHook } from "@/lib/stories";
import type { StoryMetadata, StoryAttribution } from "@/types/story";
import { toCEFR, getCEFRLabel, type CEFRCode } from "@/lib/cefr";
import ExpandableDescription from "@/components/ExpandableDescription";

// CEFR badge colors
const CEFR_BADGE_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-800",
  A2: "bg-blue-100 text-blue-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-orange-100 text-orange-800",
  C1: "bg-purple-100 text-purple-800",
  C2: "bg-red-100 text-red-800",
};

function AttributionSection({
  attribution,
  lang,
}: {
  attribution: StoryAttribution;
  lang: Language;
}) {
  const authorName = getAuthorName(attribution);
  const authorLifespan = getAuthorLifespan(attribution);
  const yearPublished = getYearPublished(attribution);
  const publicDomainNote = getPublicDomainNote(attribution);

  const yearWritten = attribution.yearWritten;
  const sourceEdition = attribution.sourceEdition;
  const translator = attribution.translator;
  const region = attribution.region;
  const culturalInfluences = attribution.culturalInfluences;
  const genres = attribution.genres;
  const rights = attribution.rights;

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        {lang === "es" ? "Información de la obra" : "Work Information"}
      </h4>

      <div className="space-y-2 text-sm">
        <div className="flex">
          <span className="text-gray-500 w-28 flex-shrink-0">
            {lang === "es" ? "Autor:" : "Author:"}
          </span>
          <span className="text-gray-800 font-medium">
            {authorName}
            {authorLifespan && (
              <span className="text-gray-500 font-normal"> ({authorLifespan})</span>
            )}
          </span>
        </div>

        {yearWritten && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Escrito:" : "Written:"}
            </span>
            <span className="text-gray-800">{yearWritten}</span>
          </div>
        )}

        {yearPublished && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Publicado:" : "Published:"}
            </span>
            <span className="text-gray-800">{yearPublished}</span>
          </div>
        )}

        {region && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Región:" : "Region:"}
            </span>
            <span className="text-gray-800">{region}</span>
          </div>
        )}

        {culturalInfluences && culturalInfluences.length > 0 && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Influencias:" : "Influences:"}
            </span>
            <span className="text-gray-800">{culturalInfluences.join(", ")}</span>
          </div>
        )}

        {genres && genres.length > 0 && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Géneros:" : "Genres:"}
            </span>
            <span className="text-gray-800">{genres.join(", ")}</span>
          </div>
        )}

        {sourceEdition && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              {lang === "es" ? "Edición fuente" : "Source Edition"}
            </p>
            {sourceEdition.title && (
              <div className="flex text-xs">
                <span className="text-gray-500 w-24 flex-shrink-0">
                  {lang === "es" ? "Título:" : "Title:"}
                </span>
                <span className="text-gray-700">{sourceEdition.title}</span>
              </div>
            )}
            {sourceEdition.publisher && (
              <div className="flex text-xs">
                <span className="text-gray-500 w-24 flex-shrink-0">
                  {lang === "es" ? "Editorial:" : "Publisher:"}
                </span>
                <span className="text-gray-700">{sourceEdition.publisher}</span>
              </div>
            )}
            {sourceEdition.editor && (
              <div className="flex text-xs">
                <span className="text-gray-500 w-24 flex-shrink-0">
                  {lang === "es" ? "Editor:" : "Editor:"}
                </span>
                <span className="text-gray-700">{sourceEdition.editor}</span>
              </div>
            )}
            {sourceEdition.url && (
              <div className="flex text-xs">
                <span className="text-gray-500 w-24 flex-shrink-0">
                  {lang === "es" ? "Fuente:" : "Source:"}
                </span>
                <a href={sourceEdition.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                  {sourceEdition.url.replace(/^https?:\/\//, '').split('/')[0]}
                </a>
              </div>
            )}
          </div>
        )}

        {translator && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              {lang === "es" ? "Traducción" : "Translation"}
            </p>
            <div className="flex text-xs">
              <span className="text-gray-500 w-24 flex-shrink-0">
                {lang === "es" ? "Traductor:" : "Translator:"}
              </span>
              <span className="text-gray-700">
                {translator.name}
                {translator.lifespan && ` (${translator.lifespan})`}
              </span>
            </div>
            {translator.translationYear && (
              <div className="flex text-xs">
                <span className="text-gray-500 w-24 flex-shrink-0">
                  {lang === "es" ? "Año:" : "Year:"}
                </span>
                <span className="text-gray-700">{translator.translationYear}</span>
              </div>
            )}
          </div>
        )}

        {rights && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 italic">
              {rights.originalWorkStatus === "public-domain"
                ? t(lang, "stories", "rightsPublicDomain")
                : rights.originalWorkStatus === "licensed"
                ? t(lang, "stories", "rightsLicensed")
                : rights.originalWorkStatus === "original"
                ? t(lang, "stories", "rightsOriginal")
                : rights.displayStatement}
            </p>
            {rights.provenanceNote && (
              <p className="text-xs text-gray-400 mt-1">
                {rights.provenanceNote}
              </p>
            )}
          </div>
        )}

        {!rights && publicDomainNote && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500 italic">
              {publicDomainNote}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

type StoryDetailContentProps = {
  story: StoryMetadata;
  lang: Language;
  /** Pre-resolved URL for the primary "Read" CTA. When provided, the CTA renders as an anchor (good for crawlers + SEO). When omitted, falls back to onReadClick. */
  readUrl?: string;
  /** Client-side click handler for the primary CTA. Used by the modal to do its session-aware bookmark lookup at click time. */
  onReadClick?: () => void | Promise<void>;
  /** Optional current user object — only used by the modal's level-badge bookmark resolution path. */
  user?: any;
};

export default function StoryDetailContent({
  story,
  lang,
  readUrl,
  onReadClick,
  user,
}: StoryDetailContentProps) {
  const router = useRouter();

  const hasAttribution = !story.origin.isOriginal;
  const attribution = hasAttribution
    ? (story.origin as { isOriginal: false; attribution: StoryAttribution }).attribution
    : null;

  return (
    <>
      {/* Left side - Image */}
      <div className="relative w-full md:w-2/5 md:flex-shrink-0">
        <div className="max-h-[60vh] md:max-h-none md:h-full relative overflow-hidden">
          <div className="relative w-full aspect-[2/3] md:aspect-auto md:h-full">
            <Image
              src={story.image}
              alt={getStoryTitle(lang, story.slug)}
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Right side - Content. md:overscroll-auto so that once this inner
          scroll reaches its bottom, continued wheel scroll chains out to the
          page (vs. the previous overscroll-contain on the wrapper, which
          trapped scroll inside the card). */}
      <div className="flex-1 md:overflow-y-auto md:overscroll-auto hide-scrollbar p-6 md:p-8">
        {/* Story Type Badge */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            story.type === "poem" || story.type === "song-lyrics"
              ? "bg-purple-100 text-purple-700"
              : story.type === "novel" || story.type === "short-story"
              ? "bg-blue-100 text-blue-700"
              : story.type === "fable" || story.type === "folktale" || story.type === "myth" || story.type === "legend"
              ? "bg-amber-100 text-amber-700"
              : story.type === "epic"
              ? "bg-rose-100 text-rose-700"
              : story.type === "movie-script" || story.type === "tv-script"
              ? "bg-cyan-100 text-cyan-700"
              : "bg-gray-100 text-gray-600"
          }`}>
            {STORY_TYPE_LABELS[story.type]?.[lang] || story.type}
          </span>
          {story.origin.isOriginal && (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              {lang === "es" ? "Original de Cuentana" : "Cuentana Original"}
            </span>
          )}
          {!story.origin.isOriginal && attribution?.sourceEdition?.source === "gutenberg" && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              Project Gutenberg
            </span>
          )}
          {story.targetAudience && story.targetAudience !== "all" && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {story.targetAudience === "children"
                ? (lang === "es" ? "Para niños" : "For Children")
                : story.targetAudience === "teen"
                ? (lang === "es" ? "Para jóvenes" : "For Teens")
                : (lang === "es" ? "Para adultos" : "For Adults")}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          {getStoryTitle(lang, story.slug)}
        </h2>

        {/* Author attribution (short form) */}
        {!story.origin.isOriginal && attribution && getAuthorName(attribution) && (
          <p className="text-gray-600 mb-4">
            {lang === "es" ? "por" : "by"}{" "}
            <span className="font-medium">{getAuthorName(attribution)}</span>
            {getYearPublished(attribution) && (
              <span className="text-gray-500"> ({getYearPublished(attribution)})</span>
            )}
          </p>
        )}

        {/* Read Button — renders as anchor when readUrl is provided (crawler-friendly), button otherwise */}
        {readUrl ? (
          <a href={readUrl} className="inline-block w-full md:w-auto mb-6">
            <Button
              variant="parts"
              className="w-full md:w-auto !bg-amber-700 hover:!bg-amber-600 text-white font-semibold py-3 px-8 text-lg"
            >
              {t(lang, "stories", "readStory")}
            </Button>
          </a>
        ) : (
          <Button
            variant="parts"
            onClick={onReadClick}
            className="w-full md:w-auto mb-6 !bg-amber-700 hover:!bg-amber-600 text-white font-semibold py-3 px-8 text-lg"
          >
            {t(lang, "stories", "readStory")}
          </Button>
        )}

        {/* Hook */}
        {getStoryHook(lang, story.slug) && (
          <p className="text-gray-600 text-sm italic mb-6">
            {getStoryHook(lang, story.slug)}
          </p>
        )}

        {/* Available Levels */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-600 mb-2">
            {t(lang, "stories", "availableLevels")}
          </p>
          <div className="flex flex-wrap gap-2">
            {story.levels.map((lvl, idx) => {
              const cefrLevel = toCEFR(lvl);
              const colorClass = CEFR_BADGE_COLORS[cefrLevel] || "bg-gray-100 text-gray-800";
              const isOriginal = story.originalLevel && cefrLevel === story.originalLevel;
              return (
                <button
                  key={idx}
                  onClick={async () => {
                    // Check for bookmark at this level first (best-effort; 401 for unauthed is fine — we just start fresh)
                    try {
                      const bookmarkResponse = await fetch(
                        `/api/story-bookmark?storySlug=${encodeURIComponent(story.slug)}`
                      );
                      if (bookmarkResponse.ok) {
                        const data = await bookmarkResponse.json();
                        if (data.bookmark && toCEFR(data.bookmark.level) === cefrLevel) {
                          const url = getStoryUrl(
                            story.slug,
                            data.bookmark.level,
                            data.bookmark.chapter,
                            data.bookmark.page,
                            lang
                          );
                          router.push(url);
                          return;
                        }
                      }
                    } catch {
                      // fall through to fresh-start URL
                    }
                    const url = getStoryUrl(story.slug, cefrLevel, 1, 1, lang);
                    router.push(url);
                  }}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass} cursor-pointer hover:scale-105 transition-transform`}
                  title={lang === "es" ? `Leer en nivel ${cefrLevel}` : `Read at ${cefrLevel} level`}
                >
                  {getCEFRLabel(cefrLevel, lang)}{isOriginal ? ` ${t(lang, "stories", "originalLevel")}` : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Estimated Read Time */}
        {story.estimatedReadTime && (
          <div className="text-sm text-gray-500 mb-6">
            {lang === "es"
              ? `Tiempo de lectura: ~${story.estimatedReadTime} min`
              : `Reading time: ~${story.estimatedReadTime} min`}
          </div>
        )}

        {/* Tags */}
        {story.tags && story.tags.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-600 mb-2">
              {lang === "es" ? "Temas" : "Themes"}
            </p>
            <div className="flex flex-wrap gap-2">
              {story.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                >
                  {STORY_TAG_LABELS[tag]?.[lang] || tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {getStoryDescription(lang, story.slug) && (
          <ExpandableDescription
            text={getStoryDescription(lang, story.slug)}
            lang={lang}
            maxLines={4}
            className="text-gray-600 mb-6"
          />
        )}

        {/* Full Attribution Section for non-original works */}
        {hasAttribution && attribution && (
          <AttributionSection attribution={attribution} lang={lang} />
        )}

        {/* Rights statement for original works */}
        {!hasAttribution && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 italic">
              {t(lang, "stories", "rightsOriginal")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
