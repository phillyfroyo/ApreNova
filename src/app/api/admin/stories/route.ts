// src/app/api/admin/stories/route.ts
import { NextResponse } from "next/server";
import { STORY_METADATA } from "@/lib/stories";
import { STORY_THEMES } from "@/components/storyThemes";
import en from "@/content/ui/en";
import es from "@/content/ui/es";

export async function GET() {
  try {
    // Build enriched story list with titles, descriptions, and tagging
    const stories = STORY_METADATA.map((story) => {
      const enMeta = (en as any).storiesMetadata?.[story.slug];
      const esMeta = (es as any).storiesMetadata?.[story.slug];
      const theme = STORY_THEMES[story.slug];

      return {
        slug: story.slug,
        image: story.image,
        backgroundImage: theme?.backgroundImage, // Get from storyThemes.ts
        levels: story.levels,
        isPremiumOnly: story.isPremiumOnly || false,
        title: {
          en: enMeta?.title || story.slug,
          es: esMeta?.title || story.slug,
        },
        description: {
          en: enMeta?.description || "",
          es: esMeta?.description || "",
        },
        // Tagging fields
        type: story.type || "short-story",
        origin: story.origin || { isOriginal: true },
        tags: story.tags || [],
        targetAudience: story.targetAudience || "all",
      };
    });

    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Failed to fetch stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}
