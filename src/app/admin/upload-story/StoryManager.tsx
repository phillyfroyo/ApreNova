"use client";

import { useState, useEffect, useCallback } from "react";
import type { StoryType, StoryTag, StoryOrigin } from "@/types/story";
import { ALL_STORY_TYPES, ALL_STORY_TAGS, STORY_TYPE_LABELS, STORY_TAG_LABELS } from "@/lib/stories";
import { FormAttribution, createEmptyFormAttribution, formToAttribution, attributionToForm } from "@/lib/admin/attribution-helpers";
import ComparisonModal from "@/components/ComparisonModal";
import type { ChapterAlignmentResult } from "@/lib/user-stories/alignment-check";
import { scanContentWarnings, scanTranslationQuality } from "./hooks/useRewritePipeline";
import { toNumericLevel } from "@/lib/cefr";

interface Story {
  slug: string;
  image: string;
  backgroundImage?: string; // From storyThemes.ts
  levels: string[];
  isPremiumOnly: boolean;
  isArchived?: boolean;
  title: { en: string; es: string };
  description: { en: string; es: string };
  hook: { en: string; es: string };
  // Tagging fields
  type?: StoryType;
  origin?: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";
  // Cost tracking
  totalCostCents?: number;
}

interface EditingStory {
  slug: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
  hook: { en: string; es: string };
  thumbnailPreview: string | null;
  thumbnailFile: File | null;
  backgroundPreview: string | null;
  backgroundFile: File | null;
  // Flags to mark images for deletion
  deleteCurrentThumbnail: boolean;
  deleteCurrentBackground: boolean;
  // Tagging fields
  storyType: StoryType;
  isOriginal: boolean;
  attribution: FormAttribution | null;
  tags: StoryTag[];
  targetAudience: "children" | "teen" | "adult" | "all";
}

type EditorStep = 1 | 2;

interface LevelRawData {
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  hasAlignmentIssues?: boolean;
  chapterAlignmentIssues?: Record<number, ChapterAlignmentResult>;
}

