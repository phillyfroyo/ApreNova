// src/lib/stories.ts
import type { StoryMetadata } from "@/types/story";
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import type { Language } from "@/types/i18n";

const translations = { en, es };

export function getStoryTitle(lang: Language, slug: string): string {
  return translations[lang]?.storiesMetadata?.[slug]?.title ?? slug;
}

export function getStoryDescription(lang: Language, slug: string): string {
  return translations[lang]?.storiesMetadata?.[slug]?.description ?? "";
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[áéíóúñ]/g, match => {
      const map: Record<string, string> = {
        á: "a", é: "e", í: "i", ó: "o", ú: "u", ñ: "n"
      };
      return map[match] || match;
    })
    .replace(/[^a-z0-9\s-]/g, "")  // remove special characters
    .replace(/\s+/g, "-");         // replace spaces with dashes
}

export const STORY_METADATA: StoryMetadata[] = [
  {
    slug: "aventura",
    image: "/images/aventura-thumbnail.png",
    levels: {
      l1: { parts: 10 },
      l2: { parts: 10 },
      l3: { parts: 10 },
      l4: { parts: 10 },
      l5: { parts: 10 },
    },
    isPremiumOnly: false,
  },
  {
    slug: slugify("El Bosque Perdido"),
    image: "/images/placeholder1.png",
    levels: {
      l1: { parts: 10 },
      l2: { parts: 10 },
      l3: { parts: 10 },
      l4: { parts: 10 },
      l5: { parts: 10 },
    },
    isPremiumOnly: false,
  },
  {
    slug: slugify("Misterio en la Selva"),
    image: "/images/placeholder2.png",
    levels: {
    l3: { parts: 6 },
    },
  },
  {
    slug: slugify("El Viaje Mágico"),
    image: "/images/placeholder3.png",
    levels: {
    l4: { parts: 8 },
    },
  },
  {
    slug: slugify("Secretos del Desierto"),
    image: "/images/placeholder4.png",
    levels: {
    l5: { parts: 7 },
    },
  },
];
export function getMaxPartForStory(storySlug: string, level: string): number {
  const story = STORY_METADATA.find((s) => s.slug === storySlug);
  return story?.levels?.[level]?.parts ?? 1;
}

export function getStoryUrl({
  locale,
  storySlug,
  level,
  part = 1
}: {
  locale: string;
  storySlug: string;
  level: string;
  part?: number;
}) {
  return `/${locale}/stories/${storySlug}/${level}/part-${part}`;
}
