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

### Stage 1 — Crawlability foundation ✅ Done (2026-05-15)

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

### Stage 2 — Per-page metadata ✅ Done (2026-05-15)

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

### Stage 3 — Structured data ✅ Done (2026-05-15)

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

### Stage 4 — Submit to Google ⏸ Awaiting deploy + manual steps

All the metadata in the world doesn't matter if Google hasn't been
told to look. This stage is **mostly manual work in the Google Search
Console UI** — there's no API path for "verify a domain and request
indexing." The code-side prep is done: a `<meta name="google-site-verification">`
tag is wired up via `GOOGLE_SITE_VERIFICATION` env var so HTML-tag
verification is a paste-and-deploy.

#### Pre-flight (verify the deploy works first)

Before opening Search Console, sanity-check the production build:

- [ ] After deploying this branch to production, `curl https://cuentana.app/robots.txt`
      — should return the rules + sitemap pointer.
- [ ] `curl https://cuentana.app/sitemap.xml` — should return ~84 URLs
      with hreflang alternates.
- [ ] Open any story page in a browser, view source — confirm the
      `<title>`, `<meta name="description">`, `<link rel="canonical">`,
      `<link rel="alternate" hreflang="en|es">`, and the JSON-LD
      `<script type="application/ld+json">` blocks are all present.
- [ ] Paste a story URL into [Rich Results Test](https://search.google.com/test/rich-results)
      — should detect Book, LearningResource, BreadcrumbList, plus the
      inherited WebSite + Organization.

#### Playbook — Search Console setup

For each of the two domains (`cuentana.app` first, `cuentana.org`
second):

1. Go to [Google Search Console](https://search.google.com/search-console).
   Sign in with the Google account that owns the marketing presence
   (recommend a dedicated `seo@cuentana.app` or similar, not a
   personal account).
2. Click **Add property** → choose **URL prefix** (NOT Domain — the
   URL prefix method is simpler and supports the meta-tag verification
   we've wired up). Enter `https://cuentana.app` (and later
   `https://cuentana.org`).
3. Search Console shows verification options. Pick **HTML tag**. It
   gives you a string like `<meta name="google-site-verification" content="abc123..." />`.
   Copy the `content` value only (just `abc123...`).
4. In Vercel dashboard for the cuentana project → Settings → Environment
   Variables, add:
   - Name: `GOOGLE_SITE_VERIFICATION`
   - Value: the `abc123...` string from step 3
   - Environment: **Production** only (no need on Preview/Dev)
5. Redeploy production from Vercel. Once the deploy completes, the
   verification meta tag will be in the HTML.
6. Back in Search Console, click **Verify**. Should succeed.

If verifying `cuentana.org` later: the env var is shared across both
domains since both serve the same Vercel deployment. The meta tag
will be present on both. Just add the `.org` property in Search
Console and click Verify — should succeed without code changes.

If Google needs a different verification value per domain, switch to
DNS TXT record verification (managed at your domain registrar /
Cloudflare). Worth noting: each meta tag value can only verify one
domain at a time, so we may need to add a second env var or switch
strategies for the second domain.

#### Playbook — Sitemap submission

1. In Search Console, with `cuentana.app` selected, go to **Sitemaps**
   in the left nav.
2. Under "Add a new sitemap," enter `sitemap.xml` (just the path,
   prefix is filled in automatically).
3. Submit. Status should turn "Success" within a few hours; "Couldn't
   fetch" means the URL isn't accessible — recheck the pre-flight
   curls.
4. Repeat for `cuentana.org`. (Or set up the 301 redirect — see
   "Decisions deferred" below.)

#### Playbook — Request indexing for sample stories

Google will crawl from the sitemap automatically, but manually
requesting a few URLs seeds the initial crawl faster.

1. In Search Console → **URL Inspection** in the left nav.
2. Paste a story URL — for example: `https://cuentana.app/en/stories/the-last-word/B1/ch1/page-1`
3. After Google fetches it, click **Request Indexing**. Queue is a
   few minutes per URL with a daily limit (~10-20 manual requests).
4. Do this for ~3 stories at A2 and B1 levels in both English and
   Spanish — the ones most likely to convert "spanish reading
   material A2" searches.

#### Playbook — Bing Webmaster Tools

Optional but cheap (~10 min). Bing has ~10% of search traffic.

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Sign in. Click **Import from GSC** to inherit Search Console
   verification — saves the verification round-trip.
3. Submit the sitemap URL.

#### After submission

- Re-crawl latency for an existing brand search ("Cuentana"): 1–3
  days. So the first thing to watch for: searching `"the last word"
  cuentana` should start landing on the actual story page within a
  week.
- For zero-history search queries ("A2 spanish reading material"):
  weeks to months. Don't expect traffic immediately; we're planting
  the seed.
- Check Search Console weekly for: indexed page count climbing,
  crawl errors, queries appearing in the Performance report.

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
  is awkward. The current setup uses canonical tags on every page
  pointing to `cuentana.app`, which tells Google "the .app version is
  authoritative even when this page is served from .org." That handles
  the SEO duplicate-content concern.
  However, a **301 redirect from `.org` → `.app`** would be cleaner:
  one canonical domain, no duplicate Search Console properties, no
  ambiguity for users sharing links. Setup at the Vercel/DNS level
  (probably cleanest as a Vercel project-level redirect rule).
  Marketing decision: do users associate the brand with one over the
  other? Defer to a separate conversation.

## File map (as shipped)

New:
- `middleware.ts` — sets `x-cuentana-lang` + `x-cuentana-pathname`
  headers per request so layouts can render language-aware
  `<html lang>` and hreflang alternates.
- `src/app/robots.ts` — auto-generated robots.txt.
- `src/app/sitemap.ts` — auto-generated sitemap.xml (~84 URLs).
- `src/app/[lng]/my-stories/layout.tsx` — `noindex` belt-and-suspenders
  for user-uploaded story routes.
- `src/app/[lng]/stories/StoriesPageClient.tsx` — moved client-side
  logic for the stories home (was `page.tsx`, now a child of the new
  server wrapper).
- `src/app/[lng]/stories/page.tsx` — server-component wrapper that
  exports `generateMetadata` for the stories home.
- `src/components/JsonLd.tsx` — helper that renders a JSON-LD
  `<script>` block.

Modified:
- `src/app/layout.tsx` — adds `metadataBase`, title template, full
  default metadata, dynamic `<html lang>`, `<meta google-site-verification>`
  via env var, and a site-wide `WebSite` + `Organization` JSON-LD
  `@graph` block.
- `src/app/[lng]/layout.tsx` — `generateMetadata` emitting default
  hreflang alternates derived from the pathname header.
- `src/app/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx`
  — adds `generateMetadata` (per-story title, description, canonical,
  hreflang, OG, Twitter) and a JSON-LD `@graph` block with `Book`,
  `LearningResource`, `BreadcrumbList`.

Untouched:
- All other routes (auth, settings, admin, etc.) — these inherit from
  root metadata.
- `STORY_METADATA` — hand-tuned hooks/summaries are a Stage 5 task.
