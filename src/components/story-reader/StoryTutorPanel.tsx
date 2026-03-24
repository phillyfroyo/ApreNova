// src/components/story-reader/StoryTutorPanel.tsx
"use client";

import StoryTutorChat from "@/components/StoryTutorChat";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { Language } from "@/types/i18n";
import type { TutorContextType } from "@/contexts/StoryReaderContext";

interface StoryTutorPanelProps {
  storySlug: string;
  sentences: StoryLine[];
  oppositeLang: Language;
  isStoryTutorOpen: boolean;
  shouldRenderTutor: boolean;
  tutorContext: TutorContextType | null;
  preloadedMessages: any[] | null;
  backgroundImage?: string;
  // Refs
  tabElRef: React.RefObject<HTMLDivElement | null>;
  tabOffsetY: React.MutableRefObject<number>;
  tabDragRef: React.MutableRefObject<{
    startY: number;
    startOffset: number;
    moved: boolean;
    prevY: number;
    prevTime: number;
    velocityY: number;
  } | null>;
  tabMomentumRef: React.MutableRefObject<number>;
  // Handlers
  openStoryTutor: () => void;
  closeStoryTutor: () => void;
  setTutorContext: (ctx: TutorContextType | null) => void;
  handleMessagesUpdate: (newMessages: any[]) => void;
}

export default function StoryTutorPanel({
  storySlug,
  sentences,
  oppositeLang,
  isStoryTutorOpen,
  shouldRenderTutor,
  tutorContext,
  preloadedMessages,
  backgroundImage,
  tabElRef,
  tabOffsetY,
  tabDragRef,
  tabMomentumRef,
  openStoryTutor,
  closeStoryTutor,
  setTutorContext,
  handleMessagesUpdate,
}: StoryTutorPanelProps) {
  return (
    <div
      className={`fixed inset-y-0 lg:top-auto lg:bottom-0 lg:h-[calc(100vh-120px)] right-0 w-full lg:w-[400px] transition-transform duration-300 z-50 overflow-visible ${
        isStoryTutorOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Tab handle — draggable vertically */}
      <div
        ref={tabElRef}
        onPointerDown={(e) => {
          cancelAnimationFrame(tabMomentumRef.current);
          const now = performance.now();
          tabDragRef.current = {
            startY: e.clientY,
            startOffset: tabOffsetY.current,
            moved: false,
            prevY: e.clientY,
            prevTime: now,
            velocityY: 0,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = tabDragRef.current;
          if (!drag) return;
          const dy = e.clientY - drag.startY;
          if (Math.abs(dy) > 3) drag.moved = true;
          if (!drag.moved) return;
          const now = performance.now();
          const dt = now - drag.prevTime;
          if (dt > 0) {
            drag.velocityY = (e.clientY - drag.prevY) / dt;
            drag.prevY = e.clientY;
            drag.prevTime = now;
          }
          const parentEl = tabElRef.current?.parentElement;
          const parentH = parentEl ? parentEl.clientHeight : window.innerHeight;
          const tabH = tabElRef.current?.offsetHeight ?? 40;
          const maxOffset = parentH / 2 - tabH / 2 - 8;
          const newOffset = Math.max(-maxOffset, Math.min(maxOffset, drag.startOffset + dy));
          tabOffsetY.current = newOffset;
          if (tabElRef.current) {
            tabElRef.current.style.top = `calc(50% + ${newOffset}px)`;
          }
        }}
        onPointerUp={(e) => {
          const drag = tabDragRef.current;
          tabDragRef.current = null;
          if (drag && !drag.moved) {
            e.preventDefault();
            e.stopPropagation();
            if (isStoryTutorOpen) {
              closeStoryTutor();
              setTutorContext(null);
            } else {
              setTutorContext(null);
              openStoryTutor();
            }
          } else if (drag) {
            const timeSinceLastMove = performance.now() - drag.prevTime;
            const decayedVelocity = drag.velocityY * Math.max(0, 1 - timeSinceLastMove / 100);
            if (Math.abs(decayedVelocity) <= 0.1) return;
            let velocity = decayedVelocity * 16;
            const friction = 0.92;
            const animate = () => {
              velocity *= friction;
              if (Math.abs(velocity) < 0.5) return;
              const parentEl = tabElRef.current?.parentElement;
              const parentH = parentEl ? parentEl.clientHeight : window.innerHeight;
              const tabH = tabElRef.current?.offsetHeight ?? 40;
              const maxOffset = parentH / 2 - tabH / 2 - 8;
              const newOffset = Math.max(-maxOffset, Math.min(maxOffset, tabOffsetY.current + velocity));
              tabOffsetY.current = newOffset;
              if (tabElRef.current) {
                tabElRef.current.style.top = `calc(50% + ${newOffset}px)`;
              }
              tabMomentumRef.current = requestAnimationFrame(animate);
            };
            tabMomentumRef.current = requestAnimationFrame(animate);
          }
        }}
        style={{ top: `calc(50% + ${tabOffsetY.current}px)` }}
        className="absolute -translate-y-1/2 z-[100] flex cursor-pointer select-none touch-none left-0 -translate-x-1/2 lg:left-auto lg:right-full lg:translate-x-0"
        title={isStoryTutorOpen ? "Close Story Tutor" : "Open Story Tutor"}
        role="button"
        tabIndex={0}
      >
        <div className="bg-amber-100 hover:bg-amber-200 transition-colors duration-200 px-1.5 py-3 rounded-l-lg shadow-lg flex items-center justify-center lg:rounded-r-none">
          <span className="text-gray-600 text-sm font-bold">||</span>
        </div>
        <div className="bg-amber-100 hover:bg-amber-200 transition-colors duration-200 px-1.5 py-3 rounded-r-lg shadow-lg flex items-center justify-center lg:hidden">
          <span className="text-gray-600 text-sm font-bold">||</span>
        </div>
      </div>

      {shouldRenderTutor && (
        <StoryTutorChat
          storySlug={storySlug}
          currentPageText={sentences.map((s) => s[oppositeLang])}
          onClose={() => {
            closeStoryTutor();
            setTutorContext(null);
          }}
          isOpen={isStoryTutorOpen}
          initialContext={tutorContext}
          preloadedMessages={preloadedMessages}
          onMessagesUpdate={handleMessagesUpdate}
          backgroundImage={backgroundImage}
        />
      )}
    </div>
  );
}
