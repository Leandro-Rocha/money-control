/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: [
    "money.cafofo.casa",
    "*.cafofo.casa",
    "192.168.0.220",
    "100.64.230.53",
    "localhost",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "money.cafofo.casa",
        "*.cafofo.casa",
        "192.168.0.220:3050",
        "localhost:3050",
        "192.168.0.220:3051",
        "100.64.230.53:3051",
        "localhost:3051",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
