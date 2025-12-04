// /src/types/story.ts

export type LevelKey = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';
export type Level = "l1" | "l2" | "l3" | "l4" | "l5";

// Story type classification
export type StoryType =
  | "short-story"   // Standalone narrative fiction
  | "poem"          // Poetry (any form)
  | "fable"         // Moral/teaching stories
  | "folktale"      // Traditional/cultural stories
  | "novella"       // Longer multi-chapter fiction
  | "article"       // Non-fiction/informational
  | "dialogue"      // Conversation-based content
  | "song-lyrics";  // Music lyrics

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
  | "latin-america" | "spain" | "usa" | "multicultural";

// Attribution for non-original works
export type StoryAttribution = {
  author: string;                    // "Gabriel García Márquez"
  authorLifespan?: string;           // "1927-2014"
  originalTitle?: string;            // Title in source language if different
  yearPublished?: number;            // 1967
  source?: string;                   // Book/collection name or URL
  translator?: string;               // If using someone else's translation
  publicDomain: boolean;             // Is this work public domain?
  publicDomainNote?: string;         // e.g., "Published before 1928"
};

// Story origin - discriminated union
export type StoryOrigin =
  | { isOriginal: true }
  | { isOriginal: false; attribution: StoryAttribution };

// Full metadata type
export type StoryMetadata = {
  slug: string;
  image: string;
  levels: LevelKey[];
  isPremiumOnly?: boolean;

  // Tagging fields
  type: StoryType;
  origin: StoryOrigin;
  tags?: StoryTag[];
  estimatedReadTime?: number;        // Minutes (calculated or manual)
  targetAudience?: "children" | "teen" | "adult" | "all";
};
