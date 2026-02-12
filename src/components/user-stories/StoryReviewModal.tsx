"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import { toCEFR, getCEFRLabel } from "@/lib/cefr";
import { StreamSelector } from "./StreamSelector";

const translations = { en, es };

// Story type options
const STORY_TYPES = [
  "short-story", "poem", "fable", "folktale", "novel", "article",
  "dialogue", "song-lyrics", "epic", "myth", "legend", "movie-script", "tv-script"
];

// Target audience options
const TARGET_AUDIENCES = ["all", "children", "teen", "adult"];

// Tag options
const STORY_TAGS = [
  "family", "friendship", "adventure", "mystery", "romance",
  "coming-of-age", "nature", "technology", "travel", "food",
  "humorous", "heartwarming", "suspenseful", "reflective", "inspiring",
  "urban", "rural", "historical", "fantasy", "contemporary",
  "latin-america", "spain", "usa", "multicultural",
  "epic", "mythology", "heroic", "tragedy", "comedy",
  "monsters", "heros-journey", "war", "love", "death", "revenge"
];

// i18n key maps for slug → dictionary key
const TAG_I18N_KEYS: Record<string, string> = {
  "family": "tagFamily", "friendship": "tagFriendship", "adventure": "tagAdventure",
  "mystery": "tagMystery", "romance": "tagRomance", "coming-of-age": "tagComingOfAge",
  "nature": "tagNature", "technology": "tagTechnology", "travel": "tagTravel",
  "food": "tagFood", "humorous": "tagHumorous", "heartwarming": "tagHeartwarming",
  "suspenseful": "tagSuspenseful", "reflective": "tagReflective", "inspiring": "tagInspiring",
  "urban": "tagUrban", "rural": "tagRural", "historical": "tagHistorical",
  "fantasy": "tagFantasy", "contemporary": "tagContemporary", "latin-america": "tagLatinAmerica",
  "spain": "tagSpain", "usa": "tagUsa", "multicultural": "tagMulticultural",
  "epic": "tagEpic", "mythology": "tagMythology", "heroic": "tagHeroic",
  "tragedy": "tagTragedy", "comedy": "tagComedy", "monsters": "tagMonsters",
  "heros-journey": "tagHerosJourney", "war": "tagWar", "love": "tagLove",
  "death": "tagDeath", "revenge": "tagRevenge",
};

const TYPE_I18N_KEYS: Record<string, string> = {
  "short-story": "typeShortStory", "poem": "typePoem", "fable": "typeFable",
  "folktale": "typeFolktale", "novel": "typeNovel", "article": "typeArticle",
  "dialogue": "typeDialogue", "song-lyrics": "typeSongLyrics", "epic": "typeEpic",
  "myth": "typeMyth", "legend": "typeLegend", "movie-script": "typeMovieScript",
  "tv-script": "typeTvScript",
};

const AUDIENCE_I18N_KEYS: Record<string, string> = {
  "all": "audienceAll", "children": "audienceChildren",
  "teen": "audienceTeen", "adult": "audienceAdult",
};

