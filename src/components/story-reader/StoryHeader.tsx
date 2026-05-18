// src/components/story-reader/StoryHeader.tsx
"use client";

import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { ALL_CEFR_LEVELS, getCEFRLabel, type CEFRCode } from "@/lib/cefr";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";
import type { StoryMapType, PoemNavInfo } from "@/contexts/StoryReaderContext";

interface StoryHeaderProps {
  typedLang: Language;
  menuOpen: boolean;
  setMenuOpen: (val: boolean) => void;
  setActiveDropdown: (val: string | null) => void;
  setIsAnyDropdownOpen: (val: boolean) => void;
  currentLevel: string;
  chapterNumber: number;
  pageNumber: number;
  storyMap: StoryMapType;
  availableLevels?: CEFRCode[];
  detectedLevel?: string | null;
  usePoemNavigation: boolean;
  getNavigationUrl: (level: string, chapter: number, page: number) => string;
  getHomeUrl: () => string;
  getNavigationLabel: (type: "chapter" | "page") => string;
  getCurrentPoem: (chapterNum: number, pageNum: number) => PoemNavInfo | null;
}

export default function StoryHeader({
  typedLang,
  menuOpen,
  setMenuOpen,
  setActiveDropdown,
  setIsAnyDropdownOpen,
  currentLevel,
  chapterNumber,
  pageNumber,
  storyMap,
  availableLevels,
  detectedLevel,
  usePoemNavigation,
  getNavigationUrl,
  getHomeUrl,
  getNavigationLabel,
  getCurrentPoem,
}: StoryHeaderProps) {
  const router = useRouter();

  return (
    <>
      <header className="fixed top-4 left-4 z-50">
        <button
          className="p-2 rounded-full bg-[#f5f0e6] backdrop-blur-md border border-indigo-200 hover:bg-[#ede4d3] shadow-md transition-colors text-indigo-600"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {menuOpen && (
        <div className="fixed top-16 left-4 right-4 z-40 bg-[#f5f0e6]/95 backdrop-blur-md shadow-md rounded-xl p-4 space-y-4 border border-indigo-200">
          <div className="flex flex-wrap gap-4">
            <Dropdown
              label={t(typedLang, "story", "navigate")}
              variant="glass"
              options={[{ label: t(typedLang, "story", "home"), value: "home" }]}
              onSelect={(option) => {
                if (option === "home") router.push(getHomeUrl());
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "navigate" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />

            <Dropdown
              label={`${t(typedLang, "story", "levelSelect")} ▾ ${getCEFRLabel(currentLevel as CEFRCode, typedLang)}${detectedLevel && currentLevel === detectedLevel ? ` ${t(typedLang, "stories", "originalLevel")}` : ""}`}
              variant="glass"
              options={ALL_CEFR_LEVELS.map((level) => {
                const isAvailable = !availableLevels || availableLevels.includes(level);
                const isOriginal = detectedLevel && level === detectedLevel;
                const notAvailableText = typedLang === "es" ? "(no disponible)" : "(not available)";
                const originalText = t(typedLang, "stories", "originalLevel");

                let label = getCEFRLabel(level, typedLang);
                if (isOriginal) label += ` ${originalText}`;
                if (!isAvailable) label += ` ${notAvailableText}`;

                return { label, value: level, disabled: !isAvailable };
              })}
              onSelect={(selectedValue) => {
                router.push(getNavigationUrl(selectedValue, chapterNumber, pageNumber));
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "level" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />

            {/* Chapter Dropdown */}
            {storyMap.chapters.length > 1 && (
              <Dropdown
                label={`${getNavigationLabel("chapter")} ▾ ${chapterNumber}`}
                variant="glass"
                options={storyMap.chapters.map((ch) => ({
                  label:
                    ch.title && ch.title !== `Chapter ${ch.chapter}`
                      ? `${getNavigationLabel("chapter")} ${ch.chapter}: ${ch.title}`
                      : `${getNavigationLabel("chapter")} ${ch.chapter}`,
                  value: ch.chapter.toString(),
                }))}
                onSelect={(selectedValue) => {
                  const selectedChapter = parseInt(selectedValue);
                  const firstPage = storyMap.chapters.find((c) => c.chapter === selectedChapter)?.pages[0] || 1;
                  router.push(getNavigationUrl(currentLevel, selectedChapter, firstPage));
                }}
                onOpenChange={(isOpen) => {
                  setActiveDropdown(isOpen ? "chapter" : null);
                  setIsAnyDropdownOpen(isOpen);
                }}
              />
            )}

            {/* Page/Poem Dropdown */}
            {(() => {
              const currentChapterData = storyMap.chapters.find((c) => c.chapter === chapterNumber);
              const hasPoems = usePoemNavigation && currentChapterData?.poems && currentChapterData.poems.length > 0;
              const currentPoem = hasPoems ? getCurrentPoem(chapterNumber, pageNumber) : null;

              if (hasPoems && currentChapterData?.poems) {
                const poemLabel = currentPoem
                  ? `${getNavigationLabel("page")} ${currentPoem.number}: ${currentPoem.title.substring(0, 15)}${currentPoem.title.length > 15 ? "..." : ""}`
                  : `${getNavigationLabel("page")} ▾`;

                return (
                  <Dropdown
                    label={`${poemLabel} ▾`}
                    variant="glass"
                    options={currentChapterData.poems.map((poem) => ({
                      label: `${poem.number}. ${poem.title.substring(0, 25)}${poem.title.length > 25 ? "..." : ""}`,
                      value: poem.number.toString(),
                    }))}
                    onSelect={(selectedValue) => {
                      const selectedPoemNum = parseInt(selectedValue);
                      const selectedPoem = currentChapterData.poems?.find((p) => p.number === selectedPoemNum);
                      if (selectedPoem) {
                        router.push(getNavigationUrl(currentLevel, chapterNumber, selectedPoem.startPage));
                      }
                    }}
                    onOpenChange={(isOpen) => {
                      setActiveDropdown(isOpen ? "page" : null);
                      setIsAnyDropdownOpen(isOpen);
                    }}
                  />
                );
              }

              return (
                <Dropdown
                  label={`${getNavigationLabel("page")} ▾ ${pageNumber}`}
                  variant="glass"
                  options={(currentChapterData?.pages || []).map((pg) => ({
                    label: `${getNavigationLabel("page")} ${pg}`,
                    value: pg.toString(),
                  }))}
                  onSelect={(selectedValue) => {
                    const selectedPage = parseInt(selectedValue);
                    router.push(getNavigationUrl(currentLevel, chapterNumber, selectedPage));
                  }}
                  onOpenChange={(isOpen) => {
                    setActiveDropdown(isOpen ? "page" : null);
                    setIsAnyDropdownOpen(isOpen);
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
