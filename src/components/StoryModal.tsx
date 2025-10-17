// src/components/StoryModal.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, Badge, Button } from "@/components/ui";
import { STORY_METADATA } from "@/lib/stories";
import { useRef, useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useParams } from "next/navigation";
import { getStoryUrl } from "@/utils/getStoryUrl";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";
import { getStoryTitle, getStoryDescription } from "@/lib/stories";



type StoryModalProps = {
  activeStory: number | null;
  cardPosition: DOMRect | null;
  storySlug: string;
  onClose: () => void;
  handleLevelClick: (lvl: string) => void;
  user: any;
};

export default function StoryModal({
  activeStory,
  cardPosition,
  storySlug,
  onClose,
  handleLevelClick,
  user,
}: StoryModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;


  const handleScroll = () => {
    if (!scrollRef.current) return;
    setIsAtTop(scrollRef.current.scrollTop === 0);
  };

  useEffect(() => {
    handleScroll();
  }, []);

  if (activeStory === null) return null;

  const story = STORY_METADATA[activeStory];


  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99,
        }}
        onClick={onClose}
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "absolute",
          top: cardPosition?.top ?? "50%",
          left: cardPosition?.left ?? "50%",
          width: cardPosition?.width ?? "400px",
          height: "auto",
          transform: "translate(0, 0)",
          zIndex: 100,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          layoutId={`story-${activeStory}`}
          style={{
            borderRadius: "12px",
            maxWidth: "100%",
            width: "400px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* 🔽 Background image layer */}
          <motion.img
            src={story.image}
            alt={getStoryTitle(typedLang, storySlug)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
              borderRadius: "18px",
            }}
          />
          <Card className="glass-card hide-scrollbar px-[0.25rem]">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                minHeight: "325px",
                maxHeight: "325px",
                overflowY: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                position: "relative",
                zIndex: 1,
              }}
              className="hide-scrollbar"
            >

              <motion.img
                src={story.image}
                alt={getStoryTitle(typedLang, storySlug)}
                initial={{ borderRadius: "12px" }}
                animate={{ borderRadius: "12px" }}
                style={{
                  width: "100%",
                  display: "block",
                  objectFit: "cover",
                  aspectRatio: "2 / 3",
                }}
              />

              <Button
                variant="parts"
                onClick={async () => {
                  // Check for bookmark first
                  console.log(`🔍 Checking bookmark for: ${storySlug}`);
                  const bookmarkResponse = await fetch(`/api/story-bookmark?storySlug=${encodeURIComponent(storySlug)}`);
                  console.log(`📥 Bookmark response status: ${bookmarkResponse.status}`);

                  if (bookmarkResponse.ok) {
                    const data = await bookmarkResponse.json();
                    console.log(`📚 Bookmark data:`, data);

                    if (data.bookmark) {
                      // Redirect to bookmarked page
                      console.log(`✅ Found bookmark! Redirecting to: ${data.bookmark.level} ch${data.bookmark.chapter} page${data.bookmark.page}`);
                      const url = getStoryUrl(
                        storySlug,
                        data.bookmark.level,
                        data.bookmark.chapter,
                        data.bookmark.page,
                        typedLang
                      );
                      router.push(url);
                      return;
                    } else {
                      console.log(`❌ No bookmark found for ${storySlug}`);
                    }
                  }

                  // No bookmark found - use default behavior
                  const storedLevel =
                    typeof window !== "undefined"
                      ? localStorage.getItem("level")
                      : null;
                  const level =
                    user?.quizLevel?.toLowerCase?.() ||
                    storedLevel?.toLowerCase?.() ||
                    "l2";

                  const url = getStoryUrl(storySlug, level, 1, 1, typedLang);
                  router.push(url);
                }}
                className="mx-auto my-4 block !bg-amber-800 hover:!bg-amber-700 text-white"

              >
                {t(typedLang, "stories", "readStory")}
              </Button>

              <div className="text-center">
                <h3 style={{ fontWeight: "bold" }}>
                {getStoryTitle(typedLang, storySlug)}
                </h3>
                <p className="my-4 text-sm text-black">
                {getStoryDescription(typedLang, storySlug)}
                </p>

                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {t(typedLang, "stories", "availableLevels")}
                </p>

                <div className="flex flex-wrap justify-center gap-2">
  {story.levels.map((lvl, idx) => {
    const badgeLevel = `level${lvl.replace("l", "")}` as
      | "level1"
      | "level2"
      | "level3"
      | "level4"
      | "level5";

    return (
      <Badge key={idx} level={badgeLevel}>
        {t(typedLang, "stories", "level")} {lvl.replace("l", "")}
      </Badge>
    );
  })}
</div>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
