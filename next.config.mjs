import { withSentryConfig } from '@sentry/nextjs';
import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cuentana1.blob.core.windows.net',
      },
    ],
  },

  // Turbopack config (Next.js 16 default)
  turbopack: {},

  // Permanent (308 ≈ 301) redirects from old story slugs to their normalized
  // form. These slugs picked up upload-artifact suffixes (-a-8, -3) from
  // repeated local re-uploads; the canonical slug, content dirs, and
  // STORY_METADATA were renamed to the clean form. These redirects preserve
  // SEO equity on the already-indexed old URLs and keep existing user
  // bookmarks / external links working. `:path*` matches zero-or-more
  // trailing segments, so one rule per slug covers both the info-card page
  // (/[lng]/stories/<slug>) and every deep reader URL beneath it. `:lng`
  // captures en|es. See dev/SEO_PLAN.md Stage 5+.
  async redirects() {
    const slugMap = [
      { from: "the-great-gatsby-a-8", to: "the-great-gatsby" },
      { from: "my-day-3", to: "my-day" },
    ];
    return slugMap.map(({ from, to }) => ({
      source: `/:lng(en|es)/stories/${from}/:path*`,
      destination: `/:lng/stories/${to}/:path*`,
      permanent: true,
    }));
  },

  // Keep large static assets out of serverless function bundles. They're
  // still served from /public via Vercel's CDN — this just stops them from
  // being copied into every function bundle and pushing past the 250MB cap.
  outputFileTracingExcludes: {
    '*': ['public/landing/**', 'public/images/**'],
  },

  // Webpack fallback for compatibility
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(process.cwd(), 'src')
    return config
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "cuentana",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
