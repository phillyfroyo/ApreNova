// src/components/StoryDetailModal.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useCallback } from "react";
import { STORY_METADATA } from "@/lib/stories";
import { getStoryUrl } from "@/utils/getStoryUrl";
import type { Language } from "@/types/i18n";
import { toCEFR } from "@/lib/cefr";
import StoryDetailContent from "@/components/StoryDetailContent";

type StoryDetailModalProps = {
  storySlug: string | null;
  onClose: () => void;
  user: any;
};

export default function StoryDetailModal({
  storySlug,
  onClose,
  user,
}: StoryDetailModalProps) {
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;

  const story = storySlug
    ? STORY_METADATA.find(s => s.slug === storySlug)
    : null;

  // Handle escape key and browser back button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handlePopState = () => onClose();

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

    // Check for bookmark first — bookmarks are bulk-updated when user changes level,
    // so the bookmark level always reflects the user's current level
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

    // No bookmark — use user's current level
    // Prioritize localStorage (updated synchronously on level change) over
    // session.user.quizLevel (JWT-based, can be stale until next token refresh)
    const storedLevel =
      typeof window !== "undefined" ? localStorage.getItem("level") : null;
    const level = toCEFR(storedLevel || user?.quizLevel || "A2");

    const url = getStoryUrl(story.slug, level, 1, 1, typedLang);
    router.push(url);
  }, [story, user, typedLang, router]);

  if (!story || !storySlug) return null;

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
            className="fixed top-6 bottom-2 left-4 right-4 md:inset-8 lg:inset-12 z-[101] flex items-start md:items-center justify-center pt-12 md:pt-0 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[75vh] md:h-[80vh] md:max-h-[600px] overflow-y-auto hide-scrollbar pointer-events-auto md:overflow-hidden md:flex md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              <StoryDetailContent
                story={story}
                lang={typedLang}
                onReadClick={handleReadStory}
                user={user}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
