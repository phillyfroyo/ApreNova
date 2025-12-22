// src/app/[lng]/my-stories/upload/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";
import StoryUploadForm from "@/components/user-stories/StoryUploadForm";
import StorageLimitIndicator from "@/components/user-stories/StorageLimitIndicator";
import type { Language } from "@/types/i18n";

interface StoryStats {
  totalStories: number;
  maxStories: number;
  maxStoryLength: number;
  dailyLimit: number;
  storiesProcessedToday: number;
  isPremium: boolean;
}

export default function UploadStoryPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;

  const [stats, setStats] = useState<StoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session?.user) {
      router.push(`/${typedLang}/auth/login`);
      return;
    }

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/user-stories/count");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError("Failed to load your story limits.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [session, sessionStatus, router, typedLang]);

  const handleSubmit = async (data: {
    title: string;
    content: string;
    sourceLanguage: "en" | "es";
    description?: string;
  }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to upload story");
      }

      // Redirect to my-stories page
      router.push(`/${typedLang}/my-stories`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Check if user can upload
  const canUpload =
    stats && stats.totalStories < stats.maxStories && stats.storiesProcessedToday < stats.dailyLimit;

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
        <h1 className="text-2xl font-bold mb-2">Upload a Story</h1>
        <p className="text-gray-600 mb-6">
          Paste your story text and we&apos;ll create learning content at all difficulty levels.
        </p>

        {/* Stats */}
        {stats && (
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
            <StorageLimitIndicator
              currentCount={stats.totalStories}
              maxCount={stats.maxStories}
              isPremium={stats.isPremium}
            />
            {!stats.isPremium && (
              <p className="text-xs text-gray-500 mt-2">
                Daily uploads: {stats.storiesProcessedToday} / {stats.dailyLimit}
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Limit reached messages */}
        {stats && stats.totalStories >= stats.maxStories && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              Story Limit Reached
            </h2>
            <p className="text-yellow-700 mb-4">
              You&apos;ve reached the maximum of {stats.maxStories} stories.
              {!stats.isPremium && " Upgrade to Premium for unlimited stories."}
            </p>
            {!stats.isPremium && (
              <Link
                href={`/${typedLang}/premium`}
                className="inline-block px-6 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
              >
                Go Premium
              </Link>
            )}
          </div>
        )}

        {stats && stats.storiesProcessedToday >= stats.dailyLimit && stats.totalStories < stats.maxStories && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              Daily Limit Reached
            </h2>
            <p className="text-yellow-700 mb-4">
              You&apos;ve used your daily upload limit. Try again tomorrow!
              {!stats.isPremium && " Premium users get 10 uploads per day."}
            </p>
            {!stats.isPremium && (
              <Link
                href={`/${typedLang}/premium`}
                className="inline-block px-6 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
              >
                Go Premium
              </Link>
            )}
          </div>
        )}

        {/* Upload Form */}
        {canUpload && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <StoryUploadForm
              isPremium={stats?.isPremium ?? false}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
