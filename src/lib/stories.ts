// src/lib/stories.ts
import type { StoryMetadata, StoryType, StoryOrigin, StoryTag, StoryAttribution, AuthorInfo } from "@/types/story";
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
  "novel": { en: "Novel", es: "Novela" },
  "article": { en: "Article", es: "Artículo" },
  "dialogue": { en: "Dialogue", es: "Diálogo" },
  "song-lyrics": { en: "Song Lyrics", es: "Letra de canción" },
  "epic": { en: "Epic", es: "Épica" },
  "myth": { en: "Myth", es: "Mito" },
  "legend": { en: "Legend", es: "Leyenda" },
  "movie-script": { en: "Movie Script", es: "Guion de película" },
  "tv-script": { en: "TV Script", es: "Guion de TV" },
};

// Plural labels for story types (used in filters)
export const STORY_TYPE_LABELS_PLURAL: Record<StoryType, { en: string; es: string }> = {
  "short-story": { en: "Short Stories", es: "Cuentos" },
  "poem": { en: "Poems", es: "Poemas" },
  "fable": { en: "Fables", es: "Fábulas" },
  "folktale": { en: "Folktales", es: "Cuentos populares" },
  "novel": { en: "Novels", es: "Novelas" },
  "article": { en: "Articles", es: "Artículos" },
  "dialogue": { en: "Dialogues", es: "Diálogos" },
  "song-lyrics": { en: "Song Lyrics", es: "Letras de canciones" },
  "epic": { en: "Epics", es: "Épicas" },
  "myth": { en: "Myths", es: "Mitos" },
  "legend": { en: "Legends", es: "Leyendas" },
  "movie-script": { en: "Movie Scripts", es: "Guiones de película" },
  "tv-script": { en: "TV Scripts", es: "Guiones de TV" },
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
  // Literary genres
  "epic": { en: "Epic", es: "Épico" },
  "mythology": { en: "Mythology", es: "Mitología" },
  "heroic": { en: "Heroic", es: "Heroico" },
  "tragedy": { en: "Tragedy", es: "Tragedia" },
  "comedy": { en: "Comedy", es: "Comedia" },
  // Content themes
  "monsters": { en: "Monsters", es: "Monstruos" },
  "heros-journey": { en: "Hero's Journey", es: "Viaje del héroe" },
  "war": { en: "War", es: "Guerra" },
  "love": { en: "Love", es: "Amor" },
  "death": { en: "Death", es: "Muerte" },
  "revenge": { en: "Revenge", es: "Venganza" },
};

// All available story types for UI dropdowns
export const ALL_STORY_TYPES: StoryType[] = [
  "short-story", "poem", "fable", "folktale", "novel", "article", "dialogue", "song-lyrics",
  "epic", "myth", "legend", "movie-script", "tv-script"
];

// All available story tags for UI multi-select
export const ALL_STORY_TAGS: StoryTag[] = [
  "family", "friendship", "adventure", "mystery", "romance",
  "coming-of-age", "nature", "technology", "travel", "food",
  "humorous", "heartwarming", "suspenseful", "reflective", "inspiring",
  "urban", "rural", "historical", "fantasy", "contemporary",
  "latin-america", "spain", "usa", "multicultural",
  "epic", "mythology", "heroic", "tragedy", "comedy",
  "monsters", "heros-journey", "war", "love", "death", "revenge"
];

// ============================================
// HELPER FUNCTIONS FOR ATTRIBUTION
// ============================================

/**
 * Get author name from attribution (handles both new and legacy formats)
 */
export function getAuthorName(attribution: StoryAttribution): string {
  if (typeof attribution.author === 'string') {
    // Legacy format
    return attribution.author;
  }
  return attribution.author.name;
}

/**
 * Get author lifespan from attribution
 */
export function getAuthorLifespan(attribution: StoryAttribution): string | undefined {
  if (typeof attribution.author === 'string') {
    return undefined;
  }
  return attribution.author.lifespan;
}

/**
 * Get year published from attribution (handles both formats)
 */
export function getYearPublished(attribution: StoryAttribution): number | undefined {
  // New format uses yearFirstPublished
  if ('yearFirstPublished' in attribution) {
    return attribution.yearFirstPublished;
  }
  return undefined;
}

/**
 * Check if work is public domain
 */
export function isPublicDomain(attribution: StoryAttribution): boolean {
  if ('rights' in attribution && attribution.rights) {
    return attribution.rights.originalWorkStatus === 'public-domain';
  }
  return false;
}

/**
 * Get public domain note
 */
export function getPublicDomainNote(attribution: StoryAttribution): string | undefined {
  if ('rights' in attribution && attribution.rights) {
    return attribution.rights.displayStatement;
  }
  if ('sourceEdition' in attribution && attribution.sourceEdition) {
    return attribution.sourceEdition.publicDomainNote;
  }
  return undefined;
}

// Helper to format attribution for display
export function formatAttribution(
  origin: StoryOrigin,
  lang: Language
): string | null {
  if (origin.isOriginal) return null;

  const authorName = getAuthorName(origin.attribution);
  const yearPublished = getYearPublished(origin.attribution);
  const year = yearPublished ? ` (${yearPublished})` : "";
  return `${authorName}${year}`;
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

export function getStoryHook(lang: Language, slug: string): string {
  return (translations as any)[lang]?.storiesMetadata?.[slug]?.hook ?? "";
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
    levels: ["A1", "A2", "B1", "B2", "C1"],
    isPremiumOnly: false,
    isArchived: true,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["adventure","mystery","friendship","suspenseful","heartwarming"],
    targetAudience: "all",
  },
  {
    slug: "the-last-word",
    image: "/images/the-last-word-thumbnail.png",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    isPremiumOnly: false,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["suspenseful","heartwarming","reflective","inspiring"],
    targetAudience: "all",
  },
  {
    slug: "diego-unplugged",
    image: "/images/diego-unplugged-thumbnail.png",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    isPremiumOnly: false,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["technology","reflective","inspiring","heartwarming"],
    targetAudience: "all",
  },{
    slug: "poems-by-emily-dickinson",
    image: "/images/poems-by-emily-dickinson-thumbnail-1465.jpeg",
    levels: ["C1"],
    type: "poem",
    origin: { isOriginal: false, attribution: { author: { name: "Emily Dickinson", lifespan: "1830-1886" }, yearFirstPublished: 2004, sourceEdition: { title: "Poems by Emily Dickinson, Three Series, Complete", publisher: "Project Gutenberg", publicationYear: 2004, editor: "Mabel Loomis Todd and T.W. Higginson", source: "gutenberg", isPublicDomain: true, publicDomainNote: "This ebook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever." }, rights: { originalWorkStatus: "public-domain", displayStatement: "The original text is in the public domain. This educational adaptation © Cuentana.", provenanceNote: "Text from Project Gutenberg", provenanceUrl: "https://www.gutenberg.org/ebooks/12242" } } },
    targetAudience: "all",
    structureType: "anthology",
  },  {
    slug: "my-day-3",
    image: "/images/my-day-3-thumbnail-7027.png",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    type: "poem",
    origin: { isOriginal: true },
    targetAudience: "all",
    structureType: "anthology",
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
