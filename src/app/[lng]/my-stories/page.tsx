// src/app/[lng]/my-stories/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Plus, ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";
import UserStoryCard from "@/components/user-stories/UserStoryCard";
import UserStoryDetailModal from "@/components/user-stories/UserStoryDetailModal";
import UploadStoryModal from "@/components/user-stories/UploadStoryModal";
import StorageLimitIndicator from "@/components/user-stories/StorageLimitIndicator";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import type { Language } from "@/types/i18n";

interface UserStory {
  id: string;
  slug: string;
  title: string;
  titleEs?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionEs?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string | null;
  sourceLanguage: string;
  status: "PROCESSING" | "READY" | "FAILED" | "PARTIAL" | "CANCELLED";
  detectedLevel?: string | null;
  createdAt?: string;
  cancelledAt?: string | null;
  levels: {
    level: string;
    status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  }[];
}

// Helper to check if a story has any readable chapters
function hasReadableChapters(story: UserStory): boolean {
  // A story has readable chapters if at least one level is READY
  return story.levels.some((level) => level.status === "READY");
}

interface StoryStats {
  totalStories: number;
  maxStories: number;
  isPremium: boolean;
}

export default function MyStoriesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;
  const { setShowUploadModal, progress, lastConfirmedAt, lastCancelledAt } = useStoryUpload();

  const [stories, setStories] = useState<UserStory[]>([]);
  const [stats, setStats] = useState<StoryStats | null>(null);
  const [selectedStory, setSelectedStory] = useState<UserStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const storiesRef = useRef<UserStory[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  // Fetch stories and stats
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session?.user) {
      router.push(`/${typedLang}/auth/login`);
      return;
    }

    const fetchData = async () => {
      try {
        const [storiesRes, statsRes] = await Promise.all([
          fetch("/api/user-stories"),
          fetch("/api/user-stories/count"),
        ]);

        if (!storiesRes.ok || !statsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const storiesData = await storiesRes.json();
        const statsData = await statsRes.json();

        setStories(storiesData.stories || []);
        setStats(statsData);
      } catch (err) {
        setError("Failed to load your stories. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Poll for updates if any story is processing
    const interval = setInterval(async () => {
      const hasProcessing = storiesRef.current.some((s) => s.status === "PROCESSING");
      if (hasProcessing) {
        const res = await fetch("/api/user-stories");
        if (res.ok) {
          const data = await res.json();
          setStories(data.stories || []);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session, sessionStatus, router, typedLang]);

  const handleStoryClick = (story: UserStory) => {
    setSelectedStory(story);
  };

  const handleDeleteStory = (storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    if (stats) {
      setStats({ ...stats, totalStories: stats.totalStories - 1 });
    }
  };

  const handleUpdateStory = (updatedStory: UserStory) => {
    setStories((prev) =>
      prev.map((s) => (s.id === updatedStory.id ? { ...s, ...updatedStory } : s))
    );
    setSelectedStory(updatedStory);
  };

  // Refetch stories when upload completes, story is confirmed, or cancelled
  useEffect(() => {
    if (!lastConfirmedAt && !lastCancelledAt) return;

    const refetch = async () => {
      try {
        const [storiesRes, statsRes] = await Promise.all([
          fetch("/api/user-stories"),
          fetch("/api/user-stories/count"),
        ]);
        if (storiesRes.ok) {
          const data = await storiesRes.json();
          setStories(data.stories || []);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to refetch stories:", err);
      }
    };
    refetch();
  }, [lastConfirmedAt, lastCancelledAt]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{
        backgroundImage: "url('/images/background3.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/${typedLang}/stories`}
            className="p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <Logo variant="storiesmain" size="text-[28px]" />
        </div>
      </div>

      {/* Title and Stats */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            My Stories
          </h1>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Upload
          </button>
        </div>

        {stats && (
          <StorageLimitIndicator
            currentCount={stats.totalStories}
            maxCount={stats.maxStories}
            isPremium={stats.isPremium}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stories Grid */}
      {stories.length === 0 ? (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-semibold mb-2">No stories yet</h2>
          <p className="text-gray-600 mb-4">
            Upload your first story to start learning with your own content!
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Upload Your First Story
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto py-3 px-1 scrollbar-hide">
          {stories.map((story) => (
            <UserStoryCard
              key={story.id}
              id={story.id}
              title={story.title}
              thumbnailUrl={story.thumbnailUrl}
              status={story.status}
              hasReadableChapters={hasReadableChapters(story)}
              lang={typedLang}
              onClick={() => handleStoryClick(story)}
            />
          ))}

          {/* Add new story card */}
          {stats && (stats.maxStories === -1 || stats.totalStories < stats.maxStories) && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-40 flex-shrink-0 aspect-[2/3] rounded-xl border-2 border-dashed border-gray-300 bg-white/50 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-white/80 transition-all cursor-pointer"
            >
              <Plus className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500">Add Story</span>
            </button>
          )}
        </div>
      )}

      {/* Story Detail Modal */}
      <UserStoryDetailModal
        story={selectedStory}
        onClose={() => setSelectedStory(null)}
        onDelete={handleDeleteStory}
        onUpdate={handleUpdateStory}
        user={session?.user}
      />

      {/* Upload Story Modal */}
      <UploadStoryModal />

      {/* Premium upsell */}
      {stats && !stats.isPremium && stats.maxStories !== -1 && stats.totalStories >= stats.maxStories && (
        <div className="mt-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl p-4 text-white">
          <h3 className="font-semibold mb-1">Want more stories?</h3>
          <p className="text-sm text-white/90 mb-3">
            Upgrade to Premium for unlimited story uploads and longer texts.
          </p>
          <Link
            href={`/${typedLang}/premium`}
            className="inline-block px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Go Premium
          </Link>
        </div>
      )}
    </div>
  );
}
