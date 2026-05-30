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

### Stage 4 — Submit to Google ✅ Done for `cuentana.app` (2026-05-16)

Completed 2026-05-16:
- `GOOGLE_SITE_VERIFICATION` set in Vercel Production; meta tag live on
  `cuentana.app`. Search Console ownership verified (HTML-tag method).
- Sitemap submitted to Search Console — accepted, awaiting first crawl.
- Bing Webmaster Tools: verification imported from GSC, sitemap
  submitted.

Still pending: `cuentana.org` property (separate verification + sitemap),
and `/[lng]/my-stories` `noindex` belt-and-suspenders — see Stage 5+.

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

- **Post-launch fix: middleware, `<html lang>`, canonical, hreflang ✅ Done (2026-05-28)**

  Google Search Console flagged `/en` and `/es` as 404s (first detected
  2026-05-22). Two compounding issues, both shipped:

  1. **`/[lng]` route gap.** The sitemap published `/en` and `/es` as
     priority-1.0 brand-landing URLs, but there was no `page.tsx` at
     `src/app/[lng]/` — only `home/`, `stories/`, etc. underneath.
     Added `src/app/[lng]/page.tsx` that 307-redirects to
     `/[lng]/stories`. Dropped `/en` and `/es` from sitemap.xml and
     promoted `/[lng]/stories` to priority 1.0 (Google indexes the
     destination directly, not the redirect).

  2. **Middleware was never running.** `middleware.ts` lived at the
     project root, but Next.js looks for it at `src/middleware.ts`
     when the app directory is under `src/`. So every page had been
     rendering with `<html lang="en">` regardless of route, canonical
     pointed at the bare root domain on every page, and hreflang
     alternates were missing entirely — none of which were visible
     in the UI but all of which Google reads.

     Moved to `src/middleware.ts` and switched from
     `response.headers.set(...)` (which only reaches the browser) to
     `NextResponse.next({ request: { headers } })` so server components
     can read the headers via `next/headers`. After the fix:
     - `/es/*` renders `<html lang="es">`
     - canonical on `/en/stories` etc. resolves to the actual page URL
     - hreflang en/es alternates emit on every page

  Re-running the Stage 4 verification checklist on the next prod
  deploy is recommended — view-source on `/es/stories`, Rich Results
  Test on a story info page, then re-request indexing for the URLs
  Search Console had marked as 404.

  Notes:
  - Next 16 emits a build warning that the `middleware` convention is
    deprecated in favor of `proxy`. Functional today; worth a follow-up
    rename (`src/middleware.ts` → `src/proxy.ts`).
  - `/dashboard` (un-prefixed) throws a client-side error instead of
    404'ing. Pre-existing, unrelated, deferred — internal nav never
    routes there.

- **Domain consolidation: `.org` → `.app` 308 redirect ✅ Done (2026-05-29)**

  Brand search "cuentana" was returning `cuentana.org` ahead of
  `cuentana.app` because both domains were attached to the same Vercel
  project and serving identical content. Every page already emitted a
  canonical pointing at `.app`, but Google was overriding the
  cross-domain canonical hint — likely because `.org` had accumulated
  more age/link-equity signal. Canonical tags are advisory; a 308 is
  not.

  Configured in Vercel project Domains:
  - `cuentana.org` → 308 redirect to `cuentana.app` (path-preserving)
  - `www.cuentana.org` → 308 redirect to `cuentana.app` (path-preserving)

  Verified live with curl:
  - `https://cuentana.org` → `308`, `location: https://cuentana.app/`
  - `https://www.cuentana.org` → `308`, `location: https://cuentana.app/`
  - `https://cuentana.org/en/stories` → `308`,
    `location: https://cuentana.app/en/stories` (path forwarding works)

  Expected timeline:
  - 1–2 weeks: Search Console "Pages" report shows `.org` URLs moving
    to "Page with redirect" status.
  - 2–4 weeks: Googling "cuentana" should surface `.app` at #1; `.org`
    should drop from results.
  - 4–8 weeks: Link equity fully consolidated on `.app`.

  Code surface unchanged. Every URL constant in the codebase
  (`SITE_URL`, `BASE_URL`, `metadataBase`, sitemap, JSON-LD, OG tags)
  already pointed at `.app`, so no follow-up edits were needed. Stripe
  checkout success/cancel URLs continue to use
  `NEXT_PUBLIC_BASE_URL` (set to `.app`); pre-redirect `.org` payment
  flows would have landed users on `.app` post-payment, which is now
  consistent end-to-end.

  Latent housekeeping (low-priority):
  - Both `.app` and `.org` show "DNS Change Recommended" in Vercel.
    Unrelated to the redirect; just a config nudge. Site works fine.
    Worth resolving in a future housekeeping pass.

