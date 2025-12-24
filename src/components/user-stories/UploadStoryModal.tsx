"use client";

import { useState, useRef } from "react";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useParams } from "next/navigation";
import en from "@/content/ui/en";
import es from "@/content/ui/es";

const translations = { en, es };

export default function UploadStoryModal() {
  const { lng } = useParams();
  const t = translations[(lng as "en" | "es") || "en"];

  const { showUploadModal, setShowUploadModal, startUpload, isUploading } = useStoryUpload();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [showTitleField, setShowTitleField] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!showUploadModal) return null;

  const handleSubmit = async () => {
    setError("");

    // Validate content
    if (!content.trim()) {
      setError(lng === "es" ? "Por favor pega o escribe tu historia" : "Please paste or type your story");
      textareaRef.current?.focus();
      return;
    }

    if (content.trim().length < 100) {
      setError(t.myStories.storyTooShort);
      return;
    }

    // Start the upload
    await startUpload(content.trim(), title.trim() || undefined);

    // Reset form
    setContent("");
    setTitle("");
    setShowTitleField(false);
  };

  const handleClose = () => {
    if (!isUploading) {
      setShowUploadModal(false);
      setContent("");
      setTitle("");
      setShowTitleField(false);
      setError("");
    }
  };

  const characterCount = content.length;
  const maxCharacters = 50000; // Premium limit, we'll check actual limit on backend

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {t.myStories.uploadStory}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {lng === "es"
                ? "Pega tu historia y la convertiremos en contenido de aprendizaje"
                : "Paste your story and we'll turn it into learning content"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Optional title field */}
          {showTitleField ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.myStories.storyTitle}
                <span className="text-gray-400 font-normal ml-2">
                  ({lng === "es" ? "opcional" : "optional"})
                </span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lng === "es" ? "Dejar vacío para auto-detectar" : "Leave empty to auto-detect"}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowTitleField(true)}
              className="mb-4 text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {lng === "es" ? "Añadir título (opcional)" : "Add title (optional)"}
            </button>
          )}

          {/* Main text area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.myStories.storyContentPlaceholder}
              className="w-full h-64 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-gray-800"
            />

            {/* Character count */}
            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
              {characterCount.toLocaleString()} / {maxCharacters.toLocaleString()} {t.myStories.characterCount}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          )}

          {/* Info box */}
          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <h4 className="font-medium text-blue-800 mb-2">
              {t.myStories.whatHappensNext}
            </h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">1.</span>
                {t.myStories.step1}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">2.</span>
                {t.myStories.step2}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">3.</span>
                {t.myStories.step3}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">4.</span>
                {t.myStories.step4}
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            {t.myStories.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUploading || !content.trim()}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t.myStories.uploading}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t.myStories.uploadButton}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