export default function StoryReviewModal() {
  const { lng } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const t = translations[(lng as "en" | "es") || "en"];

  const {
    showReviewModal,
    setShowReviewModal,
    storyData,
    updateStoryData,
    confirmStory,
    progress,
    setShowProgressViewer,
    setSelectedStreamId,
  } = useStoryUpload();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [generatedThumbnailOptions, setGeneratedThumbnailOptions] = useState<{url: string; revisedPrompt?: string}[]>([]);
  const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasPrefetched = useRef(false);

  // Prefetch the story reader page when review modal opens
  // This warms up the route so navigation is faster when user clicks "Start reading"
  useEffect(() => {
    if (!showReviewModal || !storyData?.id || hasPrefetched.current) return;

    // Get the reading level (user's level or detected level)
    const userQuizLevel = session?.user?.quizLevel;
    const userLevel = userQuizLevel ? toCEFR(userQuizLevel) : null;
    const readingLevel = userLevel || toCEFR(storyData.detectedLevel) || "B1";

    // Prefetch the route
    const prefetchUrl = `/${lng}/my-stories/${storyData.id}/${readingLevel}/1/1`;
    router.prefetch(prefetchUrl);

    // Also warm up the content API cache
    fetch(`/api/user-stories/${storyData.id}/content?level=${readingLevel}`, {
      credentials: "include",
    }).catch(() => {
      // Ignore errors - this is just a cache warm-up
    });

    hasPrefetched.current = true;
    console.log("[StoryReviewModal] Prefetching story page:", prefetchUrl);
  }, [showReviewModal, storyData?.id, storyData?.detectedLevel, session?.user?.quizLevel, lng, router]);

  // Handle file upload to Azure
  const handleFile = useCallback(async (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;

    setIsUploadingThumbnail(true);

    // Show preview immediately while uploading
    const previewUrl = URL.createObjectURL(file);
    updateStoryData({ thumbnailUrl: previewUrl });

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (storyData?.id) {
        formData.append("storyId", storyData.id);
      }

      const response = await fetch("/api/upload/thumbnail", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const { url } = await response.json();
      updateStoryData({ thumbnailUrl: url });
      URL.revokeObjectURL(previewUrl); // Clean up preview
    } catch (error: any) {
      console.error("Thumbnail upload failed:", error.message);
      // Keep preview URL as fallback, but it won't persist
    } finally {
      setIsUploadingThumbnail(false);
    }
  }, [updateStoryData, storyData?.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  // Generate AI thumbnail using DALL-E
  const handleGenerateAIThumbnail = useCallback(async () => {
    if (!storyData?.id) return;

    setIsGeneratingThumbnail(true);
    setGeneratedThumbnailOptions([]);

    try {
      const response = await fetch("/api/user-stories/generate-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: storyData.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }

      const { options } = await response.json();
      setGeneratedThumbnailOptions(options);
      setShowThumbnailPicker(true);
    } catch (error: any) {
      console.error("AI thumbnail generation failed:", error.message);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  }, [storyData?.id]);

  // Select and upload generated thumbnail
  const handleSelectGeneratedThumbnail = useCallback(async (imageUrl: string) => {
    if (!storyData?.id) return;

    setIsUploadingThumbnail(true);
    setShowThumbnailPicker(false);

    // Don't set temporary DALL-E URL - it's not configured in Next.js Image
    // The loading overlay will show until Azure upload completes

    try {
      const response = await fetch("/api/user-stories/generate-thumbnail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: storyData.id, imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to save thumbnail");
      }

      const { url } = await response.json();
      // Only set the Azure URL after successful upload
      updateStoryData({ thumbnailUrl: url });
    } catch (error: any) {
      console.error("Failed to save AI thumbnail:", error.message);
    } finally {
      setIsUploadingThumbnail(false);
      setGeneratedThumbnailOptions([]);
    }
  }, [storyData?.id, updateStoryData]);

  // Handle tag toggle
  const handleTagToggle = useCallback((tag: string) => {
    const currentTags = storyData?.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag].slice(0, 5); // Max 5 tags
    updateStoryData({ tags: newTags, tagsDetected: false });
  }, [storyData?.tags, updateStoryData]);

  if (!showReviewModal || !storyData) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await confirmStory();
    setIsSubmitting(false);
    // Don't navigate - user stays where they are
    // Success message with "Start reading" button will show in FloatingProgressWidget
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-green-500 to-emerald-500">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-full">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {lng === "es" ? "¡Historia lista!" : "Story Ready!"}
              </h2>
              <p className="text-sm text-green-100">
                {lng === "es" ? "¿Cómo se ve?" : "How does this look?"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Thumbnail */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-32 h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                  isDragging
                    ? "border-blue-500 bg-blue-100 scale-105"
                    : storyData.thumbnailUrl
                    ? "border-transparent"
                    : "border-gray-300 bg-gray-100 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                {storyData.thumbnailUrl ? (
                  <div className="relative w-full h-full group/thumb">
                    <img
                      src={storyData.thumbnailUrl}
                      alt="Story thumbnail"
                      className="w-full h-full object-cover"
                    />
                    {/* Remove thumbnail button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStoryData({ thumbnailUrl: "" });
                      }}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                      aria-label={lng === "es" ? "Eliminar imagen" : "Remove image"}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {isUploadingThumbnail && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ) : isUploadingThumbnail ? (
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs text-blue-500 mt-2 text-center px-2 font-medium">
                      {lng === "es" ? "Subiendo..." : "Uploading..."}
                    </span>
                  </div>
                ) : isDragging ? (
                  <>
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-xs text-blue-500 mt-2 text-center px-2 font-medium">
                      {lng === "es" ? "Soltar aquí" : "Drop here"}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-400 mt-2 text-center px-2">
                      {lng === "es" ? "Arrastra o haz clic" : "Drag or click"}
                    </span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                className="hidden"
              />
              {/* AI Generate Button */}
              <button
                onClick={handleGenerateAIThumbnail}
                disabled={isGeneratingThumbnail || isUploadingThumbnail}
                className="w-full mt-2 px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-default transition-all flex items-center justify-center gap-1.5"
              >
                {isGeneratingThumbnail ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {lng === "es" ? "Generando..." : "Generating..."}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {lng === "es" ? "Generar con IA" : "Generate with AI"}
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 mt-1 text-center">
                {lng === "es" ? "Opcional" : "Optional"}
              </p>
            </div>

            {/* Title and Description */}
            <div className="flex-1 space-y-4">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    {t.myStories.storyTitle}
                  </label>
                  {storyData.titleGenerated && (
                    <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                      {lng === "es" ? "Auto-generado" : "Auto-generated"}
                    </span>
                  )}
                </div>
                {editingField === "title" ? (
                  <input
                    type="text"
                    value={storyData.title}
                    onChange={(e) => updateStoryData({ title: e.target.value, titleGenerated: false })}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <div
                    onClick={() => setEditingField("title")}
                    className="px-3 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between group"
                  >
                    <span className="font-medium text-gray-800">
                      {storyData.title || (lng === "es" ? "Sin título" : "Untitled")}
                    </span>
                    <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    {t.myStories.description}
                  </label>
                  {storyData.descriptionGenerated && (
                    <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                      {lng === "es" ? "Auto-generado" : "Auto-generated"}
                    </span>
                  )}
                </div>
                {editingField === "description" ? (
                  <textarea
                    value={storyData.description}
                    onChange={(e) => updateStoryData({ description: e.target.value, descriptionGenerated: false })}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    rows={3}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                ) : (
                  <div
                    onClick={() => setEditingField("description")}
                    className="px-3 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors group min-h-[60px]"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-gray-600 text-sm">
                        {storyData.description || (lng === "es" ? "Sin descripción" : "No description")}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detected info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1">
                {lng === "es" ? "Idioma detectado" : "Detected Language"}
              </div>
              <div className="font-medium text-gray-800 flex items-center gap-2">
                <span className="text-lg">
                  {storyData.sourceLanguage === "es" ? "🇪🇸" : "🇺🇸"}
                </span>
                {storyData.sourceLanguage === "es" ? "Español" : "English"}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1">
                {lng === "es" ? "Nivel detectado" : "Detected Level"}
              </div>
              <div className="font-medium text-gray-800">
{getCEFRLabel(toCEFR(storyData.detectedLevel), lng as "en" | "es")}
              </div>
            </div>
          </div>

          {/* What was created */}
          {(() => {
            // Get user's level from session (now stored as CEFR codes)
            const userLevel = session?.user?.quizLevel;
            const userCEFR = userLevel ? toCEFR(userLevel) : null;
            const detectedCEFR = toCEFR(storyData.detectedLevel);
            const wasRewritten = userCEFR && userCEFR !== detectedCEFR;

            return (
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <h4 className="font-medium text-green-800 flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {lng === "es" ? "Lo que se creó" : "What was created"}
                </h4>
                <ul className="space-y-1 text-sm text-green-700">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>
                      {wasRewritten ? (
                        lng === "es"
                          ? `El texto fue transcrito a tu nivel, ${userCEFR}`
                          : `The text was transcribed to your level, ${userCEFR}`
                      ) : (
                        lng === "es"
                          ? "No se necesitó reescritura — ¡El texto original coincide con tu nivel de aprendizaje!"
                          : "No rewrite needed — the source text matched your exact learner level!"
                      )}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {lng === "es" ? "Traducciones en inglés y español" : "English and Spanish translations"}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {lng === "es" ? "Paginación interactiva" : "Interactive pagination"}
                  </li>
                </ul>
              </div>
            );
          })()}

          {/* Preview dropdown - now outside and below the green "what was created" area */}
          {(progress.streams || []).filter((s) => s.status === "complete").length > 0 && (
            <StreamSelector
              streams={progress.streams || []}
              lng={lng as string}
              setShowProgressViewer={setShowProgressViewer}
              isPreviewMode={true}
              storyData={{
                sourceLanguage: storyData.sourceLanguage,
                detectedLevel: storyData.detectedLevel,
              }}
            />
          )}

          {/* Advanced Options (Collapsible) */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-700">
                {lng === "es" ? "Opciones avanzadas" : "Advanced Options"}
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showAdvancedOptions ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAdvancedOptions && (
              <div className="p-4 space-y-4 bg-white">
                {/* Story Type */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      {lng === "es" ? "Tipo de historia" : "Story Type"}
                    </label>
                    {storyData.storyTypeDetected && (
                      <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                        {lng === "es" ? "Auto-detectado" : "Auto-detected"}
                      </span>
                    )}
                  </div>
                  <select
                    value={storyData.storyType || "short-story"}
                    onChange={(e) => updateStoryData({ storyType: e.target.value, storyTypeDetected: false })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    {STORY_TYPES.map(type => (
                      <option key={type} value={type}>
                        {TYPE_I18N_KEYS[type] ? t.myStories[TYPE_I18N_KEYS[type] as keyof typeof t.myStories] : type.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Audience */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      {lng === "es" ? "Audiencia objetivo" : "Target Audience"}
                    </label>
                    {storyData.targetAudienceDetected && (
                      <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                        {lng === "es" ? "Auto-detectado" : "Auto-detected"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_AUDIENCES.map(audience => (
                      <button
                        key={audience}
                        onClick={() => updateStoryData({ targetAudience: audience, targetAudienceDetected: false })}
                        className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                          storyData.targetAudience === audience
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {AUDIENCE_I18N_KEYS[audience] ? t.myStories[AUDIENCE_I18N_KEYS[audience] as keyof typeof t.myStories] : audience.charAt(0).toUpperCase() + audience.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      {lng === "es" ? "Etiquetas (máx. 5)" : "Tags (max 5)"}
                    </label>
                    {storyData.tagsDetected && (
                      <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                        {lng === "es" ? "Auto-detectadas" : "Auto-detected"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                    {STORY_TAGS.map(tag => {
                      const isSelected = storyData.tags?.includes(tag);
                      const canSelect = isSelected || (storyData.tags?.length || 0) < 5;
                      return (
                        <button
                          key={tag}
                          onClick={() => canSelect && handleTagToggle(tag)}
                          disabled={!canSelect}
                          className={`px-2 py-1 text-xs rounded-full transition-colors ${
                            isSelected
                              ? "bg-emerald-500 text-white"
                              : canSelect
                              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              : "bg-gray-50 text-gray-300 cursor-default"
                          }`}
                        >
                          {TAG_I18N_KEYS[tag] ? t.myStories[TAG_I18N_KEYS[tag] as keyof typeof t.myStories] : tag.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hook/Teaser */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      {lng === "es" ? "Gancho/Teaser" : "Hook/Teaser"}
                    </label>
                    {storyData.hookDetected && (
                      <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                        {lng === "es" ? "Auto-generado" : "Auto-generated"}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={storyData.hook || ""}
                    onChange={(e) => updateStoryData({ hook: e.target.value, hookDetected: false })}
                    placeholder={lng === "es" ? "Un gancho corto para atraer lectores..." : "A short hook to draw readers in..."}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {lng === "es" ? "Máximo 15 palabras" : "Maximum 15 words"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            onClick={() => setShowReviewModal(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            {lng === "es" ? "Revisar después" : "Review later"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || isUploadingThumbnail}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-default transition-all flex items-center gap-2"
          >
            {isSubmitting || isUploadingThumbnail ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isUploadingThumbnail
                  ? (lng === "es" ? "Subiendo imagen..." : "Uploading image...")
                  : (lng === "es" ? "Guardando..." : "Saving...")}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {lng === "es" ? "¡Se ve bien!" : "Looks good!"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI Thumbnail Picker Modal */}
      {showThumbnailPicker && generatedThumbnailOptions.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowThumbnailPicker(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {lng === "es" ? "Elige una imagen" : "Choose an image"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {generatedThumbnailOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectGeneratedThumbnail(option.url)}
                  className="group relative aspect-[2/3] rounded-xl overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all"
                >
                  <img
                    src={option.url}
                    alt={`Option ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-800 transition-opacity">
                      {lng === "es" ? "Seleccionar" : "Select"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowThumbnailPicker(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                {lng === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button
                onClick={handleGenerateAIThumbnail}
                disabled={isGeneratingThumbnail}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {lng === "es" ? "Regenerar" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
