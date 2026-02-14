// src/app/api/admin/stories/route.ts
import { NextResponse } from "next/server";
import { STORY_METADATA } from "@/lib/stories";
import { STORY_THEMES } from "@/components/storyThemes";
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import { getAllAdminStoryCosts } from "@/lib/cost-tracker";

export async function GET() {
  try {
    // Get all admin story costs in one query
    const costsBySlug = await getAllAdminStoryCosts();

    // Build enriched story list with titles, descriptions, tagging, and costs
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
        hook: {
          en: enMeta?.hook || "",
          es: esMeta?.hook || "",
        },
        // Tagging fields
        type: story.type || "short-story",
        origin: story.origin || { isOriginal: true },
        tags: story.tags || [],
        targetAudience: story.targetAudience || "all",
        // Archive status
        isArchived: story.isArchived || false,
        // Cost tracking
        totalCostCents: costsBySlug[story.slug] || 0,
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
