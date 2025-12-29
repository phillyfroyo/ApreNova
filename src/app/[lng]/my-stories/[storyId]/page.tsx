// src/app/[lng]/my-stories/[storyId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Trash2, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ProcessingStatus from "@/components/user-stories/ProcessingStatus";
import SubmitForReviewButton from "@/components/user-stories/SubmitForReviewButton";
import type { Language } from "@/types/i18n";
import { ALL_CEFR_LEVELS, getCEFRLabel, toCEFR, type CEFRCode } from "@/lib/cefr";

// CEFR badge colors
const CEFR_BADGE_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-700 hover:bg-green-200",
  A2: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  B1: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  B2: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  C1: "bg-purple-100 text-purple-700 hover:bg-purple-200",
  C2: "bg-red-100 text-red-700 hover:bg-red-200",
};

interface UserStory {
  id: string;
  slug: string;
  title: string;
  titleEs: string | null;
  titleEn: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  status: "PROCESSING" | "READY" | "FAILED" | "PARTIAL";
  visibility: "PRIVATE" | "SUBMITTED" | "PUBLIC" | "REJECTED";
  detectedLevel: string | null;
  sourceLanguage: string;
  createdAt: string;
  levels: {
    id: string;
    level: string;
    status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  }[];
}

export default function StoryDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { lng, storyId } = useParams();
  const typedLang = lng as Language;

  const [story, setStory] = useState<UserStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session?.user) {
      router.push(`/${typedLang}/auth/login`);
      return;
    }

    const fetchStory = async () => {
      try {
        const res = await fetch(`/api/user-stories/${storyId}`);
        if (!res.ok) {
          throw new Error("Story not found");
        }
        const data = await res.json();
        setStory(data.story);
      } catch (err) {
        setError("Failed to load story");
      } finally {
        setLoading(false);
      }
    };

    fetchStory();

    // Poll for updates if processing
    const interval = setInterval(async () => {
      if (story?.status === "PROCESSING") {
        const res = await fetch(`/api/user-stories/${storyId}`);
        if (res.ok) {
          const data = await res.json();
          setStory(data.story);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session, sessionStatus, router, typedLang, storyId, story?.status]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/user-stories/${storyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete");
      }
      router.push(`/${typedLang}/my-stories`);
    } catch (err) {
      setError("Failed to delete story");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700">{error || "Story not found"}</p>
          <Link
            href={`/${typedLang}/my-stories`}
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Back to My Stories
          </Link>
        </div>
      </div>
    );
  }

  const readyLevels = story.levels.filter((l) => l.status === "READY");

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href={`/${typedLang}/my-stories`}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <Logo variant="storiesmain" size="text-[24px]" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Story Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h1 className="text-2xl font-bold mb-2">{story.title}</h1>
          {story.description && (
            <p className="text-gray-600 mb-4">{story.description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-sm text-gray-500 mb-4">
            <span className="px-2 py-1 bg-gray-100 rounded">
              Source: {story.sourceLanguage === "es" ? "Spanish" : "English"}
            </span>
            {story.detectedLevel && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                Detected: {getCEFRLabel(toCEFR(story.detectedLevel), typedLang)}
              </span>
            )}
            <span className="px-2 py-1 bg-gray-100 rounded">
              Created: {new Date(story.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Submit for Review */}
          <div className="border-t pt-4 mt-4">
            <SubmitForReviewButton
              storyId={story.id}
              currentVisibility={story.visibility}
              isPremium={session?.user?.isPremium ?? false}
              onSuccess={() => {
                setStory((prev) =>
                  prev ? { ...prev, visibility: "SUBMITTED" } : null
                );
              }}
            />
          </div>
        </div>

        {/* Processing Status */}
        {story.status !== "READY" && (
          <div className="mb-6">
            <ProcessingStatus
              storyTitle={story.title}
              detectedLevel={story.detectedLevel}
              levels={story.levels}
              overallStatus={story.status}
            />
          </div>
        )}

        {/* Read Story */}
        {story.status === "READY" && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-600" />
              Read Your Story
            </h2>
            <div className="grid grid-cols-5 gap-2">
              {ALL_CEFR_LEVELS.slice(0, 5).map((cefrLevel) => {
                // Check if this level is ready in the story
                const levelData = story.levels.find((l) => toCEFR(l.level) === cefrLevel);
                const isReady = levelData?.status === "READY";
                const colorClass = isReady
                  ? CEFR_BADGE_COLORS[cefrLevel] || "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed";
                return (
                  <Link
                    key={cefrLevel}
                    href={
                      isReady
                        ? `/${typedLang}/my-stories/${story.id}/${cefrLevel}/1/1`
                        : "#"
                    }
                    className={`py-3 px-2 rounded-lg text-center text-sm font-medium transition-colors ${colorClass}`}
                    onClick={(e) => !isReady && e.preventDefault()}
                  >
                    {cefrLevel}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-red-100">
          <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
          {showDeleteConfirm ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete &quot;{story.title}&quot;? This action cannot
                be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 transition-colors"
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Story
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
