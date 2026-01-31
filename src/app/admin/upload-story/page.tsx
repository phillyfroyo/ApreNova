"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AdminLogin from "./AdminLogin";
import StoryUploadForm from "./StoryUploadForm";
import StoryManager from "./StoryManager";
import CostsManager from "./CostsManager";
import UsersManager from "./UsersManager";
import { SUTPAlgorithms } from "./components/dev-tools";

const ADMIN_SESSION_KEY = "admin_authenticated";

type AdminTab = "upload" | "manage" | "costs" | "users" | "premium" | "dev";

// Warm up serverless functions in the background
function warmupServerless() {
  fetch("/api/admin/warmup").catch(() => {
    // Silently ignore errors - this is just a best-effort warm-up
  });
}

export default function UploadStoryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("upload");

  useEffect(() => {
    // Check if already authenticated in this session
    const sessionAuth = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (sessionAuth === "true") {
      setIsAuthenticated(true);
    }
    setIsLoading(false);

    // Warm up serverless functions immediately on page load
    // This runs in parallel with auth check so functions are ready when user proceeds
    warmupServerless();
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Story Admin</h1>
            <p className="text-sm text-gray-500">Upload and manage stories</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "upload"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Upload New Story
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "manage"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Manage Stories
            </button>
            <button
              onClick={() => setActiveTab("costs")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "costs"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              API Costs
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "users"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab("premium")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "premium"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Premium
            </button>
            <button
              onClick={() => setActiveTab("dev")}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "dev"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Dev Tools
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === "upload" && (
        <StoryUploadForm onLogout={handleLogout} hideHeader />
      )}
      {activeTab === "manage" && <StoryManager />}
      {activeTab === "costs" && <CostsManager />}
      {activeTab === "users" && <UsersManager />}
      {activeTab === "premium" && <PremiumManager />}
      {activeTab === "dev" && <DevTools />}
    </div>
  );
}

// Premium Manager Component (moved from Dev Tools)
function PremiumManager() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  const handleTogglePremium = async () => {
    setToggling(true);
    try {
      await fetch("/api/dev-toggle-premium", { method: "POST" });
      await update();
      router.refresh();
    } catch (err) {
      console.error("Failed to toggle premium:", err);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Premium Status Manager</h2>
          <p className="text-sm text-gray-500 mb-6">
            Toggle premium status for testing purposes.
          </p>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Current Status</h3>
              <p className="text-sm text-gray-500">
                {session?.user?.isPremium ? (
                  <span className="text-green-600 font-medium">Premium</span>
                ) : (
                  <span className="text-gray-600">Free</span>
                )}
              </p>
            </div>
            <button
              onClick={handleTogglePremium}
              disabled={toggling}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              {toggling ? "Toggling..." : "Toggle Premium"}
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-4">
            Note: This sets isPremium without Stripe. Use actual checkout to test billing portal.
          </p>
        </div>
      </div>
    </div>
  );
}

// Dev Tools Component
function DevTools() {
  const [devSubTab, setDevSubTab] = useState<"tools" | "html-analyzer" | "su-tp-algorithms">("tools");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setDevSubTab("tools")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            devSubTab === "tools"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          General Tools
        </button>
        <button
          onClick={() => setDevSubTab("html-analyzer")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            devSubTab === "html-analyzer"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          HTML Analyzer
        </button>
        <button
          onClick={() => setDevSubTab("su-tp-algorithms")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            devSubTab === "su-tp-algorithms"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          SU TP Algorithms
        </button>
      </div>

      {devSubTab === "tools" && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Developer Tools</h2>
            <p className="text-sm text-gray-500 mb-6">
              These tools are for development and testing purposes only.
            </p>
            <p className="text-sm text-gray-400">
              Premium toggle has been moved to its own tab.
            </p>
          </div>
        </div>
      )}

      {devSubTab === "html-analyzer" && <HTMLAnalyzer />}

      {devSubTab === "su-tp-algorithms" && <SUTPAlgorithms />}
    </div>
  );
}

// HTML Analyzer Component
interface DetectedChapter {
  number: number;
  title: string;
  lineIndex: number;
  contentPreview: string;
  lineCount: number;
}

