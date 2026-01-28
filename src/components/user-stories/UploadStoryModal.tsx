// src/components/user-stories/UploadStoryModal.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { X, Upload, FileText, AlertCircle, ChevronDown, ChevronUp, File, Trash2, Info } from "lucide-react";
import { USER_STORY_LIMITS } from "@/lib/user-stories/limits";
import {
  extractTextFromHTML,
  stripRTF,
  isAcceptedFile,
  SUPPORTED_FILE_TYPES,
} from "@/lib/admin/text-utils";
import en from "@/content/ui/en";
import es from "@/content/ui/es";

const translations = { en, es };

interface StoryStats {
  totalStories: number;
  maxStories: number;
  maxStoryLength: number;
  dailyLimit: number;
  storiesProcessedToday: number;
  isFirstStoryThisMonth: boolean;
  isPremium: boolean;
}

export default function UploadStoryModal() {
  const { lng } = useParams();
  const t = translations[(lng as "en" | "es") || "en"];
  const { data: session } = useSession();

  const { showUploadModal, setShowUploadModal, startUpload, isUploading } = useStoryUpload();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [structureType, setStructureType] = useState<"auto" | "prose" | "anthology" | "epic" | "script">("auto");
  const [processingMode, setProcessingMode] = useState<"original_only" | "rewritten_only" | "both">("both");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<StoryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // File upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user stats when modal opens
  useEffect(() => {
    if (showUploadModal && session?.user) {
      setLoadingStats(true);
      fetch("/api/user-stories/count")
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch stats");
          }
          return res.json();
        })
        .then((data) => {
          // Validate that we got actual stats, not an error object
          if (data && typeof data.totalStories === "number") {
            setStats(data);
          } else {
            console.error("Invalid stats response:", data);
            setStats(null);
          }
        })
        .catch((err) => {
          console.error("Error fetching story stats:", err);
          setStats(null);
        })
        .finally(() => setLoadingStats(false));
    }
  }, [showUploadModal, session?.user]);

  // Reset form when modal closes
  useEffect(() => {
    if (!showUploadModal) {
      setContent("");
      setTitle("");
      setDescription("");
      setStructureType("auto");
      setProcessingMode("both");
      setShowAdvanced(false);
      setError("");
      setUploadedFileName(null);
      setIsDragging(false);
    }
  }, [showUploadModal]);


  // Determine input mode: 'file' if file uploaded, 'text' if text entered, 'none' if empty
  const inputMode = uploadedFileName ? "file" : content.trim() ? "text" : "none";

  // File handling functions
  const handleFileRead = async (file: File) => {
    try {
      let text = await file.text();
      const fileName = file.name.toLowerCase();

      // Convert HTML to plain text, preserving whitespace for poetry
      if (fileName.endsWith(".html") || fileName.endsWith(".htm") || file.type === "text/html") {
        const result = extractTextFromHTML(text, { preserveWhitespace: true });
        text = result.text;
      }

      // RTF basic handling - strip RTF codes
      if (fileName.endsWith(".rtf") || file.type === "application/rtf") {
        text = stripRTF(text);
      }

      setContent(text);
      setUploadedFileName(file.name);
      setError("");
    } catch (err) {
      setError(t.myStories.errorReadingFile);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isAcceptedFile(file)) {
      handleFileRead(file);
    } else if (file) {
      setError(
        t.myStories.unsupportedFileType.replace("{types}", SUPPORTED_FILE_TYPES.map((ft) => ft.ext).join(", "))
      );
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isAcceptedFile(file)) {
        handleFileRead(file);
      } else {
        setError(
          t.myStories.unsupportedFileType.replace("{types}", SUPPORTED_FILE_TYPES.map((ft) => ft.ext).join(", "))
        );
      }
    }
  };

  const handleRemoveFile = () => {
    setUploadedFileName(null);
    setContent("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // If user starts typing, clear any uploaded file reference
    if (uploadedFileName) {
      setUploadedFileName(null);
    }
  };

  if (!showUploadModal) return null;

  const isPremium = stats?.isPremium ?? false;
  // maxStoryLength from stats already accounts for first-of-month bonus
  const maxLength = stats?.maxStoryLength ?? USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH;

  const charCount = content.length;
  const isOverLimit = charCount > maxLength;
  const percentUsed = Math.min((charCount / maxLength) * 100, 100);

  // Check if user can upload (-1 means unlimited)
  const canUpload = stats
    ? (stats.maxStories === -1 || stats.totalStories < stats.maxStories) &&
      (stats.dailyLimit === -1 || stats.storiesProcessedToday < stats.dailyLimit)
    : true;

  const handleSubmit = async () => {
    setError("");

    // Validate content
    if (!content.trim()) {
      setError(t.myStories.pleaseEnterStory);
      textareaRef.current?.focus();
      return;
    }

    if (content.trim().length < 100) {
      setError(t.myStories.storyTooShort);
      return;
    }

    if (isOverLimit) {
      setError(
        t.myStories.storyExceedsLimit.replace("{max}", maxLength.toLocaleString())
      );
      return;
    }

    // Start the upload with all options (language is auto-detected by the pipeline)
    await startUpload({
      content: content.trim(),
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      structureType: structureType,
      processingMode: processingMode,
    });
  };

  const handleClose = () => {
    if (!isUploading) {
      setShowUploadModal(false);
    }
  };

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
              {t.myStories.uploadSubtitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Stats / Limits indicator */}
          {loadingStats ? (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ) : stats && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {t.myStories.storiesCount}{" "}
                <span className="font-medium">{stats.totalStories} / {stats.maxStories === -1 ? "∞" : stats.maxStories}</span>
              </span>
              {/* Only show daily limit if there is one (not -1 unlimited) */}
              {!isPremium && stats.dailyLimit !== -1 && (
                <span className="text-gray-500">
                  {t.myStories.todayCount}{" "}
                  <span className="font-medium">{stats.storiesProcessedToday} / {stats.dailyLimit}</span>
                </span>
              )}
            </div>
          )}

          {/* Limit reached warning */}
          {stats && !canUpload && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <h3 className="font-medium text-yellow-800 mb-1">
                {stats.maxStories !== -1 && stats.totalStories >= stats.maxStories
                  ? t.myStories.storyLimitReached
                  : t.myStories.dailyLimitReached}
              </h3>
              <p className="text-sm text-yellow-700">
                {stats.maxStories !== -1 && stats.totalStories >= stats.maxStories
                  ? t.myStories.storyLimitMessage.replace("{max}", String(stats.maxStories))
                  : t.myStories.dailyLimitMessage}
                {!isPremium && (
                  <a href={`/${lng}/premium`} className="ml-1 text-yellow-800 underline hover:no-underline">
                    {t.myStories.upgradeToPremium}
                  </a>
                )}
              </p>
            </div>
          )}

          {canUpload && (
            <>
              {/* Content Type Selector - badge buttons */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  {t.myStories.contentType}
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 text-xs text-white bg-gray-800 rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity z-10">
                      {t.myStories.contentTypeDescription}
                    </span>
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "auto", label: t.myStories.contentTypeAuto },
                    { value: "prose", label: t.myStories.contentTypeProse },
                    { value: "anthology", label: t.myStories.contentTypePoetry },
                    { value: "epic", label: t.myStories.contentTypeEpic },
                    { value: "script", label: t.myStories.contentTypeScript },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStructureType(option.value as typeof structureType)}
                      disabled={isUploading}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        structureType === option.value
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {structureType === "auto" && t.myStories.contentTypeHintAuto}
                  {structureType === "prose" && t.myStories.contentTypeHintProse}
                  {structureType === "anthology" && t.myStories.contentTypeHintPoetry}
                  {structureType === "epic" && t.myStories.contentTypeHintEpic}
                  {structureType === "script" && t.myStories.contentTypeHintScript}
                </p>
              </div>

              {/* Processing Mode Selector - badge buttons */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  {t.myStories.processingMode}
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 text-xs text-white bg-gray-800 rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity z-10">
                      {t.myStories.processingModeDescription}
                    </span>
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "both" as const, label: t.myStories.processingModeBoth },
                    { value: "original_only" as const, label: t.myStories.processingModeOriginal },
                    { value: "rewritten_only" as const, label: t.myStories.processingModeRewritten },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setProcessingMode(option.value)}
                      disabled={isUploading}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        processingMode === option.value
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {processingMode === "both" && t.myStories.processingModeHintBoth}
                  {processingMode === "original_only" && t.myStories.processingModeHintOriginal}
                  {processingMode === "rewritten_only" && t.myStories.processingModeHintRewritten}
                </p>
              </div>

              {/* Story content input area */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.myStories.storyContent}
                </label>

                {/* File uploaded state - show file info with remove option */}
                {inputMode === "file" && (
                  <div className="mb-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <File className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-green-800">{uploadedFileName}</p>
                          <p className="text-sm text-green-600">
                            {content.length.toLocaleString()} {t.myStories.characters}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        disabled={isUploading}
                        className="p-2 text-green-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title={t.myStories.removeFile}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    {/* Character limit indicator for file */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-green-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isOverLimit ? "bg-red-500" : percentUsed > 80 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                      <span className={`text-xs ${isOverLimit ? "text-red-500 font-medium" : "text-green-600"}`}>
                        {charCount.toLocaleString()} / {maxLength.toLocaleString()}
                      </span>
                    </div>
                    {isOverLimit && (
                      <p className="text-xs text-red-600 mt-2">
                        {t.myStories.fileExceedsLimit}
                      </p>
                    )}
                  </div>
                )}

                {/* File drop zone - show when no file and no text */}
                {inputMode === "none" && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`mb-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.html,.htm,.rtf,text/plain,text/html,application/rtf"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <div className="text-gray-500">
                      <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm font-medium">
                        {t.myStories.dropFileHere}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {t.myStories.supportedFormats}
                      </p>
                    </div>
                  </div>
                )}

                {/* Divider - show when no file and no text */}
                {inputMode === "none" && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 uppercase">
                      {t.myStories.orPasteText}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}

                {/* Text area - show when no file uploaded (either empty or has text) */}
                {inputMode !== "file" && (
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={handleTextChange}
                      placeholder={t.myStories.storyContentPlaceholder}
                      className={`w-full h-48 px-4 py-3 border rounded-xl focus:ring-2 focus:outline-none resize-none text-gray-800 font-mono text-sm ${
                        isOverLimit
                          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                          : "border-gray-200 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                      disabled={isUploading}
                    />

                    {/* Character count with progress bar */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isOverLimit ? "bg-red-500" : percentUsed > 80 ? "bg-yellow-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                      <span className={`text-xs ${isOverLimit ? "text-red-500 font-medium" : "text-gray-400"}`}>
                        {charCount.toLocaleString()} / {maxLength.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tier info - only show when not in file mode */}
                {!isPremium && inputMode !== "file" && (
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.isFirstStoryThisMonth ? (
                      t.myStories.firstStoryBonus.replace("{max}", maxLength.toLocaleString())
                    ) : (
                      <>
                        {t.myStories.freeTierLimit.replace("{max}", maxLength.toLocaleString())}{" "}
                        <a href={`/${lng}/premium`} className="text-blue-600 hover:underline">
                          {t.myStories.upgradeForMore}
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Advanced options toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {t.myStories.advancedOptions}
              </button>

              {/* Advanced fields */}
              {showAdvanced && (
                <div className="space-y-4 mb-4 p-4 bg-gray-50 rounded-xl">
                  {/* Title field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.myStories.storyTitle}
                      <span className="text-gray-400 font-normal ml-2">
                        ({t.myStories.titleOptional})
                      </span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t.myStories.titlePlaceholder}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      disabled={isUploading}
                    />
                  </div>

                  {/* Description field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.myStories.descriptionLabel}
                      <span className="text-gray-400 font-normal ml-2">
                        ({t.myStories.descriptionOptional})
                      </span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t.myStories.descriptionPlaceholder}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      disabled={isUploading}
                    />
                  </div>

                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Info box */}
              <div className="p-4 bg-blue-50 rounded-xl">
                <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            {t.myStories.cancel}
          </button>
          {canUpload && (
            <button
              onClick={handleSubmit}
              disabled={isUploading || !content.trim() || content.trim().length < 100 || isOverLimit}
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
                  <Upload className="w-4 h-4" />
                  {t.myStories.uploadButton}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
