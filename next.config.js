/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/ptc-player',
  assetPrefix: '/ptc-player',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
