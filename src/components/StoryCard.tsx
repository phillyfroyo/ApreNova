"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui";
import { STORY_METADATA } from "@/lib/stories";

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
  whileHover={{ scale: 1.05 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
  style={{ cursor: "pointer", borderRadius: "12px", overflow: "hidden" }}
>
  <img
    src={image}
    alt={title}
    style={{
      width: "100%",
      objectFit: "cover",
      aspectRatio: "2/3",
      display: "block",
      borderRadius: "12px"
    }}
  />
</motion.div>
  );
}
