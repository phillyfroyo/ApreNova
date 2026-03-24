// src/components/story-reader/NavigationButtons.tsx
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPrevNextPage as getPrevNextPageUtil } from "@/utils/storyNavigation";
import type { StoryMapType } from "@/contexts/StoryReaderContext";

interface NavigationButtonsProps {
  chapterNumber: number;
  pageNumber: number;
  storyMap: StoryMapType;
  currentLevel: string;
  isStoryTutorOpen: boolean;
  audioPlayerIsVisible: boolean;
  getNavigationUrl: (level: string, chapter: number, page: number) => string;
}

export default function NavigationButtons({
  chapterNumber,
  pageNumber,
  storyMap,
  currentLevel,
  isStoryTutorOpen,
  audioPlayerIsVisible,
  getNavigationUrl,
}: NavigationButtonsProps) {
  const { prev, next } = getPrevNextPageUtil(chapterNumber, pageNumber, storyMap);

  const navBtn = (disabled: boolean) =>
    `inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${
      disabled
        ? "bg-[#ede4d3]/80 border-gray-200 text-gray-300 cursor-default"
        : "bg-[#f5f0e6] backdrop-blur-md border-indigo-200 text-indigo-600 hover:bg-[#ede4d3] shadow-md"
    }`;

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-40 flex justify-center gap-2 ${
        isStoryTutorOpen ? "hidden lg:flex" : ""
      } ${audioPlayerIsVisible ? "hidden" : "bottom-4"}`}
    >
      <div className="flex items-center gap-3">
        {prev ? (
          <Link className={navBtn(false)} href={getNavigationUrl(currentLevel, prev.ch, prev.pg)}>
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </Link>
        ) : (
          <span className={navBtn(true)}>
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </span>
        )}
        {next ? (
          <Link className={navBtn(false)} href={getNavigationUrl(currentLevel, next.ch, next.pg)}>
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          </Link>
        ) : (
          <span className={navBtn(true)}>
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          </span>
        )}
      </div>
    </div>
  );
}
