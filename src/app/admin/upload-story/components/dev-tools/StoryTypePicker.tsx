// src/app/admin/upload-story/components/dev-tools/StoryTypePicker.tsx
// Grid of story type cards for SU TP Algorithms

import type { StoryType, FileType } from "@/lib/story-processing/text-processors";

interface StoryTypePickerProps {
  fileType: FileType;
  onSelect: (storyType: StoryType) => void;
  onBack: () => void;
  fileCounts?: Partial<Record<StoryType, number>>;
}

const STORY_TYPE_INFO: Record<StoryType, { label: string; description: string; icon: string }> = {
  anthology: {
    label: "Anthology",
    description: "Poetry collections, short story compilations",
    icon: "📚",
  },
  prose: {
    label: "Prose",
    description: "Novels, short stories, articles",
    icon: "📖",
  },
  epic: {
    label: "Epic",
    description: "Narrative poetry, long-form verse",
    icon: "🏛️",
  },
  script: {
    label: "Script",
    description: "Screenplays, transcripts, dialogue",
    icon: "🎬",
  },
};

const FILE_TYPE_LABELS: Record<FileType, string> = {
  html: "HTML",
  txt: "TXT",
  rtf: "RTF",
  md: "Markdown",
};

export function StoryTypePicker({
  fileType,
  onSelect,
  onBack,
  fileCounts = {},
}: StoryTypePickerProps) {
  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2"
      >
        <span>←</span>
        <span>Back to File Types</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {FILE_TYPE_LABELS[fileType]} Files
        </h3>
        <p className="text-sm text-gray-500">Select a story type</p>
      </div>

      {/* Story type grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(STORY_TYPE_INFO) as StoryType[]).map((storyType) => {
          const info = STORY_TYPE_INFO[storyType];
          const count = fileCounts[storyType] || 0;

          return (
            <button
              key={storyType}
              onClick={() => onSelect(storyType)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all text-left group"
            >
              <div className="text-3xl mb-3">{info.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                {info.label}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{info.description}</p>
              {count > 0 && (
                <div className="mt-3 text-xs text-gray-400">
                  {count} test file{count !== 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
