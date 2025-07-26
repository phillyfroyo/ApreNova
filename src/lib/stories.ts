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
    levels: ["l1", "l2", "l3", "l4", "l5"],
    isPremiumOnly: false,
  },
  {
    slug: "the-last-word",
    image: "/images/the-last-word-thumbnail.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    isPremiumOnly: false,
  },
  {
    slug: slugify("Misterio en la Selva"),
    image: "/images/placeholder2.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    },
  {
    slug: slugify("El Viaje Mágico"),
    image: "/images/placeholder3.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    },
  {
    slug: slugify("Secretos del Desierto"),
    image: "/images/placeholder4.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    },
];

export function getStoryUrl({
  locale,
  storySlug,
  level,
  chapter = 1,
  page = 1,
}: {
  locale: string;
  storySlug: string;
  level: string;
  chapter?: number;
  page?: number;
}) {
  return `/${locale}/stories/${storySlug}/${level}/${chapter}/${page}`;
}
