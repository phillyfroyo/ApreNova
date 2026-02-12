// src/components/user-stories/UserStoryDetailModal.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import { Badge, Button } from "@/components/ui";
import { Trash2, Pencil, X, Loader2, CheckCircle, AlertCircle, Clock, XCircle } from "lucide-react";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";
import { toCEFR, getCEFRLabel } from "@/lib/cefr";
import { useUserLevel } from "@/hooks/useUserLevel";
import { STORY_TYPE_LABELS } from "@/lib/stories";
import type { StoryType } from "@/types/story";

interface UserStoryLevel {
  level: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
}

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
  detectedLevel?: string | null;
  storyType?: string | null;
  status: "PROCESSING" | "READY" | "FAILED" | "PARTIAL" | "CANCELLED";
  cancelledAt?: string | null;
  levels: UserStoryLevel[];
  createdAt?: string;
}

type UserStoryDetailModalProps = {
  story: UserStory | null;
  onClose: () => void;
  onDelete?: (storyId: string) => void;
  onUpdate?: (story: UserStory) => void;
  user: any;
};

// Display status can differ from database status
// CANCELLED with readable content shows as "Ready" (more user-friendly)
type DisplayStatus = "PROCESSING" | "READY" | "FAILED" | "PARTIAL" | "CANCELLED";

// Map display status to translation key in myStories section
const statusTranslationKeys: Record<DisplayStatus, string> = {
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
  PARTIAL: "partial",
  CANCELLED: "cancelled",
};

const statusConfig: Record<DisplayStatus, {
  icon: typeof Loader2;
  color: string;
  bg: string;
  animate: boolean;
}> = {
  PROCESSING: {
    icon: Loader2,
    color: "text-blue-600",
    bg: "bg-blue-100",
    animate: true,
  },
  READY: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-100",
    animate: false,
  },
  FAILED: {
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-100",
    animate: false,
  },
  PARTIAL: {
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-100",
    animate: false,
  },
  CANCELLED: {
    icon: XCircle,
    color: "text-gray-600",
    bg: "bg-gray-100",
    animate: false,
  },
};

