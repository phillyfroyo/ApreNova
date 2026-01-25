// /src/types/story.ts

import type { CEFRCode } from "@/lib/cefr";

// Re-export CEFRCode for convenience
export type { CEFRCode };

// Legacy type aliases for backwards compatibility
export type LevelKey = CEFRCode;
export type Level = CEFRCode;

// Story type classification
export type StoryType =
  | "short-story"   // Standalone narrative fiction
  | "poem"          // Poetry (any form)
  | "fable"         // Moral/teaching stories
  | "folktale"      // Traditional/cultural stories
  | "novel"         // Longer multi-chapter fiction
  | "article"       // Non-fiction/informational
  | "dialogue"      // Conversation-based content
  | "song-lyrics"   // Music lyrics
  | "epic"          // Epic poetry (Beowulf, Odyssey, etc.)
  | "myth"          // Mythology
  | "legend"        // Legendary tales
  | "movie-script"  // Movie screenplay
  | "tv-script";    // TV show script

// Content structure type - determines chapter/page hierarchy and navigation labels
export type ContentStructureType =
  | "prose"      // Default: chapters and pages (novels, short stories)
  | "anthology"  // Poetry collections: collections and poems
  | "epic"       // Narrative poetry: cantos/books and sections
  | "script";    // Scripts: acts/scenes and dialogue blocks

// Genre/theme tags (curated list for consistency)
export type StoryTag =
  // Themes
  | "family" | "friendship" | "adventure" | "mystery" | "romance"
  | "coming-of-age" | "nature" | "technology" | "travel" | "food"
  // Moods
  | "humorous" | "heartwarming" | "suspenseful" | "reflective" | "inspiring"
  // Settings
  | "urban" | "rural" | "historical" | "fantasy" | "contemporary"
  // Cultural
  | "latin-america" | "spain" | "usa" | "multicultural"
  // Literary genres
  | "epic" | "mythology" | "heroic" | "tragedy" | "comedy"
  // Content themes
  | "monsters" | "heros-journey" | "war" | "love" | "death" | "revenge";

// ============================================
// TITLE INFORMATION
// ============================================
export type TitleInfo = {
  full: string;                        // Full canonical title
  display?: string;                    // Optional short display title
  original?: string;                   // Original language title if different
};

// ============================================
// AUTHOR INFORMATION
// ============================================
export type AuthorInfo = {
  name: string;                        // Full name or "Unknown" / "Traditional"
  lifespan?: string;                   // "1927-2014" or "c. 8th century"
  isUnknown?: boolean;                 // True if author unknown
  isCollective?: boolean;              // True if collective/traditional authorship
  note?: string;                       // Additional context about authorship
};

// ============================================
// SOURCE EDITION (the edition being ingested)
// ============================================
export type SourceEdition = {
  title?: string;                      // Edition title
  publisher?: string;                  // Publisher name
  publicationYear?: number;            // Year of this edition
  editor?: string;                     // Editor of this edition
  isPublicDomain: boolean;             // Is this edition public domain?
  publicDomainNote?: string;           // e.g., "Published before 1929"
  url?: string;                        // URL if from online source (Gutenberg, Wikisource)
  notes?: string;                      // e.g., "facsimile of 19th-century edition"
};

// ============================================
// TRANSLATOR INFORMATION
// ============================================
export type TranslatorInfo = {
  name: string;                        // Translator's full name
  lifespan?: string;                   // "1850-1920"
  translationYear?: number;            // Year translation was made
  isPublicDomain: boolean;             // Is the translation public domain?
  publicDomainNote?: string;           // e.g., "Published before 1929"
};

// ============================================
// CUENTANA PROCESSING METADATA (internal)
// ============================================
export type ProcessingMetadata = {
  ingestionDate: string;               // ISO date string
  ingestionVersion?: string;           // Version number of ingestion pipeline
  estimatedTokenCount?: number;        // For upload + translation + audio
  sentenceCount?: number;              // Total sentences in story
  languages: ("en" | "es")[];          // Languages available

  // Per-level availability
  cefrLevels: {
    level: CEFRCode;
    available: boolean;
    hasAudio?: boolean;
    hasGrammarNotes?: boolean;
    hasVocabNotes?: boolean;
    hasChapterSummaries?: boolean;
  }[];

  // Reading time estimates per level (in minutes)
  readingTimeByLevel?: Record<CEFRCode, number>;
};