interface HTMLAnalysis {
  fileName: string;
  fileSize: number;
  tagCounts: Record<string, number>;
  preTagContent: Array<{ index: number; lineCount: number; sample: string }>;
  tableContent: Array<{ index: number; rowCount: number; sample: string }>;
  paragraphSample: Array<{ index: number; content: string; isEmpty: boolean }>;
  headerTags: Array<{ tag: string; text: string }>;
  hasTableOfContents: boolean;
  tocIndicators: string[];
  contentStructure: "pre-based" | "p-based" | "mixed" | "unknown";
  firstPreContent: string;
  firstParagraphsContent: string;
  // Extraction test
  extractedTextSample: string;
  extractedLineCount: number;
  // Chapter/Collection detection
  detectedChapters: DetectedChapter[];
  gutenbergHeaderLines: number;
}

function analyzeHTML(html: string, fileName: string): HTMLAnalysis {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Count all tags
  const tagCounts: Record<string, number> = {};
  doc.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });

  // Analyze PRE tags (common for Gutenberg poetry)
  const preTags = doc.querySelectorAll("pre");
  const preTagContent = Array.from(preTags).slice(0, 5).map((pre, i) => {
    const text = pre.textContent || "";
    const lines = text.split("\n").filter((l) => l.trim());
    return {
      index: i,
      lineCount: lines.length,
      sample: lines.slice(0, 5).join("\n").slice(0, 200),
    };
  });

  // Analyze tables (often contain TOC)
  const tables = doc.querySelectorAll("table");
  const tableContent = Array.from(tables).slice(0, 3).map((table, i) => {
    const rows = table.querySelectorAll("tr");
    const firstRowTexts = Array.from(rows)
      .slice(0, 5)
      .map((r) => r.textContent?.trim().slice(0, 50))
      .join(" | ");
    return {
      index: i,
      rowCount: rows.length,
      sample: firstRowTexts.slice(0, 200),
    };
  });

  // Analyze paragraph tags
  const paragraphs = doc.querySelectorAll("p");
  const paragraphSample = Array.from(paragraphs).slice(0, 20).map((p, i) => {
    const text = p.textContent?.trim() || "";
    return {
      index: i,
      content: text.slice(0, 100),
      isEmpty: text.length === 0 || /^\s*$/.test(text),
    };
  });

  // Analyze header tags
  const headers = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headerTags = Array.from(headers).slice(0, 20).map((h) => ({
    tag: h.tagName.toLowerCase(),
    text: (h.textContent?.trim() || "").slice(0, 80),
  }));

  // Detect TOC patterns
  const tocIndicators: string[] = [];

  tables.forEach((table, i) => {
    const links = table.querySelectorAll("a");
    const rows = table.querySelectorAll("tr");
    if (links.length > 10 && rows.length > 10) {
      tocIndicators.push(`Table ${i + 1}: ${links.length} links in ${rows.length} rows (likely TOC)`);
    }
  });

  const tocElements = doc.querySelectorAll('[id*="contents" i], [id*="toc" i], [class*="contents" i], [class*="toc" i]');
  tocElements.forEach((el) => {
    tocIndicators.push(`Found element with TOC indicator: <${el.tagName.toLowerCase()}> id="${el.id}" class="${el.className}"`);
  });

  const internalLinks = doc.querySelectorAll("a.pginternal");
  if (internalLinks.length > 0) {
    tocIndicators.push(`Found ${internalLinks.length} Gutenberg internal links (a.pginternal) - likely TOC`);
  }

  const hasTableOfContents = tocIndicators.length > 0;

  // Determine content structure
  let contentStructure: HTMLAnalysis["contentStructure"] = "unknown";
  const preCount = preTags.length;
  const pCount = paragraphs.length;
  const preHasContent = preTagContent.some((p) => p.lineCount > 5);
  const pHasContent = paragraphSample.some((p) => !p.isEmpty && p.content.length > 50);

  if (preCount > 5 && preHasContent) {
    contentStructure = pCount > 50 && pHasContent ? "mixed" : "pre-based";
  } else if (pCount > 20 && pHasContent) {
    contentStructure = "p-based";
  }

  // Get first substantial PRE content
  const firstSubstantialPre = Array.from(preTags).find((pre) => {
    const lines = (pre.textContent || "").split("\n").filter((l) => l.trim());
    return lines.length > 3;
  });
  const firstPreContent = firstSubstantialPre
    ? (firstSubstantialPre.textContent || "").slice(0, 500)
    : "(No substantial PRE content found)";

  // Get first paragraphs content
  const firstParagraphsContent = Array.from(paragraphs)
    .slice(0, 10)
    .map((p) => p.textContent?.trim())
    .filter((t) => t && t.length > 0)
    .slice(0, 5)
    .join("\n---\n")
    .slice(0, 500) || "(No paragraph content found)";

  // Test actual extraction (simplified version of extractTextFromHTML)
  const extractedText = simulateExtraction(doc);
  const extractedLines = extractedText.split("\n");

  // Detect chapters (BOOK, CHAPTER, PART markers)
  // Note: Some Gutenberg files have no space (e.g., "BOOKXXXV" instead of "BOOK XXXV")
  const detectedChapters: DetectedChapter[] = [];
  const chapterPattern = /^(BOOK|CHAPTER|PART|CANTO)\s*([IVXLC\d]+)\.?\s*(.*)$/i;
  let chapterNum = 0;

  extractedLines.forEach((line, idx) => {
    const trimmed = line.trim();
    const match = trimmed.match(chapterPattern);
    if (match) {
      chapterNum++;
      // Get next few non-blank lines as content preview
      const contentLines = extractedLines.slice(idx + 1, idx + 10)
        .filter(l => l.trim())
        .slice(0, 3);

      // Count lines until next chapter marker
      let lineCount = 0;
      for (let i = idx + 1; i < extractedLines.length; i++) {
        if (chapterPattern.test(extractedLines[i].trim())) break;
        if (extractedLines[i].trim()) lineCount++;
      }

      detectedChapters.push({
        number: chapterNum,
        title: trimmed,
        lineIndex: idx,
        contentPreview: contentLines.join(" | ").slice(0, 150),
        lineCount,
      });
    }
  });

  // Detect Gutenberg header (lines before "*** START OF")
  let gutenbergHeaderLines = 0;
  for (let i = 0; i < extractedLines.length; i++) {
    if (extractedLines[i].includes("*** START OF")) {
      gutenbergHeaderLines = i + 1;
      break;
    }
  }

  return {
    fileName,
    fileSize: html.length,
    tagCounts,
    preTagContent,
    tableContent,
    paragraphSample,
    headerTags,
    hasTableOfContents,
    tocIndicators,
    contentStructure,
    firstPreContent,
    firstParagraphsContent,
    extractedTextSample: extractedLines.filter(l => l.trim()).slice(0, 50).join("\n"),
    extractedLineCount: extractedLines.filter(l => l.trim()).length,
    detectedChapters,
    gutenbergHeaderLines,
  };
}

