// src/lib/admin/cost-date-range.ts
//
// Shared preset -> {startDate, endDate} mapping for the admin cost views.
// One source of truth so the page control, the /costs route, and the /users
// route all interpret a date-range preset identically.

export type CostRangePreset = "since-launch" | "7" | "30" | "90" | "365" | "all";

export const COST_RANGE_OPTIONS: { value: CostRangePreset; label: string }[] = [
  { value: "since-launch", label: "Since tracking launch (Jun 5)" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
  { value: "all", label: "All time" },
];

// Word-translation cost tracking went live when the sonnet-4-6 pricing fix
// (commit c1ec249) merged to main and deployed on the morning of 2026-06-05
// (Fri, ~08:05 MT). Before that, word costs logged as $0. Start at the very
// start of June 5 UTC to capture all of that day with no risk of clipping
// (no real word-cost data exists before the ~08:05 MT deploy anyway).
const TRACKING_LAUNCH = "2026-06-05T00:00:00.000Z";

/**
 * Resolve a preset to ISO start/end strings. `endDate` is always "now".
 * `startDate` is null for "all" (no lower bound). Pure/deterministic given
 * the caller-supplied `now` — pass new Date() at the call site.
 */
export function resolveCostRange(
  preset: CostRangePreset,
  now: Date,
): { startDate: string | null; endDate: string } {
  const endDate = now.toISOString();
  if (preset === "all") return { startDate: null, endDate };
  if (preset === "since-launch") return { startDate: TRACKING_LAUNCH, endDate };

  const days = parseInt(preset, 10);
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { startDate: start.toISOString(), endDate };
}

/** Build the query string for the cost/users routes from a resolved range. */
export function rangeQueryString(range: { startDate: string | null; endDate: string }): string {
  const params = new URLSearchParams();
  if (range.startDate) params.set("startDate", range.startDate);
  params.set("endDate", range.endDate);
  return params.toString();
}
