"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui";
import { STORY_METADATA } from "@/lib/stories";

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
    alt={story.title}
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
              style={{
                minHeight: "300px",
                maxHeight: "300px",
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
                alt={story.title}
                initial={{ borderRadius: "12px" }}
                animate={{ borderRadius: "12px" }}
                style={{
                  width: "100%",
                  display: "block",
                  objectFit: "cover",
                  aspectRatio: "2 / 3",
                }}
              />

              <button
  onClick={() => {
    const storedLevel = typeof window !== "undefined" ? localStorage.getItem("level") : null;
    const level =
      user?.quizLevel?.toLowerCase?.() ||
      storedLevel?.toLowerCase?.() ||
      "l2";

    const url = `/es/stories/${storySlug}/${level}/part-1`;
    window.location.href = url;
  }}
  style={{
    margin: "1rem auto 1rem",
    display: "block",
    padding: "0.5rem 1rem",
    fontWeight: "bold",
    backgroundColor: "#1000c8",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  }}
>
  Leerme
</button>

              <div className="px-[0.25rem] text-center">
                <h3 style={{ fontWeight: "bold" }}>{story.title}</h3>
                <p className="my-4 text-sm text-black">{story.description}</p>
                {story.levels.map((lvl, idx) => (
                  <span
                   key={idx}
                   onClick={() => handleLevelClick(lvl)}
                   className="inline-block m-1 cursor-pointer rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
                  >
                   Nivel {lvl.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
