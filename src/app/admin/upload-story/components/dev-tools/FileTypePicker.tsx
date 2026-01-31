// src/app/admin/upload-story/components/dev-tools/FileTypePicker.tsx
// Grid of file type cards for SU TP Algorithms

import type { FileType } from "@/lib/story-processing/text-processors";

interface FileTypePickerProps {
  onSelect: (fileType: FileType) => void;
  fileCounts?: Partial<Record<FileType, number>>;
}

const FILE_TYPE_INFO: Record<FileType, { label: string; description: string; icon: string }> = {
  html: {
    label: "HTML",
    description: "Web pages, Gutenberg downloads",
    icon: "🌐",
  },
  txt: {
    label: "TXT",
    description: "Plain text files",
    icon: "📄",
  },
  rtf: {
    label: "RTF",
    description: "Rich text format",
    icon: "📝",
  },
  md: {
    label: "Markdown",
    description: "Markdown formatted text",
    icon: "📑",
  },
};

export function FileTypePicker({ onSelect, fileCounts = {} }: FileTypePickerProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {(Object.keys(FILE_TYPE_INFO) as FileType[]).map((fileType) => {
        const info = FILE_TYPE_INFO[fileType];
        const count = fileCounts[fileType] || 0;

        return (
          <button
            key={fileType}
            onClick={() => onSelect(fileType)}
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
  );
}
