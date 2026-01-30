// src/components/StoryDetailModal.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui";
import { STORY_METADATA, STORY_TYPE_LABELS, STORY_TAG_LABELS, formatAttribution, getAuthorName, getAuthorLifespan, getYearPublished, isPublicDomain, getPublicDomainNote } from "@/lib/stories";
import { getStoryUrl } from "@/utils/getStoryUrl";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";
import { getStoryTitle, getStoryDescription } from "@/lib/stories";
import type { StoryMetadata, StoryAttribution } from "@/types/story";
import { toCEFR, getCEFRLabel, type CEFRCode } from "@/lib/cefr";

// CEFR badge colors
const CEFR_BADGE_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-800",
  A2: "bg-blue-100 text-blue-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-orange-100 text-orange-800",
  C1: "bg-purple-100 text-purple-800",
  C2: "bg-red-100 text-red-800",
};

type StoryDetailModalProps = {
  storySlug: string | null;
  onClose: () => void;
  user: any;
};

function AttributionSection({
  attribution,
  lang
}: {
  attribution: StoryAttribution;
  lang: Language;
}) {
  const authorName = getAuthorName(attribution);
  const authorLifespan = getAuthorLifespan(attribution);
  const yearPublished = getYearPublished(attribution);
  const publicDomainNote = getPublicDomainNote(attribution);

  // Handle new format fields
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
        {/* Author */}
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

        {/* Year Written */}
        {yearWritten && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Escrito:" : "Written:"}
            </span>
            <span className="text-gray-800">{yearWritten}</span>
          </div>
        )}

        {/* Year First Published */}
        {yearPublished && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Publicado:" : "Published:"}
            </span>
            <span className="text-gray-800">{yearPublished}</span>
          </div>
        )}

        {/* Region/Culture */}
        {region && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Región:" : "Region:"}
            </span>
            <span className="text-gray-800">{region}</span>
          </div>
        )}

        {/* Cultural Influences */}
        {culturalInfluences && culturalInfluences.length > 0 && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Influencias:" : "Influences:"}
            </span>
            <span className="text-gray-800">{culturalInfluences.join(", ")}</span>
          </div>
        )}

        {/* Genres */}
        {genres && genres.length > 0 && (
          <div className="flex">
            <span className="text-gray-500 w-28 flex-shrink-0">
              {lang === "es" ? "Géneros:" : "Genres:"}
            </span>
            <span className="text-gray-800">{genres.join(", ")}</span>
          </div>
        )}

        {/* Source Edition */}
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

        {/* Translator */}
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

        {/* Rights Statement */}
        {rights && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 italic">
              {rights.displayStatement}
            </p>
            {rights.provenanceNote && (
              <p className="text-xs text-gray-400 mt-1">
                {rights.provenanceNote}
              </p>
            )}
          </div>
        )}

        {/* Legacy public domain note */}
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

