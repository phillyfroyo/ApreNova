"use client";

import { useState, useEffect } from "react";
import type { StoryType, StoryTag, StoryAttribution, StoryOrigin } from "@/types/story";
import { ALL_STORY_TYPES, ALL_STORY_TAGS, STORY_TYPE_LABELS, STORY_TAG_LABELS } from "@/lib/stories";

interface Story {
  slug: string;
  image: string;
  backgroundImage?: string; // From storyThemes.ts
  levels: string[];
  isPremiumOnly: boolean;
  title: { en: string; es: string };
  description: { en: string; es: string };
  // Tagging fields
  type?: StoryType;
  origin?: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";
}

interface EditingStory {
  slug: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
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
  attribution: StoryAttribution | null;
  tags: StoryTag[];
  targetAudience: "children" | "teen" | "adult" | "all";
}

type EditorStep = 1 | 2;

interface LevelContent {
  level: string;
  chapters: Record<number, {
    pages: Record<number, {
      lines: Array<{ en: string; es: string }>;
    }>;
  }>;
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
  const [levelContents, setLevelContents] = useState<LevelContent[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

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
    const attribution = !isOriginal && story.origin && 'attribution' in story.origin
      ? story.origin.attribution
      : null;

    setEditingStory({
      slug: story.slug,
      title: { ...story.title },
      description: { ...story.description },
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
    setLevelContents([]);
    setSelectedLevel(story.levels[0] || null);

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
    setLevelContents([]);
    setSelectedLevel(null);
  };

  // Load story content for Step 2
  const loadStoryContent = async (slug: string, levels: string[]) => {
    setIsLoadingContent(true);
    const contents: LevelContent[] = [];

    for (const level of levels) {
      try {
        const response = await fetch(`/api/admin/stories/${slug}/content?level=${level}`);
        if (response.ok) {
          const data = await response.json();
          contents.push({ level, chapters: data.chapters });
        }
      } catch (err) {
        console.error(`Failed to load content for ${level}:`, err);
      }
    }

    setLevelContents(contents);
    setIsLoadingContent(false);
  };

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

  const saveStoryChanges = async () => {
    if (!editingStory) return;

    setIsSaving(true);
    setSaveMessage(null);

    // Build origin object
    const origin = editingStory.isOriginal
      ? { isOriginal: true as const }
      : { isOriginal: false as const, attribution: editingStory.attribution! };

    try {
      const response = await fetch(`/api/admin/stories/${editingStory.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingStory.title,
          description: editingStory.description,
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
                      <div className="font-medium text-gray-900">{story.title.en}</div>
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
                    if (levelContents.length === 0 && currentStoryData) {
                      loadStoryContent(currentStoryData.slug, currentStoryData.levels);
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
                            attribution: newIsOriginal ? null : { author: "", publicDomain: true },
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

                    {/* Attribution Fields */}
                    {!editingStory.isOriginal && (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Attribution Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Author *</label>
                            <input
                              type="text"
                              value={editingStory.attribution?.author ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, author: e.target.value } })}
                              placeholder="e.g., Edgar Allan Poe"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Year Published</label>
                            <input
                              type="number"
                              value={editingStory.attribution?.yearPublished ?? ""}
                              onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, yearPublished: e.target.value ? parseInt(e.target.value) : undefined } })}
                              placeholder="e.g., 1845"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Public Domain Note</label>
                          <input
                            type="text"
                            value={editingStory.attribution?.publicDomainNote ?? ""}
                            onChange={(e) => setEditingStory({ ...editingStory, attribution: { ...editingStory.attribution!, publicDomainNote: e.target.value || undefined } })}
                            placeholder="e.g., Published before 1928"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
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
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Story Content by Level</h3>
                    {currentStoryData && (
                      <div className="flex gap-1">
                        {currentStoryData.levels.map((level) => (
                          <button
                            key={level}
                            onClick={() => setSelectedLevel(level)}
                            className={`px-3 py-1 rounded text-sm ${
                              selectedLevel === level
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          >
                            {level.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {isLoadingContent ? (
                    <div className="text-center py-12 text-gray-500">Loading story content...</div>
                  ) : levelContents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p>No content loaded yet.</p>
                      <button
                        onClick={() => currentStoryData && loadStoryContent(currentStoryData.slug, currentStoryData.levels)}
                        className="mt-2 text-blue-600 hover:text-blue-800"
                      >
                        Load Content
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {levelContents
                        .filter((lc) => lc.level === selectedLevel)
                        .map((levelContent) => (
                          <div key={levelContent.level}>
                            {Object.entries(levelContent.chapters).map(([chNum, chapter]) => (
                              <div key={chNum} className="mb-4">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Chapter {chNum}</h4>
                                {Object.entries(chapter.pages).map(([pNum, page]) => (
                                  <div key={pNum} className="mb-3 pl-4 border-l-2 border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Page {pNum}</p>
                                    <div className="space-y-1">
                                      {page.lines.map((line, lIdx) => (
                                        <div key={lIdx} className="grid grid-cols-2 gap-2 text-sm">
                                          <div className="text-gray-700">{line.es}</div>
                                          <div className="text-gray-500">{line.en}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Note: Content editing coming soon. For now, you can view the story content at each level.
                  </p>
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
