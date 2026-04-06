"use client";
import { useState } from "react";
import DraftUpload from "./components/story-tester/DraftUpload";
import DraftList from "./components/story-tester/DraftList";
import DraftReader from "./components/story-tester/DraftReader";

type SubView = "stories" | "upload";

export default function StoryTester() {
  const [view, setView] = useState<SubView | "read">("stories");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (view === "read" && selectedDraftId) {
    return (
      <DraftReader
        draftId={selectedDraftId}
        onBack={() => { setView("stories"); setSelectedDraftId(null); }}
      />
    );
  }

  return (
    <div>
      {/* Sub-tab navigation */}
      <div className="flex gap-2 mb-6">
        {(["stories", "upload"] as SubView[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`px-4 py-2 text-sm rounded-lg ${
              view === tab
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {tab === "stories" ? "Stories" : "Upload"}
          </button>
        ))}
      </div>

      {view === "stories" && (
        <DraftList
          refreshKey={refreshKey}
          onRead={(id) => { setSelectedDraftId(id); setView("read"); }}
        />
      )}
      {view === "upload" && (
        <DraftUpload onSaved={() => { setRefreshKey((k) => k + 1); setView("stories"); }} />
      )}
    </div>
  );
}
