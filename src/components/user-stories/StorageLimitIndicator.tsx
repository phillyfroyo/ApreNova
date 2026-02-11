// src/components/user-stories/StorageLimitIndicator.tsx
"use client";

import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface StorageLimitIndicatorProps {
  currentCount: number;
  maxCount: number;
  isPremium: boolean;
  lng?: Language;
}

export default function StorageLimitIndicator({
  currentCount,
  maxCount,
  isPremium,
  lng = "en",
}: StorageLimitIndicatorProps) {
  const isUnlimited = maxCount === -1;
  const percentage = isUnlimited ? 0 : (currentCount / maxCount) * 100;
  const isNearLimit = !isUnlimited && percentage >= 66;
  const isAtLimit = !isUnlimited && currentCount >= maxCount;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">
            {isUnlimited ? (
              <>{t(lng, "myStories", "storiesCountUnlimited", { count: currentCount })}</>
            ) : (
              <>
                {t(lng, "myStories", "storiesCountLimit", { count: currentCount, max: maxCount })}
              </>
            )}
          </span>
          {!isPremium && (
            <span className="text-xs text-gray-400">{t(lng, "myStories", "freeTier")}</span>
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
