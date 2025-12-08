// storyThemes.ts
export interface StoryTheme {
  backgroundImage?: string;
  backgroundColor?: string;
  backgroundGradient?: string; // CSS gradient string, e.g. "linear-gradient(135deg, #f5f0e6, #d4c4a8)"
  textColor: string;
  accentColor: string;
  hoverAccentColor: string;
  fontFamily: string;
}

export const STORY_THEMES: Record<string, StoryTheme> = {
  "aventura": {
    backgroundGradient: "linear-gradient(135deg, #fffdf9 0%, #d4c4a8 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },
  "the-last-word": {
    backgroundGradient: "linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-amber-600",
    hoverAccentColor: "hover:bg-amber-300",
    fontFamily: "font-serif",
  },
  "diego-unplugged": {
    backgroundGradient: "linear-gradient(135deg, #e8f4f8 0%, #d1e8f0 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-blue-600",
    hoverAccentColor: "hover:bg-blue-300",
    fontFamily: "font-sans",
  },
  "my-day": {
    backgroundGradient: "linear-gradient(135deg, #fff8e1 0%, #ffe0b2 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-orange-600",
    hoverAccentColor: "hover:bg-orange-300",
    fontFamily: "font-serif",
  },
  "sandbox-story": {
    backgroundGradient: "linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-indigo-600",
    hoverAccentColor: "hover:bg-indigo-300",
    fontFamily: "font-sans",
  },

  "dracula": {
    backgroundColor: "#f5f0e6",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },
};

// Default theme fallback for stories without a specific theme
export const DEFAULT_THEME: StoryTheme = {
  backgroundGradient: "linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)",
  textColor: "text-gray-900",
  accentColor: "bg-gray-600",
  hoverAccentColor: "hover:bg-gray-300",
  fontFamily: "font-sans",
};

export function getTheme(storySlug: string): StoryTheme {
  return STORY_THEMES[storySlug] || DEFAULT_THEME;
}