// src/components/audio-player/useDragToMinimize.ts
"use client";

import { useState, useRef, useEffect } from "react";

const DRAG_DISTANCE = 120; // px of drag to go from expanded to minimized

export function useDragToMinimize() {
  const [minimized, setMinimized] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartMinimized = useRef(false);
  const lastTouchY = useRef<number | null>(null);
  const lastTouchTime = useRef<number>(0);
  const velocityY = useRef<number>(0);
  const barRef = useRef<HTMLDivElement>(null);

  const isDragging = dragProgress !== null;
  // progress: 0 = expanded, 1 = minimized
  const progress = isDragging ? dragProgress : (minimized ? 1 : 0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      lastTouchY.current = e.touches[0].clientY;
      lastTouchTime.current = Date.now();
      velocityY.current = 0;
      dragStartMinimized.current = minimized;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragStartY.current === null) return;
      e.preventDefault();
      const now = Date.now();
      const currentY = e.touches[0].clientY;

      if (lastTouchY.current !== null) {
        const dt = now - lastTouchTime.current;
        if (dt > 0) {
          velocityY.current = (currentY - lastTouchY.current) / dt;
        }
      }
      lastTouchY.current = currentY;
      lastTouchTime.current = now;

      const delta = currentY - dragStartY.current;
      let p: number;
      if (dragStartMinimized.current) {
        p = Math.max(0, Math.min(1, 1 + delta / DRAG_DISTANCE));
      } else {
        p = Math.max(0, Math.min(1, delta / DRAG_DISTANCE));
      }
      setDragProgress(p);
    };

    const onTouchEnd = () => {
      if (dragStartY.current === null) return;
      dragStartY.current = null;

      if (dragProgress === null) return;

      const FLICK_THRESHOLD = 0.3; // px/ms
      let shouldMinimize: boolean;
      if (Math.abs(velocityY.current) > FLICK_THRESHOLD) {
        shouldMinimize = velocityY.current > 0;
      } else {
        shouldMinimize = dragProgress > 0.4;
      }

      setMinimized(shouldMinimize);
      setDragProgress(null);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [minimized, dragProgress]);

  const transitionClass = isDragging ? '' : 'transition-all duration-300 ease-in-out';

  return { barRef, progress, isDragging, minimized, setMinimized, transitionClass };
}
