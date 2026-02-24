/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/:path*`,
        // NOTE: Next.js route handlers take precedence over rewrites.
        // /api/auth/* is handled by app/api/auth/[...nextauth]/route.ts (Auth.js v5)
        // and never reaches this rewrite rule.
        // For all other /api/* requests, middleware.ts injects X-Internal-API-Key
        // and X-User-Email headers before the rewrite proxies to the backend.
      },
    ];
  },
};

export default nextConfig;
