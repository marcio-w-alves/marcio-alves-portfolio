import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  experimental: {
    // Turbopack's persistent cache does not know that the Tailwind loader's
    // output depends on the class names in every component, so a build where
    // only components changed reused the previous stylesheet and shipped
    // without the new classes. Correct CSS is worth the slower build.
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
