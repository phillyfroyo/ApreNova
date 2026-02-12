// src/components/user-stories/SubmitForReviewButton.tsx
"use client";

import { useState } from "react";
import { Send, Lock, CheckCircle, Clock } from "lucide-react";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface SubmitForReviewButtonProps {
  storyId: string;
  currentVisibility: "PRIVATE" | "SUBMITTED" | "PUBLIC" | "REJECTED";
  isPremium: boolean;
  lng?: Language;
  onSuccess?: () => void;
}

export default function SubmitForReviewButton({
  storyId,
  currentVisibility,
  isPremium,
  lng = "en",
  onSuccess,
}: SubmitForReviewButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!isPremium) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/user-stories/${storyId}/submit-for-review`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Already submitted or public
  if (currentVisibility === "SUBMITTED") {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 px-4 py-2 rounded-lg">
        <Clock className="w-4 h-4" />
        <span>Under review</span>
      </div>
    );
  }

  if (currentVisibility === "PUBLIC") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
        <CheckCircle className="w-4 h-4" />
        <span>Public</span>
      </div>
    );
  }

  if (currentVisibility === "REJECTED") {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
        <span>Not approved for public</span>
      </div>
    );
  }

  // Not premium
  if (!isPremium) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Lock className="w-4 h-4" />
        <span>{t(lng, "myStories", "premiumRequired")}</span>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
        <CheckCircle className="w-4 h-4" />
        <span>Submitted for review!</span>
      </div>
    );
  }

  // Ready to submit
  return (
    <div>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-default transition-colors text-sm font-medium"
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit for Public Review
          </>
        )}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
