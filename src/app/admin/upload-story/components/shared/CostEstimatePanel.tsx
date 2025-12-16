// src/app/admin/upload-story/components/shared/CostEstimatePanel.tsx
// Cost estimation panel for admin pipeline

"use client";

import { useMemo } from "react";
import {
  estimateCosts,
  formatCost,
  formatTokens,
  getCostSummary,
  type CostEstimate,
  type CostEstimateOptions,
} from "@/lib/admin/cost-estimator";

// ============================================================================
// Types
// ============================================================================

export interface CostEstimatePanelProps {
  /** Raw text content to estimate */
  rawText: string;
  /** Source language */
  sourceLanguage: "en" | "es";
  /** Detected source level (1-5) */
  sourceLevel: number;
  /** Levels to generate with their modes */
  levelModes: Record<number, "generate" | "use-original" | "omit">;
  /** Whether to generate thumbnail */
  generateThumbnail?: boolean;
  /** Whether to generate background */
  generateBackground?: boolean;
  /** Whether to generate metadata */
  generateMetadata?: boolean;
  /** Number of chapters */
  chapterCount?: number;
  /** Whether panel is collapsed by default */
  defaultCollapsed?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// Level Mode Badge
// ============================================================================

function ModeBadge({ mode }: { mode: "generate" | "use-original" | "omit" }) {
  const styles = {
    generate: "bg-blue-100 text-blue-800",
    "use-original": "bg-green-100 text-green-800",
    omit: "bg-gray-100 text-gray-500",
  };

  const labels = {
    generate: "Generate",
    "use-original": "Original",
    omit: "Omit",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[mode]}`}>
      {labels[mode]}
    </span>
  );
}

// ============================================================================
// Cost Row
// ============================================================================

function CostRow({
  label,
  value,
  subtext,
  highlight,
}: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-1 ${
        highlight ? "font-semibold" : ""
      }`}
    >
      <span className="text-gray-600">
        {label}
        {subtext && (
          <span className="text-gray-400 text-xs ml-1">({subtext})</span>
        )}
      </span>
      <span className={highlight ? "text-blue-600" : "text-gray-900"}>
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// Level Breakdown Table
// ============================================================================

function LevelBreakdown({ estimate }: { estimate: CostEstimate }) {
  const activeLevels = estimate.levels.filter((l) => l.mode !== "omit");

  if (activeLevels.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic py-2">
        No levels selected for processing
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-4">Level</th>
            <th className="py-2 pr-4">Mode</th>
            <th className="py-2 pr-4 text-right">Rewrite</th>
            <th className="py-2 pr-4 text-right">Translate</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {activeLevels.map((level) => (
            <tr key={level.level} className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium">Level {level.level}</td>
              <td className="py-2 pr-4">
                <ModeBadge mode={level.mode} />
              </td>
              <td className="py-2 pr-4 text-right text-gray-600">
                {level.rewriteCost > 0 ? formatCost(level.rewriteCost) : "—"}
              </td>
              <td className="py-2 pr-4 text-right text-gray-600">
                {formatCost(level.translateCost)}
              </td>
              <td className="py-2 text-right font-medium">
                {formatCost(level.totalCost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CostEstimatePanel({
  rawText,
  sourceLanguage,
  sourceLevel,
  levelModes,
  generateThumbnail = false,
  generateBackground = false,
  generateMetadata = false,
  chapterCount = 1,
  defaultCollapsed = false,
  className = "",
}: CostEstimatePanelProps) {
  // Calculate estimate
  const estimate = useMemo(() => {
    if (!rawText || rawText.length === 0) {
      return null;
    }

    const options: CostEstimateOptions = {
      rawText,
      sourceLanguage,
      sourceLevel,
      levelModes,
      generateThumbnail,
      generateBackground,
      generateMetadata,
      chapterCount,
    };

    return estimateCosts(options);
  }, [
    rawText,
    sourceLanguage,
    sourceLevel,
    levelModes,
    generateThumbnail,
    generateBackground,
    generateMetadata,
    chapterCount,
  ]);

  if (!estimate) {
    return null;
  }

  const { totals, images, detection, metadata, warnings } = estimate;

  // Determine cost level for styling
  const getCostLevel = (cost: number) => {
    if (cost < 1) return "low";
    if (cost < 5) return "medium";
    return "high";
  };

  const costLevel = getCostLevel(totals.totalCost);
  const costColors = {
    low: "border-green-200 bg-green-50",
    medium: "border-yellow-200 bg-yellow-50",
    high: "border-red-200 bg-red-50",
  };

  return (
    <div className={`rounded-lg border ${className}`}>
      {/* Header */}
      <div className={`px-4 py-3 rounded-t-lg ${costColors[costLevel]}`}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">
            Estimated Processing Cost
          </h3>
          <span
            className={`text-xl font-bold ${
              costLevel === "high"
                ? "text-red-600"
                : costLevel === "medium"
                  ? "text-yellow-600"
                  : "text-green-600"
            }`}
          >
            {formatCost(totals.totalCost)}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">{getCostSummary(estimate)}</p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200">
          {warnings.map((warning, i) => (
            <p key={i} className="text-sm text-yellow-800 flex items-start">
              <span className="mr-2">&#9888;</span>
              {warning}
            </p>
          ))}
        </div>
      )}

      {/* Details */}
      <details open={!defaultCollapsed}>
        <summary className="px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm text-gray-600 select-none">
          View detailed breakdown
        </summary>

        <div className="px-4 pb-4 space-y-4">
          {/* Level Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              By Level
            </h4>
            <LevelBreakdown estimate={estimate} />
          </div>

          {/* Image Costs */}
          {images.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Image Generation
              </h4>
              <div className="bg-gray-50 rounded p-3 space-y-1">
                {images.map((img) => (
                  <CostRow
                    key={img.type}
                    label={img.type === "thumbnail" ? "Thumbnails" : "Backgrounds"}
                    value={formatCost(img.totalCost)}
                    subtext={`${img.count} x ${formatCost(img.costPerImage)}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Costs */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Other Costs
            </h4>
            <div className="bg-gray-50 rounded p-3 space-y-1">
              <CostRow
                label="Level Detection"
                value={formatCost(detection.cost)}
                subtext={`${formatTokens(detection.tokens.input)} in`}
              />
              {metadata.cost > 0 && (
                <CostRow
                  label="Metadata Generation"
                  value={formatCost(metadata.cost)}
                  subtext={`${formatTokens(metadata.tokens.input)} in`}
                />
              )}
            </div>
          </div>

          {/* Token Summary */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Token Usage
            </h4>
            <div className="bg-gray-50 rounded p-3 space-y-1">
              <CostRow
                label="Total Input Tokens"
                value={formatTokens(totals.totalInputTokens)}
              />
              <CostRow
                label="Total Output Tokens"
                value={formatTokens(totals.totalOutputTokens)}
              />
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1">
            {totals.rewriteCost > 0 && (
              <CostRow
                label="Rewriting (GPT-4o)"
                value={formatCost(totals.rewriteCost)}
              />
            )}
            {totals.translateCost > 0 && (
              <CostRow
                label="Translation (Claude Haiku)"
                value={formatCost(totals.translateCost)}
              />
            )}
            {totals.imageCost > 0 && (
              <CostRow
                label="Images (DALL-E 3)"
                value={formatCost(totals.imageCost)}
              />
            )}
            {totals.otherCost > 0.01 && (
              <CostRow
                label="Other"
                value={formatCost(totals.otherCost)}
              />
            )}
            <div className="pt-2 border-t">
              <CostRow
                label="Total Estimated Cost"
                value={formatCost(totals.totalCost)}
                highlight
              />
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 italic">
            Estimates based on current API pricing. Actual costs may vary based on
            text complexity and API response sizes.
          </p>
        </div>
      </details>
    </div>
  );
}

export default CostEstimatePanel;
