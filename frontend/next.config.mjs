/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/:path*`,
        // NOTE: Next.js rewrites don't support adding outgoing request headers inline.
        // In dev, INTERNAL_API_KEY is empty so backend API key enforcement is disabled.
        // In production, inject X-Internal-API-Key via Next.js middleware (middleware.ts).
      },
    ];
  },
};

export default nextConfig;
