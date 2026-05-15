// src/components/user-stories/NewStoryCard.tsx
// Placeholder "upload a story" card sized like a UserStoryCard. Lives next to
// real story cards on /my-stories and /stories so the upload feature stays
// discoverable. Click opens the upload modal.
"use client";

import { Plus } from "lucide-react";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import type { Language } from "@/types/i18n";

interface NewStoryCardProps {
  // Kept for API symmetry with sibling story cards; the placeholder itself is
  // language-agnostic — the + icon speaks for itself.
  lang?: Language;
}

export default function NewStoryCard(_props: NewStoryCardProps) {
  const { setShowUploadModal } = useStoryUpload();

  return (
    <div style={{ width: "140px", flexShrink: 0 }}>
      <button
        onClick={() => setShowUploadModal(true)}
        className="w-full aspect-[2/3] rounded-xl border-2 border-dashed border-gray-300 bg-white/50 flex items-center justify-center hover:border-blue-400 hover:bg-white/80 transition-all cursor-pointer"
      >
        <Plus className="w-8 h-8 text-gray-400" />
      </button>
    </div>
  );
}
