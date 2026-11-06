import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Resolve this app independently of the existing Remotion prototype.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
