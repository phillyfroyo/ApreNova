// components/FeedbackWidget.tsx
"use client";

import { useState } from "react";
import Button from "./ui/Button";
import { Dialog } from "@headlessui/react";
import FeedbackCard from "./FeedbackCard";
import { t } from "@/lib/t";
import { Send } from "lucide-react";
import { motion } from "framer-motion";
import Dropdown from "@/components/ui/Dropdown";


type FeedbackWidgetProps = {
  lng: "en" | "es";
};

export default function FeedbackWidget({ lng }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const [fly, setFly] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [mood, setMood] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

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
  const optionLabels = {
    bug: t(lng, "feedback", "bug"),
    suggestion: t(lng, "feedback", "suggestion"),
    other: t(lng, "feedback", "other"),
};


  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">

{/* Open form button */} 
<Button
  onClick={() => {
    resetForm();
    setFly(false);
    setIsOpen(true);
  }}
  variant="muted"
  className="px-1 py-0.1 text-xs rounded-xl"
>
  💬 {text.title1}
</Button>
      </div>

      {isOpen && (
  <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
    <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <Dialog.Panel className="overflow-hidden max-h-[90vh]">
        <FeedbackCard
          title={text.title2}
          subtitle={text.subtitle}
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
                }, 2000); // match animation duration
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



