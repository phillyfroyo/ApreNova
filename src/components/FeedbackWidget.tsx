// components/FeedbackWidget.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Button from "./ui/Button";
import { Dialog } from "@headlessui/react";
import FeedbackCard from "./FeedbackCard";
import { t } from "@/lib/t";
import { Send } from "lucide-react";
import { motion } from "framer-motion";
import Dropdown from "@/components/ui/Dropdown";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type FeedbackWidgetProps = {
  lng: "en" | "es";
};

export default function FeedbackWidget({ lng }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const [fly, setFly] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [mood, setMood] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Draggable corner state
  const [corner, setCorner] = useState<Corner>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("feedbackWidgetCorner") as Corner) || "bottom-right";
    }
    return "bottom-right";
  });
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false); // Track if a drag actually happened
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; buttonX: number; buttonY: number } | null>(null);
  const DRAG_THRESHOLD = 10; // Minimum pixels to move before considered a drag

  // Track if we're on desktop (md breakpoint = 768px)
  const [isDesktop, setIsDesktop] = useState(false);

  // Save corner preference
  useEffect(() => {
    localStorage.setItem("feedbackWidgetCorner", corner);
  }, [corner]);

  // Track screen size for responsive positioning
  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  // Get corner position styles
  const getCornerStyles = (c: Corner): React.CSSProperties => {
    const offset = 16; // 4 in tailwind = 16px
    // Desktop: nav is on the side, so we can sit closer to bottom
    // Mobile: nav is at bottom, so we need more space
    const bottomOffset = isDesktop ? 16 : 80;

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

  // Calculate closest corner from position
  const getClosestCorner = (x: number, y: number): Corner => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const centerX = windowWidth / 2;
    const centerY = windowHeight / 2;

    const isLeft = x < centerX;
    const isTop = y < centerY;

    if (isTop && isLeft) return "top-left";
    if (isTop && !isLeft) return "top-right";
    if (!isTop && isLeft) return "bottom-left";
    return "bottom-right";
  };

  // Handle drag start
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

  // Handle drag move
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    // Check if we've moved past the threshold
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > DRAG_THRESHOLD) {
      setWasDragged(true);
    }

    setDragPosition({
      x: dragStartRef.current.buttonX + deltaX,
      y: dragStartRef.current.buttonY + deltaY,
    });
  }, [isDragging]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (isDragging && dragPosition && wasDragged) {
      const newCorner = getClosestCorner(dragPosition.x, dragPosition.y);
      setCorner(newCorner);
    }
    setIsDragging(false);
    setDragPosition(null);
    dragStartRef.current = null;
    // Reset wasDragged after a short delay to prevent click from firing
    setTimeout(() => setWasDragged(false), 100);
  }, [isDragging, dragPosition, wasDragged]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  // Global event listeners for drag
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

  const resetForm = () => {
  setSelectedType("");
  setMood("");
  setFly(false);
  const form = document.getElementById("feedback-form") as HTMLFormElement | null;
  if (form) form.reset();
};

  const text = {
    title1: t(lng, "feedback", "title1"),
    title2: t(lng, "feedback", "title2"),
    subtitle: t(lng, "feedback", "subtitle"),
    typeLabel: t(lng, "feedback", "typeLabel"),
    typePlaceholder: t(lng, "feedback", "typePlaceholder"),
    messageLabel: t(lng, "feedback", "messageLabel"),
    placeholder: t(lng, "feedback", "placeholder"),
    optionalEmail: t(lng, "feedback", "optionalEmail"),
    cancel: t(lng, "feedback", "cancel"),
    send: t(lng, "feedback", "send"),
    optionalFields: t(lng, "feedback", "optionalFields"),
    experienceQuestion: t(lng, "feedback", "experienceQuestion"),
    frustrated: t(lng, "feedback", "frustrated"),
    neutral: t(lng, "feedback", "neutral"),
    happy: t(lng, "feedback", "happy"),
    thanks: t(lng, "feedback", "thanks"),
    successMessage: t(lng, "feedback", "successMessage"),
    close: t(lng, "feedback", "close"),
  };
  const optionLabels: Record<string, string> = {
    bug: t(lng, "feedback", "bug"),
    suggestion: t(lng, "feedback", "suggestion"),
    other: t(lng, "feedback", "other"),
};


  // Compute position styles
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

  return (
    <>
      {/* Draggable feedback button */}
      <div
        className="z-50"
        style={positionStyles}
      >
        <Button
          ref={buttonRef}
          onClick={() => {
            // Only open if not dragged (to distinguish click from drag)
            if (!wasDragged) {
              resetForm();
              setFly(false);
              setIsOpen(true);
            }
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          variant="muted"
          className={`!px-3 !py-2 text-xl rounded-full leading-none min-w-0 select-none touch-none cursor-grab active:cursor-grabbing ${isDragging ? 'scale-110 shadow-lg opacity-80' : ''}`}
          aria-label={text.title1}
        >
          💬
        </Button>
      </div>

      {isOpen && (
  <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-[70]">
    <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <Dialog.Panel className="overflow-hidden max-h-[90vh]">
        <FeedbackCard
          title={hasSubmitted ? "" : text.title2}
          subtitle={hasSubmitted ? "" : text.subtitle}
footer={
  hasSubmitted ? (
    <Button variant="muted" onClick={() => {
      setIsOpen(false);
      resetForm();
      setHasSubmitted(false);
    }}>
      {text.close}
    </Button>
    ) : (
    <>
<Button variant="muted" onClick={() => setIsOpen(false)}>
{text.cancel}
</Button>
<Button
  type="submit"
  form="feedback-form"
  variant="feedback"
  className="flex items-center gap-2 whitespace-nowrap min-w-[200px] justify-center"
              >
{/* Plane Animation */} 
  <motion.div
        initial={false}
    animate={
      fly
        ? {
            x: [-40, -75, -75, 180],
            y: [0, 0, 0, 0],
            opacity: [1, 1, 1, 1],
            rotate: [0, 45, 45],
            scale: [1, 1, 1, 1],
          }
        : {}
    }
    transition={{ duration: 2, ease: "easeInOut" }}
    className="w-6 h-4 flex-shrink-0"
  >
    <Send className="w-5 h-5" />
  </motion.div>
{!fly && <span>{text.send}</span>}
</Button>
            </>
    )
  }
>
{!hasSubmitted ? (            
<form
id="feedback-form"
            className="flex flex-col gap-3"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setFly(true);

              const formData = new FormData(e.currentTarget);
              await fetch("/api/report-feedback", {
                method: "POST",
                body: JSON.stringify({
                  type: formData.get("type"),
                  message: formData.get("message"),
                  email: formData.get("email"),
                  mood: formData.get("mood"),
                  pathname: window.location.pathname,
                  userAgent: navigator.userAgent,
                }),
              });
                  setTimeout(() => {
                  setHasSubmitted(true); // ✅ show success message instead of form
                  setFly(false);         // ✅ reset animation
                }, 1900); // match animation duration
               }}
            >
  <Dropdown
  label={selectedType ? optionLabels[selectedType] : text.typePlaceholder}
  options={[
    { value: "bug", label: "🐛 Bug" },
    { value: "suggestion", label: "💡 Suggestion" },
    { value: "other", label: "✏️ Other" },
  ]}
  onSelect={setSelectedType}
  variant="default"
/>

<input type="hidden" name="type" value={selectedType} />
                  <label className="text-sm font-medium">
                    {text.messageLabel}
                    <textarea name="message" placeholder={text.placeholder}
                      className="border mt-1 p-2 rounded w-full"
                    />
                  </label>
{/* Optional Fields */}  
<div className="flex items-center gap-2 text-sm text-gray-600 my-4">
<div className="flex-grow border-t border-gray-300" />
<span className="whitespace-nowrap">{text.optionalFields}</span>
<div className="flex-grow border-t border-gray-300" />
</div>
{/* Email */}  
<input
name="email"
placeholder={text.optionalEmail}
className="border p-2 rounded"
/>
{/* Experience Question */} 
<label className="text-sm font-medium block mt-4">
  {text.experienceQuestion}
</label>
<div className="flex gap-4 mt-2">
  <button
    type="button"
    onClick={() => setMood("frustrated")}
    className={`flex flex-col items-center px-4 py-2 rounded border ${
      mood === "frustrated" ? "bg-red-100 border-red-400" : "border-gray-300"
    }`}
  >
    <span className="text-2xl">😠</span>
    <span className="text-sm">{text.frustrated}</span>
  </button>
  <button
    type="button"
    onClick={() => setMood("neutral")}
    className={`flex flex-col items-center px-4 py-2 rounded border ${
      mood === "neutral" ? "bg-yellow-100 border-yellow-400" : "border-gray-300"
    }`}
  >
    <span className="text-2xl">😐</span>
    <span className="text-sm">{text.neutral}</span>
  </button>
  <button
    type="button"
    onClick={() => setMood("happy")}
    className={`flex flex-col items-center px-4 py-2 rounded border ${
      mood === "happy" ? "bg-green-100 border-green-400" : "border-gray-300"
    }`}
  >
    <span className="text-2xl">😊</span>
    <span className="text-sm">{text.happy}</span>
  </button>
</div>

<input type="hidden" name="mood" value={mood} />
</form>
) : (
  <div className="text-center flex flex-col items-center gap-4 py-4">
    <div className="text-center flex flex-col items-center gap-2 py-4">
  <p className="text-green-800 font-semibold">
    {text.thanks}
  </p>
  <p className="text-black font-normal">
    {text.successMessage}
  </p>
</div>
  </div>
)}
</FeedbackCard>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </>
  );
}