// Simplified extraction to test what we'd get
function simulateExtraction(doc: Document): string {
  // Remove TOC tables (same logic as text-utils.ts)
  doc.querySelectorAll("table").forEach(table => {
    const internalLinks = table.querySelectorAll("a.pginternal, a[href^='#']");
    const rows = table.querySelectorAll("tr");
    if (internalLinks.length > 10 && internalLinks.length >= rows.length * 0.5) {
      table.remove();
    }
  });

  // Remove explicit TOC elements
  doc.querySelectorAll('[id*="contents" i], [id*="toc" i], [class*="toc" i]').forEach(el => {
    if (el.tagName.toLowerCase() !== 'a') {
      el.remove();
    }
  });

  // Remove "Contents" heading (orphaned after TOC table removal)
  doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(heading => {
    const text = heading.textContent?.trim().toLowerCase() || "";
    if (text === "contents" || text === "table of contents") {
      heading.remove();
    }
  });

  const processNode = (node: Node, parentIsBlock: boolean = false): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (parentIsBlock && /^\s*$/.test(text)) return "";
      return text;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      const lineBreakElements = ["h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"];
      const isLineBreak = lineBreakElements.includes(tagName);
      const paragraphElements = ["p", "div", "blockquote"];
      const isParagraph = paragraphElements.includes(tagName);
      const isPreformatted = tagName === "pre";
      const blockElements = ["body", "div", "section", "article", "main", "header", "footer", ...paragraphElements, ...lineBreakElements];
      const isBlock = blockElements.includes(tagName);

      let content = "";
      el.childNodes.forEach(child => {
        content += processNode(child, isBlock && !isPreformatted);
      });

      if (tagName === "br") return "\n";

      if (isPreformatted) {
        const lines = content.split('\n');
        const nonEmptyLines = lines.filter(l => l.trim().length > 0);
        if (nonEmptyLines.length === 0) return "\n";
        // Preserve newlines with markers (matches text-utils.ts)
        const PRE_NEWLINE = "\x00PRENL\x00";
        const PRE_START = "\x00PRESTART\x00";
        const protectedContent = content.trim().replace(/\n/g, PRE_NEWLINE);
        return PRE_START + protectedContent + "\n\n";
      }

      const trimmedContent = content.replace(/\n/g, '').trim();

      if (isParagraph) {
        if (!trimmedContent) return "\n";
        return trimmedContent + "\n";
      }

      // Headers need DOUBLE line breaks for chapter detection
      const isHeader = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName);
      if (isHeader && trimmedContent) {
        const HEADER_BREAK = "\x00HEADBRK\x00";
        return HEADER_BREAK + trimmedContent + HEADER_BREAK;
      }

      if (isLineBreak && !isHeader && trimmedContent) {
        return "\n" + trimmedContent + "\n";
      }

      return content;
    }

    return "";
  };

  let text = processNode(doc.body, true);

  // Restore markers (matches text-utils.ts post-processing)
  const PRE_NEWLINE_MARKER = "\x00PRENL\x00";
  const PRE_START_MARKER = "\x00PRESTART\x00";
  const HEADER_BREAK_MARKER = "\x00HEADBRK\x00";
  text = text
    .replace(new RegExp(HEADER_BREAK_MARKER, 'g'), "\n\n")
    .replace(new RegExp(PRE_START_MARKER, 'g'), "\n\n")
    .replace(new RegExp(PRE_NEWLINE_MARKER, 'g'), "\n");

  return text;
}

