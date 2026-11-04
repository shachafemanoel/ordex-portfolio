/** @type {import('next').NextConfig} */
const path = require('path');
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig = {
  // Next 16 / Turbopack: keep compilation root at the repo (avoids wrong inference when cwd is `app/`)
  turbopack: {
    root: path.join(__dirname),
  },
  typescript: {
    // Production builds enforce the same complete type check as CI.
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  // Basic image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      ...(isProduction
        ? []
        : [
            { protocol: 'http', hostname: 'localhost' },
          ]),
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Security headers
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=()',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'off',
      },
      ...(isProduction
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload',
            },
          ]
        : []),
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/settings',
        permanent: false,
      },
      {
        source: '/admin/users',
        destination: '/settings/users',
        permanent: false,
      },
      {
        source: '/admin/integrations',
        destination: '/settings/integrations',
        permanent: false,
      },
    ];
  },

  poweredByHeader: false,

  // Environment variables
  env: {},
  output: 'standalone',
};

module.exports = nextConfig;
