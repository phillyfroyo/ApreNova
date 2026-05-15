// src/app/[lng]/stories/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from '@/components/ui';
import { STORY_METADATA, STORY_TYPE_LABELS, STORY_TYPE_LABELS_PLURAL, STORY_TAG_LABELS, ALL_STORY_TAGS, ALL_STORY_TYPES, getAuthorName } from "@/lib/stories";
import { getStoryUrl } from "@/lib/stories";
import { useUserLevel } from "@/hooks/useUserLevel";
import { useUserSession } from "@/lib/auth";
import StoryDetailModal from "@/components/StoryDetailModal";
import StoryCard from "@/components/StoryCard";
import StoriesPageTourHint from "@/components/tour/StoriesPageTourHint";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import type { Language } from "@/types/i18n";
import type { StoryTag, StoryType } from "@/types/story";
import { t } from "@/lib/t";
import { getStoryTitle, getStoryDisplayTitle } from "@/lib/stories";
import { updateNativeLanguage } from '@/lib/updateLanguage'
import UploadStoryButton from "@/components/user-stories/UploadStoryButton"
import NewStoryCard from "@/components/user-stories/NewStoryCard"
import UserStoryCard from "@/components/user-stories/UserStoryCard"
import UserStoryDetailModal from "@/components/user-stories/UserStoryDetailModal"
import { useStoryUpload } from "@/contexts/StoryUploadContext"
import { AppLayout } from '@/components/layout';
import FeedbackModal from "@/components/FeedbackModal";

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

interface UserStoryLevel {
  level: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
}

interface UserStory {
  id: string;
  slug: string;
  title: string;
  titleEs?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionEs?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string | null;
  sourceLanguage: string;
  status: "PROCESSING" | "READY" | "FAILED" | "PARTIAL" | "CANCELLED";
  detectedLevel?: string | null;
  storyType?: string | null;
  createdAt?: string;
  cancelledAt?: string | null;
  levels: UserStoryLevel[];
}

// Helper to check if a story has any readable chapters
function hasReadableChapters(story: UserStory): boolean {
  return story.levels.some((level) => level.status === "READY");
}

const NEW_STORY_DAYS = 14;

function isNewStory(addedAt?: string): boolean {
  if (!addedAt) return false;
  const added = new Date(addedAt);
  const now = new Date();
  const diffMs = now.getTime() - added.getTime();
  return diffMs < NEW_STORY_DAYS * 24 * 60 * 60 * 1000;
}

// All theme tags combined into one list
const ALL_THEME_TAGS: StoryTag[] = [
  "family", "friendship", "adventure", "mystery", "romance",
  "coming-of-age", "nature", "technology", "travel", "food",
  "humorous", "heartwarming", "suspenseful", "reflective", "inspiring",
  "urban", "rural", "historical", "fantasy", "contemporary",
  "latin-america", "spain", "usa", "multicultural"
];

// Get unique authors from story metadata (excluding archived stories)
function getUniqueAuthors(): Array<{ id: string; name: string }> {
  const authors: Array<{ id: string; name: string }> = [
    { id: "cuentana", name: "Cuentana Originals" }
  ];
  const seenAuthors = new Set<string>();

  STORY_METADATA.forEach(story => {
    // Skip archived stories
    if (story.isArchived) return;

    if (!story.origin.isOriginal && 'attribution' in story.origin) {
      const authorName = getAuthorName(story.origin.attribution);
      if (authorName && !seenAuthors.has(authorName)) {
        seenAuthors.add(authorName);
        authors.push({ id: authorName.toLowerCase().replace(/\s+/g, '-'), name: authorName });
      }
    }
  });

  return authors;
}

function isLevel(value: unknown): value is Level {
  return (
    typeof value === 'string' &&
    ['A1', 'A2', 'B1', 'B2', 'C1'].includes(value.toUpperCase())
  );
}

function StoriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, nativeLanguage } = useUserSession();
  const [selectedLevel, setSelectedLevel] = useState<Level>('A1');
  const { lng } = useParams();
  const typedLang = lng as Language;
  const [showLangPrompt, setShowLangPrompt] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // URL-based story detail modal
  const storyParam = searchParams.get("story");
  const [detailStorySlug, setDetailStorySlug] = useState<string | null>(storyParam);

  // Source filter from URL (for "See all" links)
  const sourceFilter = searchParams.get("source"); // "cuentana", "gutenberg", or "classics"

  // Sync URL param with state
  useEffect(() => {
    setDetailStorySlug(storyParam);
  }, [storyParam]);

  // Open detail modal and update URL
  const openDetailModal = (slug: string) => {
    setDetailStorySlug(slug);
    // Update URL without full navigation (shallow routing), preserve source filter
    const params = new URLSearchParams();
    params.set("story", slug);
    if (sourceFilter) params.set("source", sourceFilter);
    window.history.pushState({}, "", `/${typedLang}/stories?${params.toString()}`);
  };

  // Close detail modal and update URL
  const closeDetailModal = () => {
    setDetailStorySlug(null);
    // Remove story param from URL, preserve source filter
    if (sourceFilter) {
      window.history.pushState({}, "", `/${typedLang}/stories?source=${sourceFilter}`);
    } else {
      window.history.pushState({}, "", `/${typedLang}/stories`);
    }
  };

  // Clear source filter (back to main stories view)
  const clearSourceFilter = () => {
    router.push(`/${typedLang}/stories`);
  };

  // Filter state
  const [selectedTags, setSelectedTags] = useState<StoryTag[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<StoryType[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // User stories state
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [userStoriesLoading, setUserStoriesLoading] = useState(true);
  const [selectedUserStory, setSelectedUserStory] = useState<UserStory | null>(null);
  const { data: session, status: sessionStatus } = useSession();
  const { lastConfirmedAt, lastCancelledAt } = useStoryUpload();

  // Fetch user stories
  useEffect(() => {
    if (sessionStatus === "loading") {
      // Still checking auth, keep loading state
      return;
    }

    if (!session?.user?.id) {
      setUserStories([]);
      setUserStoriesLoading(false);
      return;
    }

    const fetchUserStories = async () => {
      try {
        const res = await fetch("/api/user-stories");
        if (res.ok) {
          const data = await res.json();
          setUserStories(data.stories || []);
        }
        setUserStoriesLoading(false);
      } catch (error) {
        console.error("Error fetching user stories:", error);
        setUserStoriesLoading(false);
      }
    };

    fetchUserStories();

    // Poll for updates if any story is processing
    const interval = setInterval(() => {
      const hasProcessing = userStories.some((s) => s.status === "PROCESSING");
      if (hasProcessing) {
        fetchUserStories();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.user?.id, sessionStatus, lastConfirmedAt, lastCancelledAt]);

  const handleUserStoryDelete = (storyId: string) => {
    setUserStories((prev) => prev.filter((s) => s.id !== storyId));
  };

  const handleUserStoryUpdate = (updatedStory: UserStory) => {
    setUserStories((prev) =>
      prev.map((s) => (s.id === updatedStory.id ? { ...s, ...updatedStory } : s))
    );
    setSelectedUserStory(updatedStory);
  };

  // Get authors list
  const authors = getUniqueAuthors();

  // Helper to check if story passes filter criteria
  const passesFilters = (story: typeof STORY_METADATA[0]) => {
    // Never show archived stories to users
    if (story.isArchived) {
      return false;
    }

    // If no filters, show all
    if (selectedTags.length === 0 && selectedTypes.length === 0 && selectedAuthors.length === 0) {
      return true;
    }

    // Check tags (OR logic within tags)
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => story.tags?.includes(tag));

    // Check story type (OR logic within types)
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(story.type);

    // Check author (OR logic within authors)
    let matchesAuthor = selectedAuthors.length === 0;
    if (!matchesAuthor) {
      if (selectedAuthors.includes("cuentana") && story.origin.isOriginal) {
        matchesAuthor = true;
      }
      if (!story.origin.isOriginal && 'attribution' in story.origin) {
        const authorName = getAuthorName(story.origin.attribution);
        const authorId = authorName.toLowerCase().replace(/\s+/g, '-');
        if (selectedAuthors.includes(authorId)) {
          matchesAuthor = true;
        }
      }
    }

    // AND logic between filter categories
    return matchesTags && matchesType && matchesAuthor;
  };

  // Filter stories by all criteria
  const filteredStories = STORY_METADATA.filter(passesFilters);

  // Separate stories into categories
  const cuentanaOriginals = filteredStories.filter(story => story.origin.isOriginal);
  const gutenbergStories = filteredStories.filter(story =>
    !story.origin.isOriginal &&
    'attribution' in story.origin &&
    story.origin.attribution.sourceEdition?.source === 'gutenberg'
  );
  // Other external stories (not Gutenberg, not originals)
  const otherExternalStories = filteredStories.filter(story =>
    !story.origin.isOriginal &&
    (!('attribution' in story.origin) || story.origin.attribution.sourceEdition?.source !== 'gutenberg')
  );

  const toggleTag = (tag: StoryTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleType = (type: StoryType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleAuthor = (authorId: string) => {
    setSelectedAuthors(prev =>
      prev.includes(authorId) ? prev.filter(a => a !== authorId) : [...prev, authorId]
    );
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedTypes([]);
    setSelectedAuthors([]);
  };

  const activeFilterCount = selectedTags.length + selectedTypes.length + selectedAuthors.length;
 const fallbackLevel = useUserLevel();

useEffect(() => {
  // Always prioritize the user's actual CEFR level from database
  if (isLevel(fallbackLevel)) {
    setSelectedLevel(fallbackLevel.toUpperCase() as Level);
  } else {
    // Only use localStorage/sessionStorage if no database level exists
    const stored = localStorage.getItem('level') || sessionStorage.getItem('quizLevel');
    if (isLevel(stored)) {
      setSelectedLevel(stored.toUpperCase() as Level);
    }
  }
}, [fallbackLevel]);

  // Body scroll is now handled by StoryDetailModal component

  return (
    <>
    <StoriesPageTourHint lang={typedLang} />
    {/* Full-screen background that extends under sidebar */}
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: "url('/images/background3.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        zIndex: -1,
      }}
    />
    <div className="px-2 py-4 sm:p-8 relative min-h-screen">

{/* Top right controls: Filter (hidden until library is large enough to need it), Upload button + My Stories */}
<div className="absolute top-4 right-4 flex items-center gap-3 z-10">
  {/* Filter button — hidden for now; restore when content library is large enough. */}
  {false && (
    <button
      onClick={() => setShowFilters(!showFilters)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        activeFilterCount > 0
          ? "bg-purple-600 text-white"
          : "bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span>🏷️</span>
      {activeFilterCount > 0 ? (
        <span>{activeFilterCount} {typedLang === "es" ? "filtros" : "filters"}</span>
      ) : (
        <span>{typedLang === "es" ? "Filtrar" : "Filter"}</span>
      )}
    </button>
  )}
  <UploadStoryButton />
  <Link
    href={`/${typedLang}/my-stories`}
    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-purple-600 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
  >
    <span>📚</span>
    {typedLang === "es" ? "Mis Historias" : "My Stories"}
  </Link>
</div>

<div className="mt-12 mb-4 px-1 sm:px-4">
  {/* Filter Panel */}
  <AnimatePresence>
    {showFilters && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="mt-4 p-4 bg-white/90 backdrop-blur-sm rounded-xl">
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">
                {filteredStories.length} {typedLang === "es" ? "historias" : "stories"}
              </span>
              <button
                onClick={clearFilters}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                {typedLang === "es" ? "Limpiar filtros" : "Clear filters"}
              </button>
            </div>
          )}

          {/* Authors Section */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">
              {typedLang === "es" ? "Autores" : "Authors"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {authors.map(author => {
                const isSelected = selectedAuthors.includes(author.id);
                // Check if this author has any stories
                const hasStories = author.id === "cuentana"
                  ? STORY_METADATA.some(s => s.origin.isOriginal)
                  : STORY_METADATA.some(s =>
                      !s.origin.isOriginal &&
                      'attribution' in s.origin &&
                      getAuthorName(s.origin.attribution).toLowerCase().replace(/\s+/g, '-') === author.id
                    );
                if (!hasStories) return null;

                return (
                  <button
                    key={author.id}
                    onClick={() => toggleAuthor(author.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    {author.id === "cuentana"
                      ? (typedLang === "es" ? "Originales de Cuentana" : "Cuentana Originals")
                      : author.name
                    }
                  </button>
                );
              })}
            </div>
          </div>

          {/* Story Type Section */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">
              {typedLang === "es" ? "Tipo de Historia" : "Story Type"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STORY_TYPES.map(type => {
                const isSelected = selectedTypes.includes(type);
                // Only show types that have stories
                const hasStories = STORY_METADATA.some(s => s.type === type);
                if (!hasStories) return null;

                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    {STORY_TYPE_LABELS_PLURAL[type][typedLang]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Themes Section (all tags combined) */}
          <div className="mb-0">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">
              {typedLang === "es" ? "Temas" : "Themes"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_THEME_TAGS.map(tag => {
                const isSelected = selectedTags.includes(tag);
                // Only show tags that have stories
                const hasStories = STORY_METADATA.some(s => s.tags?.includes(tag));
                if (!hasStories) return null;

                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {STORY_TAG_LABELS[tag][typedLang]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>

{/* My Stories Section — always render (except when filtering by source) so the
    NewStoryCard placeholder keeps the upload feature discoverable for users
    who haven't uploaded anything yet. Gated on !userStoriesLoading so the
    placeholder doesn't render before the rest of the page content loads. */}
{!userStoriesLoading && !sourceFilter && (
  <div className="mb-6 px-1 sm:px-4">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>📚</span>
        {typedLang === "es" ? "Mis Historias" : "My Stories"}
      </h2>
    </div>
    <div
      style={{
        display: "flex",
        gap: "1rem",
        overflowX: "auto",
        paddingLeft: "0.25rem",
        paddingRight: "0.25rem",
        paddingTop: "0.75rem",
        paddingBottom: "0.75rem",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="hide-scrollbar"
    >
      <NewStoryCard lang={typedLang} />
      {userStories.slice(0, 8).map((story) => (
        <UserStoryCard
          key={story.id}
          id={story.id}
          title={story.title}
          thumbnailUrl={story.thumbnailUrl}
          status={story.status}
          hasReadableChapters={hasReadableChapters(story)}
          lang={typedLang}
          onClick={() => setSelectedUserStory(story)}
        />
      ))}
    </div>
  </div>
)}

    {/* Admin Stories - wait until we know user stories status to prevent layout shift */}
    {!userStoriesLoading ? (
      <>
        {/* Show message if no stories match filters */}
        {filteredStories.length === 0 && !sourceFilter && (
          <div className="w-full text-center py-8 text-gray-500">
            {typedLang === "es" ? "No hay historias con estos filtros" : "No stories match these filters"}
          </div>
        )}

        {/* Full Grid View when source filter is active */}
        {sourceFilter ? (
          <div className="mb-6 px-1 sm:px-4">
            {/* Header with back button */}
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={clearSourceFilter}
                className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {typedLang === "es" ? "Volver" : "Back"}
              </button>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                {sourceFilter === "cuentana" && (
                  <>
                    <span>🎨</span>
                    {typedLang === "es" ? "Originales de Cuentana" : "Cuentana Originals"}
                  </>
                )}
                {sourceFilter === "gutenberg" && (
                  <>
                    <span>📖</span>
                    {typedLang === "es" ? "La Colección Project Gutenberg" : "The Project Gutenberg Collection"}
                  </>
                )}
                {sourceFilter === "classics" && (
                  <>
                    <span>📖</span>
                    {typedLang === "es" ? "Clásicos Literarios" : "Literary Classics"}
                  </>
                )}
              </h2>
            </div>

            {/* Grid of all stories in this category */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 px-0 sm:px-2">
              {(sourceFilter === "cuentana" ? cuentanaOriginals : sourceFilter === "gutenberg" ? gutenbergStories : otherExternalStories).map((story) => {
                const originalIndex = STORY_METADATA.findIndex(s => s.slug === story.slug);
                return (
                  <StoryCard
                    key={story.slug}
                    index={originalIndex}
                    title={getStoryDisplayTitle(typedLang, story.slug)}
                    image={story.image}
                    onClick={() => openDetailModal(story.slug)}
                    isNew={isNewStory(story.addedAt)}
                    newLabel={t(typedLang, "stories", "newBadge")}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Normal Row View - Cuentana Originals */}
            {cuentanaOriginals.length > 0 && (
              <div className="mb-6 px-1 sm:px-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span>🎨</span>
                    {typedLang === "es" ? "Originales de Cuentana" : "Cuentana Originals"}
                  </h2>
                  {cuentanaOriginals.length > 8 && (
                    <Link
                      href={`/${typedLang}/stories?source=cuentana`}
                      className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      {typedLang === "es" ? "Ver todas" : "See all"}
                    </Link>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    overflowX: "auto",
                    paddingLeft: "0.25rem",
                    paddingRight: "0.25rem",
                    paddingTop: "0.75rem",
                    paddingBottom: "0.75rem",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                  className="hide-scrollbar"
                >
                  {cuentanaOriginals.slice(0, 8).map((story, idx) => {
                    const originalIndex = STORY_METADATA.findIndex(s => s.slug === story.slug);
                    return (
                      <StoryCard
                        key={story.slug}
                        index={originalIndex}
                        title={getStoryDisplayTitle(typedLang, story.slug)}
                        image={story.image}
                        onClick={() => openDetailModal(story.slug)}
                        isNew={isNewStory(story.addedAt)}
                        newLabel={t(typedLang, "stories", "newBadge")}
                        tourFirst={idx === 0}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Normal Row View - Project Gutenberg Collection */}
            {gutenbergStories.length > 0 && (
              <div className="mb-6 px-1 sm:px-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span>📖</span>
                    {typedLang === "es" ? "La Colección Project Gutenberg" : "The Project Gutenberg Collection"}
                  </h2>
                  {gutenbergStories.length > 8 && (
                    <Link
                      href={`/${typedLang}/stories?source=gutenberg`}
                      className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      {typedLang === "es" ? "Ver todas" : "See all"}
                    </Link>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    overflowX: "auto",
                    paddingLeft: "0.25rem",
                    paddingRight: "0.25rem",
                    paddingTop: "0.75rem",
                    paddingBottom: "0.75rem",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                  className="hide-scrollbar"
                >
                  {gutenbergStories.slice(0, 8).map((story) => {
                    const originalIndex = STORY_METADATA.findIndex(s => s.slug === story.slug);
                    return (
                      <StoryCard
                        key={story.slug}
                        index={originalIndex}
                        title={getStoryDisplayTitle(typedLang, story.slug)}
                        image={story.image}
                        onClick={() => openDetailModal(story.slug)}
                        isNew={isNewStory(story.addedAt)}
                        newLabel={t(typedLang, "stories", "newBadge")}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Normal Row View - Other External Stories */}
            {otherExternalStories.length > 0 && (
              <div className="mb-6 px-1 sm:px-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span>📖</span>
                    {typedLang === "es" ? "Clásicos Literarios" : "Literary Classics"}
                  </h2>
                  {otherExternalStories.length > 8 && (
                    <Link
                      href={`/${typedLang}/stories?source=classics`}
                      className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      {typedLang === "es" ? "Ver todas" : "See all"}
                    </Link>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    overflowX: "auto",
                    paddingLeft: "0.25rem",
                    paddingRight: "0.25rem",
                    paddingTop: "0.75rem",
                    paddingBottom: "0.75rem",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                  className="hide-scrollbar"
                >
                  {otherExternalStories.slice(0, 8).map((story) => {
                    const originalIndex = STORY_METADATA.findIndex(s => s.slug === story.slug);
                    return (
                      <StoryCard
                        key={story.slug}
                        index={originalIndex}
                        title={getStoryDisplayTitle(typedLang, story.slug)}
                        image={story.image}
                        onClick={() => openDetailModal(story.slug)}
                        isNew={isNewStory(story.addedAt)}
                        newLabel={t(typedLang, "stories", "newBadge")}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </>
    ) : (
      // Loading skeleton for admin stories while waiting for user stories status
      <div className="mb-6 px-1 sm:px-8">
        {[1, 2, 3].map((row) => (
          <div
            key={row}
            style={{
              display: "flex",
              gap: "1rem",
              paddingTop: row === 1 ? "0.75rem" : "0",
              paddingBottom: "0.75rem",
              overflow: "hidden",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  width: "160px",
                  flexShrink: 0,
                }}
              >
                <div className="w-full aspect-[2/3] rounded-xl bg-gray-200/60 animate-pulse" />
                <div className="h-4 bg-gray-200/60 rounded mt-2 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )}

      {/* New large story detail modal with URL state */}
      <StoryDetailModal
        storySlug={detailStorySlug}
        onClose={closeDetailModal}
        user={user}
      />

      {/* User Story Detail Modal */}
      <UserStoryDetailModal
        story={selectedUserStory}
        onClose={() => setSelectedUserStory(null)}
        onDelete={handleUserStoryDelete}
        onUpdate={handleUserStoryUpdate}
        user={user}
      />
{/* Feedback banner */}
<div className="mt-8 mb-4 px-1 sm:px-4">
  <div className="text-center py-6 px-4 bg-white/60 backdrop-blur-sm rounded-xl">
    <p className="text-gray-600 text-sm">
      {typedLang === "es"
        ? "Somos nuevos y estamos agregando historias constantemente. Si tienes sugerencias de historias, comentarios generales o quieres reportar un error, "
        : "We're new and constantly adding stories. If you have suggestions for stories to add, general feedback, or want to report a bug, "}
      <button
        onClick={() => setShowFeedback(true)}
        className="text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
      >
        {typedLang === "es" ? "nos encantaría saberlo" : "we'd love to hear from you"}
      </button>
      .
    </p>
  </div>
</div>

<FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} lng={typedLang} />

{showLangPrompt && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-xl text-center space-y-6 max-w-sm w-full border border-white/50">
      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 mb-1">
          ¿Cuál es tu lengua materna?
        </p>
        <p className="text-gray-500">
          What is your native language?
        </p>
      </div>
      <div className="space-y-3">
        <button
          className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white py-3 px-4 rounded-xl font-semibold hover:opacity-90 transition-all shadow-md"
          onClick={async () => {
            await updateNativeLanguage('es')
            setShowLangPrompt(false)
          }}
        >
          Español
        </button>
        <button
          className="w-full bg-gradient-to-r from-blue-600 to-red-500 text-white py-3 px-4 rounded-xl font-semibold hover:opacity-90 transition-all shadow-md"
          onClick={async () => {
            await updateNativeLanguage('en')
            router.replace('/en/stories')
          }}
        >
          English
        </button>
      </div>
    </div>
  </div>
)}
    </div>
    </>
  );
}

function StoriesPageWrapper() {
  const { lng } = useParams();
  const lang = (lng as Language) || 'es';

  return (
    <AppLayout lang={lang} requireAuth={false}>
      <Suspense>
        <StoriesPageContent />
      </Suspense>
    </AppLayout>
  );
}

export default function StoriesPage() {
  return <StoriesPageWrapper />;
}
