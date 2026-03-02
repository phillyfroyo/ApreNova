"use client";

import { useState } from "react";
import type { StoryData } from "../../types";
import { STORY_TYPE_LABELS, STORY_TAG_LABELS } from "@/lib/stories";
import { formToAttribution } from "@/lib/admin/attribution-helpers";
import { fromNumericLevel } from "@/lib/cefr";

interface SaveResult {
  success: boolean;
  message: string;
  warnings?: string[];
  errors?: string[];
  details?: string;
  filesWritten?: string[];
}

interface Step7PreviewProps {
  storyData: StoryData;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  saveResult: SaveResult | null;
  setSaveResult: (r: SaveResult | null) => void;
}

export function Step7Preview({
  storyData,
  isProcessing,
  setIsProcessing,
  saveResult,
  setSaveResult,
}: Step7PreviewProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  // Only include levels that are fully generated and translated (not omitted)
  const completedLevels = [1, 2, 3, 4, 5, 6].filter(
    (l) =>
      storyData.levelContent[l]?.status === "done" &&
      storyData.levelContent[l]?.mode !== "omit" &&
      storyData.levelContent[l]?.sourceText?.length > 0 &&
      storyData.levelContent[l]?.translatedText?.length > 0
  );

  const [previewLevel, setPreviewLevel] = useState(completedLevels[0] || 1);

  const saveStory = async () => {
    setIsProcessing(true);
    setSaveResult(null);

    try {
      // Build the levels data for the API - only completed levels
      const levels = completedLevels.map((level) => {
        const content = storyData.levelContent[level];
        const isSourceEnglish = storyData.sourceLanguage === "en";

        return {
          level,
          en: isSourceEnglish ? content.sourceText : content.translatedText,
          es: isSourceEnglish ? content.translatedText : content.sourceText,
        };
      });

      // Build origin object based on isOriginal flag
      // Convert form attribution to the full format when saving
      const origin = storyData.isOriginal
        ? { isOriginal: true as const }
        : { isOriginal: false as const, attribution: formToAttribution(storyData.attribution!) };

      // Resolve effective structure type - use detected type when "auto" is selected
      const effectiveStructureType = storyData.structureType === "auto"
        ? storyData.parsedResult?.stats?.structureType
        : storyData.structureType;

      const response = await fetch("/api/admin/save-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: storyData.slug,
          title: storyData.title,
          description: storyData.description,
          hook: storyData.hook || undefined,
          levels,
          linesPerPage: storyData.linesPerPage,
          thumbnailBase64: storyData.thumbnailPreview || undefined,
          backgroundBase64: storyData.backgroundPreview || undefined,
          // Tagging data
          storyType: storyData.storyType,
          origin,
          tags: storyData.tags,
          targetAudience: storyData.targetAudience,
          // Structure type for pagination - use detected type when "auto"
          structureType: effectiveStructureType,
        }),
      });

      // Parse response with error handling for network issues
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("[save-story] Failed to parse response:", parseError);
        throw new Error("Server returned invalid response. The story may have partially saved - check the codebase.");
      }

      if (!response.ok) {
        setSaveResult({
          success: false,
          message: data.error || "Failed to save story",
          errors: data.errors || [],
          details: data.details,
          filesWritten: data.filesWritten,
        });
        return;
      }

      setSaveResult({
        success: true,
        message: `Story saved successfully!`,
        warnings: data.warnings,
        filesWritten: data.filesWritten,
      });
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
        details: err instanceof Error ? err.stack : undefined,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyErrorToClipboard = () => {
    if (!saveResult) return;
    const errorText = [
      `Error: ${saveResult.message}`,
      saveResult.details ? `Details: ${saveResult.details}` : "",
      saveResult.errors?.length ? `Errors:\n${saveResult.errors.map(e => `  - ${e}`).join("\n")}` : "",
      saveResult.filesWritten?.length ? `Files written: ${saveResult.filesWritten.join(", ")}` : "",
      `\nStory slug: ${storyData.slug}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(errorText);
  };

  const content = storyData.levelContent[previewLevel];
  const isSourceEnglish = storyData.sourceLanguage === "en";
  const enText = isSourceEnglish ? content?.sourceText : content?.translatedText;
  const esText = isSourceEnglish ? content?.translatedText : content?.sourceText;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Preview & Save</h2>
        <p className="text-gray-500 text-sm">
          Review your story before saving to the codebase.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Slug:</span>{" "}
            <span className="font-medium">{storyData.slug}</span>
          </div>
          <div>
            <span className="text-gray-500">Type:</span>{" "}
            <span className="font-medium">{STORY_TYPE_LABELS[storyData.storyType].en}</span>
          </div>
          <div>
            <span className="text-gray-500">Origin:</span>{" "}
            <span className="font-medium">
              {storyData.isOriginal ? "Cuentana Original" : `By ${storyData.attribution?.authorName || "Unknown"}`}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Audience:</span>{" "}
            <span className="font-medium capitalize">
              {storyData.targetAudience === "all" ? "All Ages" : storyData.targetAudience}
            </span>
          </div>
          {storyData.tags.length > 0 && (
            <div className="col-span-2">
              <span className="text-gray-500">Tags:</span>{" "}
              <span className="font-medium">{storyData.tags.map(t => STORY_TAG_LABELS[t].en).join(", ")}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Levels:</span>{" "}
            <span className="font-medium">{completedLevels.map((l) => `L${l}`).join(", ") || "None"}</span>
          </div>
          <div>
            <span className="text-gray-500">Title (EN):</span>{" "}
            <span className="font-medium">{storyData.title.en}</span>
          </div>
          <div>
            <span className="text-gray-500">Title (ES):</span>{" "}
            <span className="font-medium">{storyData.title.es}</span>
          </div>
        </div>
      </div>

      {/* Level Preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Content Preview</h3>
          <div className="flex gap-1">
            {completedLevels.map((level) => (
              <button
                key={level}
                onClick={() => setPreviewLevel(level)}
                className={`px-3 py-1 rounded text-sm ${
                  previewLevel === level
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                L{level}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">English</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border h-48 overflow-auto whitespace-pre-wrap">
              {enText || "No content"}
            </pre>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Spanish</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border h-48 overflow-auto whitespace-pre-wrap">
              {esText || "No content"}
            </pre>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {saveResult ? (
        <div className="space-y-3">
          <div
            className={`p-4 rounded-lg ${
              saveResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium mb-1">
                  {saveResult.success ? "Success!" : "Save Failed"}
                </div>
                <div className="text-sm">{saveResult.message}</div>
              </div>
              {!saveResult.success && (
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={copyErrorToClipboard}
                    className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 rounded transition-colors"
                    title="Copy error details to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setSaveResult(null)}
                    className="px-3 py-1 text-xs bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {saveResult.success && (
              <>
                {saveResult.filesWritten && saveResult.filesWritten.length > 0 && (
                  <p className="text-sm mt-2">
                    Files written: <code className="bg-green-100 px-1 rounded text-xs">{saveResult.filesWritten.length} files</code>
                  </p>
                )}
                <p className="text-sm mt-2">
                  Restart your dev server to see the new story:
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {completedLevels.map((level) => (
                    <code key={level} className="bg-green-100 px-2 py-1 rounded text-xs">
                      /en/stories/{storyData.slug}/{fromNumericLevel(level)}/1/1
                    </code>
                  ))}
                </div>
              </>
            )}

            {/* Error details for failures */}
            {!saveResult.success && (saveResult.errors?.length || saveResult.details || saveResult.filesWritten?.length) && (
              <div className="mt-3">
                <button
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="text-xs underline hover:no-underline"
                >
                  {showErrorDetails ? "Hide details" : "Show details"}
                </button>

                {showErrorDetails && (
                  <div className="mt-2 p-3 bg-red-100 rounded text-xs space-y-2">
                    {saveResult.errors && saveResult.errors.length > 0 && (
                      <div>
                        <div className="font-medium mb-1">Errors:</div>
                        <ul className="list-disc list-inside">
                          {saveResult.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {saveResult.filesWritten && saveResult.filesWritten.length > 0 && (
                      <div>
                        <div className="font-medium mb-1">Partially saved files:</div>
                        <ul className="list-disc list-inside">
                          {saveResult.filesWritten.map((file, idx) => (
                            <li key={idx}>{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {saveResult.details && (
                      <div>
                        <div className="font-medium mb-1">Technical details:</div>
                        <pre className="whitespace-pre-wrap text-[10px] bg-red-200 p-2 rounded overflow-auto max-h-32">
                          {saveResult.details}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {saveResult.warnings && saveResult.warnings.length > 0 && (
            <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800">
              <div className="font-medium mb-1">Warnings</div>
              <ul className="text-sm list-disc list-inside">
                {saveResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
              <p className="text-xs mt-2">
                Line count mismatches may cause EN/ES translations to be misaligned.
                Please review the generated content files.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center pt-4">
          <button
            onClick={saveStory}
            disabled={isProcessing}
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? "Saving..." : "Save Story to Codebase"}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            This will create content files and update metadata.
          </p>
        </div>
      )}
    </div>
  );
}

export default Step7Preview;

// Export type for use in parent component
export type { SaveResult };
