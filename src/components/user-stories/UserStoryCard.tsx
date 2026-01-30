// src/components/user-stories/UserStoryCard.tsx
"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Clock, CheckCircle, AlertCircle, Loader2, XCircle } from "lucide-react";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface UserStoryCardProps {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  status: "PROCESSING" | "READY" | "FAILED" | "PARTIAL" | "CANCELLED";
  /** Whether the story has any readable chapters (for cancelled stories) */
  hasReadableChapters?: boolean;
  /** Language for translations */
  lang?: Language;
  onClick: () => void;
}

// Display status can differ from database status
// Card shows "Ready" for cancelled stories with readable content (more inviting)
// Detail modal shows "Partial" indicator for those stories
type DisplayStatus = "PROCESSING" | "READY" | "FAILED" | "PARTIAL" | "CANCELLED";

// Map display status to translation key in myStories section
const statusTranslationKeys: Record<DisplayStatus, string> = {
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
  PARTIAL: "partial",
  CANCELLED: "cancelled",
};

const statusConfig: Record<DisplayStatus, {
  icon: typeof Loader2;
  color: string;
  bg: string;
  animate: boolean;
}> = {
  PROCESSING: {
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-100",
    animate: true,
  },
  READY: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-100",
    animate: false,
  },
  FAILED: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-100",
    animate: false,
  },
  PARTIAL: {
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-100",
    animate: false,
  },
  CANCELLED: {
    icon: XCircle,
    color: "text-gray-500",
    bg: "bg-gray-100",
    animate: false,
  },
};

export default function UserStoryCard({
  id,
  title,
  thumbnailUrl,
  status,
  hasReadableChapters = false,
  lang = "en",
  onClick,
}: UserStoryCardProps) {
  // Compute display status for card badge:
  // - CANCELLED with readable content shows as "Ready" (more inviting on card)
  // - Detail modal will show "Partial" indicator for these stories
  const displayStatus: DisplayStatus =
    status === "CANCELLED" && hasReadableChapters ? "READY" : status;

  const statusInfo = statusConfig[displayStatus];
  const StatusIcon = statusInfo.icon;
  const statusLabel = t(lang, "myStories", statusTranslationKeys[displayStatus]);

  // All stories are clickable (to open modal for viewing/deleting)
  // Visual styling indicates cancelled stories with no readable chapters
  const isCancelledWithNoChapters = status === "CANCELLED" && !hasReadableChapters;

  // Filter out invalid blob URLs (they don't persist across page refreshes)
  const validThumbnailUrl = thumbnailUrl && !thumbnailUrl.startsWith("blob:") ? thumbnailUrl : null;

  return (
    <div
      style={{
        width: "160px",
        flexShrink: 0,
        scrollSnapAlign: "start",
      }}
    >
      <motion.div
        layoutId={`user-story-${id}`}
        onClick={onClick}
        whileHover={
          typeof window !== "undefined" &&
          window.matchMedia("(hover: hover)").matches
            ? { scale: 1.05 }
            : undefined
        }
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`rounded-xl overflow-hidden w-full cursor-pointer ${
          isCancelledWithNoChapters ? "opacity-60" : ""
        }`}
      >
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100">
        {validThumbnailUrl ? (
          <Image
            src={validThumbnailUrl}
            alt={title}
            fill
            sizes="160px"
            className="object-cover rounded-xl"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
            <span className="text-4xl">📖</span>
          </div>
        )}

        {/* Status badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-1 rounded-full ${statusInfo.bg} flex items-center gap-1`}
        >
          <StatusIcon
            className={`w-3 h-3 ${statusInfo.color} ${
              statusInfo.animate ? "animate-spin" : ""
            }`}
          />
          <span className={`text-xs font-medium ${statusInfo.color}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <p className="text-center text-sm mt-2 whitespace-nowrap overflow-hidden text-ellipsis px-1">
        {title}
      </p>
    </motion.div>
    </div>
  );
}
