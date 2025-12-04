// src/lib/admin/attribution-helpers.ts
// Helper types and functions for admin form handling of story attribution

import type { StoryAttribution, AuthorInfo, SourceEdition, TranslatorInfo, RightsStatement } from "@/types/story";

/**
 * Flat form-friendly attribution structure for admin forms.
 * This is easier to bind to form inputs than the nested StoryAttribution type.
 */
export interface FormAttribution {
  // Author
  authorName: string;
  authorLifespan?: string;
  authorIsUnknown?: boolean;
  authorIsCollective?: boolean;
  authorNote?: string;

  // Dating
  yearWritten?: string;
  yearFirstPublished?: string;  // String to allow empty input

  // Source Edition
  sourceTitle?: string;
  sourcePublisher?: string;
  sourcePublicationYear?: string;
  sourceEditor?: string;
  sourceUrl?: string;
  sourceNotes?: string;
  sourceIsPublicDomain: boolean;
  sourcePublicDomainNote?: string;

  // Translator
  translatorName?: string;
  translatorLifespan?: string;
  translatorYear?: string;
  translatorIsPublicDomain?: boolean;
  translatorPublicDomainNote?: string;

  // Rights
  originalWorkStatus: "public-domain" | "licensed" | "original";
  rightsDisplayStatement?: string;
  provenanceNote?: string;
  provenanceUrl?: string;
  copyrightNote?: string;

  // Region/Culture
  region?: string;
  culturalInfluences?: string;  // Comma-separated for form input

  // Genres
  genres?: string;  // Comma-separated for form input
}

/**
 * Create an empty form attribution with sensible defaults
 */
export function createEmptyFormAttribution(): FormAttribution {
  return {
    authorName: "",
    sourceIsPublicDomain: true,
    originalWorkStatus: "public-domain",
  };
}

/**
 * Convert a StoryAttribution to a flat FormAttribution for editing
 */
export function attributionToForm(attr: StoryAttribution): FormAttribution {
  return {
    // Author
    authorName: attr.author.name,
    authorLifespan: attr.author.lifespan,
    authorIsUnknown: attr.author.isUnknown,
    authorIsCollective: attr.author.isCollective,
    authorNote: attr.author.note,

    // Dating
    yearWritten: attr.yearWritten,
    yearFirstPublished: attr.yearFirstPublished?.toString(),

    // Source Edition
    sourceTitle: attr.sourceEdition?.title,
    sourcePublisher: attr.sourceEdition?.publisher,
    sourcePublicationYear: attr.sourceEdition?.publicationYear?.toString(),
    sourceEditor: attr.sourceEdition?.editor,
    sourceUrl: attr.sourceEdition?.url,
    sourceNotes: attr.sourceEdition?.notes,
    sourceIsPublicDomain: attr.sourceEdition?.isPublicDomain ?? true,
    sourcePublicDomainNote: attr.sourceEdition?.publicDomainNote,

    // Translator
    translatorName: attr.translator?.name,
    translatorLifespan: attr.translator?.lifespan,
    translatorYear: attr.translator?.translationYear?.toString(),
    translatorIsPublicDomain: attr.translator?.isPublicDomain,
    translatorPublicDomainNote: attr.translator?.publicDomainNote,

    // Rights
    originalWorkStatus: attr.rights.originalWorkStatus,
    rightsDisplayStatement: attr.rights.displayStatement,
    provenanceNote: attr.rights.provenanceNote,
    provenanceUrl: attr.rights.provenanceUrl,
    copyrightNote: attr.rights.copyrightNote,

    // Region/Culture
    region: attr.region,
    culturalInfluences: attr.culturalInfluences?.join(", "),

    // Genres
    genres: attr.genres?.join(", "),
  };
}

/**
 * Convert a flat FormAttribution back to a StoryAttribution for storage
 */
