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
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import type { Language } from "@/types/i18n";
import type { StoryTag, StoryType } from "@/types/story";
import { t } from "@/lib/t";
import { getStoryTitle } from "@/lib/stories";
import { updateNativeLanguage } from '@/lib/updateLanguage'
import UploadStoryButton from "@/components/user-stories/UploadStoryButton"
import UserStoryCard from "@/components/user-stories/UserStoryCard"
import UserStoryDetailModal from "@/components/user-stories/UserStoryDetailModal"
import { useStoryUpload } from "@/contexts/StoryUploadContext"
import { AppLayout } from '@/components/layout';

type Level = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

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
  status: "PROCESSING" | "READY" | "FAILED" | "PARTIAL";
  detectedLevel?: string | null;
  createdAt?: string;
  levels: UserStoryLevel[];
}

// All theme tags combined into one list
const ALL_THEME_TAGS: StoryTag[] = [
  "family", "friendship", "adventure", "mystery", "romance",
  "coming-of-age", "nature", "technology", "travel", "food",
  "humorous", "heartwarming", "suspenseful", "reflective", "inspiring",
  "urban", "rural", "historical", "fantasy", "contemporary",
  "latin-america", "spain", "usa", "multicultural"
];

// Get unique authors from story metadata
function getUniqueAuthors(): Array<{ id: string; name: string }> {
  const authors: Array<{ id: string; name: string }> = [
    { id: "cuentana", name: "Cuentana Originals" }
  ];
  const seenAuthors = new Set<string>();

  STORY_METADATA.forEach(story => {
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
    ['l1', 'l2', 'l3', 'l4', 'l5'].includes(value)
  );
}

function StoriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, nativeLanguage } = useUserSession();
  const [selectedLevel, setSelectedLevel] = useState<Level>('l1');
  const { lng } = useParams();
  const typedLang = lng as Language;
  const [showLangPrompt, setShowLangPrompt] = useState(false);

  // URL-based story detail modal
  const storyParam = searchParams.get("story");
  const [detailStorySlug, setDetailStorySlug] = useState<string | null>(storyParam);

  // Sync URL param with state
  useEffect(() => {
    setDetailStorySlug(storyParam);
  }, [storyParam]);

  // Open detail modal and update URL
  const openDetailModal = (slug: string) => {
    setDetailStorySlug(slug);
    // Update URL without full navigation (shallow routing)
    window.history.pushState({}, "", `/${typedLang}/stories?story=${slug}`);
  };

  // Close detail modal and update URL
  const closeDetailModal = () => {
    setDetailStorySlug(null);
    // Remove query param from URL
    window.history.pushState({}, "", `/${typedLang}/stories`);
  };

  // Filter state
  const [selectedTags, setSelectedTags] = useState<StoryTag[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<StoryType[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // User stories state
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [selectedUserStory, setSelectedUserStory] = useState<UserStory | null>(null);
  const { data: session } = useSession();
  const { lastConfirmedAt } = useStoryUpload();

  // Fetch user stories
  useEffect(() => {
    if (!session?.user?.id) {
      setUserStories([]);
      return;
    }

    const fetchUserStories = async () => {
      try {
        const res = await fetch("/api/user-stories");
        if (res.ok) {
          const data = await res.json();
          setUserStories(data.stories || []);
        }
      } catch (error) {
        console.error("Error fetching user stories:", error);
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
  }, [session?.user?.id, lastConfirmedAt]);

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

  // Filter stories by all criteria
  const filteredStories = STORY_METADATA.filter(story => {
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
  });

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
    setSelectedLevel(fallbackLevel);
  } else {
    // Only use localStorage/sessionStorage if no database level exists
    const stored = localStorage.getItem('level') || sessionStorage.getItem('quizLevel');
    if (isLevel(stored)) {
      setSelectedLevel(stored);
    }
  }
}, [fallbackLevel]);

  // Body scroll is now handled by StoryDetailModal component

  useEffect(() => {
  if (user && !nativeLanguage) {
    setShowLangPrompt(true)
  }
}, [user, nativeLanguage])

  return (
    <>
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
    <div style={{
    padding: "2rem",
    position: "relative",
    minHeight: "100vh",
  }}>

{/* Top right controls: Filter, Upload button + My Stories */}
<div className="absolute top-4 right-4 flex items-center gap-3 z-10">
  <button
    onClick={() => setShowFilters(!showFilters)}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
      activeFilterCount > 0
        ? "bg-purple-600 text-white"
        : "bg-white/80 text-gray-700 hover:bg-white"
    }`}
  >
    <span>🏷️</span>
    {activeFilterCount > 0 ? (
      <span>{activeFilterCount} {typedLang === "es" ? "filtros" : "filters"}</span>
    ) : (
      <span>{typedLang === "es" ? "Filtrar" : "Filter"}</span>
    )}
  </button>
  <UploadStoryButton />
  <Link
    href={`/${typedLang}/my-stories`}
    className="px-3 py-1.5 bg-white/80 hover:bg-white text-purple-600 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
  >
    <span>📚</span>
    {typedLang === "es" ? "Mis Historias" : "My Stories"}
  </Link>
</div>

<div className="mt-4 mb-4 px-4">
  <h2 className="text-xl font-semibold text-left">
    {t(typedLang, "stories", "storiesAll")}
  </h2>

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

{/* My Stories Section - only show if user has stories */}
{userStories.length > 0 && (
  <div className="mb-6 px-4">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>📚</span>
        {typedLang === "es" ? "Mis Historias" : "My Stories"}
      </h2>
      <Link
        href={`/${typedLang}/my-stories`}
        className="text-sm text-purple-600 hover:text-purple-800 font-medium"
      >
        {typedLang === "es" ? "Ver todas" : "View all"}
      </Link>
    </div>
    <div
      style={{
        display: "flex",
        gap: "1rem",
        overflowX: "auto",
        paddingTop: "0.75rem",
        paddingBottom: "0.75rem",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="hide-scrollbar"
    >
      {userStories.map((story) => (
        <UserStoryCard
          key={story.id}
          id={story.id}
          title={story.title}
          thumbnailUrl={story.thumbnailUrl}
          status={story.status}
          onClick={() => setSelectedUserStory(story)}
        />
      ))}
    </div>
  </div>
)}

    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          gap: "1.5rem",
          overflowX: "auto",
          paddingLeft: "1rem",
          paddingRight: "1rem",
          paddingTop: "0.75rem",
          paddingBottom: "0.75rem",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        >
         {filteredStories.length === 0 ? (
           <div className="w-full text-center py-8 text-gray-500">
             {typedLang === "es" ? "No hay historias con estos filtros" : "No stories match these filters"}
           </div>
         ) : (
           filteredStories.map((story, i) => {
             // Find the original index in STORY_METADATA for the modal
             const originalIndex = STORY_METADATA.findIndex(s => s.slug === story.slug);
             return (
               <StoryCard
                 key={story.slug}
                 index={originalIndex}
                 title={getStoryTitle(typedLang, story.slug)}
                 image={story.image}
                 onClick={() => {
                   openDetailModal(story.slug);
                 }}
               />
             );
           })
         )}
      </div>
    </div> {/* Close scroll wrapper */}

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
    <AppLayout lang={lang}>
      <Suspense>
        <StoriesPageContent />
      </Suspense>
    </AppLayout>
  );
}

export default function StoriesPage() {
  return <StoriesPageWrapper />;
}
