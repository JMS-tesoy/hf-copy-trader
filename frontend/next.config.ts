import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // Proxy /api/* to the backend so cookies are set on localhost:3000
    // (cookies scoped to the backend port are not visible to Next.js middleware)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
