"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui";
import { STORY_METADATA } from "@/lib/stories";
import Image from "next/image";

type StoryCardProps = {
  index: number;
  title: string;
  image: string;
  hook?: string;
  onClick: () => void;
};

export default function StoryCard({
  index,
  title,
  image,
  hook,
  onClick,
}: StoryCardProps) {
  return (
    <div
      style={{
        width: "140px",
        flexShrink: 0,
        scrollSnapAlign: "start",
      }}
    >
      <motion.div
        layoutId={`story-${index}`}
        onClick={onClick}
        whileHover={
          typeof window !== "undefined" &&
          window.matchMedia("(hover: hover)").matches
            ? { scale: 1.05 }
            : undefined
        }
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{
          cursor: "pointer",
          borderRadius: "12px",
          overflow: "hidden",
          width: "100%",
        }}
      >
  <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", borderRadius: "12px", overflow: "hidden" }}>
  <Image
    src={image}
    alt={title}
    fill
    sizes="140px"
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
      {hook && (
        <p
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "#6b7280",
            fontStyle: "italic",
            marginTop: "0.25rem",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {hook}
        </p>
      )}
</motion.div>
    </div>
  );
}
