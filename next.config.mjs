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
    ],
  },

  // Turbopack config (Next.js 16 default)
  turbopack: {},

  // Webpack fallback for compatibility
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(process.cwd(), 'src')
    return config
  },
}

export default nextConfig
