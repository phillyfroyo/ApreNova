# SEO Drift Check Routine

Weekly health check for `cuentana.app` SEO plumbing. Run locally.

- **Script:** `./dev/seo-drift-check.sh`
- **Cadence:** weekly on Saturday (set a recurring calendar reminder)
- **Runtime:** ~5 seconds

## Usage

```bash
./dev/seo-drift-check.sh
```

Exits 0 on green, 1 if any check fails. Prints the full pass/fail list either way.

## What it checks

- **`robots.txt`** — contains `Sitemap` pointer and `User-agent` rules
- **`sitemap.xml`** — returns 200; URL count between 60 and 200 (today: ~84). Adjust the bounds inline if the catalog grows substantially.
- **Sample story page** (the-last-word B1 ch1 page-1, picked as a stable canonical example) — verifies these tags are present in the rendered HTML:
  - `<title>` containing the story name
  - `<meta name="description">`
  - `<link rel="canonical">`
  - `hreflang="en"` and `hreflang="es"` alternates (React emits as camelCase `hrefLang`)
  - OpenGraph trio: `og:title`, `og:description`, `og:image`
  - `twitter:card`
  - `google-site-verification`
  - JSON-LD structured data (`application/ld+json`)
  - `<html lang="en">`

If all checks pass: green summary + reminder to skim Google Search Console and Bing Webmaster Tools (the script cannot do this — no credentials).

If anything fails: the failing checks are listed at the bottom of the report. Drift might mean a deploy regressed metadata, a route's `generateMetadata` was deleted, the sitemap generator broke, etc. Investigate from the affected check.

## History

- **2026-05-16:** SEO Stage 4 shipped. A remote scheduled Claude routine (`cuentana-seo-weekly-drift-check`, ID `trig_01C3mMKV9uuJGiHRZZczyhok`) was set up to run this check every Saturday 9am Mexico City.
- **2026-05-23:** First scheduled run fired. The remote container's network policy blocks outbound HTTPS to `cuentana.app` — both `curl` and `WebFetch` returned `403 host_not_allowed`. Routine couldn't function as designed.
- **2026-05-26:** Pivoted to this local script. Disable or delete the remote routine. Calendar reminder replaces cron.
