"use client";

import { useState, useEffect } from "react";
import type { StoryType, ContentStructureType, DigitalLibrarySource } from "@/types/story";
import type { StoryData } from "../../types";
import { FormAttribution, createEmptyFormAttribution } from "@/lib/admin/attribution-helpers";
import {
  ALL_STORY_TYPES,
  ALL_STORY_TAGS,
  STORY_TYPE_LABELS,
  STORY_TAG_LABELS,
  STORY_METADATA,
} from "@/lib/stories";

// Track existing slugs for validation
const existingSlugs = new Set(STORY_METADATA.map(s => s.slug));
const isSlugTaken = (slug: string) => slug.length > 0 && existingSlugs.has(slug);

interface Step3MetadataProps {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
}

export function Step3Metadata({
  storyData,
  updateStoryData,
}: Step3MetadataProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Track generating state per type (allows parallel generation)
  const [generatingTypes, setGeneratingTypes] = useState<Set<"title" | "description" | "image" | "background">>(new Set());
  const [error, setError] = useState("");

  // AI prompt inputs
  const [titlePrompt, setTitlePrompt] = useState("");
  const [descriptionPrompt, setDescriptionPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [backgroundPrompt, setBackgroundPrompt] = useState("");

  // AI Attribution Parser state
  const [frontMatterText, setFrontMatterText] = useState("");
  const [isParsingAttribution, setIsParsingAttribution] = useState(false);
  const [parseError, setParseError] = useState("");
  const [isAttributionParserOpen, setIsAttributionParserOpen] = useState(false);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");

  // Generated options
  const [titleOptions, setTitleOptions] = useState<Array<{ en: string; es: string }>>([]);
  const [descriptionOptions, setDescriptionOptions] = useState<Array<{ en: string; es: string }>>([]);
  const [imageOptions, setImageOptions] = useState<Array<{ url: string; revisedPrompt?: string }>>([]);
  const [backgroundOptions, setBackgroundOptions] = useState<Array<{ url: string; revisedPrompt?: string }>>([]);

  // Bundled metadata options
  const [bundleOptions, setBundleOptions] = useState<Array<{
    title: { en: string; es: string };
    displayTitle: { en: string; es: string };
    slug: string;
    hook: { en: string; es: string };
  }>>([]);
  const [isGeneratingBundle, setIsGeneratingBundle] = useState(false);

  const isGenerating = (type: "title" | "description" | "image" | "background") => generatingTypes.has(type);
  const isAnyGenerating = generatingTypes.size > 0 || isGeneratingBundle;

  // Auto-fill frontMatter from preprocessing if available
  useEffect(() => {
    if (storyData.parsedResult?.frontMatter && !frontMatterText) {
      setFrontMatterText(storyData.parsedResult.frontMatter);
    }
  }, [storyData.parsedResult?.frontMatter, frontMatterText]);

  // Auto-generate slug from English title
  useEffect(() => {
    if (storyData.title.en && !storyData.slug) {
      const generatedSlug = storyData.title.en
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
        .replace(/\s+/g, "-")          // Replace spaces with hyphens
        .replace(/-+/g, "-")           // Collapse multiple hyphens
        .replace(/^-|-$/g, "")         // Remove leading/trailing hyphens
        .slice(0, 50);                 // Limit length
      updateStoryData({ slug: generatedSlug });
    }
  }, [storyData.title.en, storyData.slug, updateStoryData]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      updateStoryData({
        thumbnailFile: file,
        thumbnailPreview: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeThumbnail = () => {
    updateStoryData({
      thumbnailFile: null,
      thumbnailPreview: null,
    });
    setImageOptions([]);
  };

  const generateMetadata = async (type: "title" | "description" | "image" | "background") => {
    // Add this type to the generating set
    setGeneratingTypes(prev => new Set(prev).add(type));
    setError("");

    const customPrompt =
      type === "title" ? titlePrompt :
      type === "description" ? descriptionPrompt :
      type === "image" ? imagePrompt :
      backgroundPrompt;

    try {
      const response = await fetch("/api/admin/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: storyData.rawText,
          sourceLanguage: storyData.sourceLanguage,
          type,
          customPrompt: customPrompt || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate");
      }

      if (type === "title") {
        setTitleOptions(data.options);
      } else if (type === "description") {
        setDescriptionOptions(data.options);
      } else if (type === "image") {
        setImageOptions(data.options);
      } else if (type === "background") {
        setBackgroundOptions(data.options);
      }
    } catch (err) {
      setError(`Failed to generate ${type}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      // Remove this type from the generating set
      setGeneratingTypes(prev => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  };

  // Generate all metadata in parallel
  const generateAll = async () => {
    const types: Array<"title" | "description" | "image" | "background"> = [];

    // Only generate what hasn't been set yet
    if (!storyData.title.en && !storyData.title.es && titleOptions.length === 0) {
      types.push("title");
    }
    if (!storyData.description.en && !storyData.description.es && descriptionOptions.length === 0) {
      types.push("description");
    }
    if (!storyData.thumbnailPreview && imageOptions.length === 0) {
      types.push("image");
    }
    if (!storyData.backgroundPreview && backgroundOptions.length === 0) {
      types.push("background");
    }

    if (types.length === 0) return;

    // Fire all requests in parallel
    await Promise.all(types.map(type => generateMetadata(type)));
  };

  // Generate bundled metadata (title, displayTitle, slug, hook in one call)
  const generateBundleMetadata = async () => {
    setIsGeneratingBundle(true);
    setError("");

    try {
      const response = await fetch("/api/admin/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: storyData.rawText,
          sourceLanguage: storyData.sourceLanguage,
          type: "bundle",
          frontMatter: storyData.parsedResult?.frontMatter,
          customPrompt: titlePrompt || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate metadata bundle");
      }

      setBundleOptions(data.options);
    } catch (err) {
      setError(`Failed to generate metadata: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsGeneratingBundle(false);
    }
  };

  // Select a bundle option and apply all fields
  const selectBundle = (option: {
    title: { en: string; es: string };
    displayTitle: { en: string; es: string };
    slug: string;
    hook: { en: string; es: string };
  }) => {
    updateStoryData({
      title: option.title,
      displayTitle: option.displayTitle,
      slug: option.slug,
      hook: option.hook,
    });
    setBundleOptions([]);
  };

  const selectTitle = (option: { en: string; es: string }) => {
    updateStoryData({ title: option });
    setTitleOptions([]);
  };

  const selectDescription = (option: { en: string; es: string }) => {
    // AI-generated descriptions are short hooks, so fill the hook field
    updateStoryData({ hook: option });
    setDescriptionOptions([]);
  };

  const selectImage = async (imageUrl: string) => {
    // Use proxy endpoint to fetch image (bypasses CORS from DALL-E Azure blob storage)
    try {
      const response = await fetch("/api/admin/proxy-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const data = await response.json();
      const dataUrl = data.dataUrl;

      // Convert data URL to blob for the File object
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      updateStoryData({
        thumbnailFile: new File([blob], "ai-generated-thumbnail.png", { type: "image/png" }),
        thumbnailPreview: dataUrl,
      });
      setImageOptions([]);
    } catch (err) {
      setError("Failed to select image");
    }
  };

  const selectBackground = async (imageUrl: string) => {
    // Use proxy endpoint to fetch image (bypasses CORS from DALL-E Azure blob storage)
    try {
      const response = await fetch("/api/admin/proxy-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const data = await response.json();
      const dataUrl = data.dataUrl;

      // Convert data URL to blob for the File object
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      updateStoryData({
        backgroundFile: new File([blob], "ai-generated-background.png", { type: "image/png" }),
        backgroundPreview: dataUrl,
      });
      setBackgroundOptions([]);
    } catch (err) {
      setError("Failed to select background");
    }
  };

  // Parse front matter with AI to extract attribution
  const parseAttributionWithAI = async () => {
    if (!frontMatterText.trim()) {
      setParseError("Please paste the front matter text first");
      return;
    }

    setIsParsingAttribution(true);
    setParseError("");

    try {
      const response = await fetch("/api/admin/parse-attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frontMatterText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse attribution");
      }

      // Merge the parsed attribution with defaults
      const parsedAttribution: FormAttribution = {
        ...createEmptyFormAttribution(),
        ...data.attribution,
      };

      // Update story data - set isOriginal to false since we're adding attribution
      updateStoryData({
        isOriginal: false,
        attribution: parsedAttribution,
      });

      // Clear the front matter text on success
      setFrontMatterText("");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse attribution");
    } finally {
      setIsParsingAttribution(false);
    }
  };

  // Translate metadata between English and Spanish
  const translateMetadata = async (
    direction: "en-to-es" | "es-to-en",
    fields: Array<"title" | "hook" | "description">
  ) => {
    setIsTranslating(true);
    setTranslationError("");

    const sourceKey = direction === "en-to-es" ? "en" : "es";
    const targetKey = direction === "en-to-es" ? "es" : "en";
    const targetLang = direction === "en-to-es" ? "Spanish" : "English";

    // Collect texts to translate
    const textsToTranslate: Array<{ field: string; text: string }> = [];

    for (const field of fields) {
      let sourceText = "";
      if (field === "title") sourceText = storyData.title[sourceKey];
      else if (field === "hook") sourceText = storyData.hook?.[sourceKey] ?? "";
      else if (field === "description") sourceText = storyData.description[sourceKey];

      if (sourceText.trim()) {
        textsToTranslate.push({ field, text: sourceText });
      }
    }

    if (textsToTranslate.length === 0) {
      setTranslationError(`No ${direction === "en-to-es" ? "English" : "Spanish"} text to translate`);
      setIsTranslating(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textsToTranslate.map(t => t.text).join("\n\n---SEPARATOR---\n\n"),
          sourceLanguage: sourceKey,
          type: direction === "en-to-es" ? "translate-to-spanish" : "translate-to-english",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to translate");
      }

      // Parse the translated texts
      const translations = data.translatedTexts || [];
      const updates: Partial<StoryData> = {};

      textsToTranslate.forEach((item, idx) => {
        if (translations[idx]) {
          if (item.field === "title") {
            updates.title = { ...storyData.title, [targetKey]: translations[idx] };
          } else if (item.field === "hook") {
            updates.hook = {
              en: storyData.hook?.en ?? "",
              es: storyData.hook?.es ?? "",
              [targetKey]: translations[idx]
            };
          } else if (item.field === "description") {
            updates.description = { ...storyData.description, [targetKey]: translations[idx] };
          }
        }
      });

      updateStoryData(updates);
    } catch (err) {
      setTranslationError(`Failed to translate to ${targetLang}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Helper to check which translations are needed
  const getMissingTranslations = () => {
    const missing = {
      titleEn: !storyData.title.en && !!storyData.title.es,
      titleEs: !!storyData.title.en && !storyData.title.es,
      hookEn: !(storyData.hook?.en) && !!(storyData.hook?.es),
      hookEs: !!(storyData.hook?.en) && !(storyData.hook?.es),
      descEn: !storyData.description.en && !!storyData.description.es,
      descEs: !!storyData.description.en && !storyData.description.es,
    };
    return {
      ...missing,
      needsEnglish: missing.titleEn || missing.hookEn || missing.descEn,
      needsSpanish: missing.titleEs || missing.hookEs || missing.descEs,
    };
  };

  const missingTranslations = getMissingTranslations();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Story Metadata</h2>
        <p className="text-gray-500 text-sm">Enter manually or generate with AI. Add optional prompts to guide generation.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Generate All Button */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">AI Generation</h3>
            <p className="text-xs text-gray-500">Generate title, hook, slug, display title in one call</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateBundleMetadata}
              disabled={isAnyGenerating || !storyData.rawText}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isGeneratingBundle ? "Generating..." : "Generate Text Metadata"}
            </button>
            <button
              onClick={generateAll}
              disabled={isAnyGenerating || !storyData.rawText}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {generatingTypes.size > 0 ? "Generating..." : "Generate Images"}
            </button>
          </div>
        </div>

        {/* Bundle Options Display */}
        {bundleOptions.length > 0 && (
          <div className="bg-white rounded-lg border border-purple-200 p-4 space-y-3">
            <p className="text-sm font-medium text-purple-700">Select a metadata bundle:</p>
            {bundleOptions.map((option, idx) => (
              <button
                key={idx}
                onClick={() => selectBundle(option)}
                className="w-full text-left p-4 bg-purple-50 rounded-lg border border-purple-200 hover:border-purple-400 transition-colors"
              >
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Title:</span>
                    <p className="font-medium text-gray-900">{option.title.en}</p>
                    <p className="text-sm text-gray-500">{option.title.es}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-xs font-medium text-gray-500">Display:</span>
                      <p className="text-gray-700">{option.displayTitle.en} / {option.displayTitle.es}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">Slug:</span>
                      <p className="text-gray-700 font-mono">{option.slug}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Hook:</span>
                    <p className="text-sm text-gray-700">{option.hook.en}</p>
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={() => setBundleOptions([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Dismiss options
            </button>
          </div>
        )}
      </div>

      {/* Thumbnail Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Thumbnail Image</h3>
          {!storyData.thumbnailPreview && (
            <button
              onClick={() => generateMetadata("image")}
              disabled={isGenerating("image") || !storyData.rawText}
              className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating("image") ? "Generating..." : "Generate with AI"}
            </button>
          )}
        </div>

        {/* Image AI Prompt Input */}
        {!storyData.thumbnailPreview && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">AI Guidance (optional)</label>
            <input
              type="text"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="e.g., Watercolor style, warm colors, cartoon illustration, minimalist..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
        )}

        {/* Image Options */}
        {imageOptions.length > 0 && !storyData.thumbnailPreview && (
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-medium mb-3">Click to select:</p>
            <div className="grid grid-cols-2 gap-4">
              {imageOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => selectImage(option.url)}
                  className="relative group"
                >
                  <img
                    src={option.url}
                    alt={`Generated option ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border-2 border-purple-200 group-hover:border-purple-500 transition-colors"
                  />
                  <div className="absolute inset-0 bg-purple-600 bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Thumbnail or Upload */}
        {storyData.thumbnailPreview ? (
          <div className="flex items-start gap-4">
            <img
              src={storyData.thumbnailPreview}
              alt="Thumbnail preview"
              className="w-32 h-32 object-cover rounded-lg border border-gray-300"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">{storyData.thumbnailFile?.name}</p>
              <button
                onClick={removeThumbnail}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              className="hidden"
              id="thumbnail-upload"
            />
            <label
              htmlFor="thumbnail-upload"
              className="cursor-pointer"
            >
              <div className="text-4xl mb-2">{isDragging ? "drop-icon" : "camera-icon"}</div>
              <p className="text-gray-600">
                {isDragging ? "Drop image here" : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB</p>
            </label>
          </div>
        )}
        <p className="text-xs text-gray-500">
          Optional: If no thumbnail is uploaded, a placeholder will be used.
        </p>
      </div>

      {/* Background Image Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Story Background Image</h3>
          {!storyData.backgroundPreview && (
            <button
              onClick={() => generateMetadata("background")}
              disabled={isGenerating("background")}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 disabled:opacity-50"
            >
              {isGenerating("background") ? (
                <>
                  <span className="animate-spin">hourglass</span>
                  Generating...
                </>
              ) : (
                <>sparkles Generate with AI</>
              )}
            </button>
          )}
        </div>

        {/* AI Background Prompt Input */}
        {!storyData.backgroundPreview && (
          <div className="flex gap-2">
            <input
              type="text"
              value={backgroundPrompt}
              onChange={(e) => setBackgroundPrompt(e.target.value)}
              placeholder="Optional: Guide AI (e.g., 'sunset beach scene', 'cozy library')"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
        )}

        {/* AI Generated Background Options */}
        {backgroundOptions.length > 0 && !storyData.backgroundPreview && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-medium mb-3">Click to select:</p>
            <div className="grid grid-cols-2 gap-4">
              {backgroundOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => selectBackground(option.url)}
                  className="relative group"
                >
                  <img
                    src={option.url}
                    alt={`Generated option ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border-2 border-transparent group-hover:border-purple-500 transition-colors"
                  />
                  <div className="absolute inset-0 bg-purple-600 bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-colors" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setBackgroundOptions([])}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700"
            >
              Dismiss options
            </button>
          </div>
        )}

        {storyData.backgroundPreview ? (
          <div className="flex items-start gap-4">
            <img
              src={storyData.backgroundPreview}
              alt="Background preview"
              className="w-64 h-40 object-cover rounded-lg border border-gray-300"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">{storyData.backgroundFile?.name}</p>
              <button
                onClick={() => {
                  updateStoryData({ backgroundFile: null, backgroundPreview: null });
                  setBackgroundOptions([]);
                }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    updateStoryData({
                      backgroundFile: file,
                      backgroundPreview: reader.result as string,
                    });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              id="background-upload"
            />
            <label htmlFor="background-upload" className="cursor-pointer">
              <div className="text-4xl mb-2">image-icon</div>
              <p className="text-gray-600">Click to upload background</p>
              <p className="text-xs text-gray-400 mt-1">Recommended: 1920x1080 or larger (landscape)</p>
            </label>
          </div>
        )}
        <p className="text-xs text-gray-500">
          Optional: If no background is uploaded, a subtle tan color will be used.
        </p>
      </div>

      {/* Story Classification Section */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="font-medium text-gray-900">Story Classification</h3>

        {/* Story Type Dropdown */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Story Type</label>
          <select
            value={storyData.storyType}
            onChange={(e) => updateStoryData({ storyType: e.target.value as StoryType })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {ALL_STORY_TYPES.map((type) => (
              <option key={type} value={type}>
                {STORY_TYPE_LABELS[type].en}
              </option>
            ))}
          </select>
        </div>

        {/* Content Structure Type */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Content Structure
            <span
              className="ml-2 text-gray-400 cursor-help"
              title="Controls how chapters and pages are labeled in navigation. Auto-detect works for most content."
            >
              ℹ️
            </span>
          </label>
          <select
            value={storyData.structureType}
            onChange={(e) => updateStoryData({ structureType: e.target.value as ContentStructureType | "auto" })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="auto">Auto-detect (recommended)</option>
            <option value="prose">Novel / Short Story (Chapter → Page)</option>
            <option value="anthology">Poetry Anthology (Collection → Poem)</option>
            <option value="epic">Epic / Narrative Poetry (Canto → Section)</option>
            <option value="script">Script / Transcript (Act → Scene)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            For poetry collections with thematic sections (like &quot;I. LIFE.&quot;), select Poetry Anthology.
          </p>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">Target Audience</label>
          <div className="flex gap-2">
            {(["all", "children", "teen", "adult"] as const).map((audience) => (
              <button
                key={audience}
                type="button"
                onClick={() => updateStoryData({ targetAudience: audience })}
                className={`px-4 py-2 rounded-lg border-2 text-sm capitalize transition-all ${
                  storyData.targetAudience === audience
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {audience === "all" ? "All Ages" : audience}
              </button>
            ))}
          </div>
        </div>

        {/* Tags Multi-Select */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">
            Tags <span className="text-gray-400">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_STORY_TAGS.map((tag) => {
              const isSelected = storyData.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      updateStoryData({ tags: storyData.tags.filter((t) => t !== tag) });
                    } else {
                      updateStoryData({ tags: [...storyData.tags, tag] });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {STORY_TAG_LABELS[tag].en}
                </button>
              );
            })}
          </div>
          {storyData.tags.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Selected: {storyData.tags.map((t) => STORY_TAG_LABELS[t].en).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Source Toggle Section */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="font-medium text-gray-900">Story Source</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const newIsOriginal = !storyData.isOriginal;
              updateStoryData({
                isOriginal: newIsOriginal,
                attribution: newIsOriginal ? null : createEmptyFormAttribution(),
              });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              storyData.isOriginal ? "bg-green-600" : "bg-blue-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                storyData.isOriginal ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">
            {storyData.isOriginal ? "Cuentana Original" : "External Source (requires attribution)"}
          </span>
        </div>
      </div>

      {/* Title Section */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Title</h3>
          <button
            onClick={() => generateMetadata("title")}
            disabled={isGenerating("title") || !storyData.rawText}
            className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating("title") ? "Generating..." : "Generate"}
          </button>
        </div>

        {/* Title AI Prompt Input */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">AI Guidance (optional)</label>
          <input
            type="text"
            value={titlePrompt}
            onChange={(e) => setTitlePrompt(e.target.value)}
            placeholder="e.g., Make it playful, use alliteration, keep it short..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
        </div>

        {/* Title Options */}
        {titleOptions.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-purple-600 font-medium mb-2">Click to select:</p>
            {titleOptions.map((option, idx) => (
              <button
                key={idx}
                onClick={() => selectTitle(option)}
                className="w-full text-left p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-400 transition-colors"
              >
                <div className="font-medium text-gray-900">{option.en}</div>
                <div className="text-sm text-gray-500">{option.es}</div>
              </button>
            ))}
          </div>
        )}

        {/* Full Title (required) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Full Title (English) *</label>
            <input
              type="text"
              value={storyData.title.en}
              onChange={(e) => updateStoryData({ title: { ...storyData.title, en: e.target.value } })}
              placeholder="e.g., Beowulf: An Anglo-Saxon Epic Poem"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Full Title (Spanish) *</label>
            <input
              type="text"
              value={storyData.title.es}
              onChange={(e) => updateStoryData({ title: { ...storyData.title, es: e.target.value } })}
              placeholder="e.g., Beowulf: Un Poema Epico Anglosaj&oacute;n"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Bidirectional Translation Panel */}
        {(missingTranslations.needsEnglish || missingTranslations.needsSpanish) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800 font-medium">Translation Helper</p>
              {translationError && (
                <p className="text-xs text-red-600">{translationError}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Translate to Spanish */}
              {missingTranslations.needsSpanish && (
                <button
                  type="button"
                  onClick={() => translateMetadata("en-to-es", ["title", "hook", "description"])}
                  disabled={isTranslating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isTranslating ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Translating...
                    </>
                  ) : (
                    <>EN → ES</>
                  )}
                </button>
              )}
              {/* Translate to English */}
              {missingTranslations.needsEnglish && (
                <button
                  type="button"
                  onClick={() => translateMetadata("es-to-en", ["title", "hook", "description"])}
                  disabled={isTranslating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isTranslating ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Translating...
                    </>
                  ) : (
                    <>ES → EN</>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-blue-600">
              Missing:{" "}
              {[
                missingTranslations.titleEs && "Title (ES)",
                missingTranslations.titleEn && "Title (EN)",
                missingTranslations.hookEs && "Hook (ES)",
                missingTranslations.hookEn && "Hook (EN)",
                missingTranslations.descEs && "Summary (ES)",
                missingTranslations.descEn && "Summary (EN)",
              ].filter(Boolean).join(", ")}
            </p>
          </div>
        )}

        {/* Story Slug */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Story Slug *</label>
          <input
            type="text"
            value={storyData.slug}
            onChange={(e) =>
              updateStoryData({
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"),
              })
            }
            placeholder="beowulf"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
              isSlugTaken(storyData.slug) ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          />
          {isSlugTaken(storyData.slug) ? (
            <p className="text-xs text-red-600 mt-1 font-medium">
              This slug already exists. Please choose a different slug or the existing story will be updated.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">URL-friendly identifier (auto-generated from title, but can be edited)</p>
          )}
        </div>

        {/* Display Title (optional) */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Display Title (optional)</h4>
              <p className="text-xs text-gray-500">Short version for cards and navigation. If empty, full title will be used.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Title (English)</label>
              <input
                type="text"
                value={storyData.displayTitle?.en ?? ""}
                onChange={(e) => updateStoryData({
                  displayTitle: {
                    en: e.target.value,
                    es: storyData.displayTitle?.es ?? ""
                  }
                })}
                placeholder="e.g., Beowulf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Title (Spanish)</label>
              <input
                type="text"
                value={storyData.displayTitle?.es ?? ""}
                onChange={(e) => updateStoryData({
                  displayTitle: {
                    en: storyData.displayTitle?.en ?? "",
                    es: e.target.value
                  }
                })}
                placeholder="e.g., Beowulf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="font-medium text-gray-900">Description</h3>

        {/* Hook (required) - short teaser for cards */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hook (English) *</label>
            <input
              type="text"
              value={storyData.hook?.en ?? ""}
              onChange={(e) => updateStoryData({
                hook: {
                  en: e.target.value,
                  es: storyData.hook?.es ?? ""
                }
              })}
              placeholder="1-2 sentence teaser for story cards"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hook (Spanish) *</label>
            <input
              type="text"
              value={storyData.hook?.es ?? ""}
              onChange={(e) => updateStoryData({
                hook: {
                  en: storyData.hook?.en ?? "",
                  es: e.target.value
                }
              })}
              placeholder="Gancho de 1-2 oraciones para tarjetas"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Summary (optional) - full description */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Summary (optional)</h4>
              <p className="text-xs text-gray-500">Full plot summary for the story detail page. Often found in front matter as &quot;THE STORY&quot;.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Summary (English)</label>
              <textarea
                value={storyData.description.en}
                onChange={(e) =>
                  updateStoryData({ description: { ...storyData.description, en: e.target.value } })
                }
                placeholder="Full description of the story..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Summary (Spanish)</label>
              <textarea
                value={storyData.description.es}
                onChange={(e) =>
                  updateStoryData({ description: { ...storyData.description, es: e.target.value } })
                }
                placeholder="Descripci&oacute;n completa de la historia..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attribution Section (only if External Source) */}
      {!storyData.isOriginal && (
        <div className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-gray-900">Attribution Information</h3>

          {/* Attribution Parser - Collapsible */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAttributionParserOpen(!isAttributionParserOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${isAttributionParserOpen ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Parse Front Matter</span>
              </div>
              <span className="text-xs text-gray-500">Extract metadata from pasted text</span>
            </button>

            {isAttributionParserOpen && (
              <div className="p-4 bg-purple-50 border-t border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-purple-600">Paste front matter text (title page, copyright, translator info)</p>
                  <button
                    type="button"
                    onClick={parseAttributionWithAI}
                    disabled={isParsingAttribution || !frontMatterText.trim()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isParsingAttribution ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Parsing...
                      </>
                    ) : (
                      "Parse"
                    )}
                  </button>
                </div>
                <textarea
                  value={frontMatterText}
                  onChange={(e) => {
                    setFrontMatterText(e.target.value);
                    setParseError("");
                  }}
                  placeholder="Paste the front matter here (e.g., title page, copyright notice, translator credits, publication info)..."
                  rows={frontMatterText ? Math.min(12, frontMatterText.split("\n").length + 2) : 4}
                  className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none bg-white transition-all"
                />
                {parseError && (
                  <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                    {parseError}
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Full Attribution Fields (only if not original) */}
        {!storyData.isOriginal && storyData.attribution && (
          <div className="space-y-4">
            {/* Author Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Author Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Author Name *</label>
                  <input
                    type="text"
                    value={storyData.attribution.authorName}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorName: e.target.value },
                      })
                    }
                    placeholder="e.g., Unknown, or Traditional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lifespan</label>
                  <input
                    type="text"
                    value={storyData.attribution.authorLifespan ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorLifespan: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., c. 8th century"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={storyData.attribution.authorIsUnknown ?? false}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorIsUnknown: e.target.checked || undefined },
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  Author Unknown
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={storyData.attribution.authorIsCollective ?? false}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorIsCollective: e.target.checked || undefined },
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  Collective/Traditional Authorship
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Author Note</label>
                <input
                  type="text"
                  value={storyData.attribution.authorNote ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, authorNote: e.target.value || undefined },
                    })
                  }
                  placeholder="Additional context about authorship"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Dating Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Dating</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Year Written</label>
                  <input
                    type="text"
                    value={storyData.attribution.yearWritten ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, yearWritten: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., c. 700-1000 CE"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Year First Published</label>
                  <input
                    type="text"
                    value={storyData.attribution.yearFirstPublished ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, yearFirstPublished: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1815"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Source Edition Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Source Edition (the edition you are ingesting)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Edition Title</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourceTitle ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourceTitle: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Beowulf: A Verse Translation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Publisher</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourcePublisher ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourcePublisher: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Oxford University Press"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Publication Year</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourcePublicationYear ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourcePublicationYear: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1910"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Editor</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourceEditor ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourceEditor: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., John Smith"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Digital Library Source</label>
                  <select
                    value={storyData.attribution.source ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, source: (e.target.value || undefined) as "gutenberg" | "wikisource" | "archive-org" | "other" | undefined },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">None / Not Applicable</option>
                    <option value="gutenberg">Project Gutenberg</option>
                    <option value="wikisource">Wikisource</option>
                    <option value="archive-org">Internet Archive</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source URL</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourceUrl ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourceUrl: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., https://www.gutenberg.org/ebooks/16328"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Edition Notes</label>
                <input
                  type="text"
                  value={storyData.attribution.sourceNotes ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, sourceNotes: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., Facsimile of 19th-century edition"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={storyData.attribution.sourceIsPublicDomain}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourceIsPublicDomain: e.target.checked },
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  Source Edition is Public Domain
                </label>
              </div>
              {storyData.attribution.sourceIsPublicDomain && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Public Domain Note</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourcePublicDomainNote ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourcePublicDomainNote: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Published before 1929"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Translator Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Translator (if using a translation)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translator Name</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorName ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorName: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Francis Gummere"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translator Lifespan</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorLifespan ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorLifespan: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1855-1919"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translation Year</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorYear ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorYear: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1909"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={storyData.attribution.translatorIsPublicDomain ?? true}
                      onChange={(e) =>
                        updateStoryData({
                          attribution: { ...storyData.attribution!, translatorIsPublicDomain: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Translation is Public Domain
                  </label>
                </div>
              </div>
              {storyData.attribution.translatorName && storyData.attribution.translatorIsPublicDomain && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translation Public Domain Note</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorPublicDomainNote ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorPublicDomainNote: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Published before 1929"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Region & Culture Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Region & Culture</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Region / Origin</label>
                  <input
                    type="text"
                    value={storyData.attribution.region ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, region: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Anglo-Saxon England"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cultural Influences (comma-separated)</label>
                  <input
                    type="text"
                    value={storyData.attribution.culturalInfluences ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, culturalInfluences: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Norse, Celtic, Germanic"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Genres (comma-separated)</label>
                <input
                  type="text"
                  value={storyData.attribution.genres ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, genres: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., Epic poetry, Mythology, Heroic literature"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Rights & Provenance Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Rights & Provenance</h4>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Original Work Status *</label>
                <select
                  value={storyData.attribution.originalWorkStatus}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: {
                        ...storyData.attribution!,
                        originalWorkStatus: e.target.value as "public-domain" | "licensed" | "original",
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="public-domain">Public Domain</option>
                  <option value="licensed">Licensed</option>
                  <option value="original">Original (Cuentana)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rights Display Statement</label>
                <textarea
                  value={storyData.attribution.rightsDisplayStatement ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, rightsDisplayStatement: e.target.value || undefined },
                    })
                  }
                  placeholder="Leave blank to auto-generate. e.g., The original text is in the public domain. This educational adaptation Cuentana."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Provenance Note (where the text came from)</label>
                <input
                  type="text"
                  value={storyData.attribution.provenanceNote ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, provenanceNote: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., Text sourced from Project Gutenberg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Provenance URL</label>
                <input
                  type="text"
                  value={storyData.attribution.provenanceUrl ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, provenanceUrl: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., https://www.gutenberg.org/ebooks/16328"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Copyright Note</label>
                <input
                  type="text"
                  value={storyData.attribution.copyrightNote ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, copyrightNote: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., No modern copyrighted annotations were included"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

export default Step3Metadata;
