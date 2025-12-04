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
  default: {
    backgroundGradient: "linear-gradient(135deg, #fffdf9 0%, #d4c4a8 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },
  aventura: {
    backgroundImage: "/images/background4.png",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },
  "the-last-word": {
    backgroundImage: "/images/background6.png",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },
  "diego-unplugged": {
    backgroundImage: "/images/background5.png",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },  "my-day": {
    backgroundGradient: "linear-gradient(135deg, #fffdf9 0%, #d4c4a8 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },  "my-family": {
    backgroundGradient: "linear-gradient(135deg, #fffdf9 0%, #d4c4a8 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },
};