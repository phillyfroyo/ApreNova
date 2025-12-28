// src/components/user-stories/UploadStoryModal.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { X, Upload, FileText, AlertCircle, ChevronDown, ChevronUp, File, Trash2 } from "lucide-react";
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
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch(() => setStats(null))
        .finally(() => setLoadingStats(false));
    }
  }, [showUploadModal, session?.user]);

  // Reset form when modal closes
  useEffect(() => {
    if (!showUploadModal) {
      setContent("");
      setTitle("");
      setDescription("");
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

      // Convert HTML to plain text
      if (fileName.endsWith(".html") || fileName.endsWith(".htm") || file.type === "text/html") {
        const result = extractTextFromHTML(text);
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
      setError(lng === "es" ? "Error al leer el archivo" : "Error reading file");
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
        lng === "es"
          ? `Tipo de archivo no soportado. Aceptados: ${SUPPORTED_FILE_TYPES.map((t) => t.ext).join(", ")}`
          : `Unsupported file type. Accepted: ${SUPPORTED_FILE_TYPES.map((t) => t.ext).join(", ")}`
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
          lng === "es"
            ? `Tipo de archivo no soportado. Aceptados: ${SUPPORTED_FILE_TYPES.map((t) => t.ext).join(", ")}`
            : `Unsupported file type. Accepted: ${SUPPORTED_FILE_TYPES.map((t) => t.ext).join(", ")}`
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
  const maxLength = isPremium
    ? USER_STORY_LIMITS.PREMIUM_MAX_STORY_LENGTH
    : USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH;

  const charCount = content.length;
  const isOverLimit = charCount > maxLength;
  const percentUsed = Math.min((charCount / maxLength) * 100, 100);

  // Check if user can upload (-1 means unlimited)
  const canUpload = stats
    ? (stats.maxStories === -1 || stats.totalStories < stats.maxStories) && stats.storiesProcessedToday < stats.dailyLimit
    : true;

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

    if (isOverLimit) {
      setError(
        lng === "es"
          ? `La historia excede el límite de ${maxLength.toLocaleString()} caracteres.`
          : `Story exceeds the ${maxLength.toLocaleString()} character limit.`
      );
      return;
    }

    // Start the upload with all options (language is auto-detected by the pipeline)
    await startUpload({
      content: content.trim(),
      title: title.trim() || undefined,
      description: description.trim() || undefined,
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
              {lng === "es"
                ? "Pega tu historia y la convertiremos en contenido de aprendizaje"
                : "Paste your story and we'll turn it into learning content"}
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
                {lng === "es" ? "Historias:" : "Stories:"}{" "}
                <span className="font-medium">{stats.totalStories} / {stats.maxStories === -1 ? "∞" : stats.maxStories}</span>
              </span>
              {!isPremium && (
                <span className="text-gray-500">
                  {lng === "es" ? "Hoy:" : "Today:"}{" "}
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
                  ? (lng === "es" ? "Límite de historias alcanzado" : "Story limit reached")
                  : (lng === "es" ? "Límite diario alcanzado" : "Daily limit reached")}
              </h3>
              <p className="text-sm text-yellow-700">
                {stats.maxStories !== -1 && stats.totalStories >= stats.maxStories
                  ? (lng === "es"
                      ? `Has alcanzado el máximo de ${stats.maxStories} historias.`
                      : `You've reached the maximum of ${stats.maxStories} stories.`)
                  : (lng === "es"
                      ? "Has usado tu límite diario de subidas. ¡Intenta de nuevo mañana!"
                      : "You've used your daily upload limit. Try again tomorrow!")}
                {!isPremium && (
                  <a href={`/${lng}/premium`} className="ml-1 text-yellow-800 underline hover:no-underline">
                    {lng === "es" ? "Mejora a Premium" : "Upgrade to Premium"}
                  </a>
                )}
              </p>
            </div>
          )}

          {canUpload && (
            <>
              {/* Story content input area */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {lng === "es" ? "Contenido de la historia" : "Story content"}
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
                            {content.length.toLocaleString()} {lng === "es" ? "caracteres" : "characters"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        disabled={isUploading}
                        className="p-2 text-green-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title={lng === "es" ? "Eliminar archivo" : "Remove file"}
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
                        {lng === "es"
                          ? "El archivo excede el límite de caracteres. Por favor usa un archivo más corto."
                          : "File exceeds character limit. Please use a shorter file."}
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
                        {lng === "es" ? "Arrastra un archivo aquí o haz clic" : "Drop a file here or click to browse"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {lng === "es" ? "Soporta: .txt, .html, .rtf" : "Supports: .txt, .html, .rtf"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Divider - show when no file and no text */}
                {inputMode === "none" && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 uppercase">
                      {lng === "es" ? "o pega tu texto" : "or paste your text"}
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

                {/* Premium upsell - only show when not in file mode */}
                {!isPremium && inputMode !== "file" && (
                  <p className="text-xs text-gray-500 mt-1">
                    {lng === "es"
                      ? `Límite gratuito: ${USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH.toLocaleString()} caracteres.`
                      : `Free tier: ${USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH.toLocaleString()} characters.`}{" "}
                    <a href={`/${lng}/premium`} className="text-blue-600 hover:underline">
                      {lng === "es" ? "Mejora para más" : "Upgrade for more"}
                    </a>
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
                {lng === "es" ? "Opciones avanzadas" : "Advanced options"}
              </button>

              {/* Advanced fields */}
              {showAdvanced && (
                <div className="space-y-4 mb-4 p-4 bg-gray-50 rounded-xl">
                  {/* Title field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.myStories.storyTitle}
                      <span className="text-gray-400 font-normal ml-2">
                        ({lng === "es" ? "opcional - se auto-detectará" : "optional - will be auto-detected"})
                      </span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={lng === "es" ? "Dejar vacío para auto-detectar" : "Leave empty to auto-detect"}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      disabled={isUploading}
                    />
                  </div>

                  {/* Description field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {lng === "es" ? "Descripción" : "Description"}
                      <span className="text-gray-400 font-normal ml-2">
                        ({lng === "es" ? "opcional - se generará automáticamente" : "optional - will be auto-generated"})
                      </span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={lng === "es" ? "Una breve descripción de tu historia..." : "A brief description of your story..."}
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
