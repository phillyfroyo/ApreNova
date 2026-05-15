# SEO Plan — Cuentana

Living plan for making Cuentana stories discoverable via web search. The
current state is **functionally invisible to Google for story-specific
queries** — story pages are publicly accessible but have no per-page
metadata, so every story appears to search engines as the generic
"Cuentana / Learn language through stories." This doc lays out the
staged work to fix that.

## Goal

When marketing is executed later this year, anyone Googling a Cuentana
story (e.g. `"The Last Word" cuentana`, `frankenstein spanish A2`)
should land directly on the story page — not the home page, not nothing.
We're planting seeds in May so the harvest is ready in August.

## Why now

SEO is the slowest-compounding channel. From the day we ship per-page
metadata, Google needs ~days to weeks to recrawl and ~weeks to months
for traffic to become meaningful. Doing this work now means by the time
the marketing plan executes, search results actually have something to
surface.

## What's wrong today (audit findings, 2026-05-15)

**Crawlability:**
- ✓ Story content pages are publicly accessible (no auth wall on story
  body). Verified at `/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx`.
- ✗ No `robots.txt`.
- ✗ No `sitemap.xml`.
- ✗ Not submitted to Google Search Console.

**Per-page signal:**
- ✗ No `metadata` or `generateMetadata` export on any story page.
- ✗ Stories home (`/[lng]/stories/page.tsx`) is a Client Component, so
  it can't export metadata until refactored.
- ✗ Root metadata is bare-bones: `title: 'Cuentana'`,
  `description: 'Learn language through stories.'`. No OG tags, no
  Twitter cards, no `metadataBase`.

**Internationalization:**
- ✗ Root layout hardcodes `<html lang="es">` for ALL routes, including
  `/en/*` — English pages are labeled as Spanish to search engines.
- ✗ No `hreflang` alternate links between `/en/` and `/es/` versions of
  the same content. Google likely indexes both as duplicates.

**Duplicate domains:**
- ⚠️ Both `cuentana.app` and `cuentana.org` serve the same Vercel
  deployment. No canonical URL signal — Google can't tell which is the
  "real" version. Need canonical tags pointing to `cuentana.app`
  (the marketed primary).

**User-uploaded stories:**
- ✓ Routes at `/[lng]/my-stories/...` already require auth (redirect
  to login for unauthenticated visitors). Not indexable today.
- ⚠️ Belt-and-suspenders: add explicit `noindex` directive in case the
  auth gate is ever removed.

**Headline diagnosis:** Google sees every story as identical
metadata-wise. Searching for a specific story matches the brand but not
the story. Fixing per-page metadata unlocks everything else.

## Stages

### Stage 1 — Crawlability foundation ⏸ Not started

Get Google's bots able to discover and crawl our pages. None of this
helps until pages have per-page metadata (Stage 2), so it's sequenced
first because metadata work depends on the same routes being indexable.

- [ ] Create `src/app/robots.ts` (Next.js auto-generated robots.txt).
      Allow all crawlers. Disallow `/api/`, `/auth/`, `/admin/`,
      `/my-stories/`. Point to sitemap.
- [ ] Create `src/app/sitemap.ts` (Next.js auto-generated sitemap.xml).
      Generate URLs for:
      - Home and core pages (`/`, `/[lng]/stories`, etc.)
      - Every `(lng, story, level, chapter, page)` combination, pulled
        from `STORY_METADATA` + content files. Roughly N stories ×
        2 languages × 5 levels × N chapters × N pages — should be a
        few thousand URLs.
      - Skip user-uploaded stories entirely.
- [ ] Verify both files render correctly at `/robots.txt` and
      `/sitemap.xml` in production.

### Stage 2 — Per-page metadata ⏸ Not started

The big one. Every story page gets a unique title, description, and
canonical URL. This is the work that actually moves the needle for
"can someone find a specific story on Google."

- [ ] **Root layout fixes** (`src/app/layout.tsx`):
      - Add `metadataBase: new URL('https://cuentana.app')` so OG/canonical
        URLs resolve absolutely.
      - Add default OG tags (title, description, image, type=website).
      - Add Twitter Card tags.
      - Add the brand favicon/manifest references if not already present.
- [ ] **Fix `<html lang>` to be language-aware**. The root layout
      hardcodes `lang="es"`. Either move the `<html>` element into
      `/[lng]/layout.tsx` (where the language is known), or set it
      via a server-side script that reads the route's `lng` param.
- [ ] **Add `hreflang` alternates** in the `/[lng]/layout.tsx` metadata.
      Every page gets `<link rel="alternate" hreflang="en" href=".../en/..." />`
      and `<link rel="alternate" hreflang="es" href=".../es/..." />`
      pointing at its sibling-language URL.
- [ ] **Story content page** (`/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx`):
      Add `generateMetadata` that returns:
      - `title`: `"{Story Title} — {Level} {Language} | Cuentana"`
        e.g. `"The Last Word — B1 Spanish | Cuentana"`
      - `description`: hand-tuned per story (pull from
        `STORY_METADATA.description` if present, else templated).
      - `alternates.canonical`: full `cuentana.app` URL for this page.
      - `alternates.languages`: `{ en: '.../en/...', es: '.../es/...' }`.
      - `openGraph`: title, description, image (story thumbnail),
        type=article, locale.
      - `robots`: index, follow (default, but explicit).
