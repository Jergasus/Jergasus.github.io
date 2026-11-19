import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Ruling R4: always defined, so Next inlines it and the e2e-only motion
  // recorder (src/components/motion/gsap.ts) is dropped from deploy builds.
  // Next only inlines NEXT_PUBLIC_* variables that exist at build time.
  env: { NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E === '1' ? '1' : '0' },
  // src/app/global-not-found.tsx renders out/404.html as one document (two
  // root layouts leave a root not-found.tsx without a layout of its own).
  experimental: { globalNotFound: true },
};

export default withNextIntl(nextConfig);
