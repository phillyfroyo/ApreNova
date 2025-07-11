// /src/types/story.ts

export type LevelKey = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

export type StoryMetadata = {
  slug: string;
  image: string;
  isPremiumOnly?: boolean;
  levels: {
    [key in LevelKey]?: {
      parts: number;
    };
  };
};

export type Level = "l1" | "l2" | "l3" | "l4" | "l5";