export default function StoryManager() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit modal state
  const [editingStory, setEditingStory] = useState<EditingStory | null>(null);
  const [currentStoryData, setCurrentStoryData] = useState<Story | null>(null);
  const [editorStep, setEditorStep] = useState<EditorStep>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete modal state
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Archive state
  const [archivingSlug, setArchivingSlug] = useState<string | null>(null);

  // AI Generation state
  const [generatingTypes, setGeneratingTypes] = useState<Set<"title" | "description" | "image" | "background">>(new Set());
  const [generationError, setGenerationError] = useState("");
  const [titlePrompt, setTitlePrompt] = useState("");
  const [descriptionPrompt, setDescriptionPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [titleOptions, setTitleOptions] = useState<Array<{ en: string; es: string }>>([]);
  const [descriptionOptions, setDescriptionOptions] = useState<Array<{ en: string; es: string }>>([]);
  const [imageOptions, setImageOptions] = useState<Array<{ url: string; revisedPrompt?: string }>>([]);
  const [backgroundOptions, setBackgroundOptions] = useState<Array<{ url: string; revisedPrompt?: string }>>([]);
  const [storyText, setStoryText] = useState<string | null>(null);

  // Step 2: Story content state
  const [levelRawData, setLevelRawData] = useState<Record<string, LevelRawData>>({});
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [expandedLineBreakdown, setExpandedLineBreakdown] = useState<string | null>(null);

  // Step 2: Comparison modal state
  const [comparisonLevel, setComparisonLevel] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<{
    sourceText: string;
    translatedText: string;
    sourceLanguage: string;
    hasAlignmentIssues?: boolean;
    chapterAlignmentIssues?: Record<number, ChapterAlignmentResult>;
  } | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [levelsWithAlignmentIssues, setLevelsWithAlignmentIssues] = useState<Set<string>>(new Set());

  // AI Attribution Parser state
  const [frontMatterText, setFrontMatterText] = useState("");
  const [isParsingAttribution, setIsParsingAttribution] = useState(false);
  const [parseAttributionError, setParseAttributionError] = useState("");

  const isGenerating = (type: "title" | "description" | "image" | "background") => generatingTypes.has(type);
  const isAnyGenerating = generatingTypes.size > 0;

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/stories");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStories(data.stories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stories");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStories = stories.filter((story) => {
    const query = searchQuery.toLowerCase();
    return (
      story.slug.toLowerCase().includes(query) ||
      story.title.en.toLowerCase().includes(query) ||
      story.title.es.toLowerCase().includes(query)
    );
  });

  // Edit functions
  const openEditModal = async (story: Story) => {
    // Parse origin to get isOriginal and attribution
    const isOriginal = story.origin?.isOriginal ?? true;
    // Convert story attribution to form format for editing
    const attribution = !isOriginal && story.origin && 'attribution' in story.origin
      ? attributionToForm(story.origin.attribution)
      : null;

    setEditingStory({
      slug: story.slug,
      title: { ...story.title },
      description: { ...story.description },
      hook: { ...story.hook },
      thumbnailPreview: null,
      thumbnailFile: null,
      backgroundPreview: null,
      backgroundFile: null,
      deleteCurrentThumbnail: false,
      deleteCurrentBackground: false,
      // Tagging fields
      storyType: story.type || "short-story",
      isOriginal,
      attribution,
      tags: story.tags || [],
      targetAudience: story.targetAudience || "all",
    });
    setCurrentStoryData(story);
    setEditorStep(1);
    setSaveMessage(null);
    setGenerationError("");
    setTitlePrompt("");
    setDescriptionPrompt("");
    setImagePrompt("");
    setBackgroundPrompt("");
    setTitleOptions([]);
    setDescriptionOptions([]);
    setImageOptions([]);
    setBackgroundOptions([]);
    setLevelRawData({});
    setExpandedLineBreakdown(null);

    // Fetch story text for AI generation
    try {
      const response = await fetch(`/api/admin/stories/${story.slug}/text`);
      if (response.ok) {
        const data = await response.json();
        setStoryText(data.text);
      } else {
        setStoryText(null);
      }
    } catch {
      setStoryText(null);
    }
  };

  const closeEditModal = () => {
    setEditingStory(null);
    setCurrentStoryData(null);
    setEditorStep(1);
    setSaveMessage(null);
    setStoryText(null);
    setTitleOptions([]);
    setDescriptionOptions([]);
    setImageOptions([]);
    setBackgroundOptions([]);
    setLevelRawData({});
    setExpandedLineBreakdown(null);
    setFrontMatterText("");
    setParseAttributionError("");
  };

  // Load all levels' raw data for Step 2
  const loadAllLevelRawData = async (slug: string, levels: string[]) => {
    setIsLoadingLevels(true);
    try {
      const results = await Promise.all(
        levels.map(async (level) => {
          try {
            const res = await fetch(
              `/api/admin/stories/${slug}/content?level=${encodeURIComponent(level)}&format=raw`
            );
            if (!res.ok) return { level, data: null };
            const data = await res.json();
            return { level, data: data as LevelRawData };
          } catch {
            return { level, data: null };
          }
        })
      );

      const newRawData: Record<string, LevelRawData> = {};
      const issueSet = new Set<string>();
      for (const { level, data } of results) {
        if (data) {
          newRawData[level] = data;
          if (data.hasAlignmentIssues) issueSet.add(level);
        }
      }
      setLevelRawData(newRawData);
      setLevelsWithAlignmentIssues(issueSet);
    } finally {
      setIsLoadingLevels(false);
    }
  };

  // Comparison modal handlers for Step 2
  const handleOpenComparison = useCallback(async (levelKey: string) => {
    if (!currentStoryData) return;
    setIsLoadingComparison(true);
    setComparisonLevel(levelKey);
    try {
      const res = await fetch(
        `/api/admin/stories/${currentStoryData.slug}/content?level=${encodeURIComponent(levelKey)}&format=raw`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setComparisonData(data);
      if (data.hasAlignmentIssues) {
        setLevelsWithAlignmentIssues(prev => new Set([...prev, levelKey]));
      } else {
        setLevelsWithAlignmentIssues(prev => {
          const next = new Set(prev);
          next.delete(levelKey);
          return next;
        });
      }
    } catch {
      setComparisonLevel(null);
      setComparisonData(null);
    } finally {
      setIsLoadingComparison(false);
    }
  }, [currentStoryData]);

  const handleSaveComparison = useCallback(async (edits: { left?: string; right?: string }) => {
    if (!currentStoryData || !comparisonLevel) return;
    try {
      const res = await fetch(`/api/admin/stories/${currentStoryData.slug}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: comparisonLevel,
          sourceText: edits.left,
          translatedText: edits.right,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      const result = await res.json();
      // Update local comparison data to reflect saved edits + updated alignment
      setComparisonData(prev => prev ? {
        ...prev,
        ...(edits.left !== undefined && { sourceText: edits.left }),
        ...(edits.right !== undefined && { translatedText: edits.right }),
        hasAlignmentIssues: result.hasAlignmentIssues || false,
        chapterAlignmentIssues: result.chapterAlignmentIssues || {},
      } : null);
      if (result.hasAlignmentIssues) {
        setLevelsWithAlignmentIssues(prev => new Set([...prev, comparisonLevel]));
      } else {
        setLevelsWithAlignmentIssues(prev => {
          const next = new Set(prev);
          next.delete(comparisonLevel);
          return next;
        });
      }
      // Refresh level raw data for the alignment cards
      setLevelRawData(prev => ({
        ...prev,
        [comparisonLevel]: {
          sourceText: edits.left ?? prev[comparisonLevel]?.sourceText ?? "",
          translatedText: edits.right ?? prev[comparisonLevel]?.translatedText ?? "",
          sourceLanguage: prev[comparisonLevel]?.sourceLanguage ?? "en",
          hasAlignmentIssues: result.hasAlignmentIssues || false,
          chapterAlignmentIssues: result.chapterAlignmentIssues || {},
        },
      }));
    } catch (error) {
      console.error("Error saving comparison edits:", error);
      alert("Failed to save edits. Please try again.");
    }
  }, [currentStoryData, comparisonLevel]);

  const handleCloseComparison = useCallback(() => {
    setComparisonLevel(null);
    setComparisonData(null);
  }, []);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingStory) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingStory({
          ...editingStory,
          thumbnailFile: file,
          thumbnailPreview: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingStory) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingStory({
          ...editingStory,
          backgroundFile: file,
          backgroundPreview: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // AI Generation functions
  const generateMetadata = async (type: "title" | "description" | "image" | "background") => {
    if (!storyText) {
      setGenerationError("Story text not available for AI generation");
      return;
    }

    setGeneratingTypes(prev => new Set(prev).add(type));
    setGenerationError("");

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
          storyText,
          sourceLanguage: "es", // Assume Spanish source for existing stories
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
      setGenerationError(`Failed to generate ${type}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setGeneratingTypes(prev => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  };

  const selectTitle = (option: { en: string; es: string }) => {
    if (editingStory) {
      setEditingStory({ ...editingStory, title: option });
    }
    setTitleOptions([]);
  };

  const selectDescription = (option: { en: string; es: string }) => {
    if (editingStory) {
      setEditingStory({ ...editingStory, description: option });
    }
    setDescriptionOptions([]);
  };

  const selectImage = async (imageUrl: string) => {
    if (!editingStory) return;

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

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      setEditingStory({
        ...editingStory,
        thumbnailFile: new File([blob], "ai-generated-thumbnail.png", { type: "image/png" }),
        thumbnailPreview: dataUrl,
      });
      setImageOptions([]);
    } catch (err) {
      setGenerationError("Failed to select image");
    }
  };

  const selectBackground = async (imageUrl: string) => {
    if (!editingStory) return;

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

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      setEditingStory({
        ...editingStory,
        backgroundFile: new File([blob], "ai-generated-background.png", { type: "image/png" }),
        backgroundPreview: dataUrl,
      });
      setBackgroundOptions([]);
    } catch (err) {
      setGenerationError("Failed to select background");
    }
  };

  // Parse front matter with AI to extract attribution
  const parseAttributionWithAI = async () => {
    if (!frontMatterText.trim() || !editingStory) {
      setParseAttributionError("Please paste the front matter text first");
      return;
    }

    setIsParsingAttribution(true);
    setParseAttributionError("");

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

      // Update editing story - set isOriginal to false since we're adding attribution
      setEditingStory({
        ...editingStory,
        isOriginal: false,
        attribution: parsedAttribution,
      });

      // Clear the front matter text on success
      setFrontMatterText("");
    } catch (err) {
      setParseAttributionError(err instanceof Error ? err.message : "Failed to parse attribution");
    } finally {
      setIsParsingAttribution(false);
    }
  };

  const saveStoryChanges = async () => {
    if (!editingStory) return;

    setIsSaving(true);
    setSaveMessage(null);

    // Build origin object - convert form attribution to storage format when saving
    const origin = editingStory.isOriginal
      ? { isOriginal: true as const }
      : { isOriginal: false as const, attribution: formToAttribution(editingStory.attribution!) };

    try {
      const response = await fetch(`/api/admin/stories/${editingStory.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingStory.title,
          description: editingStory.description,
          hook: editingStory.hook,
          thumbnailBase64: editingStory.thumbnailPreview || undefined,
          backgroundBase64: editingStory.backgroundPreview || undefined,
          // Delete flags
          deleteCurrentThumbnail: editingStory.deleteCurrentThumbnail,
          deleteCurrentBackground: editingStory.deleteCurrentBackground,
          // Tagging data
          storyType: editingStory.storyType,
          origin,
          tags: editingStory.tags,
          targetAudience: editingStory.targetAudience,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setSaveMessage({ type: "success", text: "Changes saved to files. Refresh the page or restart dev server to see updates on the stories page." });

      // Update local state so the admin list reflects changes immediately
      setStories((prev) =>
        prev.map((s) =>
          s.slug === editingStory.slug
            ? {
                ...s,
                title: editingStory.title,
                description: editingStory.description,
                type: editingStory.storyType,
                origin,
                tags: editingStory.tags,
                targetAudience: editingStory.targetAudience,
              }
            : s
        )
      );

      // Don't auto-close - let user read the message and close manually
    } catch (err) {
      setSaveMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete functions
  const openDeleteModal = (slug: string) => {
    setDeletingSlug(slug);
  };

  const closeDeleteModal = () => {
    setDeletingSlug(null);
  };

  const confirmDelete = async () => {
    if (!deletingSlug) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/stories/${deletingSlug}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete");
      }

      // Remove from local state
      setStories((prev) => prev.filter((s) => s.slug !== deletingSlug));
      closeDeleteModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete story");
    } finally {
      setIsDeleting(false);
    }
  };

  // Archive functions
  const toggleArchive = async (slug: string, currentlyArchived: boolean) => {
    setArchivingSlug(slug);

    try {
      const response = await fetch(`/api/admin/stories/${slug}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !currentlyArchived }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update archive status");
      }

      // Update local state
      setStories((prev) =>
        prev.map((s) =>
          s.slug === slug ? { ...s, isArchived: !currentlyArchived } : s
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update archive status");
    } finally {
      setArchivingSlug(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center text-gray-500">Loading stories...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All Stories</h2>
          <p className="text-sm text-gray-500">{stories.length} stories in the system</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64"
          />
          <button
            onClick={fetchStories}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6">{error}</div>
      )}

      {/* Story List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Story</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Levels</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStories.map((story) => (
              <tr key={story.slug} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={story.image}
                      alt={story.title.en}
                      className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/placeholder1.png";
                      }}
                    />
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {story.title.en}
                        {story.isArchived && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{story.title.es}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{story.slug}</code>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {story.levels.map((level) => (
                      <span
                        key={level}
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                      >
                        {level.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-gray-600">
                    {story.totalCostCents
                      ? `$${(story.totalCostCents / 1_000_000).toFixed(2)}`
                      : "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/en/stories/${story.slug}/${story.levels[0]}/1/1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      View
                    </a>
                    <button
                      onClick={() => openEditModal(story)}
                      className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleArchive(story.slug, story.isArchived || false)}
                      disabled={archivingSlug === story.slug}
                      className={`px-3 py-1.5 text-sm border rounded ${
                        story.isArchived
                          ? "text-green-600 hover:text-green-800 border-green-300 hover:bg-green-50"
                          : "text-amber-600 hover:text-amber-800 border-amber-300 hover:bg-amber-50"
                      } disabled:opacity-50`}
                    >
                      {archivingSlug === story.slug
                        ? "..."
                        : story.isArchived
                        ? "Unarchive"
                        : "Archive"}
                    </button>
                    <button
                      onClick={() => openDeleteModal(story.slug)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredStories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? "No stories match your search" : "No stories found"}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingStory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header with Step Tabs */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Edit Story</h3>
                  <p className="text-sm text-gray-500">Editing: {editingStory.slug}</p>
                </div>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Step Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditorStep(1)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    editorStep === 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  1. Metadata & Tags
                </button>
                <button
                  onClick={() => {
                    setEditorStep(2);
                    if (Object.keys(levelRawData).length === 0 && currentStoryData) {
                      loadAllLevelRawData(currentStoryData.slug, currentStoryData.levels);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    editorStep === 2
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  2. Story Content
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {editorStep === 1 && (
                <div className="space-y-5">
                  {/* Generation Error */}
                  {generationError && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                      {generationError}
                    </div>
                  )}

                  {/* AI Status Indicator */}
                  {storyText && (
                    <div className="bg-purple-50 text-purple-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                      <span>✨</span>
                      <span>AI generation available - story text loaded</span>
                    </div>
                  )}

                  {/* Title */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">Title</label>
                      {storyText && (
                        <button
                          onClick={() => generateMetadata("title")}
                          disabled={isGenerating("title")}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                        >
                          {isGenerating("title") ? "Generating..." : "✨ Generate"}
                        </button>
                      )}
                    </div>
                    {storyText && (
                      <input
                        type="text"
                        value={titlePrompt}
                        onChange={(e) => setTitlePrompt(e.target.value)}
                        placeholder="Optional: Guide AI (e.g., 'mysterious', 'adventure')"
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500 outline-none"
                      />
                    )}
                    {titleOptions.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-purple-600 font-medium">Click to select:</p>
                        {titleOptions.map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectTitle(option)}
                            className="w-full text-left px-3 py-2 bg-white rounded border border-purple-200 hover:border-purple-400 text-sm"
                          >
                            <div className="font-medium">{option.en}</div>
                            <div className="text-gray-500 text-xs">{option.es}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">English</label>
                        <input
                          type="text"
                          value={editingStory.title.en}
                          onChange={(e) =>
                            setEditingStory({
                              ...editingStory,
                              title: { ...editingStory.title, en: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Spanish</label>
                        <input
                          type="text"
                          value={editingStory.title.es}
                          onChange={(e) =>
                            setEditingStory({
                              ...editingStory,
                              title: { ...editingStory.title, es: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      {storyText && (
                        <button
                          onClick={() => generateMetadata("description")}
                          disabled={isGenerating("description")}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                        >
                          {isGenerating("description") ? "Generating..." : "✨ Generate"}
                        </button>
                      )}
                    </div>
                    {storyText && (
                      <input
                        type="text"
                        value={descriptionPrompt}
                        onChange={(e) => setDescriptionPrompt(e.target.value)}
                        placeholder="Optional: Guide AI (e.g., 'focus on the journey')"
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500 outline-none"
                      />
                    )}
                    {descriptionOptions.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-purple-600 font-medium">Click to select:</p>
                        {descriptionOptions.map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectDescription(option)}
                            className="w-full text-left px-3 py-2 bg-white rounded border border-purple-200 hover:border-purple-400 text-sm"
                          >
                            <div>{option.en}</div>
                            <div className="text-gray-500 text-xs mt-1">{option.es}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">English</label>
                        <textarea
                          value={editingStory.description.en}
                          onChange={(e) =>
                            setEditingStory({
                              ...editingStory,
                              description: { ...editingStory.description, en: e.target.value },
                            })
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Spanish</label>
                        <textarea
                          value={editingStory.description.es}
                          onChange={(e) =>
                            setEditingStory({
                              ...editingStory,
                              description: { ...editingStory.description, es: e.target.value },
                            })
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hook */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Hook</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">English</label>
                        <input
                          type="text"
                          value={editingStory.hook.en}
                          onChange={(e) =>
                            setEditingStory({
                              ...editingStory,
                              hook: { ...editingStory.hook, en: e.target.value },
                            })
                          }
                          placeholder="Short teaser hook..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Spanish</label>
                        <input
                          type="text"
                          value={editingStory.hook.es}
                          onChange={(e) =>
                            setEditingStory({
                              ...editingStory,
                              hook: { ...editingStory.hook, es: e.target.value },
                            })
                          }
                          placeholder="Gancho corto..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Thumbnail Section */}
                  <div className="space-y-3 border-t pt-5">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">Thumbnail Image</label>
                      {storyText && !editingStory.thumbnailPreview && (
                        <button
                          onClick={() => generateMetadata("image")}
                          disabled={isGenerating("image")}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                        >
                          {isGenerating("image") ? "Generating..." : "✨ Generate with AI"}
                        </button>
                      )}
                    </div>

                    {/* Current Thumbnail */}
                    {currentStoryData?.image && !editingStory.thumbnailPreview && !editingStory.deleteCurrentThumbnail && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-2">Current thumbnail:</p>
                        <div className="flex items-start gap-4">
                          <img
                            src={currentStoryData.image}
                            alt="Current thumbnail"
                            className="w-24 h-32 rounded-lg object-cover border border-gray-300"
                          />
                          <div className="flex-1 space-y-2">
                            <p className="text-xs text-gray-600 font-mono">{currentStoryData.image}</p>
                            <button
                              onClick={() => setEditingStory({ ...editingStory, deleteCurrentThumbnail: true })}
                              className="px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                            >
                              Remove Thumbnail
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Thumbnail marked for deletion */}
                    {editingStory.deleteCurrentThumbnail && !editingStory.thumbnailPreview && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-xs text-red-600 font-medium mb-2">Thumbnail will be removed on save</p>
                        <button
                          onClick={() => setEditingStory({ ...editingStory, deleteCurrentThumbnail: false })}
                          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Undo Remove
                        </button>
                      </div>
                    )}

                    {/* AI Generation prompt */}
                    {storyText && !editingStory.thumbnailPreview && (
                      <input
                        type="text"
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder="Optional: Describe the image you want (e.g., 'a cozy family scene with a cat')"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500 outline-none"
                      />
                    )}

                    {/* AI Generated Options */}
                    {imageOptions.length > 0 && !editingStory.thumbnailPreview && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-xs text-purple-600 font-medium mb-3">Click an image to select it:</p>
                        <div className="grid grid-cols-3 gap-3">
                          {imageOptions.map((option, idx) => (
                            <button key={idx} onClick={() => selectImage(option.url)} className="relative group">
                              <img src={option.url} alt={`Option ${idx + 1}`} className="w-full h-40 object-cover rounded-lg border-2 border-transparent group-hover:border-purple-500 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Thumbnail Preview */}
                    {editingStory.thumbnailPreview && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-xs text-green-600 font-medium mb-2">New thumbnail (will replace current):</p>
                        <div className="flex items-start gap-4">
                          <img src={editingStory.thumbnailPreview} alt="New thumbnail" className="w-24 h-32 rounded-lg object-cover border border-green-300" />
                          <div className="flex-1 space-y-2">
                            <button
                              onClick={() => setEditingStory({ ...editingStory, thumbnailPreview: null, thumbnailFile: null })}
                              className="px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                            >
                              Cancel Change
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upload Option */}
                    {!editingStory.thumbnailPreview && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Or upload:</span>
                        <input type="file" accept="image/*" onChange={handleThumbnailChange} className="text-xs" />
                      </div>
                    )}
                  </div>

                  {/* Background Section */}
                  <div className="space-y-3 border-t pt-5">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">Background Image</label>
                      {storyText && !editingStory.backgroundPreview && (
                        <button
                          onClick={() => generateMetadata("background")}
                          disabled={isGenerating("background")}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                        >
                          {isGenerating("background") ? "Generating..." : "✨ Generate with AI"}
                        </button>
                      )}
                    </div>

                    {/* Current Background Info */}
                    {!editingStory.backgroundPreview && !editingStory.deleteCurrentBackground && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-2">Current background:</p>
                        {currentStoryData?.backgroundImage ? (
                          <>
                            <p className="text-xs text-gray-600 font-mono mb-2">{currentStoryData.backgroundImage}</p>
                            <img
                              src={currentStoryData.backgroundImage}
                              alt="Current background"
                              className="w-full max-w-md h-32 rounded-lg object-cover border border-gray-300"
                            />
                            <button
                              onClick={() => setEditingStory({ ...editingStory, deleteCurrentBackground: true })}
                              className="mt-3 px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                            >
                              Remove Background (use default gradient)
                            </button>
                          </>
                        ) : (
                          <p className="text-xs text-gray-600 italic">Using default gradient (no image)</p>
                        )}
                      </div>
                    )}

                    {/* Background marked for deletion */}
                    {editingStory.deleteCurrentBackground && !editingStory.backgroundPreview && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-xs text-red-600 font-medium mb-2">Background image will be removed on save (will use default gradient)</p>
                        <button
                          onClick={() => setEditingStory({ ...editingStory, deleteCurrentBackground: false })}
                          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Undo Remove
                        </button>
                      </div>
                    )}

                    {/* AI Generation prompt */}
                    {storyText && !editingStory.backgroundPreview && (
                      <input
                        type="text"
                        value={backgroundPrompt}
                        onChange={(e) => setBackgroundPrompt(e.target.value)}
                        placeholder="Optional: Describe the background (e.g., 'soft watercolor meadow')"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500 outline-none"
                      />
                    )}

                    {/* AI Generated Options */}
                    {backgroundOptions.length > 0 && !editingStory.backgroundPreview && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-xs text-purple-600 font-medium mb-3">Click an image to select it:</p>
                        <div className="grid grid-cols-2 gap-3">
                          {backgroundOptions.map((option, idx) => (
                            <button key={idx} onClick={() => selectBackground(option.url)} className="relative group">
                              <img src={option.url} alt={`Option ${idx + 1}`} className="w-full h-28 object-cover rounded-lg border-2 border-transparent group-hover:border-purple-500 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Background Preview */}
                    {editingStory.backgroundPreview && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-xs text-green-600 font-medium mb-2">New background (will replace current):</p>
                        <div className="space-y-2">
                          <img src={editingStory.backgroundPreview} alt="New background" className="w-full max-w-md h-32 rounded-lg object-cover border border-green-300" />
                          <button
                            onClick={() => setEditingStory({ ...editingStory, backgroundPreview: null, backgroundFile: null })}
                            className="px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                          >
                            Cancel Change
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Upload Option */}
                    {!editingStory.backgroundPreview && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Or upload:</span>
                        <input type="file" accept="image/*" onChange={handleBackgroundChange} className="text-xs" />
                      </div>
                    )}
                  </div>

                  {/* Story Classification Section */}
                  <div className="space-y-4 border-t pt-5">
                    <h3 className="font-medium text-gray-900">Story Classification</h3>

                    {/* AI Attribution Parser */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-purple-900">AI Attribution Parser</h4>
                          <p className="text-xs text-purple-600">Paste front matter text and let AI extract the metadata</p>
                        </div>
                        <button
                          type="button"
                          onClick={parseAttributionWithAI}
                          disabled={isParsingAttribution || !frontMatterText.trim()}
                          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-default transition-colors"
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
                            <>
                              <span>✨</span>
                              Parse with AI
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        value={frontMatterText}
                        onChange={(e) => {
                          setFrontMatterText(e.target.value);
                          setParseAttributionError("");
                        }}
                        placeholder="Paste front matter here (title page, copyright, translator info)..."
                        rows={frontMatterText ? Math.min(8, frontMatterText.split("\n").length + 2) : 3}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none bg-white transition-all"
                      />
                      {parseAttributionError && (
                        <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
                          {parseAttributionError}
                        </div>
                      )}
                    </div>

                    {/* Story Type Dropdown */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Story Type</label>
                      <select
                        value={editingStory.storyType}
                        onChange={(e) => setEditingStory({ ...editingStory, storyType: e.target.value as StoryType })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        {ALL_STORY_TYPES.map((type) => (
                          <option key={type} value={type}>{STORY_TYPE_LABELS[type].en}</option>
                        ))}
                      </select>
                    </div>

                    {/* Is Original Toggle */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const newIsOriginal = !editingStory.isOriginal;
                          setEditingStory({
                            ...editingStory,
                            isOriginal: newIsOriginal,
                            attribution: newIsOriginal ? null : createEmptyFormAttribution(),
                          });
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          editingStory.isOriginal ? "bg-green-600" : "bg-gray-300"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editingStory.isOriginal ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                      <span className="text-sm text-gray-700">
                        {editingStory.isOriginal ? "Cuentana Original" : "External Source"}
                      </span>
                    </div>

                    {/* Attribution Fields - Full Form */}
                    {!editingStory.isOriginal && editingStory.attribution && (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                        {/* Author Information */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Author Information</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Author Name *</label>
                              <input
                                type="text"
                                value={editingStory.attribution.authorName}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, authorName: e.target.value } })}
                                placeholder="e.g., Unknown Anglo-Saxon Poet"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Lifespan</label>
                              <input
                                type="text"
                                value={editingStory.attribution.authorLifespan ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, authorLifespan: e.target.value || undefined } })}
                                placeholder="e.g., c. 700-1000 CE"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={editingStory.attribution.authorIsUnknown ?? false}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, authorIsUnknown: e.target.checked || undefined } })}
                                className="rounded border-gray-300"
                              />
                              Unknown Author
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={editingStory.attribution.authorIsCollective ?? false}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, authorIsCollective: e.target.checked || undefined } })}
                                className="rounded border-gray-300"
                              />
                              Collective/Oral Tradition
                            </label>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Author Note</label>
                            <input
                              type="text"
                              value={editingStory.attribution.authorNote ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, authorNote: e.target.value || undefined } })}
                              placeholder="e.g., Composed during the Anglo-Saxon period"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Dating */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Dating</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Year Written</label>
                              <input
                                type="text"
                                value={editingStory.attribution.yearWritten ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, yearWritten: e.target.value || undefined } })}
                                placeholder="e.g., c. 700-1000 CE"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Year First Published</label>
                              <input
                                type="text"
                                value={editingStory.attribution.yearFirstPublished ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, yearFirstPublished: e.target.value || undefined } })}
                                placeholder="e.g., 1815"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Source Edition */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Source Edition</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Source Title</label>
                              <input
                                type="text"
                                value={editingStory.attribution.sourceTitle ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourceTitle: e.target.value || undefined } })}
                                placeholder="e.g., Beowulf: A Translation"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Publisher</label>
                              <input
                                type="text"
                                value={editingStory.attribution.sourcePublisher ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourcePublisher: e.target.value || undefined } })}
                                placeholder="e.g., Hackett Publishing"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Publication Year</label>
                              <input
                                type="text"
                                value={editingStory.attribution.sourcePublicationYear ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourcePublicationYear: e.target.value || undefined } })}
                                placeholder="e.g., 1910"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Editor</label>
                              <input
                                type="text"
                                value={editingStory.attribution.sourceEditor ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourceEditor: e.target.value || undefined } })}
                                placeholder="e.g., John Smith"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Source URL</label>
                            <input
                              type="url"
                              value={editingStory.attribution.sourceUrl ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourceUrl: e.target.value || undefined } })}
                              placeholder="e.g., https://www.gutenberg.org/..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Source Notes</label>
                            <textarea
                              value={editingStory.attribution.sourceNotes ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourceNotes: e.target.value || undefined } })}
                              placeholder="Any additional notes about the source..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={editingStory.attribution.sourceIsPublicDomain}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourceIsPublicDomain: e.target.checked } })}
                              className="rounded border-gray-300"
                            />
                            Source edition is in public domain
                          </label>
                          {editingStory.attribution.sourceIsPublicDomain && (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Public Domain Note</label>
                              <input
                                type="text"
                                value={editingStory.attribution.sourcePublicDomainNote ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, sourcePublicDomainNote: e.target.value || undefined } })}
                                placeholder="e.g., Published before 1928"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          )}
                        </div>

                        {/* Translator */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Translator (if applicable)</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Translator Name</label>
                              <input
                                type="text"
                                value={editingStory.attribution.translatorName ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, translatorName: e.target.value || undefined } })}
                                placeholder="e.g., Francis B. Gummere"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Translator Lifespan</label>
                              <input
                                type="text"
                                value={editingStory.attribution.translatorLifespan ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, translatorLifespan: e.target.value || undefined } })}
                                placeholder="e.g., 1855-1919"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Translation Year</label>
                              <input
                                type="text"
                                value={editingStory.attribution.translatorYear ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, translatorYear: e.target.value || undefined } })}
                                placeholder="e.g., 1910"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="flex items-end">
                              <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                                <input
                                  type="checkbox"
                                  checked={editingStory.attribution.translatorIsPublicDomain ?? true}
                                  onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, translatorIsPublicDomain: e.target.checked } })}
                                  className="rounded border-gray-300"
                                />
                                Translation is public domain
                              </label>
                            </div>
                          </div>
                          {editingStory.attribution.translatorName && !(editingStory.attribution.translatorIsPublicDomain ?? true) && (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Translation Public Domain Note</label>
                              <input
                                type="text"
                                value={editingStory.attribution.translatorPublicDomainNote ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, translatorPublicDomainNote: e.target.value || undefined } })}
                                placeholder="License or permission details..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          )}
                        </div>

                        {/* Region & Culture */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Region & Culture</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Region</label>
                              <input
                                type="text"
                                value={editingStory.attribution.region ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, region: e.target.value || undefined } })}
                                placeholder="e.g., Scandinavia, England"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Cultural Influences (comma-separated)</label>
                              <input
                                type="text"
                                value={editingStory.attribution.culturalInfluences ?? ""}
                                onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, culturalInfluences: e.target.value || undefined } })}
                                placeholder="e.g., Anglo-Saxon, Norse, Germanic"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Genres (comma-separated)</label>
                            <input
                              type="text"
                              value={editingStory.attribution.genres ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, genres: e.target.value || undefined } })}
                              placeholder="e.g., epic poetry, heroic legend"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Rights & Provenance */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Rights & Provenance</h4>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Original Work Status</label>
                            <select
                              value={editingStory.attribution.originalWorkStatus}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, originalWorkStatus: e.target.value as "public-domain" | "licensed" | "original" } })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              <option value="public-domain">Public Domain</option>
                              <option value="licensed">Licensed</option>
                              <option value="original">Original</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Rights Display Statement</label>
                            <textarea
                              value={editingStory.attribution.rightsDisplayStatement ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, rightsDisplayStatement: e.target.value || undefined } })}
                              placeholder="Leave blank to auto-generate based on status..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Provenance Note</label>
                            <input
                              type="text"
                              value={editingStory.attribution.provenanceNote ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, provenanceNote: e.target.value || undefined } })}
                              placeholder="e.g., Text from Project Gutenberg"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Provenance URL</label>
                            <input
                              type="url"
                              value={editingStory.attribution.provenanceUrl ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, provenanceUrl: e.target.value || undefined } })}
                              placeholder="https://..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Copyright Note</label>
                            <input
                              type="text"
                              value={editingStory.attribution.copyrightNote ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, copyrightNote: e.target.value || undefined } })}
                              placeholder="Any additional copyright information..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Target Audience */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Target Audience</label>
                      <div className="flex gap-2">
                        {(["all", "children", "teen", "adult"] as const).map((audience) => (
                          <button
                            key={audience}
                            type="button"
                            onClick={() => setEditingStory({ ...editingStory, targetAudience: audience })}
                            className={`px-3 py-1.5 rounded-lg border-2 text-sm capitalize transition-all ${
                              editingStory.targetAudience === audience
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
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_STORY_TAGS.map((tag) => {
                          const isSelected = editingStory.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setEditingStory({ ...editingStory, tags: editingStory.tags.filter((t) => t !== tag) });
                                } else {
                                  setEditingStory({ ...editingStory, tags: [...editingStory.tags, tag] });
                                }
                              }}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
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
                      {editingStory.tags.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Selected: {editingStory.tags.map((t) => STORY_TAG_LABELS[t].en).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {editorStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Story Content by Level</h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Review alignment data for each level. Click &ldquo;View Full Text&rdquo; to open the comparison editor.
                    </p>

                    {isLoadingLevels && (
                      <div className="flex items-center gap-2 text-gray-500 py-4">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading level data...
                      </div>
                    )}

                    {currentStoryData && !isLoadingLevels && (
                      <div className="space-y-3">
                        {currentStoryData.levels.map((level) => {
                          const rawData = levelRawData[level];
                          const hasData = !!rawData?.sourceText;
                          const hasIssues = levelsWithAlignmentIssues.has(level);
                          const numLevel = toNumericLevel(level);

                          // Use server-provided alignment data (same data ComparisonModal uses)
                          const chapterIssues = rawData?.chapterAlignmentIssues || {};
                          const totalAlignmentIssues = Object.values(chapterIssues)
                            .reduce((sum, ch) => sum + ch.contentVsBlankIssues.length, 0);

                          // Extract chapter list from source text for display labels
                          const chapterDividerPattern = /^---\s*(Chapter|Capítulo)\s*(\d+)(?::\s*(.+?))?\s*---$/gim;
                          const chapters: { number: number; title: string }[] = [];
                          if (hasData) {
                            let m;
                            while ((m = chapterDividerPattern.exec(rawData.sourceText)) !== null) {
                              chapters.push({ number: parseInt(m[2], 10), title: m[3] || "" });
                            }
                          }
                          const hasMultipleChapters = chapters.length > 1;

                          // Content warnings
                          const sourceWarnings = hasData ? scanContentWarnings(rawData.sourceText, numLevel) : [];
                          const translationWarnings = hasData && rawData.translatedText ? scanContentWarnings(rawData.translatedText, numLevel) : [];
                          const qualityWarnings = hasData && rawData.translatedText ? scanTranslationQuality(rawData.sourceText, rawData.translatedText, numLevel) : [];
                          const totalWarnings = sourceWarnings.length + translationWarnings.length + qualityWarnings.length;

                          const isBreakdownExpanded = expandedLineBreakdown === level;

                          const borderColor = !hasData ? "border-gray-200" : hasIssues || totalWarnings > 0 ? "border-amber-300" : "border-green-300";

                          return (
                            <div key={level} className={`p-4 rounded-lg border-2 ${borderColor} bg-white`}>
                              {/* Header row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                    hasData ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                  }`}>
                                    {hasData ? (
                                      <span>&#10003;</span>
                                    ) : (
                                      level.toUpperCase()
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-900">{level.toUpperCase()}</span>
                                </div>
                                {hasData && (
                                  <button
                                    onClick={() => handleOpenComparison(level)}
                                    disabled={isLoadingComparison}
                                    className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    View Full Text
                                  </button>
                                )}
                              </div>

                              {/* Alignment status (uses server-provided chapterAlignmentIssues — same data as ComparisonModal) */}
                              {hasData && rawData.translatedText && (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2">
                                    {totalAlignmentIssues === 0 ? (
                                      <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                                        <span className="text-green-500">&#10003;</span>
                                        Alignment OK
                                        {hasMultipleChapters && <span className="text-gray-400 font-normal text-xs">({chapters.length} chapters)</span>}
                                      </span>
                                    ) : (
                                      <>
                                        <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                          </svg>
                                          {totalAlignmentIssues} alignment issue{totalAlignmentIssues > 1 ? "s" : ""}
                                        </span>
                                        {hasMultipleChapters && (
                                          <button
                                            onClick={() => setExpandedLineBreakdown(isBreakdownExpanded ? null : level)}
                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                            title={isBreakdownExpanded ? "Hide chapter breakdown" : "Show chapter breakdown"}
                                          >
                                            <svg
                                              className={`w-4 h-4 text-gray-500 transition-transform ${isBreakdownExpanded ? 'rotate-90' : ''}`}
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  {/* Per-chapter breakdown */}
                                  {isBreakdownExpanded && hasMultipleChapters && (
                                    <div className="mt-2 ml-6 bg-gray-50 rounded-lg p-3 text-xs space-y-1.5 max-h-48 overflow-y-auto">
                                      {chapters.map((ch) => {
                                        const chIssues = chapterIssues[ch.number];
                                        const issueCount = chIssues?.contentVsBlankIssues.length || 0;
                                        const chapterOk = !chIssues?.hasIssues;

                                        return (
                                          <div
                                            key={ch.number}
                                            className={`flex items-center justify-between px-2 py-1 rounded ${chapterOk ? 'bg-green-50' : 'bg-amber-50'}`}
                                          >
                                            <span className="text-gray-700 font-medium">
                                              Ch. {ch.number}
                                              {ch.title && <span className="font-normal text-gray-500 ml-1">({ch.title.slice(0, 20)}{ch.title.length > 20 ? '...' : ''})</span>}
                                            </span>
                                            <span className={chapterOk ? 'text-green-600' : 'text-amber-600'}>
                                              {chapterOk ? (
                                                <span>&#10003;</span>
                                              ) : (
                                                <span>{issueCount} issue{issueCount > 1 ? 's' : ''}</span>
                                              )}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* No translation yet */}
                              {hasData && !rawData.translatedText && (
                                <p className="mt-2 text-xs text-gray-400 italic">Source text only — no translation available</p>
                              )}

                              {/* No data */}
                              {!hasData && (
                                <p className="mt-2 text-xs text-gray-400 italic">No content data available</p>
                              )}

                              {/* Content warnings */}
                              {totalWarnings > 0 && (
                                <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3">
                                  <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    {totalWarnings} content warning{totalWarnings > 1 ? "s" : ""} detected
                                  </div>
                                  <ul className="space-y-1">
                                    {sourceWarnings.map((w, i) => (
                                      <li key={`src-${i}`} className="text-xs text-amber-600">
                                        <span className="font-medium text-amber-700">Source</span> Ch {w.chapter}, line {w.line}: <span className="font-medium">{w.type === "error_marker" ? "Error marker" : w.type === "ai_refusal" ? "AI refusal" : "Translation failed"}</span>
                                        {" — "}<code className="bg-amber-100 px-1 rounded">{w.text.slice(0, 80)}{w.text.length > 80 ? "..." : ""}</code>
                                      </li>
                                    ))}
                                    {translationWarnings.map((w, i) => (
                                      <li key={`trans-${i}`} className="text-xs text-amber-600">
                                        <span className="font-medium text-amber-700">Translation</span> Ch {w.chapter}, line {w.line}: <span className="font-medium">{w.type === "error_marker" ? "Error marker" : w.type === "ai_refusal" ? "AI refusal" : "Translation failed"}</span>
                                        {" — "}<code className="bg-amber-100 px-1 rounded">{w.text.slice(0, 80)}{w.text.length > 80 ? "..." : ""}</code>
                                      </li>
                                    ))}
                                    {qualityWarnings.map((w, i) => (
                                      <li key={`quality-${i}`} className="text-xs text-amber-600">
                                        <span className="font-medium text-amber-700">Short translation</span> Ch {w.chapter}, line {w.line}
                                        {" — "}<code className="bg-amber-100 px-1 rounded">{w.text.slice(0, 120)}{w.text.length > 120 ? "..." : ""}</code>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save message */}
              {saveMessage && (
                <div
                  className={`mt-4 px-4 py-3 rounded-lg text-sm ${
                    saveMessage.type === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {saveMessage.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveStoryChanges}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal for Step 2 content editing */}
      {comparisonData && comparisonLevel && (
        <div className="fixed inset-0 z-[110]">
          <ComparisonModal
            isOpen={true}
            onClose={handleCloseComparison}
            level={comparisonLevel ? parseInt(comparisonLevel.replace(/\D/g, ""), 10) : null}
            leftTitle={`Source (${(comparisonData.sourceLanguage || "en").toUpperCase()})`}
            leftText={comparisonData.sourceText}
            rightTitle={`Translation (${comparisonData.sourceLanguage === "en" ? "ES" : "EN"})`}
            rightText={comparisonData.translatedText}
            editableSide="both"
            onSave={handleSaveComparison}
            headerGradient="bg-gradient-to-r from-emerald-600 to-teal-600"
            chapterAlignmentIssues={comparisonData.chapterAlignmentIssues}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSlug && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Delete Story</h3>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deletingSlug}</span>?
              </p>
              <p className="text-sm text-red-600 mt-2">
                This will permanently delete all content files, metadata entries, and the thumbnail.
                This action cannot be undone.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Story"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
