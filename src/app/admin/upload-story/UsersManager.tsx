"use client";

import { useState, useEffect } from "react";
import { resolveCostRange, rangeQueryString, type CostRangePreset } from "@/lib/admin/cost-date-range";

interface UserSummary {
  totalUsers: number;
  totalStories: number;
  totalCostCents: number;
  avgCostPerUser: number;
  avgCostPerStory: number;
  monthCostCents: number;
}

interface UserListItem {
  id: string;
  userNumber: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  nativeLanguage: string | null;
  quizLevel: string | null;
  isPremium: boolean;
  readingMs: number;
  distinctReturnDays: number;
  lastActiveAt: string | null;
  isReturning: boolean;
  createdAt: string;
  deletedAt: string | null;
  storyCount: number;
  totalCostCents: number;
  avgCostPerStory: number;
}

type SortField = "userNumber" | "cost" | "stories" | "reading" | "returns";

interface UserDetail {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
}

interface UserDetailSummary {
  totalStories: number;
  deletedStoryCount: number;
  deletedStoryCostCents: number;
  totalWords: number;
  totalCostCents: number;
  storyCostCents: number;
  otherCostCents: number;
  avgWordsPerStory: number;
  avgCostPerStory: number;
  avgCostPerThousandWords: number;
}

interface StoryDetail {
  id: string;
  title: string;
  storyType: string | null;
  status: string;
  wordCount: number;
  costCents: number;
  costPerThousandWords: number;
  createdAt: string;
}

interface OperationBreakdown {
  operation: string;
  label: string;
  costCents: number;
  count: number;
}

interface InStoryUsage {
  totalCostCents: number;
  breakdown: OperationBreakdown[];
}

interface TutorUsage {
  totalCostCents: number;
  messageCount: number;
  breakdown: OperationBreakdown[];
}

interface StoryReadingTime {
  storySlug: string;
  ms: number;
}

interface ReadingTime {
  totalMs: number;
  byStory: StoryReadingTime[];
}

interface UsersData {
  summary: UserSummary;
  users: UserListItem[];
}

interface UserDetailsData {
  user: UserDetail;
  summary: UserDetailSummary;
  stories: StoryDetail[];
  inStoryUsage: InStoryUsage;
  tutorUsage: TutorUsage;
  readingTime: ReadingTime;
}

type DetailTab = "reading" | "in-story" | "stories" | "tutor";

