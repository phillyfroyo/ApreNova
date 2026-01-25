"use client";

import React, { useState, useRef } from "react";
import type { StoryTag } from "@/types/story";
import type { StoryData, SourceLanguage, PreprocessedResult } from "../../types";
import { createEmptyFormAttribution } from "@/lib/admin/attribution-helpers";
import {
  extractTextFromHTML,
  stripRTF,
  isAcceptedFile,
  SUPPORTED_FILE_TYPES,
  type ExtractedAnnotation,
} from "@/lib/admin/text-utils";

interface Step1UploadProps {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
}

export function Step1Upload({
  storyData,
  updateStoryData,
}: Step1UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);

  const handleFileRead = async (file: File) => {
    let text = await file.text();
    const fileName = file.name.toLowerCase();
    let extractedAnnotations: ExtractedAnnotation[] = [];

    // Convert HTML to plain text, extracting sidenotes/footnotes
    // Preserve whitespace during initial extraction - normalization happens later
    // based on structure type (prose vs anthology)
    if (fileName.endsWith(".html") || fileName.endsWith(".htm") || file.type === "text/html") {
      const result = extractTextFromHTML(text, { preserveWhitespace: true });
      text = result.text;
      extractedAnnotations = result.annotations;
    }

    // RTF basic handling - strip RTF codes
    if (fileName.endsWith(".rtf") || file.type === "application/rtf") {
      text = stripRTF(text);
    }

    updateStoryData({
      rawText: text,
      uploadedFileName: file.name,
      parsedResult: null,
      extractedAnnotations,
    });
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isAcceptedFile(file)) {
      handleFileRead(file);
    } else if (file) {
      setParseError(`Unsupported file type. Accepted: ${SUPPORTED_FILE_TYPES.map(t => t.ext).join(", ")}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isAcceptedFile(file)) {
        handleFileRead(file);
        setParseError("");
      } else {
        setParseError(`Unsupported file type. Accepted: ${SUPPORTED_FILE_TYPES.map(t => t.ext).join(", ")}`);
      }
    }
  };

  const processText = async () => {
    if (!storyData.rawText.trim()) {
      setParseError("Please upload or paste text first");
      return;
    }

    setIsParsing(true);
    setParseError("");

    try {
      const response = await fetch("/api/admin/parse-full-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: storyData.rawText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process text");
      }

      const result = data.result as PreprocessedResult;

      updateStoryData({
        parsedResult: result,
        rawText: result.cleanedFullText,
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to process text");
    } finally {
      setIsParsing(false);
    }
  };

  const extractMetadataFromFrontMatter = async () => {
    if (!storyData.parsedResult?.frontMatter) {
      setParseError("No front matter detected to extract metadata from");
      return;
    }

    setIsExtractingMetadata(true);
    setParseError("");

    try {
      const response = await fetch("/api/admin/parse-attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontMatterText: storyData.parsedResult.frontMatter,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract metadata");
      }

      if (data.attribution) {
        const parsedAttribution = {
          ...createEmptyFormAttribution(),
          ...data.attribution,
        };
        const metadata = data.metadata || {};

        const updates: Partial<StoryData> = {
          isOriginal: false,
          attribution: parsedAttribution,
        };

        // Note: title, displayTitle, slug are NOT auto-filled - they come from the bundle generation

        if (metadata.summary && !storyData.description.en) {
          updates.description = {
            en: metadata.summary,
            es: "",
          };
        }

        if (parsedAttribution.sourceIsPublicDomain && !parsedAttribution.rightsDisplayStatement) {
          parsedAttribution.rightsDisplayStatement =
            "The original text is in the public domain. This educational adaptation © Cuentana.";
        }

        if (parsedAttribution.genres) {
          const genresLower = parsedAttribution.genres.toLowerCase();
          if (genresLower.includes("epic")) {
            updates.storyType = "epic";
          } else if (genresLower.includes("myth")) {
            updates.storyType = "myth";
          } else if (genresLower.includes("legend")) {
            updates.storyType = "legend";
          } else if (genresLower.includes("fable")) {
            updates.storyType = "fable";
          } else if (genresLower.includes("folktale") || genresLower.includes("folk tale")) {
            updates.storyType = "folktale";
          } else if (genresLower.includes("poem") || genresLower.includes("poetry")) {
            updates.storyType = "poem";
          } else if (genresLower.includes("novella") || genresLower.includes("novel")) {
            updates.storyType = "novel";
          } else if (genresLower.includes("song") || genresLower.includes("lyric")) {
            updates.storyType = "song-lyrics";
          }

          const detectedTags: StoryTag[] = [];
          if (genresLower.includes("epic")) detectedTags.push("epic");
          if (genresLower.includes("myth")) detectedTags.push("mythology");
          if (genresLower.includes("hero")) detectedTags.push("heroic", "heros-journey");
          if (genresLower.includes("traged")) detectedTags.push("tragedy");
          if (genresLower.includes("comed")) detectedTags.push("comedy");
          if (genresLower.includes("adventure")) detectedTags.push("adventure");
          if (genresLower.includes("romance") || genresLower.includes("love")) detectedTags.push("romance", "love");
          if (genresLower.includes("mystery")) detectedTags.push("mystery");
          if (genresLower.includes("fantasy")) detectedTags.push("fantasy");
          if (genresLower.includes("histor")) detectedTags.push("historical");
          if (genresLower.includes("monster")) detectedTags.push("monsters");
          if (genresLower.includes("war") || genresLower.includes("battle")) detectedTags.push("war");
          if (genresLower.includes("death") || genresLower.includes("mortality")) detectedTags.push("death");
          if (genresLower.includes("revenge") || genresLower.includes("vengeance")) detectedTags.push("revenge");

          if (detectedTags.length > 0) {
            const uniqueTags = [...new Set([...storyData.tags, ...detectedTags])];
            updates.tags = uniqueTags as StoryTag[];
          }
        }

        updateStoryData(updates);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to extract metadata");
    } finally {
      setIsExtractingMetadata(false);
    }
  };

  const revertToOriginal = () => {
    updateStoryData({ parsedResult: null });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Story Text</h2>
        <p className="text-gray-500 text-sm">
          Upload a file or paste text. The processor will clean up the text, detect chapters, and extract front matter.
        </p>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Source Language</label>
          <select
            value={storyData.sourceLanguage}
            onChange={(e) => updateStoryData({ sourceLanguage: e.target.value as SourceLanguage })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="en">English (EN)</option>
            <option value="es">Spanish (ES)</option>
          </select>
        </div>
      </div>

      {/* File Upload / Paste Area */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Story Text</label>
          {storyData.uploadedFileName && (
            <span className="text-xs text-gray-500">File: {storyData.uploadedFileName}</span>
          )}
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-3 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.html,.htm,.md,.rtf,text/plain,text/html,text/markdown,application/rtf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="text-gray-500">
            <svg className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports: .txt, .html, .htm, .md, .rtf</p>
          </div>
        </div>

        {/* Text Area */}
        <textarea
          value={storyData.rawText}
          onChange={(e) => updateStoryData({ rawText: e.target.value, parsedResult: null })}
          placeholder="Paste your story here (including front matter, footnotes, etc.)..."
          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400">
            {storyData.rawText.length.toLocaleString()} characters, {storyData.rawText.split("\n").filter((l) => l.trim()).length} lines
          </p>
        </div>
      </div>

      {/* Extracted Annotations Summary */}
      {storyData.extractedAnnotations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-amber-800">Annotations Extracted</h4>
              <p className="text-sm text-amber-700 mt-1">
                Found {storyData.extractedAnnotations.length} annotation{storyData.extractedAnnotations.length !== 1 ? "s" : ""} (
                {storyData.extractedAnnotations.filter(a => a.type === "sidenote").length} sidenotes,{" "}
                {storyData.extractedAnnotations.filter(a => a.type === "footnote").length} footnotes,{" "}
                {storyData.extractedAnnotations.filter(a => a.type === "marginal").length} marginal notes
                ) - these have been removed from the story text and stored separately for tooltips.
              </p>
              <details className="mt-2">
                <summary className="text-xs text-amber-600 cursor-pointer hover:text-amber-800">
                  View extracted annotations ({storyData.extractedAnnotations.length})
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                  {storyData.extractedAnnotations.slice(0, 50).map((annotation) => (
                    <div key={annotation.id} className="text-xs bg-white rounded p-2 border border-amber-100">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-2 bg-amber-100 text-amber-700">
                        {annotation.type}
                      </span>
                      <span className="text-gray-700">{annotation.text.slice(0, 150)}{annotation.text.length > 150 ? "..." : ""}</span>
                    </div>
                  ))}
                  {storyData.extractedAnnotations.length > 50 && (
                    <p className="text-xs text-amber-600 italic">...and {storyData.extractedAnnotations.length - 50} more</p>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Process Text Button */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Text Processor</h3>
            <p className="text-xs text-gray-500">
              Clean up text, detect chapters, and extract front matter (fast, no AI cost)
            </p>
          </div>
          <button
            onClick={processText}
            disabled={isParsing || !storyData.rawText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
          >
            {isParsing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              <>Process Text</>
            )}
          </button>
        </div>
        {parseError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {parseError}
          </div>
        )}
      </div>

      {/* Processing Results */}
      {storyData.parsedResult && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Processing Results</h3>
            <button
              onClick={revertToOriginal}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Reset
            </button>
          </div>

          {/* Stats */}
          <div className="bg-blue-50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Cleanup Stats</h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-700">
                  {Math.round((1 - storyData.parsedResult.stats.cleanedLength / storyData.parsedResult.stats.originalLength) * 100)}%
                </div>
                <div className="text-xs text-blue-600">Size Reduced</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-700">
                  {storyData.parsedResult.stats.chaptersDetected}
                </div>
                <div className="text-xs text-blue-600">Chapters</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-700">
                  {storyData.parsedResult.stats.lineNumbersRemoved}
                </div>
                <div className="text-xs text-blue-600">Line #s</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-700">
                  {storyData.parsedResult.stats.pageMarkersRemoved}
                </div>
                <div className="text-xs text-blue-600">Page Markers</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-700">
                  {storyData.parsedResult.stats.footnoteIndicatorsRemoved}
                </div>
                <div className="text-xs text-blue-600">Footnotes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-700">
                  {storyData.parsedResult.stats.asteriskDividersRemoved}
                </div>
                <div className="text-xs text-blue-600">Dividers</div>
              </div>
            </div>
            {storyData.parsedResult.stats.backMatterRemoved && (
              <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Back matter (license/boilerplate) removed
              </div>
            )}
          </div>

          {/* Chapters */}
          {storyData.parsedResult.chapters.length > 0 && (
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-green-900 mb-2">
                Detected Chapters ({storyData.parsedResult.chapters.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {storyData.parsedResult.chapters.slice(0, 12).map((ch, i) => (
                  <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    {ch.number}. {ch.title.length > 30 ? ch.title.substring(0, 30) + "..." : ch.title}
                  </span>
                ))}
                {storyData.parsedResult.chapters.length > 12 && (
                  <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-medium">
                    +{storyData.parsedResult.chapters.length - 12} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Front Matter & Metadata Extraction */}
          {storyData.parsedResult.frontMatter && (
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-purple-900">Front Matter Detected</h4>
                <button
                  onClick={extractMetadataFromFrontMatter}
                  disabled={isExtractingMetadata}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all"
                >
                  {isExtractingMetadata ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Extracting...
                    </>
                  ) : (
                    <>Extract Metadata (AI)</>
                  )}
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto bg-white/50 rounded p-2">
                <pre className="whitespace-pre-wrap text-xs text-purple-800 font-mono">
                  {storyData.parsedResult.frontMatter.substring(0, 1000)}
                  {storyData.parsedResult.frontMatter.length > 1000 && "..."}
                </pre>
              </div>
              <p className="text-xs text-purple-600 mt-2">
                {storyData.parsedResult.frontMatter.length.toLocaleString()} characters of front matter
              </p>
            </div>
          )}

          {/* Attribution Preview (if extracted) */}
          {storyData.attribution && (
            <div className="bg-amber-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-amber-900 mb-2">Extracted Metadata</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {storyData.attribution.authorName && (
                  <div><span className="text-amber-600">Author:</span> {storyData.attribution.authorName}</div>
                )}
                {storyData.attribution.translatorName && (
                  <div><span className="text-amber-600">Translator:</span> {storyData.attribution.translatorName}</div>
                )}
                {storyData.attribution.yearWritten && (
                  <div><span className="text-amber-600">Written:</span> {storyData.attribution.yearWritten}</div>
                )}
                {storyData.attribution.sourceTitle && (
                  <div><span className="text-amber-600">Source:</span> {storyData.attribution.sourceTitle}</div>
                )}
                {storyData.attribution.region && (
                  <div><span className="text-amber-600">Region:</span> {storyData.attribution.region}</div>
                )}
                {storyData.attribution.genres && (
                  <div><span className="text-amber-600">Genres:</span> {storyData.attribution.genres}</div>
                )}
              </div>
              <p className="text-xs text-amber-600 mt-2">* This will auto-fill Step 3 metadata</p>
            </div>
          )}

          {/* Clean Text Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Clean Text Preview</h4>
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showRawText ? "Hide full text" : "Show full text"}
              </button>
            </div>
            <div className={`bg-white border rounded-lg p-3 font-mono text-xs overflow-auto ${showRawText ? "max-h-96" : "max-h-32"}`}>
              <pre className="whitespace-pre-wrap">{storyData.parsedResult.cleanedFullText}</pre>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {storyData.parsedResult.cleanedFullText.length.toLocaleString()} characters (cleaned)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Step1Upload;
