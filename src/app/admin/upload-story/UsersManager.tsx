"use client";

import { useState, useEffect } from "react";

interface UserSummary {
  totalUsers: number;
  totalStories: number;
  totalCostCents: number;
  avgCostPerUser: number;
  avgCostPerStory: number;
}

interface UserListItem {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  storyCount: number;
  totalCostCents: number;
  avgCostPerStory: number;
}

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
}

type DetailTab = "stories" | "in-story" | "tutor";

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

export default function UsersManager() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected user details
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetailsData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("stories");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserDetails(selectedUserId);
      setActiveDetailTab("stories");
    } else {
      setUserDetails(null);
    }
  }, [selectedUserId]);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
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
      const res = await fetch(`/api/admin/users?userId=${userId}`);
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
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Users</div>
          <div className="text-2xl font-bold text-gray-900">
            {data.summary.totalUsers}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Stories</div>
          <div className="text-2xl font-bold text-gray-900">
            {data.summary.totalStories}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Cost</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCents(data.summary.totalCostCents)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Avg Cost/User</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCents(data.summary.avgCostPerUser)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Avg Cost/Story</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCents(data.summary.avgCostPerStory)}
          </div>
        </div>
      </div>

      {/* Two Column Layout: User List + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Users</h3>
            <p className="text-xs text-gray-500 mt-1">
              Click a user to view their cost details
            </p>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {data.users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No users with stories or costs yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() =>
                      setSelectedUserId(
                        selectedUserId === user.id ? null : user.id
                      )
                    }
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedUserId === user.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.name || user.email || "Anonymous"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.storyCount} stories · Joined{" "}
                          {formatDate(user.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {formatCents(user.totalCostCents)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCents(user.avgCostPerStory)}/story
                        </div>
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
              {/* 3-Tab Strip */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveDetailTab("stories")}
                  className={`flex-1 px-3 py-3 text-sm font-medium text-center transition-colors ${
                    activeDetailTab === "stories"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div>Story Uploads</div>
                  <div className="text-xs mt-0.5">{formatCents(storyUploadCost)}</div>
                </button>
                <button
                  onClick={() => setActiveDetailTab("in-story")}
                  className={`flex-1 px-3 py-3 text-sm font-medium text-center transition-colors ${
                    activeDetailTab === "in-story"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div>In-Story Usage</div>
                  <div className="text-xs mt-0.5">{formatCents(inStoryCost)}</div>
                </button>
                <button
                  onClick={() => setActiveDetailTab("tutor")}
                  className={`flex-1 px-3 py-3 text-sm font-medium text-center transition-colors ${
                    activeDetailTab === "tutor"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div>AI Tutor</div>
                  <div className="text-xs mt-0.5">{formatCents(tutorCost)}</div>
                </button>
              </div>

              {/* Tab-Aware Summary Card */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
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
          <div className="text-gray-400 text-lg mb-2">No user data yet</div>
          <p className="text-gray-500 text-sm">
            User analytics will appear here once users upload stories.
          </p>
        </div>
      )}
    </div>
  );
}
