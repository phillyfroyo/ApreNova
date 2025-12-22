// src/components/user-stories/UserStoryCard.tsx
"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface UserStoryCardProps {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  status: "PROCESSING" | "READY" | "FAILED" | "PARTIAL";
  onClick: () => void;
}

const statusConfig = {
  PROCESSING: {
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-100",
    label: "Processing...",
    animate: true,
  },
  READY: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-100",
    label: "Ready",
    animate: false,
  },
  FAILED: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-100",
    label: "Failed",
    animate: false,
  },
  PARTIAL: {
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-100",
    label: "Partial",
    animate: false,
  },
};

export default function UserStoryCard({
  id,
  title,
  thumbnailUrl,
  status,
  onClick,
}: UserStoryCardProps) {
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  return (
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
      className="cursor-pointer rounded-xl overflow-hidden w-40 flex-shrink-0 scroll-snap-align-start"
    >
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
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
            {statusInfo.label}
          </span>
        </div>
      </div>

      <p className="text-center text-sm mt-2 whitespace-nowrap overflow-hidden text-ellipsis px-1">
        {title}
      </p>
    </motion.div>
  );
}
