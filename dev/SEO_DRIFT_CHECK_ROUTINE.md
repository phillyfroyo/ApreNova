# SEO Drift Check Routine

Weekly remote agent that monitors production SEO health for `cuentana.app`.

- **Routine:** `cuentana-seo-weekly-drift-check`
- **ID:** `trig_01C3mMKV9uuJGiHRZZczyhok`
- **Schedule:** Every Saturday at 9am America/Mexico_City (15:00 UTC) — cron `0 15 * * 6`
- **First run:** 2026-05-23 09:02 America/Mexico_City
- **Model:** `claude-sonnet-4-6` · **Tools:** Bash, Read
- **Manage:** https://claude.ai/code/routines/trig_01C3mMKV9uuJGiHRZZczyhok

## What it does

Each Saturday morning, runs public curls against `cuentana.app` to verify SEO
plumbing is still intact: `robots.txt`, `sitemap.xml` (URL count in expected
range), and per-page tags on a sample story page (title, description,
canonical, hreflang, OG, Twitter Card, google-site-verification, JSON-LD
blocks, `<html lang>`).

- **If healthy:** one-line ✅ + reminder to open Google Search Console and Bing
  Webmaster Tools to skim indexed page count, crawl errors, and new queries.
- **If drift detected:** lists specific failures (missing tag, anomalous URL
  count, status code change).

Cannot log into Search Console (no credentials) — surfaces a reminder only.
