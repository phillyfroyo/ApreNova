// src/components/user-stories/StorageLimitIndicator.tsx
"use client";

import { USER_STORY_LIMITS } from "@/lib/user-stories/limits";

interface StorageLimitIndicatorProps {
  currentCount: number;
  maxCount: number;
  isPremium: boolean;
}

export default function StorageLimitIndicator({
  currentCount,
  maxCount,
  isPremium,
}: StorageLimitIndicatorProps) {
  const isUnlimited = maxCount === Infinity;
  const percentage = isUnlimited ? 0 : (currentCount / maxCount) * 100;
  const isNearLimit = !isUnlimited && percentage >= 66;
  const isAtLimit = !isUnlimited && currentCount >= maxCount;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">
            {isUnlimited ? (
              <>Stories: {currentCount}</>
            ) : (
              <>
                {currentCount} / {maxCount} stories
              </>
            )}
          </span>
          {!isPremium && (
            <span className="text-xs text-gray-400">Free tier</span>
          )}
        </div>
        {!isUnlimited && (
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isAtLimit
                  ? "bg-red-500"
                  : isNearLimit
                  ? "bg-yellow-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
