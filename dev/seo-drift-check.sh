#!/usr/bin/env bash
# Weekly SEO drift check for cuentana.app.
#
# Replaces the remote scheduled routine (cuentana-seo-weekly-drift-check)
# which is blocked from outbound HTTPS to cuentana.app by the remote
# execution sandbox's network policy. Run this manually instead.
#
# Usage:
#   ./dev/seo-drift-check.sh
#
# Cadence: weekly on Saturday. Add a recurring calendar reminder.
#
# Exits 0 if everything is healthy, 1 if any check fails.
# See dev/SEO_DRIFT_CHECK_ROUTINE.md for context.

set -uo pipefail

HOST="https://cuentana.app"
SAMPLE_STORY_URL="$HOST/en/stories/the-last-word/B1/ch1/page-1"
SITEMAP_MIN=60      # alert if URL count drops below this
SITEMAP_MAX=200     # alert if URL count exceeds this

pass=0
fail=0
notes=()

ok()   { echo "  ✅ $1"; pass=$((pass + 1)); }
bad()  { echo "  ❌ $1"; fail=$((fail + 1)); notes+=("$1"); }

echo ""
echo "SEO drift check — $HOST — $(date '+%Y-%m-%d %H:%M %Z')"
echo "────────────────────────────────────────────────────────────"

# 1. robots.txt
echo ""
echo "[1/3] robots.txt"
robots=$(curl -s --max-time 10 "$HOST/robots.txt" || true)
if [[ -z "$robots" ]]; then
  bad "robots.txt empty or unreachable"
else
  echo "$robots" | grep -qi "sitemap" && ok "contains Sitemap pointer" || bad "robots.txt missing Sitemap pointer"
  echo "$robots" | grep -qi "user-agent" && ok "contains User-agent rules" || bad "robots.txt missing User-agent rules"
fi

# 2. sitemap.xml — status + URL count
echo ""
echo "[2/3] sitemap.xml"
sitemap_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HOST/sitemap.xml")
[[ "$sitemap_status" == "200" ]] && ok "returns 200" || bad "sitemap.xml returned $sitemap_status"

url_count=$(curl -s --max-time 10 "$HOST/sitemap.xml" | grep -c '<url>' || echo 0)
if [[ "$url_count" -ge "$SITEMAP_MIN" && "$url_count" -le "$SITEMAP_MAX" ]]; then
  ok "URL count = $url_count (expected $SITEMAP_MIN to $SITEMAP_MAX)"
else
  bad "URL count = $url_count (out of expected range $SITEMAP_MIN to $SITEMAP_MAX)"
fi

# 3. Sample story page — per-page SEO tags
echo ""
echo "[3/3] Sample story page ($SAMPLE_STORY_URL)"
story_html=$(mktemp -t seo-drift-check.XXXXXX.html)
trap 'rm -f "$story_html"' EXIT
http_status=$(curl -s -o "$story_html" -w "%{http_code}" --max-time 15 "$SAMPLE_STORY_URL")

if [[ "$http_status" != "200" ]]; then
  bad "page returned $http_status — skipping tag checks"
else
  ok "returns 200"

  # Title contains the story name (not just the generic site title)
  grep -q "The Last Word" "$story_html" && ok "<title> contains \"The Last Word\"" || bad "<title> missing story name"

  # Per-page meta description
  grep -q 'meta name="description"' "$story_html" && ok '<meta name="description"> present' || bad '<meta name="description"> missing'

  # Canonical URL
  grep -q 'rel="canonical"' "$story_html" && ok '<link rel="canonical"> present' || bad '<link rel="canonical"> missing'

  # Hreflang — React emits as camelCase `hrefLang`, not lowercase
  grep -q 'hrefLang="en"' "$story_html" && ok 'hreflang="en" alternate present' || bad 'hreflang="en" alternate missing'
  grep -q 'hrefLang="es"' "$story_html" && ok 'hreflang="es" alternate present' || bad 'hreflang="es" alternate missing'

  # OpenGraph trio — count distinct properties, not lines (tags may share a line in minified output)
  og_hits=$(grep -oE 'og:(title|description|image)' "$story_html" | sort -u | wc -l | tr -d ' ')
  [[ "$og_hits" -ge 3 ]] && ok "OpenGraph tags present (og:title, og:description, og:image)" || bad "OpenGraph tags incomplete ($og_hits/3 distinct properties found)"

  # Twitter card
  grep -q 'twitter:card' "$story_html" && ok 'twitter:card present' || bad 'twitter:card missing'

  # Search Console verification
  grep -q 'google-site-verification' "$story_html" && ok 'google-site-verification present' || bad 'google-site-verification missing'

  # JSON-LD structured data (Book + LearningResource + BreadcrumbList expected)
  jsonld_hits=$(grep -c 'application/ld+json' "$story_html" || echo 0)
  [[ "$jsonld_hits" -ge 1 ]] && ok "JSON-LD present ($jsonld_hits block(s))" || bad "JSON-LD missing"

  # html lang attribute
  grep -q '<html lang="en"' "$story_html" && ok '<html lang="en"> set' || bad '<html lang="en"> missing'
fi

# Summary
echo ""
echo "────────────────────────────────────────────────────────────"
if [[ "$fail" -eq 0 ]]; then
  echo "✅ All $pass checks passed."
  echo ""
  echo "Reminder: also skim Google Search Console + Bing Webmaster Tools"
  echo "for indexed page count, crawl errors, and new queries."
  echo "  https://search.google.com/search-console"
  echo "  https://www.bing.com/webmasters"
  exit 0
else
  echo "❌ $fail check(s) failed, $pass passed."
  echo ""
  echo "Failures:"
  for n in "${notes[@]}"; do
    echo "  • $n"
  done
  exit 1
fi
