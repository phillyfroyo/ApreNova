// src/app/[lng]/stories/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from '@/components/Logo';
import { Card } from '@/components/ui';
import { STORY_METADATA, STORY_TYPE_LABELS, STORY_TYPE_LABELS_PLURAL, STORY_TAG_LABELS, ALL_STORY_TAGS, ALL_STORY_TYPES } from "@/lib/stories";
import { getStoryUrl } from "@/lib/stories";
import { useUserLevel } from "@/hooks/useUserLevel";
import { useUserSession } from "@/lib/auth";
import StoryModal from "@/components/StoryModal";
import StoryCard from "@/components/StoryCard";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import type { Language } from "@/types/i18n";
import type { StoryTag, StoryType } from "@/types/story";
import Image from "next/image";
import { t } from "@/lib/t";
import { getStoryTitle } from "@/lib/stories";
import { updateNativeLanguage } from '@/lib/updateLanguage'

type Level = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

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
      const authorName = story.origin.attribution.author;
      if (authorName && !seenAuthors.has(authorName)) {
        seenAuthors.add(authorName);
        authors.push({ id: authorName.toLowerCase().replace(/\s+/g, '-'), name: authorName });
      }
    }
  });

  return authors;
}

function AccountDropdown() {
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;

  const goToQuiz = () => router.push(`/${typedLang}/home/quiz/placement`);
  const goToSettings = () => router.push(`/${typedLang}/settings`);

  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const profilePic = session?.user?.image;
  const dropdownRef = useRef<HTMLDivElement | null>(null)

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (!dropdownRef.current?.contains(event.target as Node)) {
      setOpen(false)
    }
  }

  if (open) {
    document.addEventListener("mousedown", handleClickOutside)
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside)
  }
}, [open])



  return (
<div ref={dropdownRef}>
  <div style={{ position: "absolute", top: "1rem", right: "1rem", textAlign: "center" }}>
    <div
      style={{
        cursor: "pointer",
        borderRadius: "50%",
        overflow: "hidden",
        width: "32px",
        height: "32px",
        margin: "0 auto",
      }}
      onClick={() => setOpen((prev) => !prev)}
    >
      <Image
        src={profilePic || "/images/default-avatar.png"}
        alt="Account"
        width={100}
        height={100}
        style={{ objectFit: "cover" }}
      />
    </div>

    {session?.user?.isPremium && (
      <div
        style={{
          fontSize: "8px",
          backgroundColor: "rgba(255, 255, 255, 0.6)",
          padding: "2px 6px",
          borderRadius: "9999px",
          backdropFilter: "blur(4px)",
          fontWeight: "600",
          color: "#333",
          display: "inline-block",
        }}
      >
        Premium 💎
      </div>
    )}
  </div>

  {open && (
    <div
      style={{
        position: "absolute",
        top: "70px",
        right: "15px",
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        minWidth: "200px",
        maxWidth: "300px",
        padding: "1rem",
        zIndex: 1000,
      }}
    >
      <div style={{ marginBottom: "1rem", fontWeight: "bold", fontSize: "14px" }}>
        {session?.user?.email ? (
          <div style={{ wordWrap: "break-word", overflowWrap: "break-word" }}>{session.user.email}</div>
        ) : (
          <a href={`/${typedLang}/auth/signup`} className="text-blue-800 hover:underline">
            {t(typedLang, "stories", "createAccount")}
          </a>
        )}
      </div>


        <div className="space-y-2">
          <Link
            href={`/${typedLang}/tutor`}
            className="text-purple-600 cursor-pointer block"
          >
            {t(typedLang, "stories", "aiTutor")}
          </Link>

          <button
            onClick={goToQuiz}
            className="text-green-600 cursor-pointer block w-full text-left"
          >
            {t(typedLang, "stories", "takeQuiz")}
          </button>

          <button
            onClick={goToSettings}
            className="text-blue-800 cursor-pointer block w-full text-left"
          >
            {t(typedLang, "stories", "myAccount")}
          </button>

          <Link
            href={`/${typedLang}/premium`}
            className="text-yellow-700 cursor-pointer block"
          >
            {t(typedLang, "stories", "goPremium")}
          </Link>
        </div>
      </div>
    )}
  </div>
);}

function isLevel(value: unknown): value is Level {
  return (
    typeof value === 'string' &&
    ['l1', 'l2', 'l3', 'l4', 'l5'].includes(value)
  );
}

function StoriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, email, image, name, nativeLanguage } = useUserSession();
  const [selectedLevel, setSelectedLevel] = useState<Level>('l1');
  const [cardPosition, setCardPosition] = useState<DOMRect | null>(null);
  const [activeStory, setActiveStory] = useState<number | null>(null);
  const { lng } = useParams();
  const typedLang = lng as Language;
  const [showLangPrompt, setShowLangPrompt] = useState(false);

  // Filter state
  const [selectedTags, setSelectedTags] = useState<StoryTag[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<StoryType[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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
        const authorId = story.origin.attribution.author.toLowerCase().replace(/\s+/g, '-');
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


  function handleLevelClick(lvl: string) {
  const locale = typedLang;
  const storySlug = "aventura"; // We'll make this dynamic in the future
  const url = getStoryUrl({ locale, storySlug, level: lvl, chapter: 1, page: 1 });
  router.push(url);
}
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

  useEffect(() => {
    if (activeStory !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [activeStory]);

  useEffect(() => {
  if (user && !nativeLanguage) {
    setShowLangPrompt(true)
  }
}, [user, nativeLanguage])

  return (
    <div style={{
    padding: "2rem",
    position: "relative",
    backgroundImage: "url('/images/background3.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    minHeight: "100vh",
  }}>
    <AccountDropdown />

    <div className="absolute top-4 left-4 z-50">
  <Logo variant="storiesmain" size="text-[32px]" />
</div>

<div className="mt-16 mb-4 px-4">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-semibold text-left">
      {t(typedLang, "stories", "storiesAll")}
    </h2>
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
  </div>

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
                      s.origin.attribution.author.toLowerCase().replace(/\s+/g, '-') === author.id
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
                 onClick={(rect) => {
                   setCardPosition(rect);
                   setActiveStory(originalIndex);
                 }}
               />
             );
           })
         )}
      </div>
    </div> {/* Close scroll wrapper */}

      <StoryModal
  activeStory={activeStory}
  cardPosition={cardPosition}
  storySlug={activeStory !== null ? STORY_METADATA[activeStory].slug : ""}
  onClose={() => {
    setActiveStory(null);
    setCardPosition(null);
  }}
  handleLevelClick={handleLevelClick}
  user={user} // ✅ Add this line
/>
{showLangPrompt && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-xl shadow-lg text-center space-y-4 max-w-sm">
      <p className="text-lg font-semibold">
        ¿Cuál es tu lengua materna? <br />
        <span className="text-gray-600">What is your native language?</span>
      </p>
      <button
        className="w-full bg-[#1000c8] text-white py-2 px-4 rounded"
        onClick={async () => {
          await updateNativeLanguage('es')
          setShowLangPrompt(false)
        }}
      >
        Español
      </button>
      <button
        className="w-full bg-gray-800 text-white py-2 px-4 rounded"
        onClick={async () => {
          await updateNativeLanguage('en')
          router.replace('/en/stories')
        }}
      >
        English
      </button>
    </div>
  </div>
)}
    </div> 
  );
}

export default function StoriesPage() {
  return (
    <Suspense>
      <StoriesPageContent />
    </Suspense>
  );
}
