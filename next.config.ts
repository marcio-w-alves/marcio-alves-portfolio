import type { NextConfig } from 'next';
import { locales } from './src/profile/locales';
import { localeRedirects, localeRewrites } from './src/site/locale-routing';
import { publishedLocales } from './src/site/published-locales';

const isDevelopment = process.env.NODE_ENV === 'development';

// A static policy, not a per-request nonce: the home page is prerendered as a
// partial-prerendering shell, which a nonce cannot reach. The App Router
// streams its payload through inline scripts, so those stay allowed; every
// other source is this origin only. Inline style attributes are allowed
// because a server-rendered `style={{ '--var': value }}` is how this codebase
// passes a dynamic value to a utility; style elements are not. Development
// alone needs eval (React rebuilds server stack traces with it) and inline
// style elements (the dev server injects them). Inline event handlers are
// refused outright: nothing here writes one, so only an injection would.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  `style-src 'self'${isDevelopment ? " 'unsafe-inline'" : ''}`,
  "script-src-attr 'none'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
  redirects() {
    return Promise.resolve(localeRedirects());
  },
  rewrites() {
    return Promise.resolve(localeRewrites(publishedLocales(locales, process.env)));
  },
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
