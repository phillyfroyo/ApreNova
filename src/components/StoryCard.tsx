"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui";
import { STORY_METADATA } from "@/lib/stories";
import Image from "next/image";

type StoryCardProps = {
  index: number;
  title: string;
  image: string;
  onClick: () => void;
  isNew?: boolean;
  newLabel?: string;
  tourFirst?: boolean;
};

export default function StoryCard({
  index,
  title,
  image,
  onClick,
  isNew,
  newLabel = "New",
  tourFirst,
}: StoryCardProps) {
  return (
    <div
      data-tour-story-card={tourFirst ? "first" : undefined}
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
  {isNew && (
    <span
      style={{
        position: "absolute",
        top: "0",
        right: "0",
        background: "#22c55e",
        color: "white",
        fontSize: "0.7rem",
        fontWeight: 600,
        padding: "3px 10px",
        borderBottomLeftRadius: "10px",
        borderTopRightRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}
    >
      {newLabel}
    </span>
  )}
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
    </div>
  );
}
