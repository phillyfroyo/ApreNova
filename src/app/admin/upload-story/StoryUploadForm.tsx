"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAdminStorage } from "./hooks/useAdminStorage";
import { STORY_METADATA } from "@/lib/stories";
import { cleanText } from "@/lib/admin/text-utils";
import type { StoryData, Step } from "./types";
import { STEPS } from "./config/constants";
import { StepErrorBoundary } from "./components/shared";
import {
  Step1Upload,
  Step2Detect,
  Step3Metadata,
  Step4Generate,
  Step5Translate,
  Step6Paginate,
  Step7Preview,
  type SaveResult,
} from "./components/steps";

// Track existing slugs for validation (module-level for access across step components)
const existingSlugs = new Set(STORY_METADATA.map(s => s.slug));
const isSlugTaken = (slug: string) => slug.length > 0 && existingSlugs.has(slug);

interface StoryUploadFormProps {
  onLogout: () => void;
  hideHeader?: boolean;
}

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
  structureType: "auto",  // Auto-detect content structure
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
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  // Use new async storage (IndexedDB + Web Worker for compression)
  const {
    saveStatus,
    hasRestoredState,
    saveProgress,
    saveImmediately,
    clearProgress,
    lastSavedAt,
  } = useAdminStorage<StoryData>({
    initialState: initialStoryData,
    initialStep: 1,
    onRestore: (restoredData, restoredStep) => {
      setStoryData(restoredData);
      setCurrentStep(restoredStep as Step);
    },
  });

  // Refs to access latest state in callbacks
  const storyDataRef = useRef(storyData);
  const currentStepRef = useRef(currentStep);
  storyDataRef.current = storyData;
  currentStepRef.current = currentStep;

  // Save on beforeunload (user closing tab/navigating away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only save if there's actual content
      if (currentStepRef.current > 1 || storyDataRef.current.rawText) {
        saveImmediately(storyDataRef.current, currentStepRef.current);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveImmediately]);

  // Track previous processing state to detect completion
  const prevIsProcessingRef = useRef(isProcessing);
  useEffect(() => {
    // Save when processing completes (transitions from true to false)
    if (prevIsProcessingRef.current && !isProcessing) {
      // Processing just finished - save progress
      if (currentStep > 1 || storyData.rawText) {
        saveProgress(storyData, currentStep);
      }
    }
    prevIsProcessingRef.current = isProcessing;
  }, [isProcessing, storyData, currentStep, saveProgress]);

  const clearSavedState = async () => {
    await clearProgress();
    setStoryData(initialStoryData);
    setCurrentStep(1);
    setSaveResult(null);
  };

  const updateStoryData = (updates: Partial<StoryData>) => {
    setStoryData((prev) => ({ ...prev, ...updates }));
  };

  const goToStep = (step: Step) => {
    // Clean raw text when moving from Step 1 to Step 2
    // Preserve whitespace during initial clean - structure-specific normalization happens later
    let updatedData = storyData;
    if (currentStep === 1 && step === 2) {
      updatedData = { ...storyData, rawText: cleanText(storyData.rawText, { preserveWhitespace: true }) };
      setStoryData(updatedData);
    }
    // Reset processing state when navigating away from steps that use async processing
    // This allows the user to use the Continue button on other steps
    if ((currentStep === 4 || currentStep === 5) && step !== currentStep) {
      setIsProcessing(false);
    }
    setCurrentStep(step);

    // Scroll to top when changing steps
    window.scrollTo(0, 0);

    // Save progress when changing steps (non-blocking)
    if (step > 1 || updatedData.rawText) {
      saveProgress(updatedData, step);
    }
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

  // Get list of missing required fields for current step
  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    switch (currentStep) {
      case 1:
        if (!storyData.rawText.trim()) missing.push("Story text");
        break;
      case 2:
        if (storyData.detectedLevel === null) missing.push("Level detection (click Detect)");
        break;
      case 3:
        if (!storyData.title.en && !storyData.title.es) missing.push("Title (English or Spanish)");
        if (!storyData.slug) missing.push("Story slug");
        break;
      case 4:
        if (getGeneratedLevels().length === 0) missing.push("At least one level generated");
        break;
      case 5:
        const generatedLevels = getGeneratedLevels();
        const untranslated = generatedLevels.filter(
          (l) => !storyData.levelContent[l]?.translatedText?.length
        );
        if (untranslated.length > 0) {
          missing.push(`Translation for level(s): ${untranslated.join(", ")}`);
        }
        break;
    }
    return missing;
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
                      : "text-gray-400 cursor-default"
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

          {/* Save Status Indicator */}
          {(saveStatus !== "idle" || lastSavedAt) && (
            <div className="mt-2 flex items-center justify-end gap-2 text-xs">
              {saveStatus === "saving" && (
                <span className="text-gray-500 flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-green-600 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Progress saved
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-red-600 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Save failed
                </span>
              )}
              {saveStatus === "idle" && lastSavedAt && (
                <span className="text-gray-400">
                  Last saved {lastSavedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Restored State Banner */}
      {hasRestoredState && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-amber-800">
              Restored saved progress (Step {currentStep}{storyData.slug ? `: ${storyData.slug}` : ""})
            </span>
            <button
              onClick={clearSavedState}
              className="text-xs text-amber-700 hover:text-amber-900 underline"
            >
              Clear &amp; Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {currentStep === 1 && (
            <StepErrorBoundary
              stepNumber={1}
              stepLabel="Upload Text"
              onGoBack={undefined}
            >
              <Step1Upload storyData={storyData} updateStoryData={updateStoryData} />
            </StepErrorBoundary>
          )}
          {currentStep === 2 && (
            <StepErrorBoundary
              stepNumber={2}
              stepLabel="Parse & Detect"
              onGoBack={() => goToStep(1)}
            >
              <Step2Detect
                storyData={storyData}
                updateStoryData={updateStoryData}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
            </StepErrorBoundary>
          )}
          {currentStep === 3 && (
            <StepErrorBoundary
              stepNumber={3}
              stepLabel="Metadata"
              onGoBack={() => goToStep(2)}
            >
              <Step3Metadata storyData={storyData} updateStoryData={updateStoryData} />
            </StepErrorBoundary>
          )}
          {currentStep === 4 && (
            <StepErrorBoundary
              stepNumber={4}
              stepLabel="Generate Levels"
              onGoBack={() => goToStep(3)}
            >
              <Step4Generate
                storyData={storyData}
                updateStoryData={updateStoryData}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
            </StepErrorBoundary>
          )}
          {currentStep === 5 && (
            <StepErrorBoundary
              stepNumber={5}
              stepLabel="Translate"
              onGoBack={() => goToStep(4)}
            >
              <Step5Translate
                storyData={storyData}
                updateStoryData={updateStoryData}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
            </StepErrorBoundary>
          )}
          {currentStep === 6 && (
            <StepErrorBoundary
              stepNumber={6}
              stepLabel="Paginate"
              onGoBack={() => goToStep(5)}
            >
              <Step6Paginate storyData={storyData} updateStoryData={updateStoryData} />
            </StepErrorBoundary>
          )}
          {currentStep === 7 && (
            <StepErrorBoundary
              stepNumber={7}
              stepLabel="Preview & Save"
              onGoBack={() => goToStep(6)}
            >
              <Step7Preview
                storyData={storyData}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                saveResult={saveResult}
                setSaveResult={setSaveResult}
              />
            </StepErrorBoundary>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-start mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => goToStep((currentStep - 1) as Step)}
              disabled={currentStep === 1}
              className="px-6 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-default"
            >
              ← Back
            </button>
            {currentStep < 7 ? (
              <div className="flex flex-col items-end gap-2">
                {/* Show missing fields when can't proceed */}
                {!canProceed() && !isProcessing && (
                  <div className="text-right">
                    <p className="text-xs text-amber-600 font-medium mb-1">Missing required fields:</p>
                    <ul className="text-xs text-gray-500 list-disc list-inside">
                      {getMissingFields().map((field, i) => (
                        <li key={i}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => goToStep((currentStep + 1) as Step)}
                  disabled={!canProceed() || isProcessing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-default"
                >
                  Continue →
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
