// src/components/user-stories/StoryUploadForm.tsx
"use client";

import { useState } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { USER_STORY_LIMITS } from "@/lib/user-stories/limits";

interface StoryUploadFormProps {
  isPremium: boolean;
  onSubmit: (data: {
    title: string;
    content: string;
    sourceLanguage: "en" | "es";
    description?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export default function StoryUploadForm({
  isPremium,
  onSubmit,
  isSubmitting,
}: StoryUploadFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<"en" | "es">("es");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const maxLength = isPremium
    ? USER_STORY_LIMITS.PREMIUM_MAX_STORY_LENGTH
    : USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH;

  const charCount = content.length;
  const isOverLimit = charCount > maxLength;
  const percentUsed = Math.min((charCount / maxLength) * 100, 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter a title for your story.");
      return;
    }

    if (content.length < 100) {
      setError("Story is too short. Please provide at least 100 characters.");
      return;
    }

    if (isOverLimit) {
      setError(`Story exceeds the ${maxLength.toLocaleString()} character limit.`);
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        sourceLanguage,
        description: description.trim() || undefined,
      });
    } catch (err: any) {
      setError(err.message || "Failed to upload story. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Story Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter your story title..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          disabled={isSubmitting}
        />
      </div>

      {/* Source Language */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Source Language
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sourceLanguage"
              value="es"
              checked={sourceLanguage === "es"}
              onChange={() => setSourceLanguage("es")}
              className="w-4 h-4 text-blue-600"
              disabled={isSubmitting}
            />
            <span>Spanish</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sourceLanguage"
              value="en"
              checked={sourceLanguage === "en"}
              onChange={() => setSourceLanguage("en")}
              className="w-4 h-4 text-blue-600"
              disabled={isSubmitting}
            />
            <span>English</span>
          </label>
        </div>
      </div>

      {/* Content */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Story Content
        </label>
        <div className="relative">
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or type your story here...

Use '---' on a new line to mark chapter breaks."
            rows={12}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none resize-none font-mono text-sm ${
              isOverLimit
                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            }`}
            disabled={isSubmitting}
          />

          {/* Character count indicator */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isOverLimit ? "bg-red-500" : percentUsed > 80 ? "bg-yellow-500" : "bg-blue-500"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <span
              className={`text-xs ${isOverLimit ? "text-red-500 font-medium" : "text-gray-400"}`}
            >
              {charCount.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {!isPremium && (
            <span>
              Free tier: {USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH.toLocaleString()} characters max.{" "}
              <a href="/premium" className="text-blue-600 hover:underline">
                Upgrade for more
              </a>
            </span>
          )}
        </p>
      </div>

      {/* Description (optional) */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of your story..."
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          disabled={isSubmitting}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting || isOverLimit || !title.trim() || content.length < 100}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            Upload Story
          </>
        )}
      </button>

      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          What happens next?
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. We&apos;ll detect the difficulty level of your text</li>
          <li>2. AI will rewrite your story at all 5 CEFR levels</li>
          <li>3. Each level will be translated to both languages</li>
          <li>4. Your story will be ready to read in 2-3 minutes</li>
        </ul>
      </div>
    </form>
  );
}
