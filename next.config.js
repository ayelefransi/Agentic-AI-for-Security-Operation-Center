/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:8000/api/:path*',
        },
      ];
    }
    if (process.env.BACKEND_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.BACKEND_URL.replace(/\/+$/, '')}/api/:path*`,
        },
      ];
    }
    return [];
  },
  output: 'standalone',
};

module.exports = nextConfig;
