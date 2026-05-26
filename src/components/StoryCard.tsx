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
  /** Crawlable URL to the story's info page. Lets search engines and middle-click
   *  "open in new tab" follow a real link, while left-click still triggers onClick
   *  (which opens the modal). Recommended for grid-style story listings. */
  href?: string;
  isNew?: boolean;
  newLabel?: string;
  tourFirst?: boolean;
};

export default function StoryCard({
  index,
  title,
  image,
  onClick,
  href,
  isNew,
  newLabel = "New",
  tourFirst,
}: StoryCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Let modifier-clicks (cmd/ctrl/shift/middle) use the href's native behavior —
    // opens in a new tab/window the way users expect.
    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as React.MouseEvent).button === 1) return;
    // Plain left-click: open the modal instead of navigating.
    if (href) e.preventDefault();
    onClick();
  };

  const inner = (
    <>
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
          fontSize: "0.875rem",
          marginTop: "0.5rem",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </p>
    </>
  );

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
        {href ? (
          <a
            href={href}
            onClick={handleClick}
            style={{ color: "inherit", textDecoration: "none", display: "block" }}
          >
            {inner}
          </a>
        ) : (
          <div onClick={handleClick}>{inner}</div>
        )}
      </motion.div>
    </div>
  );
}