- **Hierarchy: `hreflang x-default` → `/es` + middleware default ✅ Done (2026-05-30)**

  Goal: make the SEO setup respect the stated audience hierarchy —
  primary = Spanish-native (LATAM) learning English on `/es/*`,
  secondary = English-native learning Spanish on `/en/*` — without
  demoting the secondary target. Per-query targeting was already
  correct (reciprocal `en`/`es` hreflang clusters Spanish queries → `/es`,
  English queries → `/en`); the only signals leaning the wrong way were
  the *undefined fallbacks*, both of which defaulted to English.

  Two fixes, both leaning the fallback toward Spanish:

  1. **`x-default` → `/es`** added to every hreflang declaration. The
     `x-default` link is Google's tiebreaker for searchers whose
     language matches neither `en` nor `es`; without it Google guesses,
     and historically skews to the English URL. Now points at the `/es`
     variant on every page (including `/en` pages — the fallback is
     language-independent). Touched:
     - `src/app/sitemap.ts` (all 3 entry types: stories home, info
       cards, reader pages)
     - `src/app/[lng]/layout.tsx` (default for any `/[lng]/*` page)
     - `src/app/[lng]/stories/page.tsx`
     - `src/app/[lng]/stories/[storySlug]/page.tsx`
     - `src/app/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx`

  2. **`middleware.ts` `DEFAULT_LANG`: `"en"` → `"es"`.** This only
     affects un-prefixed / unknown-first-segment paths (e.g. `/`,
     `/privacy`); it sets `<html lang>` on those pages. Was the lone
     outlier — `[lng]/layout.tsx` and `constants/i18n.ts` already
     default to `es`. No redirect/rewrite behavior; header-only.

  This supersedes the earlier "`hreflang x-default` — when we have more
  than two languages" deferral note below: x-default is useful with two
  languages too, precisely because it claims the ambiguous bucket for
  the primary audience.

  No user-facing behavior change: `/en/*` and `/es/*` content pages are
  untouched (their `lang` comes from the URL segment); only the metadata
  `lang` attribute on un-prefixed pages flips `en` → `es`, which is
  arguably more correct (the `/` landing already defaults its visible
  copy to Spanish). `tsc --noEmit` clean.

  Verified on local dev server (view-source / curl, not devtools):
  - `/es/stories`, `/en/stories`, story info + reader pages all emit the
    `en` / `es` / `x-default→/es` triple
  - `sitemap.xml`: 98/98 `<url>` entries carry `x-default→/es`
  - `<html lang>`: `/es/*`→`es`, `/en/*`→`en`, `/`→`es`, `/privacy`→`es`

  Latent (not addressed, low-priority): `src/app/layout.tsx:78` still
  hardcodes its own `?? 'en'` fallback. Unreachable in practice (the
  middleware sets the header on `/` and `/privacy` before the layout
  reads it), but now slightly inconsistent with the `es` middleware
  default. Worth aligning in a future housekeeping pass.