function formatCents(microcents: number): string {
  const dollars = microcents / 1_000_000;
  if (dollars < 0.01 && dollars > 0) return "<$0.01";
  return `$${dollars.toFixed(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatReadingTime(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Internal level → CEFR label
const CEFR_LABELS: Record<string, string> = {
  l1: "A1",
  l2: "A2",
  l3: "B1",
  l4: "B2",
  l5: "C1",
};

// Story type formatting
const STORY_TYPE_LABELS: Record<string, string> = {
  "short-story": "Short Story",
  poem: "Poem",
  fable: "Fable",
  folktale: "Folktale",
  novel: "Novel",
  article: "Article",
  dialogue: "Dialogue",
  "song-lyrics": "Song Lyrics",
  epic: "Epic",
  myth: "Myth",
  legend: "Legend",
  "movie-script": "Movie Script",
  "tv-script": "TV Script",
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  READY: "bg-green-100 text-green-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  PENDING_REVIEW: "bg-blue-100 text-blue-700",
};

export default function UsersManager({ costRange }: { costRange: CostRangePreset }) {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>("userNumber");
  const [sortDesc, setSortDesc] = useState(false);

  // Filter: when on, show only users who came back after their signup day
  const [returningOnly, setReturningOnly] = useState(false);

  // Selected user details
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetailsData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("stories");

  // Tracks which field was just copied, e.g. `${userId}:email` — used to show brief confirmation
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function copyToClipboard(value: string, fieldKey: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldKey);
      window.setTimeout(() => {
        setCopiedField((current) => (current === fieldKey ? null : current));
      }, 1200);
    } catch {
      // Clipboard may be unavailable (insecure context). Fallback: select the text node.
      const range = document.createRange();
      range.selectNodeContents(e.currentTarget as Node);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  // Refetch the user list whenever the shared date range changes.
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costRange]);

  // Refetch the open user's detail when the selection OR the range changes,
  // so the per-student breakdown always matches the selected window.
  useEffect(() => {
    if (selectedUserId) {
      fetchUserDetails(selectedUserId);
      setActiveDetailTab("reading");
    } else {
      setUserDetails(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, costRange]);

  function rangeQs() {
    return rangeQueryString(resolveCostRange(costRange, new Date()));
  }

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?${rangeQs()}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserDetails(userId: string) {
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}&${rangeQs()}`);
      if (!res.ok) throw new Error("Failed to fetch user details");
      const json = await res.json();
      setUserDetails(json);
    } catch (err) {
      console.error("Failed to fetch user details:", err);
    } finally {
      setDetailsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            <div className="h-20 sm:h-24 bg-gray-200 rounded"></div>
            <div className="h-20 sm:h-24 bg-gray-200 rounded"></div>
            <div className="h-20 sm:h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error: {error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 text-red-600 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Compute tab cost values for the tab strip
  const storyUploadCost = userDetails
    ? userDetails.summary.storyCostCents + userDetails.summary.deletedStoryCostCents
    : 0;
  const inStoryCost = userDetails?.inStoryUsage?.totalCostCents ?? 0;
  const tutorCost = userDetails?.tutorUsage?.totalCostCents ?? 0;

  const totalInStoryRequests = userDetails?.inStoryUsage?.breakdown.reduce(
    (sum, b) => sum + b.count,
    0
  ) ?? 0;
  const featureCount = userDetails?.inStoryUsage?.breakdown.length ?? 0;

  const tutorMessageCount = userDetails?.tutorUsage?.messageCount ?? 0;
  const totalTutorApiCalls = userDetails?.tutorUsage?.breakdown.reduce(
    (sum, b) => sum + b.count,
    0
  ) ?? 0;

  // Sort users
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      // Default direction: userNumber asc, others desc
      setSortDesc(field !== "userNumber");
    }
  }

  const filteredUsers = returningOnly
    ? data.users.filter((u) => u.isReturning)
    : data.users;

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let diff = 0;
    switch (sortField) {
      case "userNumber": diff = a.userNumber - b.userNumber; break;
      case "cost": diff = a.totalCostCents - b.totalCostCents; break;
      case "stories": diff = a.storyCount - b.storyCount; break;
      case "reading": diff = a.readingMs - b.readingMs; break;
      case "returns": diff = a.distinctReturnDays - b.distinctReturnDays; break;
    }
    return sortDesc ? -diff : diff;
  });


  return (
    <div className="max-w-6xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">User Analytics</h2>
        <button
          onClick={fetchUsers}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Users</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {data.summary.totalUsers}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Stories</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {data.summary.totalStories}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Total Cost</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {formatCents(data.summary.totalCostCents)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">This Month</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {formatCents(data.summary.monthCostCents)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Avg/User</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {formatCents(data.summary.avgCostPerUser)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Avg/Story</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600">
            {formatCents(data.summary.avgCostPerStory)}
          </div>
        </div>
      </div>

      {/* Two Column Layout: User List + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* User List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-3 sm:px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">Users</h3>
              <p className="text-xs text-gray-500">Tap to view details</p>
            </div>
            <div className="flex gap-1 flex-wrap items-center">
              {([
                ["userNumber", "#"],
                ["cost", "Cost"],
                ["stories", "Stories"],
                ["reading", "Reading"],
                ["returns", "Returns"],
              ] as [SortField, string][]).map(([field, label]) => (
                <button
                  key={field}
                  onClick={() => handleSort(field)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    sortField === field
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="text-gray-300 mx-1" aria-hidden="true">|</span>
              <button
                onClick={() => setReturningOnly((v) => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  returningOnly
                    ? "bg-green-100 text-green-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="Show only users who returned after signup day"
              >
                Returning only
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] sm:max-h-[500px] overflow-y-auto">
            {data.users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No registered users yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() =>
                      setSelectedUserId(
                        selectedUserId === user.id ? null : user.id
                      )
                    }
                    className={`w-full px-3 sm:px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedUserId === user.id ? "bg-blue-50" : ""
                    } ${user.deletedAt ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-gray-400 flex-shrink-0">
                            #{user.userNumber}
                          </span>
                          <span className="font-medium text-gray-900 truncate">
                            {user.name || "Anonymous"}
                          </span>
                          {user.deletedAt && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 flex-shrink-0">
                              Deleted
                            </span>
                          )}
                          {user.isPremium && !user.deletedAt && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
                              Premium
                            </span>
                          )}
                        </div>
                        {user.email && (
                          <div className="text-xs text-gray-400 truncate flex items-center gap-1.5">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => copyToClipboard(user.email!, `${user.id}:email`, e)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  copyToClipboard(user.email!, `${user.id}:email`, e as unknown as React.MouseEvent);
                                }
                              }}
                              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-medium flex-shrink-0 transition-colors w-12 text-center"
                              aria-label="Copy email"
                            >
                              {copiedField === `${user.id}:email` ? "Copied" : "Copy"}
                            </span>
                            <span className="truncate">{user.email}</span>
                          </div>
                        )}
                        {user.phone && (
                          <div className="text-xs text-emerald-600 truncate flex items-center gap-1.5">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => copyToClipboard(user.phone!, `${user.id}:phone`, e)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  copyToClipboard(user.phone!, `${user.id}:phone`, e as unknown as React.MouseEvent);
                                }
                              }}
                              className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[10px] font-medium flex-shrink-0 transition-colors w-12 text-center"
                              aria-label="Copy phone"
                            >
                              {copiedField === `${user.id}:phone` ? "Copied" : "Copy"}
                            </span>
                            <span className="truncate">{user.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {user.nativeLanguage && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                              {user.nativeLanguage}
                            </span>
                          )}
                          {user.quizLevel && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                              {CEFR_LABELS[user.quizLevel] || user.quizLevel.toUpperCase()}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {user.storyCount} stories
                          </span>
                          {user.readingMs > 0 && (
                            <span className="text-xs text-gray-500">
                              · {formatReadingTime(user.readingMs)}
                            </span>
                          )}
                          {user.distinctReturnDays > 0 && (
                            <span
                              className="text-xs text-gray-500"
                              title={`Returned on ${user.distinctReturnDays} distinct day(s) after signup`}
                            >
                              · {user.distinctReturnDays}d returned
                            </span>
                          )}
                          {user.isReturning && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium flex-shrink-0"
                              title="Returned at least once after signup day"
                            >
                              ↺ Returning
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            · {formatDate(user.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <div className="font-medium text-gray-900">
                          {formatCents(user.totalCostCents)}
                        </div>
                        {user.storyCount > 0 && (
                          <div className="text-xs text-gray-500">
                            {formatCents(user.avgCostPerStory)}/story
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="bg-white rounded-lg border border-gray-200">
          {!selectedUserId ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Cost Details</h3>
              </div>
              <div className="p-8 text-center text-gray-400">
                Select a user to view their cost breakdown
              </div>
            </>
          ) : detailsLoading ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Cost Details</h3>
              </div>
              <div className="p-8 text-center text-gray-500">
                Loading...
              </div>
            </>
          ) : userDetails ? (
            <div>
              {/* 4-Tab Strip */}
              <div className="flex border-b border-gray-200">
                {([
                  { key: "reading" as DetailTab, label: "Time Reading", subtitle: formatReadingTime(userDetails.readingTime?.totalMs ?? 0) },
                  { key: "in-story" as DetailTab, label: "In-Story Usage", subtitle: formatCents(inStoryCost) },
                  { key: "stories" as DetailTab, label: "Story Uploads", subtitle: formatCents(storyUploadCost) },
                  { key: "tutor" as DetailTab, label: "AI Tutor", subtitle: formatCents(tutorCost) },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDetailTab(tab.key)}
                    className={`flex-1 px-2 py-3 text-sm font-medium text-center transition-colors ${
                      activeDetailTab === tab.key
                        ? "border-b-2 border-blue-500 text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <div className="text-xs sm:text-sm">{tab.label}</div>
                    <div className="text-xs mt-0.5">{tab.subtitle}</div>
                  </button>
                ))}
              </div>

              {/* Tab-Aware Summary Card */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                {activeDetailTab === "reading" && (() => {
                  const totalMs = userDetails.readingTime?.totalMs ?? 0;
                  const storyCount = userDetails.readingTime?.byStory.length ?? 0;
                  return (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          {totalMs > 0 ? formatReadingTime(totalMs) : "—"}
                        </div>
                        <div className="text-xs text-gray-500">Total Time</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          {storyCount}
                        </div>
                        <div className="text-xs text-gray-500">Stories Tracked</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600">
                          {storyCount > 0
                            ? formatReadingTime(Math.round(totalMs / storyCount))
                            : "—"}
                        </div>
                        <div className="text-xs text-gray-500">Avg/Story</div>
                      </div>
                    </div>
                  );
                })()}
                {activeDetailTab === "stories" && (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatNumber(userDetails.summary.totalWords)}
                      </div>
                      <div className="text-xs text-gray-500">Total Words</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatCents(storyUploadCost)}
                      </div>
                      <div className="text-xs text-gray-500">Upload Cost</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCents(userDetails.summary.avgCostPerThousandWords)}
                      </div>
                      <div className="text-xs text-gray-500">Per 1K Words</div>
                    </div>
                  </div>
                )}
                {activeDetailTab === "in-story" && (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatNumber(totalInStoryRequests)}
                      </div>
                      <div className="text-xs text-gray-500">Requests</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatCents(inStoryCost)}
                      </div>
                      <div className="text-xs text-gray-500">Total Cost</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {featureCount}
                      </div>
                      <div className="text-xs text-gray-500">Features Used</div>
                    </div>
                  </div>
                )}
                {activeDetailTab === "tutor" && (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatNumber(tutorMessageCount)}
                      </div>
                      <div className="text-xs text-gray-500">Messages</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatCents(tutorCost)}
                      </div>
                      <div className="text-xs text-gray-500">Total Cost</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatNumber(totalTutorApiCalls)}
                      </div>
                      <div className="text-xs text-gray-500">API Calls</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Time Reading Tab */}
              {activeDetailTab === "reading" && (() => {
                const totalMs = userDetails.readingTime?.totalMs ?? 0;
                const byStory = userDetails.readingTime?.byStory ?? [];
                const attributedMs = byStory.reduce((sum, s) => sum + s.ms, 0);
                const unattributedMs = totalMs - attributedMs;

                return (
                  <div className="max-h-[380px] overflow-y-auto">
                    {totalMs === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <div className="text-gray-400 mb-1">No reading data yet</div>
                        <div className="text-xs text-gray-400">
                          Reading time will appear here as the user reads stories
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-gray-100">
                          {byStory.map((story) => (
                            <div key={story.storySlug} className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900">
                                  {story.storySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                </div>
                                <div className="font-medium text-gray-900">
                                  {formatReadingTime(story.ms)}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {story.storySlug}
                              </div>
                            </div>
                          ))}
                        </div>
                        {unattributedMs > 0 && (
                          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">
                                Unattributed
                                <span className="text-xs text-gray-400 ml-1">(before per-story tracking)</span>
                              </span>
                              <span className="font-medium text-gray-700">
                                {formatReadingTime(unattributedMs)}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Story Uploads Tab */}
              {activeDetailTab === "stories" && (
                <>
                  <div className="max-h-[380px] overflow-y-auto">
                    {userDetails.stories.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        No stories uploaded yet
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {userDetails.stories.map((story) => (
                          <div key={story.id} className="px-4 py-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate text-gray-900">
                                  {story.title}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500">
                                    {STORY_TYPE_LABELS[story.storyType || ""] ||
                                      story.storyType ||
                                      "Unknown"}
                                  </span>
                                  <span
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      STATUS_COLORS[story.status] ||
                                      "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {story.status}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-medium text-gray-900">
                                  {formatCents(story.costCents)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatNumber(story.wordCount)} words
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                              <span>{formatDate(story.createdAt)}</span>
                              <span className="text-blue-600 font-medium">
                                {formatCents(story.costPerThousandWords)}/1K words
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deleted Stories */}
                  {userDetails.summary.deletedStoryCount > 0 && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Deleted stories ({userDetails.summary.deletedStoryCount})
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCents(userDetails.summary.deletedStoryCostCents)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Other Costs */}
                  {userDetails.summary.otherCostCents > 0 && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Other (unattributed)
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCents(userDetails.summary.otherCostCents)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* In-Story Usage Tab */}
              {activeDetailTab === "in-story" && (
                <div className="max-h-[380px] overflow-y-auto">
                  {userDetails.inStoryUsage.breakdown.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="text-gray-400 mb-1">No in-story usage yet</div>
                      <div className="text-xs text-gray-400">
                        Translations, example sentences, and TTS costs will appear here
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {userDetails.inStoryUsage.breakdown
                        .sort((a, b) => b.costCents - a.costCents)
                        .map((item) => (
                          <div key={item.operation} className="px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {item.label}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {formatNumber(item.count)} requests
                                  {item.count > 0 && (
                                    <span className="text-gray-400">
                                      {" "}· {formatCents(Math.round(item.costCents / item.count))}/req
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="font-medium text-gray-900">
                                {formatCents(item.costCents)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Tutor Tab */}
              {activeDetailTab === "tutor" && (
                <div className="max-h-[380px] overflow-y-auto">
                  {userDetails.tutorUsage.breakdown.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="text-gray-400 mb-1">No tutor usage yet</div>
                      <div className="text-xs text-gray-400">
                        AI tutor conversation costs will appear here
                      </div>
                    </div>
                  ) : (
                    <>
                      {tutorMessageCount > 0 && (
                        <div className="px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                              Total tutor messages
                            </span>
                            <span className="font-medium text-gray-900">
                              {formatNumber(tutorMessageCount)}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="divide-y divide-gray-100">
                        {userDetails.tutorUsage.breakdown
                          .sort((a, b) => b.costCents - a.costCents)
                          .map((item) => (
                            <div key={item.operation} className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {item.label}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {formatNumber(item.count)} API calls
                                    {item.count > 0 && (
                                      <span className="text-gray-400">
                                        {" "}· {formatCents(Math.round(item.costCents / item.count))}/call
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="font-medium text-gray-900">
                                  {formatCents(item.costCents)}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Empty State */}
      {data.users.length === 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-lg mb-2">No users yet</div>
          <p className="text-gray-500 text-sm">
            Registered users will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
