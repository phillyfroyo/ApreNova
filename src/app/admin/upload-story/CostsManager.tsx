"use client";

import { useState, useEffect } from "react";

interface CostSummary {
  totalCents: number;
  totalCalls: number;
  days: number;
  startDate: string;
}

interface OperationCost {
  operation: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  count: number;
}

interface ProviderCost {
  provider: string;
  costCents: number;
  count: number;
}

interface ModelCost {
  model: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  count: number;
}

interface DailyCost {
  date: string;
  totalCents: number;
  callCount: number;
}

interface StoryTypeCost {
  storyType: string;
  avgCostCents: number;
  avgWords: number;
  costPerThousandWords: number;
  storyCount: number;
  totalCents: number;
}

interface RecentEntry {
  id: string;
  operation: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
  costCents: number;
  userId: string | null;
  userStoryId: string | null;
  createdAt: string;
}

interface CostData {
  summary: CostSummary;
  byOperation: OperationCost[];
  byProvider: ProviderCost[];
  byModel: ModelCost[];
  daily: DailyCost[];
  byStoryType: StoryTypeCost[];
  recentEntries: RecentEntry[];
}

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
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Operation name formatting
const OPERATION_LABELS: Record<string, string> = {
  detection: "Language/Level Detection",
  rewriting: "CEFR Rewriting",
  translation: "Translation",
  metadata: "Metadata Extraction",
  thumbnail: "Thumbnail Generation",
  tutor: "General Tutor",
  "story-tutor": "Story Tutor",
  "translate-word": "Word Translation",
  "translate-phrase": "Phrase Translation",
  "example-sentence": "Example Sentences",
  tts: "Text-to-Speech",
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
  unknown: "Unknown",
};

export default function CostsManager() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchCosts();
  }, [days]);

  async function fetchCosts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/costs?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch costs");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
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
            onClick={fetchCosts}
            className="mt-2 text-red-600 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">API Cost Tracker</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Time Range:</label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={fetchCosts}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Cost</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCents(data.summary.totalCents)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Last {data.summary.days} days
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">API Calls</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(data.summary.totalCalls)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Avg {formatCents(data.summary.totalCents / (data.summary.totalCalls || 1))}/call
          </div>
        </div>
        {data.byProvider.map((p) => (
          <div
            key={p.provider}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="text-sm text-gray-500 capitalize">{p.provider}</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCents(p.costCents)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {formatNumber(p.count)} calls
            </div>
          </div>
        ))}
      </div>

      {/* Average Cost by Story Type */}
      {data.byStoryType.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Average Cost by Story Type</h3>
            <p className="text-xs text-gray-500 mt-1">
              Cost breakdown per story upload, including word count correlation
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Story Type</th>
                  <th className="px-4 py-2 text-right">Stories</th>
                  <th className="px-4 py-2 text-right">Avg Words</th>
                  <th className="px-4 py-2 text-right">Avg Cost</th>
                  <th className="px-4 py-2 text-right">Cost/1K Words</th>
                  <th className="px-4 py-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.byStoryType
                  .sort((a, b) => b.totalCents - a.totalCents)
                  .map((st) => (
                    <tr key={st.storyType} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        {STORY_TYPE_LABELS[st.storyType] || st.storyType}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-600">
                        {st.storyCount}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-600">
                        {formatNumber(st.avgWords)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">
                        {formatCents(st.avgCostCents)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-blue-600 font-medium">
                        {formatCents(st.costPerThousandWords)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-600">
                        {formatCents(st.totalCents)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost by Operation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Cost by Operation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Operation</th>
                <th className="px-4 py-2 text-right">Calls</th>
                <th className="px-4 py-2 text-right">Input Tokens</th>
                <th className="px-4 py-2 text-right">Output Tokens</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byOperation
                .sort((a, b) => b.costCents - a.costCents)
                .map((op) => (
                  <tr key={op.operation} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">
                      {OPERATION_LABELS[op.operation] || op.operation}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatNumber(op.count)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatNumber(op.inputTokens)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatNumber(op.outputTokens)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {formatCents(op.costCents)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {data.summary.totalCents > 0
                        ? ((op.costCents / data.summary.totalCents) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost by Model */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Cost by Model</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Model</th>
                <th className="px-4 py-2 text-right">Calls</th>
                <th className="px-4 py-2 text-right">Input Tokens</th>
                <th className="px-4 py-2 text-right">Output Tokens</th>
                <th className="px-4 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byModel
                .sort((a, b) => b.costCents - a.costCents)
                .map((m) => (
                  <tr key={m.model} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono">{m.model}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatNumber(m.count)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatNumber(m.inputTokens)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatNumber(m.outputTokens)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {formatCents(m.costCents)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Chart (simple bar representation) */}
      {data.daily.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Daily Costs</h3>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-1 h-32">
              {data.daily.map((day) => {
                const maxCost = Math.max(...data.daily.map((d) => d.totalCents));
                const heightPercent = maxCost > 0 ? (day.totalCents / maxCost) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 group relative"
                    title={`${day.date}: ${formatCents(day.totalCents)} (${day.callCount} calls)`}
                  >
                    <div
                      className="bg-blue-500 hover:bg-blue-600 rounded-t transition-colors cursor-pointer"
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                    ></div>
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                      {day.date}: {formatCents(day.totalCents)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{data.daily[0]?.date}</span>
              <span>{data.daily[data.daily.length - 1]?.date}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent API Calls */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Recent API Calls</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Operation</th>
                <th className="px-4 py-2 text-left">Model</th>
                <th className="px-4 py-2 text-right">Tokens</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-left">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {data.recentEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    {OPERATION_LABELS[entry.operation] || entry.operation}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">
                    {entry.model}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {entry.inputTokens > 0 || entry.outputTokens > 0
                      ? `${formatNumber(entry.inputTokens)}/${formatNumber(entry.outputTokens)}`
                      : entry.imageCount > 0
                      ? `${entry.imageCount} img`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatCents(entry.costCents)}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {entry.userId ? entry.userId.slice(0, 8) + "..." : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {data.summary.totalCalls === 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-lg mb-2">No API calls recorded yet</div>
          <p className="text-gray-500 text-sm">
            Upload a story or use the tutor to see cost tracking in action.
          </p>
        </div>
      )}
    </div>
  );
}