type AnalyzerView = "raw" | "analysis";

function HTMLAnalyzer() {
  const [analysis, setAnalysis] = useState<HTMLAnalysis | null>(null);
  const [rawHTML, setRawHTML] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeView, setActiveView] = useState<AnalyzerView>("raw");

  const processFile = async (file: File) => {
    if (!file.name.match(/\.html?$/i)) {
      alert("Please upload an HTML file (.html or .htm)");
      return;
    }
    const text = await file.text();
    setRawHTML(text);
    setFileName(file.name);
    setActiveView("raw"); // Start with raw view
    setAnalysis(null); // Clear previous analysis
  };

  const runAnalysis = () => {
    if (!rawHTML) return;
    const result = analyzeHTML(rawHTML, fileName);
    setAnalysis(result);
    setActiveView("analysis");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">HTML Structure Analyzer</h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload HTML files to analyze their structure and identify content patterns for the upload pipeline.
        </p>

        {/* Upload Area */}
        <label className="block">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-blue-500"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".html,.htm"
              onChange={handleFileUpload}
              className="hidden"
            />
            <p className="text-gray-700 mb-1">
              {isDragging ? "Drop file here..." : "Drop HTML file here or click to upload"}
            </p>
            <p className="text-gray-400 text-sm">Supports .html and .htm files</p>
          </div>
        </label>
      </div>

      {/* Show content once file is uploaded */}
      {rawHTML && (
        <>
          {/* View Tabs */}
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveView("raw")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === "raw"
                    ? "bg-gray-800 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                1. Raw Source
              </button>
              <button
                onClick={() => analysis ? setActiveView("analysis") : runAnalysis()}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === "analysis"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}
              >
                2. Run Analysis {!analysis && "→"}
              </button>
            </div>
            <span className="text-sm text-gray-500">
              {fileName} ({(rawHTML.length / 1024).toFixed(1)} KB)
            </span>
          </div>

          {/* Raw Source View */}
          {activeView === "raw" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Raw HTML Source</h3>
              <p className="text-sm text-gray-500 mb-4">
                This is the unprocessed HTML file. Look for: &lt;pre&gt; tags (poetry content),
                &lt;table&gt; tags (often TOC), &lt;h2&gt; tags (poem/chapter titles),
                and &lt;p&gt; tags (prose content).
              </p>

              {/* Quick Stats */}
              <div className="flex gap-4 mb-4 text-sm">
                <span className="text-blue-600">
                  {(rawHTML.match(/<pre[\s>]/gi) || []).length} &lt;pre&gt; tags
                </span>
                <span className="text-green-600">
                  {(rawHTML.match(/<p[\s>]/gi) || []).length} &lt;p&gt; tags
                </span>
                <span className="text-yellow-600">
                  {(rawHTML.match(/<table[\s>]/gi) || []).length} &lt;table&gt; tags
                </span>
                <span className="text-purple-600">
                  {(rawHTML.match(/<h[1-6][\s>]/gi) || []).length} header tags
                </span>
              </div>

              {/* HTML Preview with Syntax Highlighting */}
              <div className="bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-auto">
                <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                  {rawHTML.slice(0, 20000)}
                  {rawHTML.length > 20000 && (
                    <span className="text-yellow-500">
                      {"\n\n"}... truncated ({((rawHTML.length - 20000) / 1024).toFixed(1)} KB more) ...
                    </span>
                  )}
                </pre>
              </div>

              <button
                onClick={runAnalysis}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Run Analysis →
              </button>
            </div>
          )}
        </>
      )}

      {/* Analysis View */}
      {activeView === "analysis" && analysis && (
        <>
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary: {analysis.fileName}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{analysis.tagCounts.pre || 0}</div>
                <div className="text-xs text-gray-500">PRE tags</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{analysis.tagCounts.p || 0}</div>
                <div className="text-xs text-gray-500">P tags</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{analysis.tagCounts.table || 0}</div>
                <div className="text-xs text-gray-500">Tables</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(analysis.tagCounts.h1 || 0) + (analysis.tagCounts.h2 || 0) + (analysis.tagCounts.h3 || 0)}
                </div>
                <div className="text-xs text-gray-500">Headers</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-600">{analysis.extractedLineCount}</div>
                <div className="text-xs text-gray-500">Extracted Lines</div>
              </div>
            </div>

            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">Content Structure:</span>{" "}
                <span className={`font-semibold ${
                  analysis.contentStructure === "pre-based" ? "text-blue-600" :
                  analysis.contentStructure === "p-based" ? "text-green-600" :
                  analysis.contentStructure === "mixed" ? "text-yellow-600" : "text-red-600"
                }`}>
                  {analysis.contentStructure.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Has TOC:</span>{" "}
                <span className={analysis.hasTableOfContents ? "text-yellow-600 font-semibold" : "text-green-600"}>
                  {analysis.hasTableOfContents ? "YES" : "NO"}
                </span>
              </div>
            </div>
          </div>

          {/* TOC Detection */}
          {analysis.tocIndicators.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">TOC Detection</h3>
              <ul className="space-y-1 text-sm text-yellow-700">
                {analysis.tocIndicators.map((indicator, i) => (
                  <li key={i}>• {indicator}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Chapter/Collection Detection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-indigo-600 mb-3">
              Detected Chapters/Collections ({analysis.detectedChapters.length})
            </h3>
            {analysis.gutenbergHeaderLines > 0 && (
              <p className="text-sm text-amber-600 mb-3">
                Gutenberg header detected: {analysis.gutenbergHeaderLines} lines before content start
              </p>
            )}
            {analysis.detectedChapters.length === 0 ? (
              <p className="text-sm text-red-600">
                No chapter markers found (BOOK, CHAPTER, PART, CANTO).
                The entire text will be treated as one chapter.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {analysis.detectedChapters.map((ch) => (
                  <div key={ch.number} className="bg-indigo-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-indigo-800">{ch.title}</span>
                      <span className="text-xs text-gray-500">{ch.lineCount} lines</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{ch.contentPreview || "(empty)"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extracted Text Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Extracted Text Preview (First 50 non-blank lines)
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              This shows what our current extraction algorithm produces. If this only shows titles/TOC entries instead of actual content, the extraction needs fixing.
            </p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto">
              {analysis.extractedTextSample || "(No content extracted)"}
            </pre>
          </div>

          {/* PRE Tag Analysis */}
          {analysis.preTagContent.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-blue-600 mb-3">PRE Tag Content (First 5)</h3>
              <div className="space-y-4">
                {analysis.preTagContent.map((pre) => (
                  <div key={pre.index} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      PRE #{pre.index + 1} - {pre.lineCount} lines
                    </div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                      {pre.sample}
                    </pre>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">First Substantial PRE Content:</h4>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-48 overflow-auto">
                  {analysis.firstPreContent}
                </pre>
              </div>
            </div>
          )}

          {/* Table Analysis */}
          {analysis.tableContent.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-yellow-600 mb-3">Table Content (First 3)</h3>
              <div className="space-y-4">
                {analysis.tableContent.map((table) => (
                  <div key={table.index} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      Table #{table.index + 1} - {table.rowCount} rows
                    </div>
                    <div className="text-xs text-gray-700">{table.sample}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header Tags */}
          {analysis.headerTags.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-purple-600 mb-3">Header Tags (First 20)</h3>
              <div className="space-y-2">
                {analysis.headerTags.map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-mono">
                      {h.tag}
                    </span>
                    <span className="text-gray-700 text-sm">{h.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Tag Counts */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">All Tag Counts</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(analysis.tagCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 30)
                .map(([tag, count]) => (
                  <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-sm">
                    <span className="text-gray-500">&lt;{tag}&gt;</span>{" "}
                    <span className="font-semibold text-gray-700">{count}</span>
                  </span>
                ))}
            </div>
          </div>

          {/* Back to Raw Source */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <button
              onClick={() => setActiveView("raw")}
              className="text-gray-600 hover:text-gray-700 font-medium"
            >
              ← Back to Raw Source
            </button>
          </div>
        </>
      )}
    </div>
  );
}
