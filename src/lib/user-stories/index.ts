// src/lib/user-stories/index.ts
// User story processing module - barrel export

// Main pipeline
export {
  processUserStory,
  retryLevel,
  getProcessingStatus,
} from "./pipeline";

// Metadata generation
export {
  generateDescription,
  generateAllMetadata,
  type TitleResult,
  type DescriptionResult,
  type BatchedMetadataResult,
  type BatchedMetadataOptions,
} from "./metadata";

// Level processing
export {
  processLevel,
  type LevelProcessingParams,
  type LevelProcessingResult,
} from "./level-processor";

// Progress tracking
export {
  LevelProgressTracker,
  updateStoryStatus,
  determineFinalStatus,
  type ProcessingProgress,
  type ChapterTranslationData,
  type ChapterRewriteData,
  type LevelStatus,
  type StoryStatus,
} from "./progress-tracker";

// Access control
export {
  canCreateStory,
  canProcessToday,
  validateContentLength,
  getUserStoryStats,
  type AccessCheckResult,
} from "./access-control";

// Limits configuration
export { USER_STORY_LIMITS } from "./limits";
