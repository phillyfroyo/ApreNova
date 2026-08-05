// src/lib/stories.ts
import type { StoryMetadata, StoryType, StoryOrigin, StoryTag, StoryAttribution, AuthorInfo } from "@/types/story";
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import type { Language } from "@/types/i18n";

const translations = { en, es };

// Display labels for story types (singular - used in story modal/detail)
export const STORY_TYPE_LABELS: Record<StoryType, { en: string; es: string }> = {
  "short-story": { en: "Short Story", es: "Cuento" },
  "short-story-collection": { en: "Short Story Collection", es: "Colección de cuentos" },
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
  "short-story-collection": { en: "Short Story Collections", es: "Colecciones de cuentos" },
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
  "short-story", "short-story-collection", "poem", "fable", "folktale", "novel", "article", "dialogue", "song-lyrics",
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

export function getStoryDisplayTitle(lang: Language, slug: string): string {
  const meta = (translations as any)[lang]?.storiesMetadata?.[slug];
  return meta?.displayTitle ?? meta?.title ?? slug;
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
    originalLevel: "C1",
    isPremiumOnly: false,
    isArchived: true,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["adventure","mystery","friendship","suspenseful","heartwarming"],
    targetAudience: "all",
    descriptions: {
      hook: "An enchanted forest, hidden creatures, and a mystery only the curious can solve. A Spanish adventure for learners.",
      summary: "Read Aventura in Spanish at A1–C1: a short adventure-mystery set in an enchanted forest. Built-in translation, word-by-word audio, and bilingual reading mode. A Cuentana original.",
    },
  },
  {
    slug: "the-last-word",
    image: "/images/the-last-word-thumbnail2.png",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    originalLevel: "C1",
    isPremiumOnly: false,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["suspenseful","heartwarming","reflective","inspiring"],
    targetAudience: "all",
    descriptions: {
      hook: "A girl who can barely speak in class is asked to read a poem on stage in front of the entire school.",
      summary: "Read The Last Word in Spanish at A1–C1: a short coming-of-age story about stage fright, grief, and finding your voice. Built-in translation and word-by-word audio. A Cuentana original.",
    },
  },
  {
    slug: "saturday-morning",
    image: "/images/saturday-morning-thumbnail2.png",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    originalLevel: "C1",
    isPremiumOnly: false,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["reflective","contemporary","urban"],
    targetAudience: "all",
    addedAt: "2026-05-18",
    descriptions: {
      hook: "An ordinary Saturday morning, told one quiet detail at a time. Nothing happens. Everything happens.",
      summary: "A short, reflective vignette for Spanish learners: Maya's Saturday morning told in small, repeating details — the vendor's call, the green motorcycle, the light on the wall. Read at A1–C1 with built-in translation, word-by-word audio, and bilingual mode. The first in a series of parallel-lives stories from Cuentana.",
    },
  },
  {
    slug: "diego-unplugged",
    image: "/images/diego-unplugged-thumbnail2.png",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    originalLevel: "C1",
    isPremiumOnly: false,
    type: "short-story",
    origin: { isOriginal: true },
    tags: ["technology","reflective","inspiring","heartwarming"],
    targetAudience: "all",
    descriptions: {
      hook: "A teenager drops his phone out a window and must survive a month without it.",
      summary: "Read Diego Unplugged in Spanish at A1–C1: a short story about a phone-addicted teen forced offline for a month. Built-in translation, word-by-word audio, and bilingual reading mode. A Cuentana original.",
    },
  },{
    slug: "my-day",
    image: "/images/my-day-3-thumbnail-7027.png",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    originalLevel: "A1",
    type: "poem",
    origin: { isOriginal: true },
    targetAudience: "all",
    structureType: "anthology",
    tags: [],
    descriptions: {
      hook: "A simple Spanish poem about the rhythm of an ordinary day, from dawn to dusk.",
      summary: "Read My Day in Spanish at A1–C1: a short poem capturing the rhythm of a single day, dawn to dusk. Built-in translation, word-by-word audio, and bilingual reading mode. A Cuentana original.",
    },
  },
  {
    slug: "the-adventures-of-sherlock-holmes",
    image: "/images/the-adventures-of-sherlock-holmes-thumbnail-1280.jpeg",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    descriptions: {
      hook: "Arthur Conan Doyle's 1892 detective stories, adapted for Spanish learners from A1 to C1.",
      summary: "Read The Adventures of Sherlock Holmes in Spanish at A1–C1: twelve self-contained cases from 221B Baker Street, narrated by Dr. Watson. Built-in translation, word-by-word audio, and bilingual mode.",
    },
    type: "short-story-collection",
    origin: { isOriginal: false, attribution: { author: { name: "Arthur Conan Doyle", lifespan: "1859-1930", note: "Scottish physician who wrote the Holmes stories between patients; created the modern detective story's template and then spent decades resenting it." }, yearWritten: "1891–1892", yearFirstPublished: 1892, sourceEdition: { title: "The Adventures of Sherlock Holmes", isPublicDomain: true, publicDomainNote: "Public domain in the United States (published 1892); author died 1930.", url: "https://www.gutenberg.org/ebooks/1661" }, rights: { originalWorkStatus: "public-domain", displayStatement: "The original text is in the public domain. This educational adaptation © Cuentana." }, region: "England", genres: ["Detective fiction", "mystery", "crime", "short story collection", "Victorian literature"] } },
    tags: ["mystery", "adventure", "suspenseful", "urban", "historical", "heroic", "friendship"],
    targetAudience: "all",
    addedAt: "2026-08-05",
  },

  {
    slug: "poems-by-emily-dickinson-complete",
    image: "/images/poems-by-emily-dickinson-complete-thumbnail-4653.jpeg",
    levels: ["A1", "A2", "B1", "B2", "C1", "C2"],
    originalLevel: "C2",
    descriptions: {
      hook: "Emily Dickinson's complete poetry, adapted for Spanish learners across all CEFR levels.",
      summary: "Read Emily Dickinson's poems in Spanish at A1–C2: the complete 1890 collection, edited by Mabel Loomis Todd and T.W. Higginson. Built-in translation, word-by-word audio, and bilingual mode.",
    },
    type: "poem",
    origin: { isOriginal: false, attribution: { author: { name: "Emily Dickinson", lifespan: "1830-1886", note: "Emily Dickinson was a recluse by temperament and habit, known for her unique and remote personality." }, sourceEdition: { title: "Poems by Emily Dickinson", publisher: "Not specified", editor: "Mabel Loomis Todd and T.W. Higginson", isPublicDomain: true, publicDomainNote: "Emily Dickinson died in 1886, and her works are in the public domain.", url: "https://www.gutenberg.org/ebooks/12242" }, rights: { originalWorkStatus: "public-domain", displayStatement: "The original text is in the public domain. This educational adaptation © Cuentana.", provenanceUrl: "https://www.gutenberg.org/ebooks/12242" }, region: "United States", culturalInfluences: ["American"], genres: ["poetry"] } },
    tags: ["love","death","usa","inspiring"],
    targetAudience: "all",
    structureType: "anthology",
  },{
    slug: "the-great-gatsby",
    image: "/images/the-great-gatsby-a-8-thumbnail-7588.jpeg",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    originalLevel: "C1",
    descriptions: {
      hook: "F. Scott Fitzgerald's 1925 classic novel, adapted for Spanish learners from A1 to C1.",
      summary: "Read The Great Gatsby in Spanish at A1–C1: Fitzgerald's 1925 American classic about love, wealth, and the green light across the bay. Built-in translation, word-by-word audio, and bilingual mode.",
    },
    type: "novel",
    origin: { isOriginal: false, attribution: { author: { name: "F. Scott Fitzgerald", lifespan: "1896 - 1940" }, yearWritten: "1925", sourceEdition: { isPublicDomain: true, url: "https://www.gutenberg.org/ebooks/64317" }, rights: { originalWorkStatus: "public-domain", displayStatement: "The original text is in the public domain. This educational adaptation © Cuentana.", provenanceUrl: "https://www.gutenberg.org/ebooks/64317" } } },
    tags: ["romance", "urban", "tragedy", "love"],
    targetAudience: "all",
    addedAt: "2026-03-17",
  },

  {
    slug: "the-adventures-of-tom-sawyer",
    image: "/images/the-adventures-of-tom-sawyer-thumbnail-4502.jpeg",
    levels: ["A1", "A2", "B1", "B2", "C1"],
    originalLevel: "C1",
    descriptions: {
      hook: "Mark Twain's 1876 classic, adapted for Spanish learners from A1 to C1.",
      summary: "Read The Adventures of Tom Sawyer in Spanish at A1–C1: Twain's 1876 tale of a mischievous boy in a Mississippi River town. Built-in translation, word-by-word audio, and bilingual mode.",
    },
    type: "novel",
    origin: { isOriginal: false, attribution: { author: { name: "Mark Twain", lifespan: "1835-1910", note: "Mark Twain is the pen name of Samuel Langhorne Clemens." }, yearWritten: "c. 1876", yearFirstPublished: 1876, sourceEdition: { title: "The Adventures of Tom Sawyer", isPublicDomain: true, publicDomainNote: "Published before 1928 and author died over 70 years ago.", url: "https://www.gutenberg.org/ebooks/74" }, rights: { originalWorkStatus: "public-domain", displayStatement: "The original text is in the public domain. This educational adaptation © Cuentana.", provenanceUrl: "https://www.gutenberg.org/ebooks/74" }, region: "United States", genres: ["novel", "children's literature"] } },
    tags: ["friendship","adventure","coming-of-age","humorous","nature","travel","historical","rural"],
    targetAudience: "all",
    addedAt: "2026-03-22",
  },

  {
    slug: "the-wonderful-wizard-of-oz",
    image: "/images/the-wonderful-wizard-of-oz-thumbnail-1030.jpeg",
    levels: ["A1", "A2", "B1", "B2"],
    originalLevel: "B2",
    descriptions: {
      hook: "L. Frank Baum's 1900 fairy tale, adapted for Spanish learners from A1 to B2.",
      summary: "Read The Wonderful Wizard of Oz in Spanish at A1–B2: Baum's 1900 fairy tale of Dorothy, Toto, and the yellow brick road. Built-in translation, word-by-word audio, and bilingual mode.",
    },
    type: "novel",
    origin: { isOriginal: false, attribution: { author: { name: "L. Frank Baum", lifespan: "1856 – 1919" }, yearWritten: "1900", sourceEdition: { title: "The Wonderful Wizard of Oz", publicationYear: 1900, isPublicDomain: true, url: "https://www.gutenberg.org/ebooks/55" }, rights: { originalWorkStatus: "public-domain", displayStatement: "The original text is in the public domain. This educational adaptation © Cuentana.", provenanceUrl: "https://www.gutenberg.org/ebooks/55" }, region: "United States", genres: ["fairy tale", "children's literature"] } },
    tags: ["friendship","adventure","fantasy","heros-journey","heartwarming"],
    targetAudience: "all",
    addedAt: "2026-03-24",
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
  // Normalize level to CEFR format for URLs (A1, A2, B1, B2, C1)
  const cefrLevel = toCEFR(level);
  return `/${locale}/stories/${storySlug}/${cefrLevel}/${chapter}/${page}`;
}

// CEFR to L-level mapping (for content loading)
const CEFR_TO_L: Record<string, string> = {
  'a1': 'l1',
  'a2': 'l2',
  'b1': 'l3',
  'b2': 'l4',
  'c1': 'l5',
};

// L-level to CEFR mapping (for URLs and display)
const L_TO_CEFR: Record<string, string> = {
  'l1': 'A1',
  'l2': 'A2',
  'l3': 'B1',
  'l4': 'B2',
  'l5': 'C1',
};

/**
 * Convert any level format to CEFR (A1, A2, B1, B2, C1)
 * Used for URLs and display
 */
export function toCEFR(level: string | undefined | null): string {
  if (!level) return 'A2'; // Default

  const lowerLevel = level.toLowerCase().trim();

  // Already CEFR format
  if (/^[abc][12]$/i.test(level.trim())) {
    return level.trim().toUpperCase();
  }

  // L-level format (l1, l2, etc.)
  if (L_TO_CEFR[lowerLevel]) {
    return L_TO_CEFR[lowerLevel];
  }

  // Numeric format (1, 2, 3, 4, 5)
  if (/^[1-5]$/.test(lowerLevel)) {
    return L_TO_CEFR[`l${lowerLevel}`] || 'A2';
  }

  return 'A2'; // Default fallback
}

/**
 * Convert any level format to L-level (l1, l2, l3, l4, l5)
 * Used internally for loading content from folders
 */
export function toLLevel(level: string | undefined | null): string {
  if (!level) return 'l2'; // Default

  const lowerLevel = level.toLowerCase().trim();

  // Already in L format
  if (/^l[1-5]$/.test(lowerLevel)) {
    return lowerLevel;
  }

  // CEFR format (A1, A2, B1, B2, C1)
  if (CEFR_TO_L[lowerLevel]) {
    return CEFR_TO_L[lowerLevel];
  }

  // Numeric format (1, 2, 3, 4, 5)
  if (/^[1-5]$/.test(lowerLevel)) {
    return `l${lowerLevel}`;
  }

  return 'l2'; // Default fallback
}

// Backwards compatibility alias
export const normalizeLevel = toLLevel;
