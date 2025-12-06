"use client";

import React, { useState, useRef } from "react";
import type { StoryType, StoryTag } from "@/types/story";
import { ALL_STORY_TYPES, ALL_STORY_TAGS, STORY_TYPE_LABELS, STORY_TAG_LABELS } from "@/lib/stories";
import { FormAttribution, formToAttribution, createEmptyFormAttribution } from "@/lib/admin/attribution-helpers";

/**
 * Clean text by removing AI artifacts, markdown formatting, and normalizing
 */
function cleanText(text: string): string {
  let cleaned = text
    // Remove code fences (```language or just ```)
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .replace(/```/g, "")
    // Remove triple quotes that AI sometimes adds
    .replace(/^"""\n?/gm, "")
    .replace(/\n?"""$/gm, "")
    .replace(/^'''\n?/gm, "")
    .replace(/\n?'''$/gm, "")
    // Remove markdown bold/italic
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Normalize whitespace
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  // Process line by line to remove quote wrapping
  cleaned = cleaned
    .split("\n")
    .map(line => {
      let l = line.trim();
      // Remove surrounding double quotes (straight and curly)
      if ((l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith("'") && l.endsWith("'")) ||
          (l.startsWith("'") && l.endsWith("'"))) {
        l = l.slice(1, -1);
      }
      // Also handle lines that are just quotes
      if (l === '""' || l === "''" || l === '""' || l === "''") {
        return "";
      }
      return l;
    })
    .filter(line => line.length > 0 || line === "") // Keep empty lines for structure but filter pure quote lines
    .join("\n");

  // Final trim and remove any remaining quote-only lines
  return cleaned
    .split("\n")
    .filter(line => !/^["'"'""'']+$/.test(line.trim()))
    .join("\n")
    .trim();
}

interface StoryUploadFormProps {
  onLogout: () => void;
  hideHeader?: boolean;
}

type SourceLanguage = "en" | "es";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface LevelContent {
  sourceText: string;
  translatedText: string;
  status: "pending" | "generating" | "done" | "error" | "omitted";
  mode: "generate" | "use-original" | "omit"; // Whether to AI generate, use source text, or skip
}

// Preprocessed text result structure (matches algorithmic preprocessor output)
interface DetectedChapter {
  number: number;
  title: string;
  subtitle?: string;
  rawText: string;
  startLine: number;
  endLine: number;
}

interface PreprocessedResult {
  frontMatter: string;
  chapters: DetectedChapter[];
  stats: {
    originalLength: number;
    cleanedLength: number;
    lineNumbersRemoved: number;
    pageMarkersRemoved: number;
    footnoteIndicatorsRemoved: number;
    asteriskDividersRemoved: number;
    chaptersDetected: number;
    backMatterRemoved: boolean;
  };
  cleanedFullText: string;
}

interface StoryData {
  rawText: string;
  sourceLanguage: SourceLanguage;
  slug: string;
  detectedLevel: number | null;
  title: { en: string; es: string };
  displayTitle: { en: string; es: string } | null; // Optional short version for cards
  description: { en: string; es: string };
  hook: { en: string; es: string } | null; // Optional short teaser for cards
  selectedLevels: number[];
  levelContent: Record<number, LevelContent>;
  linesPerPage: number;
  thumbnailFile: File | null;
  thumbnailPreview: string | null;
  backgroundFile: File | null;
  backgroundPreview: string | null;
  // Tagging fields
  storyType: StoryType;
  isOriginal: boolean;
  attribution: FormAttribution | null;
  tags: StoryTag[];
  targetAudience: "children" | "teen" | "adult" | "all";
  // Parsed text data
  parsedResult: PreprocessedResult | null;
  uploadedFileName: string | null;
  // Extracted annotations (sidenotes, footnotes, etc.)
  extractedAnnotations: ExtractedAnnotation[];
}

const STEPS = [
  { number: 1, label: "Upload Text" },
  { number: 2, label: "Parse & Detect" },
  { number: 3, label: "Metadata" },
  { number: 4, label: "Generate Levels" },
  { number: 5, label: "Translate" },
  { number: 6, label: "Paginate" },
  { number: 7, label: "Preview & Save" },
];

const initialStoryData: StoryData = {
  rawText: "",
  sourceLanguage: "en",
  slug: "",
  detectedLevel: null,
  title: { en: "", es: "" },
  displayTitle: null,
  description: { en: "", es: "" },
  hook: null,
  selectedLevels: [1, 2, 3, 4, 5],
  levelContent: {},
  linesPerPage: 10,
  thumbnailFile: null,
  thumbnailPreview: null,
  backgroundFile: null,
  backgroundPreview: null,
  // Tagging defaults
  storyType: "short-story",
  isOriginal: true,
  attribution: null,
  tags: [],
  targetAudience: "all",
  // Parsed text data
  parsedResult: null,
  uploadedFileName: null,
  // Extracted annotations
  extractedAnnotations: [],
};

export default function StoryUploadForm({ onLogout, hideHeader }: StoryUploadFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [storyData, setStoryData] = useState<StoryData>(initialStoryData);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string; warnings?: string[] } | null>(null);

  const updateStoryData = (updates: Partial<StoryData>) => {
    setStoryData((prev) => ({ ...prev, ...updates }));
  };

  const goToStep = (step: Step) => {
    // Clean raw text when moving from Step 1 to Step 2
    if (currentStep === 1 && step === 2) {
      updateStoryData({ rawText: cleanText(storyData.rawText) });
    }
    setCurrentStep(step);
  };

  // Get levels that have been generated (have content, not omitted)
  const getGeneratedLevels = () => {
    return [1, 2, 3, 4, 5].filter(
      (l) => storyData.levelContent[l]?.status === "done" &&
             storyData.levelContent[l]?.mode !== "omit" &&
             storyData.levelContent[l]?.sourceText?.length > 0
    );
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return storyData.rawText.trim().length > 0;
      case 2:
        return storyData.detectedLevel !== null;
      case 3:
        return (storyData.title.en.length > 0 || storyData.title.es.length > 0) && storyData.slug.length > 0;
      case 4:
        // Allow proceeding if at least one level is generated (not omitted)
        return getGeneratedLevels().length > 0;
      case 5:
        // All generated levels must be translated
        const generatedLevels = getGeneratedLevels();
        return generatedLevels.length > 0 && generatedLevels.every(
          (l) => storyData.levelContent[l]?.translatedText?.length > 0
        );
      case 6:
        return true;
      default:
        return true;
    }
  };

  return (
    <div className={hideHeader ? "" : "min-h-screen bg-gray-50"}>
      {/* Header - only show if not hidden */}
      {!hideHeader && (
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Story Upload System</h1>
              <p className="text-sm text-gray-500">Admin Panel</p>
            </div>
            <button
              onClick={onLogout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>
        </header>
      )}

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <button
                  onClick={() => step.number <= currentStep && goToStep(step.number as Step)}
                  disabled={step.number > currentStep}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    step.number === currentStep
                      ? "bg-blue-100 text-blue-700"
                      : step.number < currentStep
                      ? "text-green-600 hover:bg-green-50 cursor-pointer"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.number === currentStep
                        ? "bg-blue-600 text-white"
                        : step.number < currentStep
                        ? "bg-green-500 text-white"
                        : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {step.number < currentStep ? "✓" : step.number}
                  </span>
                  <span className="hidden md:inline text-sm font-medium">
                    {step.label}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      step.number < currentStep ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {currentStep === 1 && (
            <Step1Upload storyData={storyData} updateStoryData={updateStoryData} />
          )}
          {currentStep === 2 && (
            <Step2Detect
              storyData={storyData}
              updateStoryData={updateStoryData}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          )}
          {currentStep === 3 && (
            <Step3Metadata storyData={storyData} updateStoryData={updateStoryData} />
          )}
          {currentStep === 4 && (
            <Step4Generate
              storyData={storyData}
              updateStoryData={updateStoryData}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          )}
          {currentStep === 5 && (
            <Step5Translate
              storyData={storyData}
              updateStoryData={updateStoryData}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          )}
          {currentStep === 6 && (
            <Step6Paginate storyData={storyData} updateStoryData={updateStoryData} />
          )}
          {currentStep === 7 && (
            <Step7Preview
              storyData={storyData}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              saveResult={saveResult}
              setSaveResult={setSaveResult}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => goToStep((currentStep - 1) as Step)}
              disabled={currentStep === 1}
              className="px-6 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            {currentStep < 7 ? (
              <button
                onClick={() => goToStep((currentStep + 1) as Step)}
                disabled={!canProceed() || isProcessing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

// Extracted annotation from HTML (sidenote, footnote, etc.)
interface ExtractedAnnotation {
  id: string;
  type: "sidenote" | "footnote" | "marginal";
  text: string;
  nearbyText: string; // Context for matching later
}

interface HTMLExtractionResult {
  text: string;
  annotations: ExtractedAnnotation[];
}

// Helper to extract text from HTML, also extracting sidenotes and footnotes
function extractTextFromHTML(html: string): HTMLExtractionResult {
  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove script and style elements
  doc.querySelectorAll("script, style, noscript").forEach(el => el.remove());

  const annotations: ExtractedAnnotation[] = [];
  let annotationIndex = 0;

  // Extract sidenotes (common patterns)
  // Pattern 1: <span class="sidenote">...</span> (Project Gutenberg style)
  doc.querySelectorAll("span.sidenote, .sidenote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      // Get nearby text for context (previous sibling or parent's text)
      const parent = el.parentElement;
      const nearbyText = parent?.textContent?.slice(0, 100)?.trim() || "";

      annotations.push({
        id: `sidenote-${annotationIndex++}`,
        type: "sidenote",
        text,
        nearbyText,
      });
    }
    el.remove(); // Remove from DOM so it doesn't appear in story text
  });

  // Pattern 2: <aside>...</aside>
  doc.querySelectorAll("aside").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      const parent = el.parentElement;
      const nearbyText = parent?.textContent?.slice(0, 100)?.trim() || "";

      annotations.push({
        id: `aside-${annotationIndex++}`,
        type: "sidenote",
        text,
        nearbyText,
      });
    }
    el.remove();
  });

  // Pattern 3: <span class="note">...</span> or <span class="margin-note">...</span>
  doc.querySelectorAll("span.note, span.margin-note, span.marginal, .marginnote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      const parent = el.parentElement;
      const nearbyText = parent?.textContent?.slice(0, 100)?.trim() || "";

      annotations.push({
        id: `marginal-${annotationIndex++}`,
        type: "marginal",
        text,
        nearbyText,
      });
    }
    el.remove();
  });

  // Extract footnotes
  // Pattern 1: <div class="footnote">...</div> inside <div class="footnotes">
  doc.querySelectorAll(".footnotes .footnote, div.footnote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: "footnote",
        text,
        nearbyText: "", // Footnotes are typically at the end
      });
    }
    el.remove();
  });

  // Pattern 2: <aside class="footnote">...</aside>
  doc.querySelectorAll("aside.footnote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: "footnote",
        text,
        nearbyText: "",
      });
    }
    el.remove();
  });

  // Get text content, preserving some structure
  let text = "";

  // Process block elements to preserve paragraph structure
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Block elements that should have line breaks
      const blockElements = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br", "tr", "blockquote", "pre"];
      const isBlock = blockElements.includes(tagName);

      let content = "";
      el.childNodes.forEach(child => {
        content += processNode(child);
      });

      if (tagName === "br") {
        return "\n";
      }

      if (isBlock && content.trim()) {
        return "\n" + content.trim() + "\n";
      }

      return content;
    }

    return "";
  };

  text = processNode(doc.body);

  // Clean up excessive whitespace while preserving paragraph breaks
  text = text
    .replace(/\n{3,}/g, "\n\n")  // Max 2 consecutive newlines
    .replace(/[ \t]+/g, " ")     // Collapse spaces/tabs
    .replace(/\n /g, "\n")       // Remove leading spaces on lines
    .replace(/ \n/g, "\n")       // Remove trailing spaces on lines
    .trim();

  return { text, annotations };
}

// Supported file types
const SUPPORTED_FILE_TYPES = [
  { ext: ".txt", mime: "text/plain", label: "Plain Text" },
  { ext: ".html", mime: "text/html", label: "HTML" },
  { ext: ".htm", mime: "text/html", label: "HTML" },
  { ext: ".md", mime: "text/markdown", label: "Markdown" },
  { ext: ".rtf", mime: "application/rtf", label: "Rich Text" },
];

function isAcceptedFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  return SUPPORTED_FILE_TYPES.some(
    type => fileName.endsWith(type.ext) || file.type === type.mime
  );
}

// Step 1: Upload Text
function Step1Upload({
  storyData,
  updateStoryData,
}: {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileRead = async (file: File) => {
    let text = await file.text();
    const fileName = file.name.toLowerCase();
    let extractedAnnotations: ExtractedAnnotation[] = [];

    // Convert HTML to plain text, extracting sidenotes/footnotes
    if (fileName.endsWith(".html") || fileName.endsWith(".htm") || file.type === "text/html") {
      const result = extractTextFromHTML(text);
      text = result.text;
      extractedAnnotations = result.annotations;
    }

    // RTF basic handling - strip RTF codes (basic implementation)
    if (fileName.endsWith(".rtf") || file.type === "application/rtf") {
      // Remove RTF control codes - this is a simplified version
      text = text
        .replace(/\{\\[^{}]+\}/g, "")  // Remove control groups
        .replace(/\\[a-z]+\d*\s?/gi, "") // Remove control words
        .replace(/[{}]/g, "")           // Remove remaining braces
        .replace(/\\'[0-9a-f]{2}/gi, "") // Remove hex characters
        .trim();
    }

    updateStoryData({
      rawText: text,
      uploadedFileName: file.name,
      parsedResult: null, // Reset parsed result when new file is uploaded
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

  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);

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

      // Update story data with preprocessed results
      const updates: Partial<StoryData> = {
        parsedResult: result,
        rawText: result.cleanedFullText, // Replace raw text with clean text
      };

      // Note: Slug is now generated in Step 3 from the title (more accurate than chapter title)

      updateStoryData(updates);
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

        // Build update object with attribution
        const updates: Partial<StoryData> = {
          isOriginal: false,
          attribution: parsedAttribution,
        };

        // Auto-fill title from sourceTitle if available and title is empty
        if (parsedAttribution.sourceTitle && !storyData.title.en) {
          updates.title = {
            en: parsedAttribution.sourceTitle,
            es: metadata.sourceTitleEs || storyData.title.es || "",
          };

          // Auto-generate slug from display title (short) or source title
          const slugSource = metadata.displayTitle || parsedAttribution.sourceTitle;
          if (slugSource && !storyData.slug) {
            updates.slug = slugSource
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .substring(0, 50);
          }
        }

        // Auto-fill display title if provided
        if (metadata.displayTitle) {
          updates.displayTitle = {
            en: metadata.displayTitle,
            es: metadata.displayTitleEs || metadata.displayTitle,
          };
        }

        // Auto-fill summary if provided (goes to description field which is now the summary)
        if (metadata.summary && !storyData.description.en) {
          updates.description = {
            en: metadata.summary,
            es: "", // Will need translation later
          };
        }

        // Auto-generate Rights Display Statement for public domain works
        if (parsedAttribution.sourceIsPublicDomain && !parsedAttribution.rightsDisplayStatement) {
          parsedAttribution.rightsDisplayStatement =
            "The original text is in the public domain. This educational adaptation © Cuentana.";
        }

        // Auto-fill story type from genres if detected
        if (parsedAttribution.genres) {
          const genresLower = parsedAttribution.genres.toLowerCase();
          // Map common genre keywords to story types
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
            updates.storyType = "novella";
          } else if (genresLower.includes("song") || genresLower.includes("lyric")) {
            updates.storyType = "song-lyrics";
          }

          // Auto-select tags from genres
          const detectedTags: StoryTag[] = [];
          // Literary genres
          if (genresLower.includes("epic")) detectedTags.push("epic");
          if (genresLower.includes("myth")) detectedTags.push("mythology");
          if (genresLower.includes("hero")) detectedTags.push("heroic", "heros-journey");
          if (genresLower.includes("traged")) detectedTags.push("tragedy");
          if (genresLower.includes("comed")) detectedTags.push("comedy");
          // Themes
          if (genresLower.includes("adventure")) detectedTags.push("adventure");
          if (genresLower.includes("romance") || genresLower.includes("love")) detectedTags.push("romance", "love");
          if (genresLower.includes("mystery")) detectedTags.push("mystery");
          if (genresLower.includes("fantasy")) detectedTags.push("fantasy");
          if (genresLower.includes("histor")) detectedTags.push("historical");
          // Content themes
          if (genresLower.includes("monster")) detectedTags.push("monsters");
          if (genresLower.includes("war") || genresLower.includes("battle")) detectedTags.push("war");
          if (genresLower.includes("death") || genresLower.includes("mortality")) detectedTags.push("death");
          if (genresLower.includes("revenge") || genresLower.includes("vengeance")) detectedTags.push("revenge");

          if (detectedTags.length > 0) {
            // Deduplicate and merge with existing tags
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

  const acceptCleanText = () => {
    if (storyData.parsedResult) {
      updateStoryData({ rawText: storyData.parsedResult.cleanedFullText });
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
                  {storyData.extractedAnnotations.slice(0, 50).map((annotation, idx) => (
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
              <>
                Process Text
              </>
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

// Step 2: Parse & Detect CEFR Level
function Step2Detect({
  storyData,
  updateStoryData,
  isProcessing,
  setIsProcessing,
}: {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}) {
  const [error, setError] = useState("");

  const detectLevel = async () => {
    setIsProcessing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/detect-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: storyData.rawText, language: storyData.sourceLanguage }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to detect level");
        return;
      }
      updateStoryData({ detectedLevel: data.level });
    } catch {
      setError("Failed to detect level. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const lines = storyData.rawText.split("\n").filter((l) => l.trim());
  const chapters = storyData.rawText.split(/---|\bCHAPTER\b/i).filter((c) => c.trim());
  const levelLabels: Record<number, string> = {
    1: "A1 - Beginner",
    2: "A2 - Elementary",
    3: "B1 - Intermediate",
    4: "B2 - Upper Intermediate",
    5: "C1 - Advanced",
    6: "C2+ - Literary/Archaic",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Parse & Detect Level</h2>
        <p className="text-gray-500 text-sm">We&apos;ll analyze your text to detect its CEFR level.</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Text Analysis</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{lines.length}</div>
            <div className="text-sm text-gray-500">Lines</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{chapters.length}</div>
            <div className="text-sm text-gray-500">Chapters</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {storyData.rawText.split(/\s+/).filter((w) => w.trim()).length}
            </div>
            <div className="text-sm text-gray-500">Words</div>
          </div>
        </div>
      </div>

      {storyData.detectedLevel === null ? (
        <div className="text-center">
          <button
            onClick={detectLevel}
            disabled={isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? "Analyzing..." : "Detect CEFR Level"}
          </button>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>
      ) : (
        <div className="bg-green-50 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">📊</div>
          <h3 className="text-lg font-semibold text-green-800">
            Detected Level: L{storyData.detectedLevel}
          </h3>
          <p className="text-green-600">{levelLabels[storyData.detectedLevel]}</p>
          <button
            onClick={() => updateStoryData({ detectedLevel: null })}
            className="text-sm text-green-700 underline mt-3"
          >
            Re-analyze
          </button>
        </div>
      )}

      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Manual Override</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <button
              key={level}
              onClick={() => updateStoryData({ detectedLevel: level })}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                storyData.detectedLevel === level
                  ? level === 6
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              L{level}
              {level === 6 && <span className="text-xs ml-1">(C2+)</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 3: Metadata
function Step3Metadata({
  storyData,
  updateStoryData,
}: {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  // Track generating state per type (allows parallel generation)
  const [generatingTypes, setGeneratingTypes] = useState<Set<"title" | "description" | "image" | "background">>(new Set());
  const [error, setError] = useState("");

  // AI prompt inputs
  const [titlePrompt, setTitlePrompt] = useState("");
  const [descriptionPrompt, setDescriptionPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [backgroundPrompt, setBackgroundPrompt] = useState("");

  // AI Attribution Parser state
  const [frontMatterText, setFrontMatterText] = useState("");
  const [isParsingAttribution, setIsParsingAttribution] = useState(false);
  const [parseError, setParseError] = useState("");

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);

  // Generated options
  const [titleOptions, setTitleOptions] = useState<Array<{ en: string; es: string }>>([]);
  const [descriptionOptions, setDescriptionOptions] = useState<Array<{ en: string; es: string }>>([]);
  const [imageOptions, setImageOptions] = useState<Array<{ url: string; revisedPrompt?: string }>>([]);
  const [backgroundOptions, setBackgroundOptions] = useState<Array<{ url: string; revisedPrompt?: string }>>([]);

  const isGenerating = (type: "title" | "description" | "image" | "background") => generatingTypes.has(type);
  const isAnyGenerating = generatingTypes.size > 0;

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      updateStoryData({
        thumbnailFile: file,
        thumbnailPreview: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeThumbnail = () => {
    updateStoryData({
      thumbnailFile: null,
      thumbnailPreview: null,
    });
    setImageOptions([]);
  };

  const generateMetadata = async (type: "title" | "description" | "image" | "background") => {
    // Add this type to the generating set
    setGeneratingTypes(prev => new Set(prev).add(type));
    setError("");

    const customPrompt =
      type === "title" ? titlePrompt :
      type === "description" ? descriptionPrompt :
      type === "image" ? imagePrompt :
      backgroundPrompt;

    try {
      const response = await fetch("/api/admin/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: storyData.rawText,
          sourceLanguage: storyData.sourceLanguage,
          type,
          customPrompt: customPrompt || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate");
      }

      if (type === "title") {
        setTitleOptions(data.options);
      } else if (type === "description") {
        setDescriptionOptions(data.options);
      } else if (type === "image") {
        setImageOptions(data.options);
      } else if (type === "background") {
        setBackgroundOptions(data.options);
      }
    } catch (err) {
      setError(`Failed to generate ${type}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      // Remove this type from the generating set
      setGeneratingTypes(prev => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  };

  // Generate all metadata in parallel
  const generateAll = async () => {
    const types: Array<"title" | "description" | "image" | "background"> = [];

    // Only generate what hasn't been set yet
    if (!storyData.title.en && !storyData.title.es && titleOptions.length === 0) {
      types.push("title");
    }
    if (!storyData.description.en && !storyData.description.es && descriptionOptions.length === 0) {
      types.push("description");
    }
    if (!storyData.thumbnailPreview && imageOptions.length === 0) {
      types.push("image");
    }
    if (!storyData.backgroundPreview && backgroundOptions.length === 0) {
      types.push("background");
    }

    if (types.length === 0) return;

    // Fire all requests in parallel
    await Promise.all(types.map(type => generateMetadata(type)));
  };

  const selectTitle = (option: { en: string; es: string }) => {
    updateStoryData({ title: option });
    setTitleOptions([]);
  };

  const selectDescription = (option: { en: string; es: string }) => {
    // AI-generated descriptions are short hooks, so fill the hook field
    updateStoryData({ hook: option });
    setDescriptionOptions([]);
  };

  const selectImage = async (imageUrl: string) => {
    // Use proxy endpoint to fetch image (bypasses CORS from DALL-E Azure blob storage)
    try {
      const response = await fetch("/api/admin/proxy-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const data = await response.json();
      const dataUrl = data.dataUrl;

      // Convert data URL to blob for the File object
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      updateStoryData({
        thumbnailFile: new File([blob], "ai-generated-thumbnail.png", { type: "image/png" }),
        thumbnailPreview: dataUrl,
      });
      setImageOptions([]);
    } catch (err) {
      setError("Failed to select image");
    }
  };

  const selectBackground = async (imageUrl: string) => {
    // Use proxy endpoint to fetch image (bypasses CORS from DALL-E Azure blob storage)
    try {
      const response = await fetch("/api/admin/proxy-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const data = await response.json();
      const dataUrl = data.dataUrl;

      // Convert data URL to blob for the File object
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      updateStoryData({
        backgroundFile: new File([blob], "ai-generated-background.png", { type: "image/png" }),
        backgroundPreview: dataUrl,
      });
      setBackgroundOptions([]);
    } catch (err) {
      setError("Failed to select background");
    }
  };

  // Parse front matter with AI to extract attribution
  const parseAttributionWithAI = async () => {
    if (!frontMatterText.trim()) {
      setParseError("Please paste the front matter text first");
      return;
    }

    setIsParsingAttribution(true);
    setParseError("");

    try {
      const response = await fetch("/api/admin/parse-attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frontMatterText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse attribution");
      }

      // Merge the parsed attribution with defaults
      const parsedAttribution: FormAttribution = {
        ...createEmptyFormAttribution(),
        ...data.attribution,
      };

      // Update story data - set isOriginal to false since we're adding attribution
      updateStoryData({
        isOriginal: false,
        attribution: parsedAttribution,
      });

      // Clear the front matter text on success
      setFrontMatterText("");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse attribution");
    } finally {
      setIsParsingAttribution(false);
    }
  };

  // Translate English title and summary to Spanish
  const translateToSpanish = async () => {
    const needsTitleTranslation = storyData.title.en && !storyData.title.es;
    const needsSummaryTranslation = storyData.description.en && !storyData.description.es;

    if (!needsTitleTranslation && !needsSummaryTranslation) {
      return;
    }

    setIsTranslating(true);
    setError("");

    try {
      const textsToTranslate: string[] = [];
      if (needsTitleTranslation) textsToTranslate.push(storyData.title.en);
      if (needsSummaryTranslation) textsToTranslate.push(storyData.description.en);

      const response = await fetch("/api/admin/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textsToTranslate.join("\n\n---SEPARATOR---\n\n"),
          sourceLanguage: "en",
          type: "translate-to-spanish",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to translate");
      }

      // Parse the translated texts
      const translations = data.translatedTexts || [];
      const updates: Partial<StoryData> = {};

      let idx = 0;
      if (needsTitleTranslation && translations[idx]) {
        updates.title = { ...storyData.title, es: translations[idx] };
        idx++;
      }
      if (needsSummaryTranslation && translations[idx]) {
        updates.description = { ...storyData.description, es: translations[idx] };
      }

      updateStoryData(updates);
    } catch (err) {
      setError(`Failed to translate: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Story Metadata</h2>
        <p className="text-gray-500 text-sm">Enter manually or generate with AI. Add optional prompts to guide generation.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Generate All Button */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">AI Generation</h3>
          <p className="text-xs text-gray-500">Generate title, description, and images in parallel</p>
        </div>
        <button
          onClick={generateAll}
          disabled={isAnyGenerating || !storyData.rawText}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isAnyGenerating ? "Generating..." : "Generate All with AI"}
        </button>
      </div>

      {/* Thumbnail Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Thumbnail Image</h3>
          {!storyData.thumbnailPreview && (
            <button
              onClick={() => generateMetadata("image")}
              disabled={isGenerating("image") || !storyData.rawText}
              className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating("image") ? "Generating..." : "Generate with AI"}
            </button>
          )}
        </div>

        {/* Image AI Prompt Input */}
        {!storyData.thumbnailPreview && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">AI Guidance (optional)</label>
            <input
              type="text"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="e.g., Watercolor style, warm colors, cartoon illustration, minimalist..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
        )}

        {/* Image Options */}
        {imageOptions.length > 0 && !storyData.thumbnailPreview && (
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-medium mb-3">Click to select:</p>
            <div className="grid grid-cols-2 gap-4">
              {imageOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => selectImage(option.url)}
                  className="relative group"
                >
                  <img
                    src={option.url}
                    alt={`Generated option ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border-2 border-purple-200 group-hover:border-purple-500 transition-colors"
                  />
                  <div className="absolute inset-0 bg-purple-600 bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Thumbnail or Upload */}
        {storyData.thumbnailPreview ? (
          <div className="flex items-start gap-4">
            <img
              src={storyData.thumbnailPreview}
              alt="Thumbnail preview"
              className="w-32 h-32 object-cover rounded-lg border border-gray-300"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">{storyData.thumbnailFile?.name}</p>
              <button
                onClick={removeThumbnail}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              className="hidden"
              id="thumbnail-upload"
            />
            <label
              htmlFor="thumbnail-upload"
              className="cursor-pointer"
            >
              <div className="text-4xl mb-2">{isDragging ? "📥" : "📷"}</div>
              <p className="text-gray-600">
                {isDragging ? "Drop image here" : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB</p>
            </label>
          </div>
        )}
        <p className="text-xs text-gray-500">
          Optional: If no thumbnail is uploaded, a placeholder will be used.
        </p>
      </div>

      {/* Background Image Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Story Background Image</h3>
          {!storyData.backgroundPreview && (
            <button
              onClick={() => generateMetadata("background")}
              disabled={isGenerating("background")}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 disabled:opacity-50"
            >
              {isGenerating("background") ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Generating...
                </>
              ) : (
                <>✨ Generate with AI</>
              )}
            </button>
          )}
        </div>

        {/* AI Background Prompt Input */}
        {!storyData.backgroundPreview && (
          <div className="flex gap-2">
            <input
              type="text"
              value={backgroundPrompt}
              onChange={(e) => setBackgroundPrompt(e.target.value)}
              placeholder="Optional: Guide AI (e.g., 'sunset beach scene', 'cozy library')"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
        )}

        {/* AI Generated Background Options */}
        {backgroundOptions.length > 0 && !storyData.backgroundPreview && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-medium mb-3">Click to select:</p>
            <div className="grid grid-cols-2 gap-4">
              {backgroundOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => selectBackground(option.url)}
                  className="relative group"
                >
                  <img
                    src={option.url}
                    alt={`Generated option ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border-2 border-transparent group-hover:border-purple-500 transition-colors"
                  />
                  <div className="absolute inset-0 bg-purple-600 bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-colors" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setBackgroundOptions([])}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700"
            >
              Dismiss options
            </button>
          </div>
        )}

        {storyData.backgroundPreview ? (
          <div className="flex items-start gap-4">
            <img
              src={storyData.backgroundPreview}
              alt="Background preview"
              className="w-64 h-40 object-cover rounded-lg border border-gray-300"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">{storyData.backgroundFile?.name}</p>
              <button
                onClick={() => {
                  updateStoryData({ backgroundFile: null, backgroundPreview: null });
                  setBackgroundOptions([]);
                }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    updateStoryData({
                      backgroundFile: file,
                      backgroundPreview: reader.result as string,
                    });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              id="background-upload"
            />
            <label htmlFor="background-upload" className="cursor-pointer">
              <div className="text-4xl mb-2">🖼️</div>
              <p className="text-gray-600">Click to upload background</p>
              <p className="text-xs text-gray-400 mt-1">Recommended: 1920x1080 or larger (landscape)</p>
            </label>
          </div>
        )}
        <p className="text-xs text-gray-500">
          Optional: If no background is uploaded, a subtle tan color will be used.
        </p>
      </div>

      {/* Story Classification Section */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="font-medium text-gray-900">Story Classification</h3>

        {/* Story Type Dropdown */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Story Type</label>
          <select
            value={storyData.storyType}
            onChange={(e) => updateStoryData({ storyType: e.target.value as StoryType })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {ALL_STORY_TYPES.map((type) => (
              <option key={type} value={type}>
                {STORY_TYPE_LABELS[type].en}
              </option>
            ))}
          </select>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">Target Audience</label>
          <div className="flex gap-2">
            {(["all", "children", "teen", "adult"] as const).map((audience) => (
              <button
                key={audience}
                type="button"
                onClick={() => updateStoryData({ targetAudience: audience })}
                className={`px-4 py-2 rounded-lg border-2 text-sm capitalize transition-all ${
                  storyData.targetAudience === audience
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {audience === "all" ? "All Ages" : audience}
              </button>
            ))}
          </div>
        </div>

        {/* Tags Multi-Select */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">
            Tags <span className="text-gray-400">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_STORY_TAGS.map((tag) => {
              const isSelected = storyData.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      updateStoryData({ tags: storyData.tags.filter((t) => t !== tag) });
                    } else {
                      updateStoryData({ tags: [...storyData.tags, tag] });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {STORY_TAG_LABELS[tag].en}
                </button>
              );
            })}
          </div>
          {storyData.tags.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Selected: {storyData.tags.map((t) => STORY_TAG_LABELS[t].en).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Source Toggle Section */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="font-medium text-gray-900">Story Source</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const newIsOriginal = !storyData.isOriginal;
              updateStoryData({
                isOriginal: newIsOriginal,
                attribution: newIsOriginal ? null : createEmptyFormAttribution(),
              });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              storyData.isOriginal ? "bg-green-600" : "bg-blue-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                storyData.isOriginal ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">
            {storyData.isOriginal ? "Cuentana Original" : "External Source (requires attribution)"}
          </span>
        </div>
      </div>

      {/* Title Section */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Title</h3>
          <button
            onClick={() => generateMetadata("title")}
            disabled={isGenerating("title") || !storyData.rawText}
            className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating("title") ? "Generating..." : "Generate with AI"}
          </button>
        </div>

        {/* Title AI Prompt Input */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">AI Guidance (optional)</label>
          <input
            type="text"
            value={titlePrompt}
            onChange={(e) => setTitlePrompt(e.target.value)}
            placeholder="e.g., Make it playful, use alliteration, keep it short..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
        </div>

        {/* Title Options */}
        {titleOptions.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-purple-600 font-medium mb-2">Click to select:</p>
            {titleOptions.map((option, idx) => (
              <button
                key={idx}
                onClick={() => selectTitle(option)}
                className="w-full text-left p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-400 transition-colors"
              >
                <div className="font-medium text-gray-900">{option.en}</div>
                <div className="text-sm text-gray-500">{option.es}</div>
              </button>
            ))}
          </div>
        )}

        {/* Full Title (required) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Full Title (English) *</label>
            <input
              type="text"
              value={storyData.title.en}
              onChange={(e) => updateStoryData({ title: { ...storyData.title, en: e.target.value } })}
              placeholder="e.g., Beowulf: An Anglo-Saxon Epic Poem"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Full Title (Spanish) *</label>
            <input
              type="text"
              value={storyData.title.es}
              onChange={(e) => updateStoryData({ title: { ...storyData.title, es: e.target.value } })}
              placeholder="e.g., Beowulf: Un Poema Épico Anglosajón"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Translate to Spanish Button */}
        {(storyData.title.en && !storyData.title.es) || (storyData.description.en && !storyData.description.es) ? (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex-1">
              <p className="text-sm text-blue-800">
                Missing Spanish translations for{" "}
                {[
                  storyData.title.en && !storyData.title.es && "title",
                  storyData.description.en && !storyData.description.es && "summary",
                ].filter(Boolean).join(" and ")}
              </p>
            </div>
            <button
              type="button"
              onClick={translateToSpanish}
              disabled={isTranslating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isTranslating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Translating...
                </>
              ) : (
                "Translate to Spanish"
              )}
            </button>
          </div>
        ) : null}

        {/* Story Slug */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Story Slug *</label>
          <input
            type="text"
            value={storyData.slug}
            onChange={(e) =>
              updateStoryData({
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"),
              })
            }
            placeholder="beowulf"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">URL-friendly identifier (auto-generated from title, but can be edited)</p>
        </div>

        {/* Display Title (optional) */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Display Title (optional)</h4>
              <p className="text-xs text-gray-500">Short version for cards and navigation. If empty, full title will be used.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Title (English)</label>
              <input
                type="text"
                value={storyData.displayTitle?.en ?? ""}
                onChange={(e) => updateStoryData({
                  displayTitle: {
                    en: e.target.value,
                    es: storyData.displayTitle?.es ?? ""
                  }
                })}
                placeholder="e.g., Beowulf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Title (Spanish)</label>
              <input
                type="text"
                value={storyData.displayTitle?.es ?? ""}
                onChange={(e) => updateStoryData({
                  displayTitle: {
                    en: storyData.displayTitle?.en ?? "",
                    es: e.target.value
                  }
                })}
                placeholder="e.g., Beowulf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Description</h3>
          <button
            onClick={() => generateMetadata("description")}
            disabled={isGenerating("description") || !storyData.rawText}
            className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating("description") ? "Generating..." : "Generate Hook with AI"}
          </button>
        </div>

        {/* Description AI Prompt Input */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">AI Guidance (optional)</label>
          <input
            type="text"
            value={descriptionPrompt}
            onChange={(e) => setDescriptionPrompt(e.target.value)}
            placeholder="e.g., Focus on the emotional journey, keep it mysterious, mention the setting..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
        </div>

        {/* AI Hook Options */}
        {descriptionOptions.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-purple-600 font-medium mb-2">Click to select a hook:</p>
            {descriptionOptions.map((option, idx) => (
              <button
                key={idx}
                onClick={() => selectDescription(option)}
                className="w-full text-left p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-400 transition-colors"
              >
                <div className="text-gray-900 text-sm">{option.en}</div>
                <div className="text-gray-500 text-sm mt-1">{option.es}</div>
              </button>
            ))}
          </div>
        )}

        {/* Hook (required) - short teaser for cards */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hook (English) *</label>
            <input
              type="text"
              value={storyData.hook?.en ?? ""}
              onChange={(e) => updateStoryData({
                hook: {
                  en: e.target.value,
                  es: storyData.hook?.es ?? ""
                }
              })}
              placeholder="1-2 sentence teaser for story cards"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hook (Spanish) *</label>
            <input
              type="text"
              value={storyData.hook?.es ?? ""}
              onChange={(e) => updateStoryData({
                hook: {
                  en: storyData.hook?.en ?? "",
                  es: e.target.value
                }
              })}
              placeholder="Gancho de 1-2 oraciones para tarjetas"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Summary (optional) - full description */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Summary (optional)</h4>
              <p className="text-xs text-gray-500">Full plot summary for the story detail page. Often found in front matter as "THE STORY".</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Summary (English)</label>
              <textarea
                value={storyData.description.en}
                onChange={(e) =>
                  updateStoryData({ description: { ...storyData.description, en: e.target.value } })
                }
                placeholder="Full description of the story..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Summary (Spanish)</label>
              <textarea
                value={storyData.description.es}
                onChange={(e) =>
                  updateStoryData({ description: { ...storyData.description, es: e.target.value } })
                }
                placeholder="Descripción completa de la historia..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attribution Section (only if External Source) */}
      {!storyData.isOriginal && (
        <div className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-gray-900">Attribution Information</h3>

          {/* AI Attribution Parser */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-purple-900">AI Attribution Parser</h4>
                <p className="text-xs text-purple-600">Paste front matter text (title page, copyright, translator info) and let AI extract the metadata</p>
              </div>
              <button
                type="button"
                onClick={parseAttributionWithAI}
                disabled={isParsingAttribution || !frontMatterText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isParsingAttribution ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Parsing...
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    Parse with AI
                  </>
                )}
              </button>
            </div>
            <textarea
              value={frontMatterText}
              onChange={(e) => {
                setFrontMatterText(e.target.value);
                setParseError("");
              }}
              placeholder="Paste the front matter here (e.g., title page, copyright notice, translator credits, publication info)..."
              rows={frontMatterText ? Math.min(12, frontMatterText.split("\n").length + 2) : 4}
              className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none bg-white transition-all"
            />
            {parseError && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                {parseError}
              </div>
            )}
          </div>

        {/* Full Attribution Fields (only if not original) */}
        {!storyData.isOriginal && storyData.attribution && (
          <div className="space-y-4">
            {/* Author Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Author Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Author Name *</label>
                  <input
                    type="text"
                    value={storyData.attribution.authorName}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorName: e.target.value },
                      })
                    }
                    placeholder="e.g., Unknown, or Traditional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lifespan</label>
                  <input
                    type="text"
                    value={storyData.attribution.authorLifespan ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorLifespan: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., c. 8th century"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={storyData.attribution.authorIsUnknown ?? false}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorIsUnknown: e.target.checked || undefined },
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  Author Unknown
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={storyData.attribution.authorIsCollective ?? false}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, authorIsCollective: e.target.checked || undefined },
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  Collective/Traditional Authorship
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Author Note</label>
                <input
                  type="text"
                  value={storyData.attribution.authorNote ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, authorNote: e.target.value || undefined },
                    })
                  }
                  placeholder="Additional context about authorship"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Dating Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Dating</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Year Written</label>
                  <input
                    type="text"
                    value={storyData.attribution.yearWritten ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, yearWritten: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., c. 700-1000 CE"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Year First Published</label>
                  <input
                    type="text"
                    value={storyData.attribution.yearFirstPublished ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, yearFirstPublished: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1815"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Source Edition Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Source Edition (the edition you are ingesting)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Edition Title</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourceTitle ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourceTitle: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Beowulf: A Verse Translation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Publisher</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourcePublisher ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourcePublisher: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Oxford University Press"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Publication Year</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourcePublicationYear ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourcePublicationYear: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1910"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Editor</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourceEditor ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourceEditor: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., John Smith"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Source URL (Gutenberg, Wikisource, etc.)</label>
                <input
                  type="text"
                  value={storyData.attribution.sourceUrl ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, sourceUrl: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., https://www.gutenberg.org/ebooks/16328"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Edition Notes</label>
                <input
                  type="text"
                  value={storyData.attribution.sourceNotes ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, sourceNotes: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., Facsimile of 19th-century edition"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={storyData.attribution.sourceIsPublicDomain}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourceIsPublicDomain: e.target.checked },
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  Source Edition is Public Domain
                </label>
              </div>
              {storyData.attribution.sourceIsPublicDomain && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Public Domain Note</label>
                  <input
                    type="text"
                    value={storyData.attribution.sourcePublicDomainNote ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, sourcePublicDomainNote: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Published before 1929"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Translator Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Translator (if using a translation)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translator Name</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorName ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorName: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Francis Gummere"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translator Lifespan</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorLifespan ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorLifespan: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1855-1919"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translation Year</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorYear ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorYear: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., 1909"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={storyData.attribution.translatorIsPublicDomain ?? true}
                      onChange={(e) =>
                        updateStoryData({
                          attribution: { ...storyData.attribution!, translatorIsPublicDomain: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Translation is Public Domain
                  </label>
                </div>
              </div>
              {storyData.attribution.translatorName && storyData.attribution.translatorIsPublicDomain && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Translation Public Domain Note</label>
                  <input
                    type="text"
                    value={storyData.attribution.translatorPublicDomainNote ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, translatorPublicDomainNote: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Published before 1929"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Region & Culture Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Region & Culture</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Region / Origin</label>
                  <input
                    type="text"
                    value={storyData.attribution.region ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, region: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Anglo-Saxon England"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cultural Influences (comma-separated)</label>
                  <input
                    type="text"
                    value={storyData.attribution.culturalInfluences ?? ""}
                    onChange={(e) =>
                      updateStoryData({
                        attribution: { ...storyData.attribution!, culturalInfluences: e.target.value || undefined },
                      })
                    }
                    placeholder="e.g., Norse, Celtic, Germanic"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Genres (comma-separated)</label>
                <input
                  type="text"
                  value={storyData.attribution.genres ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, genres: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., Epic poetry, Mythology, Heroic literature"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Rights & Provenance Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Rights & Provenance</h4>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Original Work Status *</label>
                <select
                  value={storyData.attribution.originalWorkStatus}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: {
                        ...storyData.attribution!,
                        originalWorkStatus: e.target.value as "public-domain" | "licensed" | "original",
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="public-domain">Public Domain</option>
                  <option value="licensed">Licensed</option>
                  <option value="original">Original (Cuentana)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rights Display Statement</label>
                <textarea
                  value={storyData.attribution.rightsDisplayStatement ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, rightsDisplayStatement: e.target.value || undefined },
                    })
                  }
                  placeholder="Leave blank to auto-generate. e.g., The original text is in the public domain. This educational adaptation © Cuentana."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Provenance Note (where the text came from)</label>
                <input
                  type="text"
                  value={storyData.attribution.provenanceNote ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, provenanceNote: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., Text sourced from Project Gutenberg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Provenance URL</label>
                <input
                  type="text"
                  value={storyData.attribution.provenanceUrl ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, provenanceUrl: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., https://www.gutenberg.org/ebooks/16328"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Copyright Note</label>
                <input
                  type="text"
                  value={storyData.attribution.copyrightNote ?? ""}
                  onChange={(e) =>
                    updateStoryData({
                      attribution: { ...storyData.attribution!, copyrightNote: e.target.value || undefined },
                    })
                  }
                  placeholder="e.g., No modern copyrighted annotations were included"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

// Step 4: Generate Levels
function Step4Generate({
  storyData,
  updateStoryData,
  isProcessing,
  setIsProcessing,
}: {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}) {
  const [currentGenerating, setCurrentGenerating] = useState<number | null>(null);
  const [chapterProgress, setChapterProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [comparisonLevel, setComparisonLevel] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [splitPosition, setSplitPosition] = useState(50); // Percentage for left panel width

  // Refs for draggable divider - uses CSS variables for smooth, lag-free dragging
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle divider drag - updates CSS variable directly for smooth performance
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleDividerMouseMove);
    document.addEventListener("mouseup", handleDividerMouseUp);
  };

  const handleDividerMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
    // Clamp between 20% and 80%
    const clampedPosition = Math.min(80, Math.max(20, newPosition));
    // Update CSS variable directly - no React re-render, buttery smooth
    containerRef.current.style.setProperty("--split-pos", `${clampedPosition}%`);
  };

  const handleDividerMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    // Sync final position to React state
    if (containerRef.current) {
      const finalPos = containerRef.current.style.getPropertyValue("--split-pos");
      if (finalPos) {
        setSplitPosition(parseFloat(finalPos));
      }
    }
    document.removeEventListener("mousemove", handleDividerMouseMove);
    document.removeEventListener("mouseup", handleDividerMouseUp);
  };

  // Helper to render text with line numbers (single panel mode)
  const renderNumberedLines = (text: string, className?: string) => {
    const lines = text.split("\n");
    return (
      <div className={`font-mono text-sm leading-relaxed ${className || ""}`}>
        {lines.map((line, idx) => (
          <div key={idx} className="flex">
            <span className="select-none text-gray-400 text-right pr-4 shrink-0" style={{ width: "3.5rem" }}>
              {idx + 1}
            </span>
            <span className="text-gray-700 whitespace-pre-wrap break-words flex-1">{line || "\u00A0"}</span>
          </div>
        ))}
      </div>
    );
  };

  // Helper to render side-by-side comparison with locked line numbers
  const renderSideBySideLines = (leftText: string, rightText: string) => {
    const leftLines = leftText.split("\n");
    const rightLines = rightText.split("\n");
    const maxLines = Math.max(leftLines.length, rightLines.length);

    return (
      <div className="font-mono text-sm leading-relaxed">
        {Array.from({ length: maxLines }, (_, idx) => (
          <div key={idx} className="flex border-b border-gray-100 hover:bg-gray-50">
            {/* Line number */}
            <div className="select-none text-gray-400 text-right pr-3 shrink-0 py-1 bg-gray-50 border-r border-gray-200" style={{ width: "3.5rem" }}>
              {idx + 1}
            </div>
            {/* Left (original) text */}
            <div
              className="py-1 px-3 text-gray-700 whitespace-pre-wrap break-words border-r border-gray-200"
              style={{ width: `calc(var(--split-pos, ${splitPosition}%) - 1.75rem)` }}
            >
              {leftLines[idx] || "\u00A0"}
            </div>
            {/* Right (rewritten) text */}
            <div
              className="py-1 px-3 text-gray-700 whitespace-pre-wrap break-words flex-1"
            >
              {rightLines[idx] || "\u00A0"}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Open comparison panel for a level (-1 = original text review only)
  const openComparison = (level: number) => {
    if (level === -1) {
      // Original text review mode
      setComparisonLevel(-1);
      setEditedText(storyData.rawText);
      setIsEditing(false);
    } else {
      const content = storyData.levelContent[level];
      if (content?.sourceText) {
        setComparisonLevel(level);
        setEditedText(content.sourceText);
        setIsEditing(false);
      }
    }
  };

  // Save edited text
  const saveEditedText = () => {
    if (comparisonLevel === -1) {
      // Saving edited original text
      updateStoryData({ rawText: editedText });
      setIsEditing(false);
    } else if (comparisonLevel !== null) {
      const current = storyData.levelContent[comparisonLevel];
      updateStoryData({
        levelContent: {
          ...storyData.levelContent,
          [comparisonLevel]: {
            ...current,
            sourceText: editedText,
          },
        },
      });
      setIsEditing(false);
    }
  };

  // Initialize mode for levels that don't have one yet
  const getLevelMode = (level: number): "generate" | "use-original" | "omit" => {
    if (storyData.levelContent[level]?.mode) {
      return storyData.levelContent[level].mode;
    }
    // Default: source level uses original, others generate
    return level === storyData.detectedLevel ? "use-original" : "generate";
  };

  const setLevelMode = (level: number, mode: "generate" | "use-original" | "omit") => {
    const current = storyData.levelContent[level] || { sourceText: "", translatedText: "", status: "pending" as const, mode: "generate" as const };
    const newStatus = mode === "omit" ? "omitted" as const : "pending" as const;
    updateStoryData({
      levelContent: {
        ...storyData.levelContent,
        [level]: { ...current, mode, status: newStatus },
      },
    });
  };

  // Rewrite a single chunk of text
  const rewriteChunk = async (text: string, targetLevel: number): Promise<string> => {
    const response = await fetch("/api/admin/rewrite-level", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sourceLanguage: storyData.sourceLanguage,
        targetLevel,
        sourceLevel: storyData.detectedLevel,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate");
    }

    return data.rewrittenText;
  };

  const processLevel = async (level: number, accumulator: Record<number, LevelContent>) => {
    setCurrentGenerating(level);
    setChapterProgress(null);
    setError("");

    const mode = getLevelMode(level);

    // Update status to generating
    accumulator[level] = { sourceText: "", translatedText: "", status: "generating", mode };
    updateStoryData({ levelContent: { ...accumulator } });

    try {
      // If using original text (either source level or "use-original" mode)
      if (level === storyData.detectedLevel || mode === "use-original") {
        accumulator[level] = {
          sourceText: cleanText(storyData.rawText),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        setCurrentGenerating(null);
        return true;
      }

      // Check if we have chapters from parsing
      const chapters = storyData.parsedResult?.chapters;

      if (chapters && chapters.length > 1) {
        // Process chapter by chapter for long texts
        const rewrittenChapters: string[] = [];
        setChapterProgress({ current: 0, total: chapters.length });

        for (let i = 0; i < chapters.length; i++) {
          setChapterProgress({ current: i + 1, total: chapters.length });

          const chapter = chapters[i];
          const chapterText = chapter.rawText;

          // Skip empty chapters
          if (!chapterText.trim()) {
            rewrittenChapters.push("");
            continue;
          }

          try {
            const rewritten = await rewriteChunk(chapterText, level);
            rewrittenChapters.push(rewritten);
          } catch (chunkError) {
            // If a chapter fails, add error marker but continue
            console.error(`Failed to rewrite chapter ${i + 1}:`, chunkError);
            rewrittenChapters.push(`[ERROR: Failed to rewrite chapter ${chapter.title || i + 1}]\n\n${chapterText}`);
          }

          // Small delay between chapters to avoid rate limiting
          if (i < chapters.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Concatenate all rewritten chapters with proper chapter labels
        const fullRewrittenText = rewrittenChapters
          .map((text, idx) => {
            const chapterTitle = chapters[idx]?.title || `Chapter ${idx + 1}`;
            const chapterNumber = chapters[idx]?.number || idx + 1;
            // Format: "--- Chapter X: Title ---" or just "--- Chapter X ---"
            const divider = chapters[idx]?.title
              ? `--- Chapter ${chapterNumber}: ${chapterTitle} ---`
              : `--- Chapter ${chapterNumber} ---`;
            return idx === 0 ? text : `${divider}\n\n${text}`;
          })
          .join("\n\n");

        accumulator[level] = {
          sourceText: cleanText(fullRewrittenText),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        setChapterProgress(null);
        return true;
      } else {
        // No chapters or single chapter - process as single text
        const rewrittenText = await rewriteChunk(cleanText(storyData.rawText), level);

        accumulator[level] = {
          sourceText: cleanText(rewrittenText),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        return true;
      }
    } catch (err) {
      accumulator[level] = { sourceText: "", translatedText: "", status: "error", mode };
      updateStoryData({ levelContent: { ...accumulator } });
      setError(`Failed to generate L${level}: ${err instanceof Error ? err.message : "Unknown error"}`);
      return false;
    } finally {
      setCurrentGenerating(null);
      setChapterProgress(null);
    }
  };

  const processSingleLevel = async (level: number) => {
    const accumulator = { ...storyData.levelContent };
    await processLevel(level, accumulator);
  };

  const processAllLevels = async () => {
    setIsProcessing(true);
    const accumulator = { ...storyData.levelContent };

    for (const level of [1, 2, 3, 4, 5]) {
      const mode = getLevelMode(level);
      // Skip omitted levels and already done levels
      if (mode === "omit" || accumulator[level]?.status === "done") {
        continue;
      }
      await processLevel(level, accumulator);
    }
    setIsProcessing(false);
  };

  // Check if all non-omitted levels are done
  const allDone = [1, 2, 3, 4, 5].every((l) => {
    const mode = getLevelMode(l);
    return mode === "omit" || storyData.levelContent[l]?.status === "done";
  });

  // Check if at least one level is not omitted
  const hasNonOmittedLevels = [1, 2, 3, 4, 5].some((l) => getLevelMode(l) !== "omit");

  // Get original text for comparison (cleaned rawText)
  const originalText = storyData.rawText;
  const comparisonContent = comparisonLevel !== null ? storyData.levelContent[comparisonLevel] : null;

  return (
    <>
      {/* Main content - always full width */}
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Generate Level Variations</h2>
            <p className="text-gray-500 text-sm">
              Choose whether to use the original text or have AI generate a CEFR-appropriate version for each level.
            </p>
          </div>
          <button
            onClick={() => openComparison(-1)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Review Original Text
          </button>
        </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((level) => {
          const content = storyData.levelContent[level];
          const isSource = level === storyData.detectedLevel;
          const mode = getLevelMode(level);
          const isOmitted = mode === "omit";

          return (
            <div
              key={level}
              className={`p-4 rounded-lg border-2 transition-all ${
                isOmitted
                  ? "border-gray-200 bg-gray-50 opacity-60"
                  : content?.status === "done"
                  ? "border-green-500 bg-green-50"
                  : content?.status === "generating"
                  ? "border-blue-500 bg-blue-50"
                  : content?.status === "error"
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      isOmitted
                        ? "bg-gray-300 text-gray-500"
                        : content?.status === "done"
                        ? "bg-green-600 text-white"
                        : content?.status === "generating"
                        ? "bg-blue-600 text-white animate-pulse"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {isOmitted ? "—" : content?.status === "done" ? "✓" : `L${level}`}
                  </div>
                  <div>
                    <div className={`font-medium ${isOmitted ? "text-gray-400" : "text-gray-900"}`}>
                      Level {level} {isSource && <span className="text-amber-600">(Source)</span>}
                      {isOmitted && <span className="text-gray-400 ml-2">— Omitted</span>}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isOmitted
                        ? "This level will not be generated"
                        : content?.status === "generating"
                        ? mode === "use-original"
                          ? "Copying original..."
                          : chapterProgress
                            ? `Generating chapter ${chapterProgress.current} of ${chapterProgress.total}...`
                            : "Generating..."
                        : content?.status === "done"
                        ? `${content.sourceText.split("\n").filter((l) => l.trim()).length} lines • ${content.mode === "use-original" ? "Original text" : "AI generated"}`
                        : content?.status === "error"
                        ? "Error - click to retry"
                        : "Pending"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Mode selector - show for levels that aren't done/generating */}
                  {content?.status !== "done" && content?.status !== "generating" && (
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                      <button
                        onClick={() => setLevelMode(level, "generate")}
                        className={`w-20 py-1.5 text-center ${
                          mode === "generate"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => setLevelMode(level, "use-original")}
                        className={`w-24 py-1.5 text-center border-l border-gray-300 ${
                          mode === "use-original"
                            ? "bg-amber-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Use Original
                      </button>
                      <button
                        onClick={() => setLevelMode(level, "omit")}
                        className={`w-14 py-1.5 text-center border-l border-gray-300 ${
                          mode === "omit"
                            ? "bg-gray-500 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Omit
                      </button>
                    </div>
                  )}

                  {/* Process button - fixed width container to prevent layout shift */}
                  {content?.status !== "done" && content?.status !== "generating" && (
                    <div className="w-24">
                      {!isOmitted && (
                        <button
                          onClick={() => processSingleLevel(level)}
                          disabled={isProcessing}
                          className={`w-full py-2 text-white rounded-lg text-sm disabled:opacity-50 ${
                            mode === "use-original"
                              ? "bg-amber-600 hover:bg-amber-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {mode === "use-original" ? "Copy" : "Generate"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {content?.status === "done" && (
                <div className="mt-3 flex items-start gap-4">
                  <details className="flex-1">
                    <summary className="text-sm text-gray-600 cursor-pointer">Preview text</summary>
                    <pre className="mt-2 text-xs bg-white p-3 rounded border max-h-40 overflow-auto whitespace-pre-wrap">
                      {content.sourceText.slice(0, 500)}
                      {content.sourceText.length > 500 && "..."}
                    </pre>
                  </details>
                  <button
                    onClick={() => openComparison(level)}
                    className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    View Full Text
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!allDone && (
        <div className="text-center pt-4">
          <button
            onClick={processAllLevels}
            disabled={isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing
              ? chapterProgress
                ? `Processing chapter ${chapterProgress.current}/${chapterProgress.total}...`
                : "Processing..."
              : "Process All Levels"}
          </button>
        </div>
      )}
      </div>

      {/* Full-screen Modal Overlay for Text Comparison/Review */}
      {comparisonLevel !== null && (comparisonLevel === -1 || comparisonContent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setComparisonLevel(null)}
          />

          {/* Modal Content */}
          <div className="relative w-[95vw] h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`${comparisonLevel === -1 ? "bg-gradient-to-r from-amber-600 to-orange-600" : "bg-gradient-to-r from-indigo-600 to-purple-600"} text-white px-6 py-4 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold">
                  {comparisonLevel === -1 ? "Review Original Text" : `Level ${comparisonLevel} Comparison`}
                </span>
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                  {comparisonLevel === -1
                    ? `${originalText.split("\n").filter(l => l.trim()).length} lines • ${storyData.parsedResult?.chapters.length || 1} chapters`
                    : `${originalText.split("\n").filter(l => l.trim()).length} → ${comparisonContent!.sourceText.split("\n").filter(l => l.trim()).length} lines`
                  }
                </span>
              </div>
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEditedText}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setEditedText(comparisonLevel === -1 ? originalText : comparisonContent!.sourceText);
                        setIsEditing(false);
                      }}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                  >
                    Edit Text
                  </button>
                )}
                <button
                  onClick={() => setComparisonLevel(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Close (Esc)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {comparisonLevel === -1 ? (
              /* Original text review mode - full width with chapter list */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-amber-50 px-6 py-3 text-sm font-medium text-amber-700 border-b flex items-center justify-between shrink-0">
                  <span>Original Text (L{storyData.detectedLevel}) - Review before generation</span>
                  <span className="text-amber-500">{(isEditing ? editedText : originalText).split("\n").filter(l => l.trim()).length} lines</span>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  {isEditing ? (
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full h-full text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="grid gap-3">
                      {storyData.parsedResult?.chapters.map((chapter, idx) => (
                        <details key={idx} className="border border-amber-200 rounded-xl overflow-hidden bg-white shadow-sm">
                          <summary className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 cursor-pointer hover:from-amber-100 hover:to-orange-100 transition-colors flex items-center justify-between">
                            <span className="text-sm font-semibold text-amber-800">
                              Chapter {chapter.number}: {chapter.title}
                            </span>
                            <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                              {chapter.rawText.split("\n").filter(l => l.trim()).length} lines • {chapter.rawText.length.toLocaleString()} chars
                            </span>
                          </summary>
                          <div className="p-4 bg-white border-t border-amber-100 max-h-[50vh] overflow-auto">
                            <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">
                              {chapter.rawText}
                            </pre>
                          </div>
                        </details>
                      )) || (
                        <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">
                          {originalText}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <div className="bg-amber-50 px-6 py-3 text-sm text-amber-600 border-t shrink-0 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Review the text above. Look for non-story content like license text, advertisements, or metadata that should be removed before generation.
                  </div>
                )}
              </div>
            ) : (
              /* Single-scroll side-by-side view with locked line numbers */
              <div
                ref={containerRef}
                className="flex-1 flex flex-col overflow-hidden"
                style={{ "--split-pos": `${splitPosition}%` } as React.CSSProperties}
              >
                {/* Header row */}
                <div className="flex shrink-0 border-b border-gray-300">
                  {/* Line number header */}
                  <div className="bg-gray-100 text-gray-500 text-xs font-medium py-2 text-center border-r border-gray-200" style={{ width: "3.5rem" }}>
                    #
                  </div>
                  {/* Original header */}
                  <div
                    className="bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 border-r border-gray-200 flex items-center justify-between"
                    style={{ width: `calc(var(--split-pos, ${splitPosition}%) - 1.75rem)` }}
                  >
                    <span>Original (L{storyData.detectedLevel})</span>
                    <span className="text-gray-400 text-xs">{originalText.split("\n").length} lines</span>
                  </div>
                  {/* Draggable divider in header */}
                  <div
                    onMouseDown={handleDividerMouseDown}
                    className="w-2 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center shrink-0 transition-colors"
                  />
                  {/* Rewritten header */}
                  <div className="bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 flex-1 flex items-center justify-between">
                    <span>Rewritten (L{comparisonLevel})</span>
                    <span className="text-indigo-400 text-xs">{(isEditing ? editedText : comparisonContent!.sourceText).split("\n").length} lines</span>
                  </div>
                </div>

                {/* Scrollable content - single scroll container */}
                {isEditing ? (
                  <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-auto p-4">
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="w-full h-full text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed border border-gray-300 rounded p-3 focus:ring-2 focus:ring-blue-500 resize-none"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    {renderSideBySideLines(originalText, comparisonContent!.sourceText)}
                  </div>
                )}
              </div>
            )}

            {/* Footer with feature indicators - only show for comparison mode */}
            {comparisonLevel !== -1 && (
              <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500 border-t flex items-center justify-center gap-4 shrink-0">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Line-locked comparison
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Drag header divider to resize
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Step 5: Translate
function Step5Translate({
  storyData,
  updateStoryData,
  isProcessing,
  setIsProcessing,
}: {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}) {
  const [currentTranslating, setCurrentTranslating] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Only show levels that have been generated in Step 4 (not omitted)
  const generatedLevels = [1, 2, 3, 4, 5].filter(
    (l) => storyData.levelContent[l]?.status === "done" &&
           storyData.levelContent[l]?.mode !== "omit" &&
           storyData.levelContent[l]?.sourceText?.length > 0
  );

  const translateLevel = async (level: number, accumulator: Record<number, LevelContent>) => {
    setCurrentTranslating(level);
    setError("");

    try {
      const response = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: accumulator[level].sourceText,
          fromLanguage: storyData.sourceLanguage,
          level,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to translate");
      }

      accumulator[level] = {
        ...accumulator[level],
        translatedText: cleanText(data.translatedText),
      };
      updateStoryData({ levelContent: { ...accumulator } });
      return true;
    } catch (err) {
      setError(`Failed to translate L${level}: ${err instanceof Error ? err.message : "Unknown error"}`);
      return false;
    } finally {
      setCurrentTranslating(null);
    }
  };

  const translateSingleLevel = async (level: number) => {
    const accumulator = { ...storyData.levelContent };
    await translateLevel(level, accumulator);
  };

  const translateAll = async () => {
    setIsProcessing(true);
    const accumulator = { ...storyData.levelContent };

    for (const level of generatedLevels) {
      if (!accumulator[level]?.translatedText) {
        await translateLevel(level, accumulator);
      }
    }
    setIsProcessing(false);
  };

  const allTranslated = generatedLevels.every(
    (l) => storyData.levelContent[l]?.translatedText?.length > 0
  );

  const targetLang = storyData.sourceLanguage === "en" ? "Spanish" : "English";

  if (generatedLevels.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Levels Generated</h2>
        <p className="text-gray-500">Go back to Step 5 and generate at least one level first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Translate to {targetLang}</h2>
        <p className="text-gray-500 text-sm">
          Each generated level will be translated maintaining the same complexity.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-3">
        {generatedLevels.map((level) => {
          const content = storyData.levelContent[level];
          const hasTranslation = content?.translatedText?.length > 0;
          const isTranslating = currentTranslating === level;

          return (
            <div
              key={level}
              className={`p-4 rounded-lg border-2 ${
                hasTranslation
                  ? "border-green-500 bg-green-50"
                  : isTranslating
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      hasTranslation
                        ? "bg-green-600 text-white"
                        : isTranslating
                        ? "bg-blue-600 text-white animate-pulse"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {hasTranslation ? "✓" : `L${level}`}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Level {level}</div>
                    <div className="text-sm text-gray-500">
                      {isTranslating
                        ? "Translating..."
                        : hasTranslation
                        ? `${content.translatedText.split("\n").filter((l) => l.trim()).length} lines translated`
                        : "Pending translation"}
                    </div>
                  </div>
                </div>
                {!hasTranslation && !isTranslating && (
                  <button
                    onClick={() => translateSingleLevel(level)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Translate
                  </button>
                )}
              </div>
              {hasTranslation && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-600 cursor-pointer">Preview translation</summary>
                  <pre className="mt-2 text-xs bg-white p-3 rounded border max-h-40 overflow-auto whitespace-pre-wrap">
                    {content.translatedText.slice(0, 500)}
                    {content.translatedText.length > 500 && "..."}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {!allTranslated && (
        <div className="text-center pt-4">
          <button
            onClick={translateAll}
            disabled={isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? "Translating..." : "Translate All Levels"}
          </button>
        </div>
      )}
    </div>
  );
}

// Step 6: Paginate
function Step6Paginate({
  storyData,
  updateStoryData,
}: {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
}) {
  const lines = storyData.rawText.split("\n").filter((l) => l.trim());
  const totalLines = lines.length;
  const hasPageMarkers = lines.some(l => {
    const trimmed = l.trim().toUpperCase();
    return trimmed === "PAGE" || trimmed === "---PAGE---" || trimmed === "[PAGE]" || trimmed === "PAGE BREAK";
  });
  const pageMarkerCount = lines.filter(l => {
    const trimmed = l.trim().toUpperCase();
    return trimmed === "PAGE" || trimmed === "---PAGE---" || trimmed === "[PAGE]" || trimmed === "PAGE BREAK";
  }).length;
  const estimatedPages = hasPageMarkers
    ? pageMarkerCount + 1
    : Math.ceil(totalLines / storyData.linesPerPage);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Pagination Settings</h2>
        <p className="text-gray-500 text-sm">
          Configure how the story will be split into pages.
        </p>
      </div>

      {hasPageMarkers && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-1">Manual Page Markers Detected</h3>
          <p className="text-sm text-green-700">
            Found {pageMarkerCount} PAGE marker{pageMarkerCount > 1 ? "s" : ""} in your text.
            The story will be paginated at these markers, ignoring the &quot;lines per page&quot; setting.
          </p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lines Per Page
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={storyData.linesPerPage}
              onChange={(e) =>
                updateStoryData({ linesPerPage: Math.max(1, parseInt(e.target.value) || 10) })
              }
              disabled={hasPageMarkers}
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${hasPageMarkers ? "bg-gray-100 text-gray-500" : ""}`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {hasPageMarkers
                ? "Disabled when using PAGE markers"
                : "Default is 10. Use higher for longer stories, lower for poems."}
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{estimatedPages}</div>
              <div className="text-sm text-gray-500">
                {hasPageMarkers ? "Pages (from markers)" : "Estimated Pages"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Preview Structure</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Total lines: {totalLines - pageMarkerCount} (excluding markers)</li>
          <li>• {hasPageMarkers ? `PAGE markers: ${pageMarkerCount}` : `Lines per page: ${storyData.linesPerPage}`}</li>
          <li>• {hasPageMarkers ? "Pages" : "Estimated pages"}: {estimatedPages}</li>
          <li>• Generated levels: {[1, 2, 3, 4, 5].filter(l => storyData.levelContent[l]?.status === "done" && storyData.levelContent[l]?.mode !== "omit").map((l) => `L${l}`).join(", ") || "None"}</li>
        </ul>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium text-gray-900 mb-2">Quick Presets</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => updateStoryData({ linesPerPage: totalLines })}
            disabled={hasPageMarkers}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Single Page ({totalLines} lines)
          </button>
          <button
            onClick={() => updateStoryData({ linesPerPage: 10 })}
            disabled={hasPageMarkers}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Standard (10 lines)
          </button>
          <button
            onClick={() => updateStoryData({ linesPerPage: 5 })}
            disabled={hasPageMarkers}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Short (5 lines)
          </button>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium text-gray-900 mb-2">Manual Page Breaks</h3>
        <p className="text-sm text-gray-600 mb-2">
          For precise control, add these markers on their own line in your source text:
        </p>
        <div className="flex gap-2 flex-wrap">
          <code className="px-2 py-1 bg-gray-100 rounded text-sm">PAGE</code>
          <code className="px-2 py-1 bg-gray-100 rounded text-sm">---PAGE---</code>
          <code className="px-2 py-1 bg-gray-100 rounded text-sm">[PAGE]</code>
          <code className="px-2 py-1 bg-gray-100 rounded text-sm">PAGE BREAK</code>
        </div>
      </div>
    </div>
  );
}

// Step 7: Preview & Save
function Step7Preview({
  storyData,
  isProcessing,
  setIsProcessing,
  saveResult,
  setSaveResult,
}: {
  storyData: StoryData;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  saveResult: { success: boolean; message: string; warnings?: string[] } | null;
  setSaveResult: (r: { success: boolean; message: string; warnings?: string[] } | null) => void;
}) {
  // Only include levels that are fully generated and translated (not omitted)
  const completedLevels = [1, 2, 3, 4, 5].filter(
    (l) =>
      storyData.levelContent[l]?.status === "done" &&
      storyData.levelContent[l]?.mode !== "omit" &&
      storyData.levelContent[l]?.sourceText?.length > 0 &&
      storyData.levelContent[l]?.translatedText?.length > 0
  );

  const [previewLevel, setPreviewLevel] = useState(completedLevels[0] || 1);

  const saveStory = async () => {
    setIsProcessing(true);
    setSaveResult(null);

    try {
      // Build the levels data for the API - only completed levels
      const levels = completedLevels.map((level) => {
        const content = storyData.levelContent[level];
        const isSourceEnglish = storyData.sourceLanguage === "en";

        return {
          level,
          en: isSourceEnglish ? content.sourceText : content.translatedText,
          es: isSourceEnglish ? content.translatedText : content.sourceText,
        };
      });

      // Build origin object based on isOriginal flag
      // Convert form attribution to the full format when saving
      const origin = storyData.isOriginal
        ? { isOriginal: true as const }
        : { isOriginal: false as const, attribution: formToAttribution(storyData.attribution!) };

      const response = await fetch("/api/admin/save-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: storyData.slug,
          title: storyData.title,
          description: storyData.description,
          levels,
          linesPerPage: storyData.linesPerPage,
          thumbnailBase64: storyData.thumbnailPreview || undefined,
          backgroundBase64: storyData.backgroundPreview || undefined,
          // Tagging data
          storyType: storyData.storyType,
          origin,
          tags: storyData.tags,
          targetAudience: storyData.targetAudience,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save story");
      }

      setSaveResult({
        success: true,
        message: `Story saved successfully! Files written: ${data.filesWritten.join(", ")}`,
        warnings: data.warnings,
      });
    } catch (err) {
      setSaveResult({
        success: false,
        message: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const content = storyData.levelContent[previewLevel];
  const isSourceEnglish = storyData.sourceLanguage === "en";
  const enText = isSourceEnglish ? content?.sourceText : content?.translatedText;
  const esText = isSourceEnglish ? content?.translatedText : content?.sourceText;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Preview & Save</h2>
        <p className="text-gray-500 text-sm">
          Review your story before saving to the codebase.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Slug:</span>{" "}
            <span className="font-medium">{storyData.slug}</span>
          </div>
          <div>
            <span className="text-gray-500">Type:</span>{" "}
            <span className="font-medium">{STORY_TYPE_LABELS[storyData.storyType].en}</span>
          </div>
          <div>
            <span className="text-gray-500">Origin:</span>{" "}
            <span className="font-medium">
              {storyData.isOriginal ? "Cuentana Original" : `By ${storyData.attribution?.authorName || "Unknown"}`}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Audience:</span>{" "}
            <span className="font-medium capitalize">
              {storyData.targetAudience === "all" ? "All Ages" : storyData.targetAudience}
            </span>
          </div>
          {storyData.tags.length > 0 && (
            <div className="col-span-2">
              <span className="text-gray-500">Tags:</span>{" "}
              <span className="font-medium">{storyData.tags.map(t => STORY_TAG_LABELS[t].en).join(", ")}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Levels:</span>{" "}
            <span className="font-medium">{completedLevels.map((l) => `L${l}`).join(", ") || "None"}</span>
          </div>
          <div>
            <span className="text-gray-500">Title (EN):</span>{" "}
            <span className="font-medium">{storyData.title.en}</span>
          </div>
          <div>
            <span className="text-gray-500">Title (ES):</span>{" "}
            <span className="font-medium">{storyData.title.es}</span>
          </div>
        </div>
      </div>

      {/* Level Preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Content Preview</h3>
          <div className="flex gap-1">
            {completedLevels.map((level) => (
              <button
                key={level}
                onClick={() => setPreviewLevel(level)}
                className={`px-3 py-1 rounded text-sm ${
                  previewLevel === level
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                L{level}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">English</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border h-48 overflow-auto whitespace-pre-wrap">
              {enText || "No content"}
            </pre>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Spanish</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border h-48 overflow-auto whitespace-pre-wrap">
              {esText || "No content"}
            </pre>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {saveResult ? (
        <div className="space-y-3">
          <div
            className={`p-4 rounded-lg ${
              saveResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            <div className="font-medium mb-1">
              {saveResult.success ? "Success!" : "Error"}
            </div>
            <div className="text-sm">{saveResult.message}</div>
            {saveResult.success && (
              <p className="text-sm mt-2">
                Restart your dev server to see the new story at{" "}
                <code className="bg-green-100 px-1 rounded">/en/stories/{storyData.slug}/l1/1/1</code>
              </p>
            )}
          </div>
          {saveResult.warnings && saveResult.warnings.length > 0 && (
            <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800">
              <div className="font-medium mb-1">Warnings</div>
              <ul className="text-sm list-disc list-inside">
                {saveResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
              <p className="text-xs mt-2">
                Line count mismatches may cause EN/ES translations to be misaligned.
                Please review the generated content files.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center pt-4">
          <button
            onClick={saveStory}
            disabled={isProcessing}
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? "Saving..." : "Save Story to Codebase"}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            This will create content files and update metadata.
          </p>
        </div>
      )}
    </div>
  );
}
