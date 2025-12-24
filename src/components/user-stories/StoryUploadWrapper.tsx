"use client";

import { StoryUploadProvider } from "@/contexts/StoryUploadContext";
import FloatingProgressWidget from "./FloatingProgressWidget";
import UploadStoryModal from "./UploadStoryModal";
import StoryReviewModal from "./StoryReviewModal";

export default function StoryUploadWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StoryUploadProvider>
      {children}
      <FloatingProgressWidget />
      <UploadStoryModal />
      <StoryReviewModal />
    </StoryUploadProvider>
  );
}