export default function StoryDetailModal({
  storySlug,
  onClose,
  user,
}: StoryDetailModalProps) {
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;

  // Find story by slug
  const story = storySlug
    ? STORY_METADATA.find(s => s.slug === storySlug)
    : null;

  // Handle escape key and browser back button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handlePopState = () => {
      onClose();
    };

    if (storySlug) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("popstate", handlePopState);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
      document.body.style.overflow = "auto";
    };
  }, [storySlug, onClose]);

  const handleReadStory = useCallback(async () => {
    if (!story) return;

    // Check for bookmark first
    const bookmarkResponse = await fetch(
      `/api/story-bookmark?storySlug=${encodeURIComponent(story.slug)}`
    );

    if (bookmarkResponse.ok) {
      const data = await bookmarkResponse.json();
      if (data.bookmark) {
        const url = getStoryUrl(
          story.slug,
          data.bookmark.level,
          data.bookmark.chapter,
          data.bookmark.page,
          typedLang
        );
        router.push(url);
        return;
      }
    }

    // No bookmark - use default level (convert any format to CEFR)
    const storedLevel =
      typeof window !== "undefined" ? localStorage.getItem("level") : null;
    const level = toCEFR(user?.quizLevel || storedLevel || "A2");

    const url = getStoryUrl(story.slug, level, 1, 1, typedLang);
    router.push(url);
  }, [story, user, typedLang, router]);

  if (!story || !storySlug) return null;

  const hasAttribution = !story.origin.isOriginal;
  const attribution = hasAttribution ? (story.origin as { isOriginal: false; attribution: StoryAttribution }).attribution : null;

  return (
    <AnimatePresence>
      {storySlug && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-4 md:inset-8 lg:inset-12 z-[101] flex items-center justify-center pointer-events-none"
          >
            {/* Close button - fixed position outside the scrollable area */}
            <button
              onClick={onClose}
              className="absolute top-0 right-0 md:top-2 md:right-2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors z-10 pointer-events-auto"
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] max-h-[440px] overflow-y-auto pointer-events-auto md:overflow-hidden md:flex md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left side - Image */}
              <div className="relative w-full md:w-2/5 md:flex-shrink-0">
                <div className="aspect-[2/3] md:aspect-auto md:h-full relative">
                  <Image
                    src={story.image}
                    alt={getStoryTitle(typedLang, storySlug)}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>

              {/* Right side - Content */}
              <div className="flex-1 md:overflow-y-auto p-6 md:p-8">
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
                    {STORY_TYPE_LABELS[story.type]?.[typedLang] || story.type}
                  </span>
                  {story.origin.isOriginal && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                      {typedLang === "es" ? "Original de Cuentana" : "Cuentana Original"}
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
                        ? (typedLang === "es" ? "Para niños" : "For Children")
                        : story.targetAudience === "teen"
                        ? (typedLang === "es" ? "Para jóvenes" : "For Teens")
                        : (typedLang === "es" ? "Para adultos" : "For Adults")}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  {getStoryTitle(typedLang, storySlug)}
                </h2>

                {/* Author attribution (short form) - only show if author name exists */}
                {!story.origin.isOriginal && attribution && getAuthorName(attribution) && (
                  <p className="text-gray-600 mb-4">
                    {typedLang === "es" ? "por" : "by"}{" "}
                    <span className="font-medium">{getAuthorName(attribution)}</span>
                    {getYearPublished(attribution) && (
                      <span className="text-gray-500"> ({getYearPublished(attribution)})</span>
                    )}
                  </p>
                )}

                {/* Description */}
                <p className="text-gray-700 leading-relaxed mb-6">
                  {getStoryDescription(typedLang, storySlug)}
                </p>

                {/* Read Button */}
                <Button
                  variant="parts"
                  onClick={handleReadStory}
                  className="w-full md:w-auto mb-6 !bg-amber-700 hover:!bg-amber-600 text-white font-semibold py-3 px-8 text-lg"
                >
                  {t(typedLang, "stories", "readStory")}
                </Button>

                {/* Available Levels */}
                <div className="mb-6">
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    {t(typedLang, "stories", "availableLevels")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {story.levels.map((lvl, idx) => {
                      const cefrLevel = toCEFR(lvl);
                      const colorClass = CEFR_BADGE_COLORS[cefrLevel] || "bg-gray-100 text-gray-800";
                      return (
                        <button
                          key={idx}
                          onClick={async () => {
                            // Check for bookmark at this level first
                            const bookmarkResponse = await fetch(
                              `/api/story-bookmark?storySlug=${encodeURIComponent(story.slug)}`
                            );

                            if (bookmarkResponse.ok) {
                              const data = await bookmarkResponse.json();
                              if (data.bookmark && toCEFR(data.bookmark.level) === cefrLevel) {
                                // Bookmark exists at this level - resume from bookmark
                                const url = getStoryUrl(
                                  story.slug,
                                  data.bookmark.level,
                                  data.bookmark.chapter,
                                  data.bookmark.page,
                                  typedLang
                                );
                                router.push(url);
                                return;
                              }
                            }

                            // No bookmark at this level - start from beginning
                            const url = getStoryUrl(story.slug, cefrLevel, 1, 1, typedLang);
                            router.push(url);
                          }}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass} cursor-pointer hover:scale-105 transition-transform`}
                          title={typedLang === "es" ? `Leer en nivel ${cefrLevel}` : `Read at ${cefrLevel} level`}
                        >
                          {getCEFRLabel(cefrLevel, typedLang)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags */}
                {story.tags && story.tags.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-600 mb-2">
                      {typedLang === "es" ? "Temas" : "Themes"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {story.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                        >
                          {STORY_TAG_LABELS[tag]?.[typedLang] || tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Attribution Section for non-original works */}
                {hasAttribution && attribution && (
                  <AttributionSection attribution={attribution} lang={typedLang} />
                )}

                {/* Estimated Read Time (if available) */}
                {story.estimatedReadTime && (
                  <div className="text-sm text-gray-500">
                    {typedLang === "es"
                      ? `Tiempo de lectura: ~${story.estimatedReadTime} min`
                      : `Reading time: ~${story.estimatedReadTime} min`}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
