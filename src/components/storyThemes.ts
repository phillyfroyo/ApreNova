// storyThemes.ts
export interface StoryTheme {
  backgroundImage?: string;
  backgroundColor?: string;
  textColor: string;
  accentColor: string;
  hoverAccentColor: string;
  fontFamily: string;
}

export const STORY_THEMES: Record<string, StoryTheme> = {
  default: {
    backgroundColor: "#f5f0e6",
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
    backgroundImage: "/images/my-day-background.png",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },  "my-family": {
    backgroundColor: "#f5f0e6",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },
};