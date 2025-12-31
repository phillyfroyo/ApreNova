// src/lib/contentRegistry.ts
// Explicit content imports to avoid dynamic import warnings in Turbopack

// Aventura
import { levelContent as aventuraL1 } from '@/content/aventura/l1/content';
import { levelContent as aventuraL2 } from '@/content/aventura/l2/content';
import { levelContent as aventuraL3 } from '@/content/aventura/l3/content';
import { levelContent as aventuraL4 } from '@/content/aventura/l4/content';
import { levelContent as aventuraL5 } from '@/content/aventura/l5/content';

// The Last Word
import { levelContent as theLastWordL1 } from '@/content/the-last-word/l1/content';
import { levelContent as theLastWordL2 } from '@/content/the-last-word/l2/content';
import { levelContent as theLastWordL3 } from '@/content/the-last-word/l3/content';
import { levelContent as theLastWordL4 } from '@/content/the-last-word/l4/content';
import { levelContent as theLastWordL5 } from '@/content/the-last-word/l5/content';

// Diego Unplugged
import { levelContent as diegoUnpluggedL1 } from '@/content/diego-unplugged/l1/content';
import { levelContent as diegoUnpluggedL2 } from '@/content/diego-unplugged/l2/content';
import { levelContent as diegoUnpluggedL3 } from '@/content/diego-unplugged/l3/content';
import { levelContent as diegoUnpluggedL4 } from '@/content/diego-unplugged/l4/content';
import { levelContent as diegoUnpluggedL5 } from '@/content/diego-unplugged/l5/content';

// My Day
import { levelContent as myDayL1 } from '@/content/my-day/l1/content';
import { levelContent as myDayL2 } from '@/content/my-day/l2/content';
import { levelContent as myDayL3 } from '@/content/my-day/l3/content';
import { levelContent as myDayL4 } from '@/content/my-day/l4/content';
import { levelContent as myDayL5 } from '@/content/my-day/l5/content';

// Content registry mapping
const contentRegistry: Record<string, Record<string, any>> = {
  'aventura': {
    'l1': aventuraL1,
    'l2': aventuraL2,
    'l3': aventuraL3,
    'l4': aventuraL4,
    'l5': aventuraL5,
  },
  'the-last-word': {
    'l1': theLastWordL1,
    'l2': theLastWordL2,
    'l3': theLastWordL3,
    'l4': theLastWordL4,
    'l5': theLastWordL5,
  },
  'diego-unplugged': {
    'l1': diegoUnpluggedL1,
    'l2': diegoUnpluggedL2,
    'l3': diegoUnpluggedL3,
    'l4': diegoUnpluggedL4,
    'l5': diegoUnpluggedL5,
  },
  'my-day': {
    'l1': myDayL1,
    'l2': myDayL2,
    'l3': myDayL3,
    'l4': myDayL4,
    'l5': myDayL5,
  },
};

/**
 * Get story content from the registry
 * @param storySlug - The story slug (e.g., 'aventura', 'the-last-word')
 * @param level - The L-level (e.g., 'l1', 'l2', 'l3', 'l4', 'l5')
 * @returns The story content or null if not found
 */
export function getContentFromRegistry(storySlug: string, level: string): any | null {
  const storyContent = contentRegistry[storySlug];
  if (!storyContent) {
    console.error(`Story not found in registry: ${storySlug}`);
    return null;
  }

  const levelContent = storyContent[level];
  if (!levelContent) {
    console.error(`Level not found in registry: ${storySlug}/${level}`);
    return null;
  }

  return levelContent;
}

/**
 * Check if a story/level combination exists in the registry
 */
export function hasContent(storySlug: string, level: string): boolean {
  return !!(contentRegistry[storySlug]?.[level]);
}
