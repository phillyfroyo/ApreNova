// src/components/ExpandableDescription.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";

interface ExpandableDescriptionProps {
  text: string;
  lang: Language;
  maxLines?: number;
  className?: string;
}

export default function ExpandableDescription({
  text,
  lang,
  maxLines = 4,
  className = "",
}: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Split on newlines to render paragraphs
  const paragraphs = text.split(/\n+/).filter(Boolean);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // Compare natural height vs clamped height (line-height ~1.625 * font-size ~14px * maxLines)
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22.75;
    const clampedHeight = lineHeight * maxLines;
    setNeedsClamp(el.scrollHeight > clampedHeight + 4); // small tolerance
  }, [text, maxLines]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={contentRef}
        className={`text-sm leading-relaxed ${!expanded && needsClamp ? "overflow-hidden" : ""}`}
        style={
          !expanded && needsClamp
            ? {
                display: "-webkit-box",
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: "vertical" as const,
              }
            : undefined
        }
      >
        {paragraphs.map((para, i) => (
          <p key={i} className={i > 0 ? "mt-3" : ""}>
            {para}
          </p>
        ))}
      </div>

      {/* Blur gradient hint when collapsed */}
      {needsClamp && !expanded && (
        <div className="absolute bottom-5 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      )}

      {/* Read more / Read less toggle */}
      {needsClamp && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-700 mt-1 transition-colors"
        >
          {expanded
            ? t(lang, "stories", "readLess")
            : t(lang, "stories", "readMore")}
        </button>
      )}
    </div>
  );
}