// ============================================
// AUDIO METADATA
// ============================================
export type AudioMetadata = {
  narrator?: string;                   // Narrator name or "Azure TTS"
  speedWpm?: number;                   // Words per minute
  chaptersIncluded?: number[];         // Which chapters have audio
  totalDurationMinutes?: number;       // Total audio duration
};

// ============================================
// RIGHTS & PROVENANCE
// ============================================
export type RightsStatement = {
  originalWorkStatus: "public-domain" | "licensed" | "original";
  displayStatement: string;            // Shown to user
  provenanceNote?: string;             // Where the text came from
  provenanceUrl?: string;              // Source URL
  copyrightNote?: string;              // e.g., "No modern copyrighted annotations included"
};

// ============================================
// FULL ATTRIBUTION (for non-original works)
// ============================================
export type StoryAttribution = {
  // Author info
  author: AuthorInfo;

  // Dating
  yearWritten?: string;                // "c. 700-1000 CE" or "1605"
  yearFirstPublished?: number;         // First known publication

  // Source edition being used
  sourceEdition?: SourceEdition;

  // Translator (if applicable)
  translator?: TranslatorInfo;

  // Rights
  rights: RightsStatement;

  // Region/Culture
  region?: string;                     // "Anglo-Saxon England", "Medieval Spain"
  culturalInfluences?: string[];       // ["Norse", "Celtic"]

  // Genre classification
  genres?: string[];                   // ["Epic poetry", "Mythology", "Heroic literature"]
};

// Story origin - discriminated union
export type StoryOrigin =
  | { isOriginal: true }
  | { isOriginal: false; attribution: StoryAttribution };

// ============================================
// DESCRIPTIONS
// ============================================
export type StoryDescriptions = {
  hook: string;                        // One-line hook for catalog
  summary?: string;                    // 2-3 paragraph description
};

// ============================================
// FULL STORY METADATA
// ============================================
export type StoryMetadata = {
  slug: string;
  image: string;
  levels: CEFRCode[];
  isPremiumOnly?: boolean;

  // Title info
  title?: TitleInfo;                   // Extended title info (optional, falls back to translations)

  // Tagging fields
  type: StoryType;
  origin: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";

  // Content structure - determines navigation labels (Collection/Poem vs Chapter/Page)
  structureType?: ContentStructureType;

  // Original level - the CEFR level of the source/unmodified text
  // For public domain works, this is typically the highest level (e.g., C1)
  // Lower levels are simplified adaptations
  originalLevel?: CEFRCode;

  // Descriptions (optional, falls back to translations)
  descriptions?: StoryDescriptions;

  // Processing metadata (internal)
  processing?: ProcessingMetadata;

  // Audio metadata
  audio?: AudioMetadata;

  // Reading time (simple version - or use processing.readingTimeByLevel)
  estimatedReadTime?: number;          // Minutes at native level
};

// ============================================
// LEGACY COMPATIBILITY
// Keep the old simple StoryAttribution structure working
// ============================================
export type LegacyStoryAttribution = {
  author: string;
  authorLifespan?: string;
  originalTitle?: string;
  yearPublished?: number;
  source?: string;
  translator?: string;
  publicDomain: boolean;
  publicDomainNote?: string;
};

// Helper to check if attribution is legacy format
export function isLegacyAttribution(attr: any): attr is LegacyStoryAttribution {
  return typeof attr.author === 'string';
}

// Helper to convert legacy to new format
export function convertLegacyAttribution(legacy: LegacyStoryAttribution): StoryAttribution {
  return {
    author: {
      name: legacy.author,
      lifespan: legacy.authorLifespan,
    },
    yearFirstPublished: legacy.yearPublished,
    sourceEdition: legacy.source ? {
      title: legacy.source,
      isPublicDomain: legacy.publicDomain,
      publicDomainNote: legacy.publicDomainNote,
    } : undefined,
    translator: legacy.translator ? {
      name: legacy.translator,
      isPublicDomain: legacy.publicDomain,
    } : undefined,
    rights: {
      originalWorkStatus: legacy.publicDomain ? "public-domain" : "licensed",
      displayStatement: legacy.publicDomain
        ? `This work is in the public domain. ${legacy.publicDomainNote || ''}`
        : "This work is used under license.",
    },
  };
}