- **Content optimization — descriptions backfill ✅ Done (2026-05-26)**

  All 9 stories now have hand-tuned `descriptions.hook` + `descriptions.summary`
  in `src/lib/stories.ts`. Skeleton: "Read [Title] in Spanish at [level
  range]: [hook]. Built-in translation, word-by-word audio, and bilingual
  mode." Hooks vary per story (Cuentana originals lean on central
  conflict; non-Cuentana classics lean on author + year + recognizable
  phrase like "green light across the bay" for Gatsby).

  Per-story `<meta description>`, OG, Twitter Card, and JSON-LD
  `Book.description` now serve unique snippets instead of the generic
  Stage 2 template fallback. Template fallback path kept as defensive
  default for future stories shipped without `descriptions` set.

  Note: `descriptions` is language-agnostic (one string used regardless
  of `lng`). Spanish snippets are English-language because most
  "learn Spanish through stories" search traffic queries in English.
  Per-language descriptions could be added later but not worth the
  schema change at current scale.


- **Story landing page (info card with its own URL) ✅ Done (2026-05-26)**

  Shipped `/[lng]/stories/[storySlug]` as a server-rendered route that
  surfaces the info card (image, title, hook, description, level badges,
  author/rights, "Read Me" CTA) with its own metadata + JSON-LD +
  sitemap entry. Google-referred cold visitors now land here instead of
  inside chapter 1, page 1 of the reader.

  What landed:
  1. New route at `src/app/[lng]/stories/[storySlug]/page.tsx`
  2. `<StoryDetailContent>` extracted from `StoryDetailModal` as a
     shared component — single source of truth for the info card visual
  3. `generateMetadata`: per-story title, description, canonical,
     hreflang en↔es, OG, Twitter Card
  4. JSON-LD: `Book` + `BreadcrumbList`
  5. Server-side bookmark + quizLevel resolution for the "Read Me" CTA
     so the link in initial HTML is correct for both crawlers (lowest
     level) and signed-in users (their bookmark or quizLevel)
  6. Sitemap restructured:

     | Pri | URL | Audience |
     |---|---|---|
     | 1.0 | `/en` | Brand search |
     | 0.9 | `/en/stories` | Browse intent |
     | 0.8 | `/en/stories/[storySlug]` | Specific-story search → info card (NEW) |
     | 0.7 | `/en/stories/[storySlug]/[level]/1/1` | Returning user / deep crawl (demoted from 0.8) |

  7. Internal linking: each `<StoryCard>` on `/[lng]/stories` now wraps
     image+title in an `<a href>` to the info-card URL — crawlers and
     cmd-click users follow the link; left-click still opens the modal
  8. Cuentana context block below each card (logo, tagline, "Hi there,
     we're Cuentana..." intro copy, two CTAs) — orients cold visitors
  9. Back-to-stories link above the card; card height capped at
     `calc(100vh - 120px)` on desktop with `hide-scrollbar` so the
     Cuentana logo peeks above the fold as a "more here" signal

  Canonical decision: each info-page URL is its own canonical (no
  reader → info redirect). Simpler than the original plan note about
  conditional canonicals; avoids any risk of redirect loops on direct
  bookmark visits.

  Sitemap deployed with 100 URLs (was 84). Sitemap re-submitted in
  Google Search Console + Bing Webmaster Tools 2026-05-26; 10 priority
  URLs manually requested for indexing (5 English + 5 Spanish — Gatsby,
  Tom Sawyer, the-last-word, saturday-morning, diego-unplugged).

  Expected timeline:
  - **2026-06-01** (week 1): manually-requested URLs appear in index
  - **2026-06-23** (week 4): first impression/click data in Performance
    report
  - **~2026-07** (week 6-8): ranking changes settle

- **Level-landing pages.** Original SEO discussion flagged that "A2
  Spanish reading content" searches currently land on `/[lng]/stories`
  with no level filter applied. Long-tail SEO opportunity: dedicated
  landing pages at `/[lng]/stories/level/[cefr]` (e.g.
  `/en/stories/level/A2`) that show only A2 stories with a
  level-specific title/description. Compounds with the per-story info
  pages above. **Status: deferred to Stage 5 — Move 2 (see below).**

- **Internal linking taxonomy** — story → author → language → level
  hub pages. Today there's no `/[lng]/authors/[author]` route or
  similar.
- **Page speed / Core Web Vitals optimization** — defer until traffic
  starts flowing and we can measure.
- **Backlink building** — guest posts, partnerships with
  language-learning blogs. This is the slowest-compounding channel and
  the most external.
- ~~**`hreflang` x-default** — when we have more than two languages.~~
  Done 2026-05-30 (with two languages) — see the hierarchy entry above.
- **Consolidate story URL emission to `getNavigationUrl()`.** Discovered
  2026-05-16: the route accepts both short form (`/A2/1/1`) and long
  form (`/A2/ch1/page-1`) and `page.tsx` normalizes them, so they
  serve identical content. The canonical tag points to the long form
  everywhere, so SEO impact is currently neutralized — but several
  call sites still emit the short form:
  - `src/app/[lng]/dashboard/page.tsx:280` (bookmark resume links)
  - `src/app/admin/upload-story/StoryManager.tsx:780` (admin viewer)
  - `src/components/LevelUnavailablePage.tsx:84` (level selector)
  - `src/utils/getStoryUrl.ts` (deprecated helper — delete)
  - `src/lib/stories.ts:317` (deprecated helper — delete)

  Migrate all to `getNavigationUrl()` (`src/utils/storyNavigation.ts:56`)
  so shared links use the canonical form. ~30 min cleanup, low urgency.

### Stage 5 — Search-intent / keyword research (added 2026-05-26)

Stages 1–4 + the Stage 5+ landing-page work above are the **technical
foundation**: pages exist, are indexable, have clean metadata, are in
the sitemap, and Google has been notified. We've built a site that
can rank for whatever queries Google decides match it.

Stage 5 shifts the work from *technical infrastructure* to *demand
matching*: figure out what your audience actually types into Google,
then make sure your site uses those words in the right places (and
eventually, build content explicitly targeting those queries).

The work breaks into three moves of increasing investment. Each builds
on the previous.

#### Move 1 — Keyword research to inform existing copy (this month)

**Goal:** Discover the 10–20 phrases your audience actually searches
for, then audit existing titles/descriptions/on-page copy to use those
phrases naturally where they don't already.

**Why it works:** Google ranks pages on word-match more than people
realize. If your audience searches "spanish reading practice a2" but
your A2-related pages say "CEFR-leveled stories at A2," Google sees
a partial match and ranks you lower than a competitor whose page uses
the searcher's exact vocabulary. Small copy edits, big ranking impact.

**Process:**
1. Brainstorm 30–50 seed queries. Examples:
   - "learn spanish through stories"
   - "spanish reading practice [a1|a2|b1|b2|c1]"
   - "free spanish reading for beginners"
   - "spanish short stories for [level] learners"
   - "comprehensible input spanish"
   - "spanish books for beginners"
   - "[author name] in spanish for english speakers"
   - "easy spanish books to read online"
2. Run them through free keyword tools to get search volume +
   competition data:
   - **Google Keyword Planner** (free with a Google Ads account, no
     spend required)
   - **AnswerThePublic** (free tier — surfaces question-form variants)
   - **Google auto-suggest** (just type into the search bar)
   - **Search Console Performance report** — after 4–8 weeks of data,
     this surfaces queries we're *already* showing up for. Goldmine
     for finding accidental matches we should double down on.
3. Narrow to a top-10 list ranked by (volume × intent-match × low
   competition).
4. Audit existing pages against the top-10. For each mismatch,
   update copy. Concrete examples of where to look:
   - Story info-page `<title>` and `<meta description>` (currently
     uses "Spanish Stories" phrasing — does the audience say
     "Spanish reading" or "Spanish stories" more?)
   - `/stories` index page `<title>` and `<h1>`
   - Landing page hero copy
   - About page intro

**Effort:** ~3–5 hours research + 1–2 hours of copy edits. No code
changes beyond text. Massively informative regardless of what comes
next.

**Risk:** Don't target queries we can't actually serve well. If we
rank for "spanish songs for learners" but don't have song-lyric
content, users bounce, Google demotes us. Match keywords to the
actual experience we deliver.

**Start:** May/June 2026.

#### Move 2 — Build content around proven search demand (deferred to August)

**Goal:** Once Move 1 surfaces queries with strong demand that we
don't currently rank for, build dedicated landing pages targeting
those queries.

**Examples worth considering** (depending on Move 1 findings):

- `/[lng]/learn-spanish-through-stories/` — pillar page targeting
  the brand-defining query. Single deeply-optimized page with rich
  content (testimonials, story samples, "how it works," comparison
  to other methods). The kind of page that ranks #1 forever.
- `/[lng]/stories/level/[cefr]/` — level-landing pages targeting
  "A2 spanish reading," "B1 spanish reading," etc. Was originally
  flagged as its own Stage 5+ item; rolls up here as a Move 2 task.
- `/[lng]/comprehensible-input-spanish/` — explainer page targeting
  the methodology-aware searcher. High-intent, often used in
  language-learning communities.
- `/[lng]/free-spanish-books-online/` — targets the "free" qualifier
  which is a high-volume modifier.

**Why ship one at a time:** Each landing page that ranks becomes a
permanent traffic engine. Better to ship one excellent page than five
mediocre ones. Pick the highest-leverage target from Move 1 findings.

**Effort per landing page:** ~4–8 hours (copy, layout, internal
linking, OG image, JSON-LD).

**Defer reason:** Move 1 has to happen first so we target real
queries rather than guesses. Also gives ~4 weeks of Search Console
data to inform decisions.

**Start:** August 2026 or later, after Move 1 informs targets.

#### Move 3 — Programmatic SEO (deferred to August or later)

**Goal:** Build a template that auto-generates one landing page per
(level × topic × language) combination — e.g.
`/spanish-reading-a2-romance`, `/spanish-reading-b1-mystery`,
`/spanish-reading-c1-coming-of-age`. Each ranks for its long-tail
combination; total surface area becomes hundreds of indexable pages.

**Why it works:** This is how Babbel, FluentU, and similar sites
built early-stage organic traffic. Long-tail queries individually
have low volume but collectively are most of the search universe.
A template that ships 100 pages can capture more total traffic than
5 hand-crafted pages.

**Why we're deferring:**
1. Programmatic SEO done lazily generates thin pages that Google
   may treat as "spam" and demote. Done well requires real content
   per combination (story excerpts, stats, recommendations).
2. We don't yet have enough story-tag taxonomy to fill the
   combinations. Most stories have 3–5 tags; combining 5 levels ×
   ~20 tags × 2 languages = 200 potential URLs, but most would be
   empty (no A1 horror stories yet).
3. Move 1 + Move 2 may move the needle enough that programmatic
   becomes unnecessary at our scale.

**Trigger to revisit:** When we have either (a) ≥30 stories or
(b) Move 2 landing pages prove the template structure works.

**Effort:** ~1–2 weeks. Includes schema design, template, internal
linking, sitemap generation, and content sufficiency rules
(don't generate empty combinations).

**Start:** Q4 2026 at earliest, possibly later.

#### Sequencing summary

| Move | Effort | Start | Trigger |
|---|---|---|---|
| Move 1 (research + audit) | ~5–7 hrs total | May/June 2026 | Now — depends on nothing else |
| Move 2 (landing pages) | ~4–8 hrs each, ship 1 at a time | August 2026 | Move 1 done + 4 weeks of Search Console data |
| Move 3 (programmatic) | ~1–2 weeks | Q4 2026+ | ≥30 stories or Move 2 proves the model |

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

- ~~**Domain consolidation.**~~ Resolved 2026-05-29 — see Stage 5+
  shipped entry for the `.org` → `.app` 308 redirect.

## File map (as shipped)

New:
- `src/middleware.ts` — sets `x-cuentana-lang` + `x-cuentana-pathname`
  request headers per request so layouts can render language-aware
  `<html lang>` and hreflang alternates. Must live under `src/` (not
  the project root) because the app directory is under `src/` — Next.js
  looks for middleware alongside the app dir. See the 2026-05-28
  post-launch fix entry under Stage 5+ for context.
- `src/app/[lng]/page.tsx` — server-side redirect to `/[lng]/stories`
  so `/en` and `/es` resolve with a 200 (via redirect) instead of 404.
- `src/app/robots.ts` — auto-generated robots.txt.
- `src/app/sitemap.ts` — auto-generated sitemap.xml (~98 URLs).
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