export function formToAttribution(form: FormAttribution): StoryAttribution {
  const author: AuthorInfo = {
    name: form.authorName,
    lifespan: form.authorLifespan || undefined,
    isUnknown: form.authorIsUnknown || undefined,
    isCollective: form.authorIsCollective || undefined,
    note: form.authorNote || undefined,
  };

  const sourceEdition: SourceEdition | undefined = form.sourceTitle || form.sourcePublisher || form.sourceUrl ? {
    title: form.sourceTitle || undefined,
    publisher: form.sourcePublisher || undefined,
    publicationYear: form.sourcePublicationYear ? parseInt(form.sourcePublicationYear) : undefined,
    editor: form.sourceEditor || undefined,
    url: form.sourceUrl || undefined,
    notes: form.sourceNotes || undefined,
    isPublicDomain: form.sourceIsPublicDomain,
    publicDomainNote: form.sourcePublicDomainNote || undefined,
  } : undefined;

  const translator: TranslatorInfo | undefined = form.translatorName ? {
    name: form.translatorName,
    lifespan: form.translatorLifespan || undefined,
    translationYear: form.translatorYear ? parseInt(form.translatorYear) : undefined,
    isPublicDomain: form.translatorIsPublicDomain ?? true,
    publicDomainNote: form.translatorPublicDomainNote || undefined,
  } : undefined;

  // Generate rights statement if not provided
  const displayStatement = form.rightsDisplayStatement || generateRightsStatement(form);

  const rights: RightsStatement = {
    originalWorkStatus: form.originalWorkStatus,
    displayStatement,
    provenanceNote: form.provenanceNote || undefined,
    provenanceUrl: form.provenanceUrl || undefined,
    copyrightNote: form.copyrightNote || undefined,
  };

  return {
    author,
    yearWritten: form.yearWritten || undefined,
    yearFirstPublished: form.yearFirstPublished ? parseInt(form.yearFirstPublished) : undefined,
    sourceEdition,
    translator,
    rights,
    region: form.region || undefined,
    culturalInfluences: form.culturalInfluences ? form.culturalInfluences.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    genres: form.genres ? form.genres.split(",").map(s => s.trim()).filter(Boolean) : undefined,
  };
}

/**
 * Generate a default rights statement based on form data
 */
function generateRightsStatement(form: FormAttribution): string {
  if (form.originalWorkStatus === "public-domain") {
    const pdNote = form.sourcePublicDomainNote || "This work is in the public domain.";
    return `${pdNote} This educational adaptation, translation, and formatting are © Cuentana.`;
  } else if (form.originalWorkStatus === "licensed") {
    return "This work is used under license. Educational adaptation and formatting are © Cuentana.";
  } else {
    return "This is an original Cuentana work. All rights reserved.";
  }
}

/**
 * Simple legacy format for backwards compatibility during transition
 */
export interface SimpleLegacyAttribution {
  author: string;
  authorLifespan?: string;
  originalTitle?: string;
  yearPublished?: number;
  source?: string;
  translator?: string;
  publicDomain: boolean;
  publicDomainNote?: string;
}

/**
 * Convert legacy format to new StoryAttribution
 */
export function legacyToAttribution(legacy: SimpleLegacyAttribution): StoryAttribution {
  return {
    author: {
      name: legacy.author,
      lifespan: legacy.authorLifespan,
    },
    yearFirstPublished: legacy.yearPublished,
    sourceEdition: legacy.source ? {
      title: legacy.source,
      isPublicDomain: legacy.publicDomain,
      publicDomainNote: legacy.publicDomainNote,
    } : undefined,
    translator: legacy.translator ? {
      name: legacy.translator,
      isPublicDomain: legacy.publicDomain,
    } : undefined,
    rights: {
      originalWorkStatus: legacy.publicDomain ? "public-domain" : "licensed",
      displayStatement: legacy.publicDomain
        ? `This work is in the public domain. ${legacy.publicDomainNote || ''} Educational adaptation © Cuentana.`
        : "This work is used under license.",
    },
  };
}

/**
 * Convert new StoryAttribution to legacy format (for backwards compatibility)
 */
export function attributionToLegacy(attr: StoryAttribution): SimpleLegacyAttribution {
  return {
    author: attr.author.name,
    authorLifespan: attr.author.lifespan,
    yearPublished: attr.yearFirstPublished,
    source: attr.sourceEdition?.title,
    translator: attr.translator?.name,
    publicDomain: attr.rights.originalWorkStatus === "public-domain",
    publicDomainNote: attr.sourceEdition?.publicDomainNote || attr.rights.displayStatement,
  };
}
