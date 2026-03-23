// components/FeedbackWidget.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { t } from "@/lib/t";
import FeedbackModal from "./FeedbackModal";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type FeedbackWidgetProps = {
  lng: "en" | "es";
};

// Routes where the floating feedback button should appear
// (onboarding, auth, about — NOT in-app pages like stories, dashboard, etc.)
function shouldShowFloatingButton(pathname: string): boolean {
  // Show on landing page (/), /home (onboarding), /auth, and /about routes
  return pathname === "/" || /^\/(en|es)\/(home|auth|about)(\/|$)/.test(pathname);
}

export default function FeedbackWidget({ lng }: FeedbackWidgetProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Draggable corner state
  const [corner, setCorner] = useState<Corner>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("feedbackWidgetCorner") as Corner) || "bottom-right";
    }
    return "bottom-right";
  });
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; buttonX: number; buttonY: number } | null>(null);
  const DRAG_THRESHOLD = 10;

  const [isDesktop, setIsDesktop] = useState(false);
  const [hasBottomNav, setHasBottomNav] = useState(true);
  const [hasAudioPlayer, setHasAudioPlayer] = useState(false);

  const showButton = shouldShowFloatingButton(pathname);

  // Save corner preference
  useEffect(() => {
    localStorage.setItem("feedbackWidgetCorner", corner);
  }, [corner]);

  // Track screen size and bottom nav presence for responsive positioning
  useEffect(() => {
    const check = () => {
      setIsDesktop(window.innerWidth >= 768);
      const bottomNav = document.querySelector('nav.fixed.bottom-0');
      setHasBottomNav(!!bottomNav);
      const audioBar = document.querySelector('[data-audio-player-bar]');
      setHasAudioPlayer(!!audioBar);
    };
    check();
    window.addEventListener("resize", check);
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", check);
      observer.disconnect();
    };
  }, []);

  // Get corner position styles
  const getCornerStyles = (c: Corner): React.CSSProperties => {
    const offset = 16;
    const bottomOffset = isDesktop ? 16 : (hasBottomNav ? 80 : 16);

    switch (c) {
      case "top-left":
        return { top: offset, left: offset, bottom: "auto", right: "auto" };
      case "top-right":
        return { top: offset, right: offset, bottom: "auto", left: "auto" };
      case "bottom-left":
        return { bottom: bottomOffset, left: offset, top: "auto", right: "auto" };
      case "bottom-right":
      default:
        return { bottom: bottomOffset, right: offset, top: "auto", left: "auto" };
    }
  };

  const getClosestCorner = (x: number, y: number): Corner => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const isLeft = x < centerX;
    const isTop = y < centerY;

    if (isTop && isLeft) return "top-left";
    if (isTop && !isLeft) return "top-right";
    if (!isTop && isLeft) return "bottom-left";
    return "bottom-right";
  };

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        buttonX: rect.left + rect.width / 2,
        buttonY: rect.top + rect.height / 2,
      };
      setIsDragging(true);
    }
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > DRAG_THRESHOLD) {
      setWasDragged(true);
    }

    setDragPosition({
      x: dragStartRef.current.buttonX + deltaX,
      y: dragStartRef.current.buttonY + deltaY,
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (isDragging && dragPosition && wasDragged) {
      const newCorner = getClosestCorner(dragPosition.x, dragPosition.y);
      setCorner(newCorner);
    }
    setIsDragging(false);
    setDragPosition(null);
    dragStartRef.current = null;
    setTimeout(() => setWasDragged(false), 100);
  }, [isDragging, dragPosition, wasDragged]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    };
    const handleMouseUp = () => handleDragEnd();
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const positionStyles: React.CSSProperties = isDragging && dragPosition
    ? {
        position: "fixed",
        left: dragPosition.x,
        top: dragPosition.y,
        transform: "translate(-50%, -50%)",
        transition: "none",
      }
    : {
        position: "fixed",
        ...getCornerStyles(corner),
        transition: "all 0.3s ease-out",
      };

  const title1 = t(lng, "feedback", "title1");

  return (
    <>
      {/* Draggable feedback button — only on onboarding/auth/about pages */}
      {showButton && (
        <div
          className={`z-50 ${hasAudioPlayer && !isDesktop ? 'hidden' : ''}`}
          style={positionStyles}
        >
          <button
            ref={buttonRef}
            onClick={() => {
              if (!wasDragged) {
                setIsOpen(true);
              }
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`px-3 py-2 text-sm font-semibold rounded-full leading-none min-w-0 select-none touch-none cursor-grab active:cursor-grabbing bg-gray-300 hover:bg-gray-400 transition-all ${isDragging ? 'scale-110 shadow-lg opacity-80' : ''}`}
            aria-label={title1}
            title={lng === 'es' ? 'Comentarios' : 'Feedback'}
          >
            fb
          </button>
        </div>
      )}

      <FeedbackModal isOpen={isOpen} onClose={() => setIsOpen(false)} lng={lng} />
    </>
  );
}
