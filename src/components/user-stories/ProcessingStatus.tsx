// src/components/user-stories/ProcessingStatus.tsx
"use client";

import { CheckCircle, Loader2, Clock, AlertCircle } from "lucide-react";
import { getCEFRLabel, toCEFR, type CEFRCode } from "@/lib/cefr";

interface LevelStatus {
  level: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
}

interface ProcessingStatusProps {
  storyTitle: string;
  detectedLevel?: string | null;
  levels: LevelStatus[];
  overallStatus: "PROCESSING" | "READY" | "FAILED" | "PARTIAL";
  lng?: "en" | "es";
}

const statusIcons = {
  PENDING: { icon: Clock, color: "text-gray-400", label: "Waiting" },
  PROCESSING: { icon: Loader2, color: "text-blue-500", label: "Processing", animate: true },
  READY: { icon: CheckCircle, color: "text-green-500", label: "Ready" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Failed" },
};

export default function ProcessingStatus({
  storyTitle,
  detectedLevel,
  levels,
  overallStatus,
  lng = "en",
}: ProcessingStatusProps) {
  const sortedLevels = [...levels].sort((a, b) => a.level.localeCompare(b.level));

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-2">Processing &quot;{storyTitle}&quot;</h3>

      {detectedLevel && (
        <p className="text-sm text-gray-600 mb-4">
          {lng === "es" ? "Nivel CEFR detectado:" : "Detected CEFR Level:"}{" "}
          <span className="font-medium text-blue-600">
            {getCEFRLabel(toCEFR(detectedLevel), lng)}
          </span>
        </p>
      )}

      <div className="space-y-3">
        {sortedLevels.map((level) => {
          const statusInfo = statusIcons[level.status];
          const StatusIcon = statusInfo.icon;

          return (
            <div
              key={level.level}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
            >
              <span className="text-sm text-gray-700">
                {getCEFRLabel(toCEFR(level.level), lng)}
              </span>
              <div className="flex items-center gap-2">
                <StatusIcon
                  className={`w-4 h-4 ${statusInfo.color} ${
                    (statusInfo as any).animate ? "animate-spin" : ""
                  }`}
                />
                <span className={`text-xs ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {overallStatus === "PROCESSING" && (
        <p className="text-sm text-gray-500 mt-4 text-center">
          Estimated time: 2-3 minutes
        </p>
      )}

      {overallStatus === "READY" && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg text-center">
          <p className="text-green-700 font-medium">
            Your story is ready to read!
          </p>
        </div>
      )}

      {overallStatus === "FAILED" && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg text-center">
          <p className="text-red-700 font-medium">
            Processing failed. Please try again.
          </p>
        </div>
      )}
    </div>
  );
}
