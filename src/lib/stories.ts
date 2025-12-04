// src/lib/stories.ts
import type { StoryMetadata, StoryType, StoryOrigin, StoryTag } from "@/types/story";
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import type { Language } from "@/types/i18n";

const translations = { en, es };

// Display labels for story types (singular - used in story modal/detail)
export const STORY_TYPE_LABELS: Record<StoryType, { en: string; es: string }> = {
  "short-story": { en: "Short Story", es: "Cuento" },
  "poem": { en: "Poem", es: "Poema" },
  "fable": { en: "Fable", es: "Fábula" },
  "folktale": { en: "Folktale", es: "Cuento popular" },
  "novella": { en: "Novella", es: "Novela corta" },
  "article": { en: "Article", es: "Artículo" },
  "dialogue": { en: "Dialogue", es: "Diálogo" },
  "song-lyrics": { en: "Song Lyrics", es: "Letra de canción" },
};

// Plural labels for story types (used in filters)
export const STORY_TYPE_LABELS_PLURAL: Record<StoryType, { en: string; es: string }> = {
  "short-story": { en: "Short Stories", es: "Cuentos" },
  "poem": { en: "Poems", es: "Poemas" },
  "fable": { en: "Fables", es: "Fábulas" },
  "folktale": { en: "Folktales", es: "Cuentos populares" },
  "novella": { en: "Novels", es: "Novelas cortas" },
  "article": { en: "Articles", es: "Artículos" },
  "dialogue": { en: "Dialogues", es: "Diálogos" },
  "song-lyrics": { en: "Song Lyrics", es: "Letras de canciones" },
};

// Display labels for story tags
export const STORY_TAG_LABELS: Record<StoryTag, { en: string; es: string }> = {
  // Themes
  "family": { en: "Family", es: "Familia" },
  "friendship": { en: "Friendship", es: "Amistad" },
  "adventure": { en: "Adventure", es: "Aventura" },
  "mystery": { en: "Mystery", es: "Misterio" },
  "romance": { en: "Romance", es: "Romance" },
  "coming-of-age": { en: "Coming of Age", es: "Crecimiento" },
  "nature": { en: "Nature", es: "Naturaleza" },
  "technology": { en: "Technology", es: "Tecnología" },
  "travel": { en: "Travel", es: "Viajes" },
  "food": { en: "Food", es: "Comida" },
  // Moods
  "humorous": { en: "Humorous", es: "Humorístico" },
  "heartwarming": { en: "Heartwarming", es: "Conmovedor" },
  "suspenseful": { en: "Suspenseful", es: "De suspenso" },
  "reflective": { en: "Reflective", es: "Reflexivo" },
  "inspiring": { en: "Inspiring", es: "Inspirador" },
  // Settings
  "urban": { en: "Urban", es: "Urbano" },
  "rural": { en: "Rural", es: "Rural" },
  "historical": { en: "Historical", es: "Histórico" },
  "fantasy": { en: "Fantasy", es: "Fantasía" },
  "contemporary": { en: "Contemporary", es: "Contemporáneo" },
  // Cultural
  "latin-america": { en: "Latin America", es: "Latinoamérica" },
  "spain": { en: "Spain", es: "España" },
  "usa": { en: "USA", es: "EE.UU." },
  "multicultural": { en: "Multicultural", es: "Multicultural" },
};

// All available story types for UI dropdowns
export const ALL_STORY_TYPES: StoryType[] = [
  "short-story", "poem", "fable", "folktale", "novella", "article", "dialogue", "song-lyrics"
];

// All available story tags for UI multi-select
export const ALL_STORY_TAGS: StoryTag[] = [
  "family", "friendship", "adventure", "mystery", "romance",
  "coming-of-age", "nature", "technology", "travel", "food",
  "humorous", "heartwarming", "suspenseful", "reflective", "inspiring",
  "urban", "rural", "historical", "fantasy", "contemporary",
  "latin-america", "spain", "usa", "multicultural"
];

// Helper to format attribution for display
export function formatAttribution(
  origin: StoryOrigin,
  lang: Language
): string | null {
  if (origin.isOriginal) return null;

  const { author, yearPublished } = origin.attribution;
  const year = yearPublished ? ` (${yearPublished})` : "";
  return `${author}${year}`;
}

// Helper to get story type label
export function getStoryTypeLabel(type: StoryType, lang: Language): string {
  return STORY_TYPE_LABELS[type]?.[lang] ?? type;
}

// Helper to get story tag label
export function getStoryTagLabel(tag: StoryTag, lang: Language): string {
  return STORY_TAG_LABELS[tag]?.[lang] ?? tag;
}

export function getStoryTitle(lang: Language, slug: string): string {
  return (translations as any)[lang]?.storiesMetadata?.[slug]?.title ?? slug;
}

export function getStoryDescription(lang: Language, slug: string): string {
  return (translations as any)[lang]?.storiesMetadata?.[slug]?.description ?? "";
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
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["adventure","mystery","friendship","suspenseful","heartwarming"],
    targetAudience: "all",
  },
  {
    slug: "the-last-word",
    image: "/images/the-last-word-thumbnail.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    isPremiumOnly: false,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["suspenseful","heartwarming","reflective","inspiring"],
    targetAudience: "adult",
  },
  {
    slug: "diego-unplugged",
    image: "/images/diego-unplugged-thumbnail.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    isPremiumOnly: false,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["technology","reflective","inspiring","heartwarming"],
    targetAudience: "all",
  },
  {
    slug: "my-day",
    image: "/images/my-day-thumbnail.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    type: "poem",
    origin: { isOriginal: true },
    tags: ["family","multicultural"],
    targetAudience: "all",
  },
  {
    slug: "my-family",
    image: "/images/my-family-thumbnail-6994.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    type: "poem",
    origin: { isOriginal: true },
    targetAudience: "all",
    tags: ["family","heartwarming"]
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
