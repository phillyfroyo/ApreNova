// src/app/robots.ts
// Next.js auto-generates /robots.txt from this file at build time.
// Tells search-engine crawlers what they may and may not access.

import type { MetadataRoute } from "next";

const BASE_URL = "https://cuentana.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          // Auth + onboarding pages — no SEO value, can confuse crawlers
          "/en/auth/",
          "/es/auth/",
          // User-uploaded stories are private; never index
          "/en/my-stories/",
          "/es/my-stories/",
          "/en/upload-story/",
          "/es/upload-story/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