- [ ] **Stories home page** (`/[lng]/stories/page.tsx`): currently
      Client Component. Refactor into a Server Component wrapper that
      exports metadata, with the existing client logic moved into a
      child component. Metadata:
      - `title`: `"Spanish Stories at Every Level | Cuentana"` (or
        equivalent in Spanish for the `/es` variant)
      - `description`: marketing-friendly description of the library.
      - Canonical + hreflang.
- [ ] **User-story routes** (`/[lng]/my-stories/...`): explicit
      `robots: { index: false, follow: false }` metadata to prevent
      indexing even if the auth gate is later removed.

### Stage 3 — Structured data ⏸ Not started

JSON-LD structured data unlocks "rich results" in Google search —
larger snippets with author, language, level, etc. Lower priority than
Stage 2 but valuable once metadata is in place.

- [ ] **`Book` schema** on each story page. Properties: `name`,
      `author`, `inLanguage`, `bookFormat`, `numberOfPages`. Story data
      already lives in `STORY_METADATA`.
- [ ] **`LearningResource` schema** on each story page (Cuentana stories
      are educational content). Properties: `educationalLevel` (CEFR),
      `learningResourceType`, `teaches` (language).
- [ ] **`BreadcrumbList` schema** for navigation context. Stories home
      → story → level → chapter → page.
- [ ] **`WebSite` schema with `SearchAction`** on the root layout, so
      Google can show a search box for cuentana.app in its results.
- [ ] Validate with [Schema.org Validator](https://validator.schema.org/)
      and Google's [Rich Results Test](https://search.google.com/test/rich-results).

### Stage 4 — Submit to Google ⏸ Not started

All the metadata in the world doesn't matter if Google hasn't been
told to look.

- [ ] Verify domain ownership for both `cuentana.app` and `cuentana.org`
      in Google Search Console.
- [ ] Submit `https://cuentana.app/sitemap.xml` to Search Console.
- [ ] Configure preferred domain (or rely on canonical tags from
      Stage 2 — both approaches work).
- [ ] Manually request indexing for ~3 sample story URLs (the popular
      ones from `STORY_METADATA`) to seed initial crawls.
- [ ] Submit the same for `cuentana.org` OR set up a 301 redirect from
      `.org` → `.app` (cleaner long-term; consider this).
- [ ] Set up Bing Webmaster Tools too (small effort, ~10% search
      market share). Same sitemap.

### Stage 5+ — Deferred to August or later

These are the slow-compounding items. Don't touch now; they're the
"6-month plan" referenced in the broader strategy.

- **Content optimization** — story descriptions written specifically
  to rank (e.g. "Beginner Spanish A2 reading"), level-specific landing
  pages, language-pair pages.
- **Internal linking taxonomy** — story → author → language → level
  hub pages. Today there's no `/[lng]/authors/[author]` route or
  similar.
- **Page speed / Core Web Vitals optimization** — defer until traffic
  starts flowing and we can measure.
- **Backlink building** — guest posts, partnerships with
  language-learning blogs. This is the slowest-compounding channel and
  the most external.
- **`hreflang` x-default** — when we have more than two languages.

## Verification

For each stage, before marking done:

1. **Build locally** with `npm run build` and confirm no metadata
   errors.
2. **Inspect rendered HTML** on the deployed preview — view source on
   a story page, confirm the new `<title>`, `<meta>`, `<link
   rel="canonical">`, and OG tags are present.
3. **Run through Google's Rich Results Test** for structured data
   stages.
4. **Wait ~3-7 days after Stage 4** then search Google for an exact
   story title — should start surfacing within 2 weeks.

## Open questions

- **Stage 1 sitemap scale.** Will the auto-generated sitemap include
  every page combination, or should we cap at chapter level (one URL
  per chapter, not per page)? Google's per-sitemap cap is 50,000 URLs;
  splitting into multiple sitemap files is supported but more complex.
  Decision: start with page-level URLs, split into multiple sitemap
  files if we cross 40k entries.

- **Story descriptions.** `STORY_METADATA` currently has a `description`
  field on some entries but not all. Stage 2 templates a fallback
  ("Read {title} at the {level} CEFR level..."), but hand-tuning each
  description in `STORY_METADATA` is what actually moves rankings.
  Probably a Stage 5 task once we know which stories matter most.

- **Domain consolidation.** Long-term, running both `.app` and `.org`
  is awkward. Should `.org` redirect 301 to `.app`? That's the cleanest
  outcome but it's a marketing decision (do users associate the brand
  with one over the other?). Out of scope for this doc.

## File map (anticipated)

New:
- `src/app/robots.ts`
- `src/app/sitemap.ts`

Modified:
- `src/app/layout.tsx` — root metadata, fix `<html lang>`
- `src/app/[lng]/layout.tsx` — hreflang, language-aware lang attribute
- `src/app/[lng]/stories/page.tsx` — refactor into server component for
  metadata
- `src/app/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx`
  — add `generateMetadata` + JSON-LD
- `src/app/[lng]/my-stories/[storyId]/[level]/[chapter]/[page]/page.tsx`
  — add `noindex` metadata

Untouched:
- All other routes (auth, settings, admin, etc.) — these inherit from
  root metadata, which improves in Stage 2.
- `STORY_METADATA` — descriptions hand-tuning deferred to Stage 5.
