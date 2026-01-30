"use client";

import type { StoryData } from "../../types";

interface Step6PaginateProps {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
}

export function Step6Paginate({
  storyData,
  updateStoryData,
}: Step6PaginateProps) {
  const lines = storyData.rawText.split("\n").filter((l) => l.trim());
  const totalLines = lines.length;
  const hasPageMarkers = lines.some(l => {
    const trimmed = l.trim().toUpperCase();
    return trimmed === "PAGE" || trimmed === "---PAGE---" || trimmed === "[PAGE]" || trimmed === "PAGE BREAK";
  });
  const pageMarkerCount = lines.filter(l => {
    const trimmed = l.trim().toUpperCase();
    return trimmed === "PAGE" || trimmed === "---PAGE---" || trimmed === "[PAGE]" || trimmed === "PAGE BREAK";
  }).length;

  // Check if anthology/poetry auto-pagination is active
  // When structureType is "auto", use the detected structure from preprocessing
  const effectiveStructureType = storyData.structureType === "auto"
    ? storyData.parsedResult?.stats?.structureType
    : storyData.structureType;

  // Anthology gets per-poem pagination
  const isAnthology = effectiveStructureType === "anthology" ||
                      storyData.storyType === "poem" ||
                      storyData.storyType === "song-lyrics";

  const estimatedPages = hasPageMarkers
    ? pageMarkerCount + 1
    : Math.ceil(totalLines / storyData.linesPerPage);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Pagination Settings</h2>
        <p className="text-gray-500 text-sm">
          Configure how the story will be split into pages.
        </p>
      </div>

      {isAnthology && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-medium text-purple-900 mb-1">Poetry Anthology Auto-Pagination</h3>
          <p className="text-sm text-purple-700">
            Each poem will be placed on its own page automatically. The system detects poem boundaries
            from chapter markers and section headers. Manual pagination settings below are ignored.
          </p>
          <p className="text-xs text-purple-600 mt-2">
            To use manual pagination instead, change &quot;Content Structure&quot; in the Metadata step.
          </p>
        </div>
      )}

      {hasPageMarkers && !isAnthology && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-1">Manual Page Markers Detected</h3>
          <p className="text-sm text-green-700">
            Found {pageMarkerCount} PAGE marker{pageMarkerCount > 1 ? "s" : ""} in your text.
            The story will be paginated at these markers, ignoring the &quot;lines per page&quot; setting.
          </p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lines Per Page
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={storyData.linesPerPage}
              onChange={(e) =>
                updateStoryData({ linesPerPage: Math.max(1, parseInt(e.target.value) || 10) })
              }
              disabled={hasPageMarkers || isAnthology}
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${hasPageMarkers || isAnthology ? "bg-gray-100 text-gray-500" : ""}`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {isAnthology
                ? "Disabled for poetry anthology (auto-pagination)"
                : hasPageMarkers
                ? "Disabled when using PAGE markers"
                : "Default is 10. Use higher for longer stories, lower for poems."}
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {isAnthology ? "Auto" : estimatedPages}
              </div>
              <div className="text-sm text-gray-500">
                {isAnthology
                  ? "One poem per page"
                  : hasPageMarkers
                  ? "Pages (from markers)"
                  : "Estimated Pages"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Preview Structure</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Total lines: {totalLines - pageMarkerCount} (excluding markers)</li>
          <li>• {isAnthology
              ? "Pagination: One poem per page (auto)"
              : hasPageMarkers
              ? `PAGE markers: ${pageMarkerCount}`
              : `Lines per page: ${storyData.linesPerPage}`}</li>
          <li>• {isAnthology
              ? "Pages: Determined by poem count"
              : hasPageMarkers
              ? `Pages: ${estimatedPages}`
              : `Estimated pages: ${estimatedPages}`}</li>
          <li>• Generated levels: {[1, 2, 3, 4, 5].filter(l => storyData.levelContent[l]?.status === "done" && storyData.levelContent[l]?.mode !== "omit").map((l) => `L${l}`).join(", ") || "None"}</li>
        </ul>
      </div>

      {!isAnthology && (
        <div className="border-t pt-4">
          <h3 className="font-medium text-gray-900 mb-2">Quick Presets</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => updateStoryData({ linesPerPage: totalLines })}
              disabled={hasPageMarkers}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Single Page ({totalLines} lines)
            </button>
            <button
              onClick={() => updateStoryData({ linesPerPage: 10 })}
              disabled={hasPageMarkers}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Standard (10 lines)
            </button>
            <button
              onClick={() => updateStoryData({ linesPerPage: 5 })}
              disabled={hasPageMarkers}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Short (5 lines)
            </button>
          </div>
        </div>
      )}

      {!isAnthology && (
        <div className="border-t pt-4">
          <h3 className="font-medium text-gray-900 mb-2">Manual Page Breaks</h3>
          <p className="text-sm text-gray-600 mb-2">
            For precise control, add these markers on their own line in your source text:
          </p>
          <div className="flex gap-2 flex-wrap">
            <code className="px-2 py-1 bg-gray-100 rounded text-sm">PAGE</code>
            <code className="px-2 py-1 bg-gray-100 rounded text-sm">---PAGE---</code>
            <code className="px-2 py-1 bg-gray-100 rounded text-sm">[PAGE]</code>
            <code className="px-2 py-1 bg-gray-100 rounded text-sm">PAGE BREAK</code>
          </div>
        </div>
      )}
    </div>
  );
}

export default Step6Paginate;
