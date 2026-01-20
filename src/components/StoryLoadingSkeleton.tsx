// src/components/StoryLoadingSkeleton.tsx
// Shared loading skeleton for story reader pages
// Used by loading.tsx files and StreamingStoryReader component

interface StoryLoadingSkeletonProps {
  message?: string;
}

export default function StoryLoadingSkeleton({
  message = "Loading story..."
}: StoryLoadingSkeletonProps) {
  return (
    <div className="min-h-screen px-1.5 sm:px-4 pt-6 pb-[32rem] bg-gradient-to-br from-emerald-50 to-teal-100 animate-pulse">
      {/* Menu button skeleton */}
      <header className="fixed top-4 left-4 z-50">
        <div className="p-2 rounded-md bg-white/80 border border-emerald-300 shadow-md w-9 h-9" />
      </header>

      {/* Content area */}
      <div className="max-w-2xl mx-auto pt-12">
        {/* Title skeleton */}
        <div className="h-8 bg-white/50 rounded-lg w-3/4 mx-auto mb-8" />

        {/* Sentences skeleton - simulate 6-8 lines of text */}
        <div className="space-y-6">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="space-y-2">
              {/* Main text line - deterministic widths to avoid hydration mismatch */}
              <div
                className="h-6 bg-white/40 rounded"
                style={{ width: `${70 + (i * 7) % 25}%` }}
              />
              {/* Occasional second line for longer sentences */}
              {i % 3 === 0 && (
                <div
                  className="h-6 bg-white/40 rounded"
                  style={{ width: `${40 + (i * 11) % 30}%` }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex justify-center gap-4 mt-12">
          <div className="h-10 w-24 bg-white/50 rounded-lg" />
          <div className="h-10 w-16 bg-white/50 rounded-lg" />
          <div className="h-10 w-24 bg-white/50 rounded-lg" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 px-4 py-2 rounded-full shadow-lg">
        <svg
          className="w-5 h-5 animate-spin text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm text-gray-600 font-medium">{message}</span>
      </div>
    </div>
  );
}
