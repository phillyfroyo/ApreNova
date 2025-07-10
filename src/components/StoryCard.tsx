"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui";
import { STORY_METADATA } from "@/lib/stories";
import Image from "next/image";

type StoryCardProps = {
  index: number;
  title: string;
  image: string;
  onClick: (cardEl: DOMRect) => void;
};

export default function StoryCard({
  index,
  title,
  image,
  onClick,
}: StoryCardProps) {
  return (
    <motion.div
  layoutId={`story-${index}`}
  onClick={(e) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onClick(rect);
  }}
  whileHover={
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover)").matches
    ? { scale: 1.05 }
    : undefined // ✅ not false
}
  transition={{ duration: 0.2, ease: "easeOut" }}
  style={{
    cursor: "pointer",
    borderRadius: "12px",
    overflow: "hidden",
    width: "160px",              // ← Adjust to desired size
    flexShrink: 0,               // ← Prevent squishing in flex scroll
    scrollSnapAlign: "start",    // ← Carousel snapping
  }}
>
  <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", borderRadius: "12px", overflow: "hidden" }}>
  <Image
    src={image}
    alt={title}
    fill
    style={{ objectFit: "cover", borderRadius: "12px" }}
  />
</div>
  <p
        style={{
          textAlign: "center",
          fontSize: "0.875rem", // ~text-sm
          marginTop: "0.5rem",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </p>
</motion.div>
  );
}
