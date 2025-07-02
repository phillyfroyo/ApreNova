// /src/types/story.ts

export type StoryMetadata = {
  title: string;
  image: string;
  levels: string[]; // e.g., ["l1", "l2"]
  description: string;
};

export type Level = "l1" | "l2" | "l3" | "l4" | "l5";