export default function UserStoryDetailModal({
  story,
  onClose,
  onDelete,
  onUpdate,
  user,
}: UserStoryDetailModalProps) {
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;
  const userLevel = useUserLevel("A2"); // Get user's preferred reading level

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize edit fields when story changes
  useEffect(() => {
    if (story) {
      setEditTitle(story.title);
      setEditDescription(story.description || "");
    }
  }, [story]);

  // Handle escape key and browser back button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };

    const handlePopState = () => {
      onClose();
    };

    if (story) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("popstate", handlePopState);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
      document.body.style.overflow = "auto";
    };
  }, [story, onClose, isEditing, showDeleteConfirm]);

  const handleReadStory = useCallback(async () => {
    if (!story) return;

    // Check if story has any readable levels
    const readyLevels = story.levels.filter((l) => l.status === "READY");
    if (readyLevels.length === 0) return;

    // Check for bookmark first
    try {
      const bookmarkResponse = await fetch(
        `/api/user-story-bookmark?storyId=${encodeURIComponent(story.id)}`
      );

      if (bookmarkResponse.ok) {
        const data = await bookmarkResponse.json();
        if (data.bookmark) {
          // Verify the bookmarked level is still ready
          const isLevelReady = readyLevels.some(l => l.level === data.bookmark.level);
          if (isLevelReady) {
            router.push(
              `/${typedLang}/my-stories/${story.id}/${data.bookmark.level}/${data.bookmark.chapter}/${data.bookmark.page}`
            );
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error checking bookmark:", error);
    }

    // No valid bookmark - prioritize user's preferred level if available
    // Fall back to first ready level, then detected level, then A1
    const userLevelReady = readyLevels.find(l => l.level === userLevel);
    const targetLevel = userLevelReady?.level || readyLevels[0]?.level || story.detectedLevel || "A1";
    router.push(`/${typedLang}/my-stories/${story.id}/${targetLevel}/1/1`);
  }, [story, typedLang, router, userLevel]);

  const handleSave = async () => {
    if (!story) return;
    setIsSaving(true);

    try {
      const res = await fetch(`/api/user-stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsEditing(false);
        if (onUpdate) {
          onUpdate({ ...story, title: editTitle, description: editDescription });
        }
      }
    } catch (error) {
      console.error("Error saving story:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!story || !onDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/user-stories/${story.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDelete(story.id);
        onClose();
      }
    } catch (error) {
      console.error("Error deleting story:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!story) return null;

  // CEFR level order for sorting
  const levelOrder: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

  const readyLevels = story.levels
    .filter((l) => l.status === "READY")
    .sort((a, b) => {
      const orderA = levelOrder[toCEFR(a.level)] ?? 99;
      const orderB = levelOrder[toCEFR(b.level)] ?? 99;
      return orderA - orderB;
    });
  const hasReadableChapters = readyLevels.length > 0;

  // Compute display status: CANCELLED with readable chapters shows as READY (more inviting)
  // We'll show a separate "Partial" indicator for these stories
  const displayStatus: DisplayStatus =
    story.status === "CANCELLED" && hasReadableChapters ? "READY" : story.status;

  // Track if this is a partial story (cancelled but has readable content)
  const isPartialStory = story.status === "CANCELLED" && hasReadableChapters;

  const statusInfo = statusConfig[displayStatus];
  const StatusIcon = statusInfo.icon;
  const statusLabel = t(typedLang, "myStories", statusTranslationKeys[displayStatus]);

  // Can read if: READY, PARTIAL with ready levels, or CANCELLED with ready levels (INCOMPLETE)
  const canRead = story.status === "READY" ||
    (story.status === "PARTIAL" && hasReadableChapters) ||
    (story.status === "CANCELLED" && hasReadableChapters);

  // Filter out invalid blob URLs (they don't persist across page refreshes)
  const validThumbnailUrl = story.thumbnailUrl && !story.thumbnailUrl.startsWith("blob:")
    ? story.thumbnailUrl
    : null;

  // Get localized title/description
  const displayTitle = typedLang === "es"
    ? (story.titleEs || story.title)
    : (story.titleEn || story.title);
  const displayDescription = typedLang === "es"
    ? (story.descriptionEs || story.description)
    : (story.descriptionEn || story.description);

  return (
    <AnimatePresence>
      {story && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed top-6 bottom-2 left-4 right-4 md:inset-8 lg:inset-12 z-[101] flex items-center justify-center pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] md:h-[80vh] md:max-h-[440px] overflow-y-auto pointer-events-auto md:overflow-hidden md:flex md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left side - Image */}
              <div className="relative w-full md:w-2/5 md:flex-shrink-0">
                <div className="max-h-[60vh] md:max-h-none md:h-full relative overflow-hidden">
                  <div className="relative w-full aspect-[2/3] md:aspect-auto md:h-full">
                  {validThumbnailUrl ? (
                    <Image
                      src={validThumbnailUrl}
                      alt={displayTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
                      <span className="text-8xl">📖</span>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Right side - Content */}
              <div className="flex-1 md:overflow-y-auto p-6 md:p-8">
                {/* Status Badge */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {/* Status first */}
                  <span className={`px-3 py-1 ${statusInfo.bg} ${statusInfo.color} rounded-full text-xs font-medium flex items-center gap-1.5`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.animate ? "animate-spin" : ""}`} />
                    {statusLabel}
                  </span>
                  {/* Partial indicator for cancelled stories with readable content */}
                  {isPartialStory && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {t(typedLang, "myStories", "partial")}
                    </span>
                  )}
                  {/* Story Type Badge */}
                  {story.storyType && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      story.storyType === "poem" || story.storyType === "song-lyrics"
                        ? "bg-purple-100 text-purple-700"
                        : story.storyType === "novel" || story.storyType === "short-story"
                        ? "bg-blue-100 text-blue-700"
                        : story.storyType === "fable" || story.storyType === "folktale" || story.storyType === "myth" || story.storyType === "legend"
                        ? "bg-amber-100 text-amber-700"
                        : story.storyType === "epic"
                        ? "bg-rose-100 text-rose-700"
                        : story.storyType === "movie-script" || story.storyType === "tv-script"
                        ? "bg-cyan-100 text-cyan-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {STORY_TYPE_LABELS[story.storyType as StoryType]?.[typedLang] || story.storyType}
                    </span>
                  )}
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                    {typedLang === "es" ? "Mi Historia" : "My Story"}
                  </span>
                </div>

                {/* Title - Edit mode or display */}
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-2xl md:text-3xl font-bold text-gray-900 mb-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={typedLang === "es" ? "Título de la historia" : "Story title"}
                  />
                ) : (
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                    {displayTitle}
                  </h2>
                )}

                {/* Source language and detected level */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <span>
                    {typedLang === "es" ? "Idioma original:" : "Original language:"}{" "}
                    {story.sourceLanguage === "es" ? "Español" : "English"}
                  </span>
                  {story.detectedLevel && (
                    <>
                      <span>•</span>
                      <span>
                        {typedLang === "es" ? "CEFR original:" : "Original CEFR:"}{" "}
                        {toCEFR(story.detectedLevel)}
                      </span>
                    </>
                  )}
                </div>

                {/* Description - Edit mode or display */}
                {isEditing ? (
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full text-gray-700 leading-relaxed mb-6 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                    placeholder={typedLang === "es" ? "Descripción (opcional)" : "Description (optional)"}
                  />
                ) : (
                  displayDescription && (
                    <p className="text-gray-700 leading-relaxed mb-6">
                      {displayDescription}
                    </p>
                  )
                )}

                {/* Action Buttons */}
                {isEditing ? (
                  <div className="flex gap-3 mb-6">
                    <Button
                      variant="parts"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 !bg-purple-600 hover:!bg-purple-500 text-white font-semibold py-3"
                    >
                      {isSaving ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        typedLang === "es" ? "Guardar" : "Save"
                      )}
                    </Button>
                    <Button
                      variant="parts"
                      onClick={() => {
                        setIsEditing(false);
                        setEditTitle(story.title);
                        setEditDescription(story.description || "");
                      }}
                      className="!bg-gray-200 hover:!bg-gray-300 text-gray-700 font-semibold py-3 px-6"
                    >
                      {typedLang === "es" ? "Cancelar" : "Cancel"}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Read Button - show if story has readable content */}
                    {canRead && (
                      <Button
                        variant="parts"
                        onClick={handleReadStory}
                        className="w-full md:w-auto mb-4 !bg-amber-700 hover:!bg-amber-600 text-white font-semibold py-3 px-8 text-lg"
                      >
                        {t(typedLang, "stories", "readStory")}
                      </Button>
                    )}

                    {/* Edit/Delete buttons */}
                    <div className="flex gap-3 mb-6">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        {typedLang === "es" ? "Editar" : "Edit"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        {typedLang === "es" ? "Eliminar" : "Delete"}
                      </button>
                    </div>
                  </>
                )}

                {/* Available Levels */}
                {readyLevels.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-600 mb-2">
                      {t(typedLang, "stories", "availableLevels")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {readyLevels.map((lvl) => {
                        const cefrLevel = toCEFR(lvl.level);
                        const isOriginal = story.detectedLevel && toCEFR(story.detectedLevel) === cefrLevel;
                        // Map CEFR to badge level numbers (A1=1, A2=2, B1=3, B2=4, C1=5, C2=6)
                        const levelNum = cefrLevel === "A1" ? 1 : cefrLevel === "A2" ? 2 : cefrLevel === "B1" ? 3 : cefrLevel === "B2" ? 4 : cefrLevel === "C1" ? 5 : 6;
                        const badgeLevel = `level${levelNum}` as
                          | "level1"
                          | "level2"
                          | "level3"
                          | "level4"
                          | "level5"
                          | "level6";
                        return (
                          <button
                            key={lvl.level}
                            onClick={() => router.push(`/${typedLang}/my-stories/${story.id}/${cefrLevel}/1/1`)}
                            className="cursor-pointer hover:scale-105 transition-transform"
                            title={typedLang === "es" ? `Leer en nivel ${cefrLevel}` : `Read at ${cefrLevel} level`}
                          >
                            <Badge level={badgeLevel}>
                              {cefrLevel}
                              {isOriginal && (
                                <span className="ml-1 text-[10px] opacity-75">
                                  ({typedLang === "es" ? "Original" : "Original"})
                                </span>
                              )}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Processing status for non-ready stories */}
                {story.status === "PROCESSING" && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <p className="text-blue-700 text-sm">
                      {typedLang === "es"
                        ? "Tu historia está siendo procesada. Esto puede tomar unos minutos."
                        : "Your story is being processed. This may take a few minutes."}
                    </p>
                    <div className="mt-3 space-y-2">
                      {story.levels
                        .filter((level) => level.status !== "PENDING")
                        .map((level) => (
                          <div key={level.level} className="flex items-center gap-2 text-xs">
                            {level.status === "READY" ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            ) : level.status === "PROCESSING" ? (
                              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            ) : level.status === "FAILED" ? (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                            )}
                            <span className="text-gray-600">
                              Level {level.level.replace("l", "")}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Failed status message */}
                {story.status === "FAILED" && (
                  <div className="bg-red-50 rounded-lg p-4 mb-6">
                    <p className="text-red-700 text-sm">
                      {typedLang === "es"
                        ? "Hubo un error procesando tu historia. Por favor, intenta subirla de nuevo."
                        : "There was an error processing your story. Please try uploading it again."}
                    </p>
                  </div>
                )}

                {/* Cancelled/Partial status message */}
                {story.status === "CANCELLED" && (
                  <div className={`${hasReadableChapters ? "bg-orange-50" : "bg-gray-50"} rounded-lg p-4 mb-6`}>
                    <p className={`${hasReadableChapters ? "text-orange-700" : "text-gray-700"} text-sm`}>
                      {hasReadableChapters
                        ? t(typedLang, "myStories", "partialMessage")
                        : t(typedLang, "myStories", "cancelledMessage")}
                    </p>
                  </div>
                )}

                {/* Created date */}
                {story.createdAt && (
                  <div className="text-sm text-gray-500">
                    {typedLang === "es" ? "Creado:" : "Created:"}{" "}
                    {new Date(story.createdAt).toLocaleDateString(
                      typedLang === "es" ? "es-ES" : "en-US",
                      { year: "numeric", month: "long", day: "numeric" }
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 z-[102] flex items-center justify-center p-4"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-xl p-6 max-w-sm w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold mb-2">
                    {typedLang === "es" ? "¿Eliminar historia?" : "Delete story?"}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {typedLang === "es"
                      ? "Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar esta historia?"
                      : "This action cannot be undone. Are you sure you want to delete this story?"}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        typedLang === "es" ? "Eliminar" : "Delete"
                      )}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      {typedLang === "es" ? "Cancelar" : "Cancel"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
