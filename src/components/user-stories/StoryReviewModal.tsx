"use client";

import { useState, useRef, useCallback } from "react";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import { toCEFR, getCEFRLabel } from "@/lib/cefr";

const translations = { en, es };

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
  } = useStoryUpload();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const levelLabels: Record<string, string> = {
    A1: t.myStories.levelBeginner,
    A2: t.myStories.levelElementary,
    B1: t.myStories.levelIntermediate,
    B2: t.myStories.levelUpperIntermediate,
    C1: t.myStories.levelAdvanced,
    C2: t.myStories.levelAdvanced, // Use same label for C2
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
                  <div className="relative w-full h-full">
                    <img
                      src={storyData.thumbnailUrl}
                      alt="Story thumbnail"
                      className="w-full h-full object-cover"
                    />
                    {isUploadingThumbnail && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
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
                {toCEFR(storyData.detectedLevel)}
                <span className="text-sm text-gray-500 ml-2">
                  ({levelLabels[toCEFR(storyData.detectedLevel)] || storyData.detectedLevel})
                </span>
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
                <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
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
            disabled={isSubmitting}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {lng === "es" ? "Guardando..." : "Saving..."}
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
    </div>
  );
}
