// components/FeedbackModal.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { t } from "@/lib/t";
import { Send, CheckCircle, ChevronDown } from "lucide-react";

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  lng: "en" | "es";
};

export default function FeedbackModal({ isOpen, onClose, lng }: FeedbackModalProps) {
  const [selectedType, setSelectedType] = useState("");
  const [mood, setMood] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    if (typeDropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [typeDropdownOpen]);

  const resetForm = () => {
    setSelectedType("");
    setMood("");
    setIsSubmitting(false);
    setTypeDropdownOpen(false);
    const form = document.getElementById("feedback-form") as HTMLFormElement | null;
    if (form) form.reset();
  };

  const handleClose = () => {
    onClose();
    // Delay reset so the closing animation isn't jarring
    setTimeout(() => {
      resetForm();
      setHasSubmitted(false);
    }, 200);
  };

  const text = {
    title: t(lng, "feedback", "title2"),
    subtitle: t(lng, "feedback", "subtitle"),
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

  const typeOptions = [
    { value: "bug", label: t(lng, "feedback", "bug") },
    { value: "suggestion", label: t(lng, "feedback", "suggestion") },
    { value: "other", label: t(lng, "feedback", "other") },
  ];

  const moods = [
    { value: "frustrated", emoji: "😠", label: text.frustrated },
    { value: "neutral", emoji: "😐", label: text.neutral },
    { value: "happy", emoji: "😊", label: text.happy },
  ];

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-[70]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden touch-none">
        <Dialog.Panel className="w-full max-w-md md:max-w-2xl lg:max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

          {!hasSubmitted ? (
            <>
              {/* Header — clean, no gradient */}
              <div className="px-6 md:px-8 pt-6 md:pt-8 pb-2">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">{text.title}</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">{text.subtitle}</p>
              </div>

              {/* Form */}
              <form
                id="feedback-form"
                className="px-6 md:px-8 pt-4 pb-2 flex flex-col gap-4 md:gap-5 overflow-y-auto overflow-x-hidden flex-1 min-h-0 overscroll-contain"
                noValidate
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSubmitting(true);

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
                    setHasSubmitted(true);
                    setIsSubmitting(false);
                  }, 600);
                }}
              >
                {/* Type dropdown — custom, full width */}
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                    className={`w-full flex items-center justify-between border rounded-lg px-3 py-2.5 md:py-3 text-sm md:text-base bg-white transition-colors ${
                      typeDropdownOpen
                        ? "border-indigo-500 ring-2 ring-indigo-500"
                        : "border-gray-300"
                    } ${selectedType ? "text-gray-900" : "text-gray-400"}`}
                  >
                    <span>
                      {selectedType
                        ? typeOptions.find((o) => o.value === selectedType)?.label
                        : text.typePlaceholder}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${typeDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {typeDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                      {typeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSelectedType(opt.value);
                            setTypeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm md:text-base hover:bg-gray-50 transition-colors ${
                            selectedType === opt.value ? "bg-indigo-50 text-indigo-700" : "text-gray-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="hidden" name="type" value={selectedType} />

                {/* Message */}
                <div>
                  <label className="text-sm md:text-base font-medium text-gray-700">{text.messageLabel}</label>
                  <textarea
                    name="message"
                    placeholder={text.placeholder}
                    rows={4}
                    className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2.5 md:py-3 text-sm md:text-base resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Optional divider */}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <div className="flex-grow border-t border-gray-200" />
                  <span>{text.optionalFields}</span>
                  <div className="flex-grow border-t border-gray-200" />
                </div>

                {/* Email */}
                <input
                  name="email"
                  placeholder={text.optionalEmail}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />

                {/* Mood */}
                <div>
                  <label className="text-sm md:text-base font-medium text-gray-700">{text.experienceQuestion}</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {moods.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMood(m.value)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs sm:text-sm transition-colors ${
                          mood === m.value
                            ? m.value === "frustrated"
                              ? "bg-red-50 border-red-300 text-red-700"
                              : m.value === "neutral"
                              ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                              : "bg-green-50 border-green-300 text-green-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span>{m.emoji}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <input type="hidden" name="mood" value={mood} />
              </form>

              {/* Footer */}
              <div className="px-6 md:px-8 py-4 md:py-5 flex justify-between border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 rounded-full text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  {text.cancel}
                </button>
                <button
                  type="submit"
                  form="feedback-form"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? "..." : text.send}</span>
                </button>
              </div>
            </>
          ) : (
            /* Success state */
            <div className="px-6 md:px-8 py-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">{text.thanks}</p>
              <p className="text-gray-500 mt-1">{text.successMessage}</p>
              <button
                onClick={handleClose}
                className="mt-6 px-6 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {text.close}
              </button>
            </div>
          )}

        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
