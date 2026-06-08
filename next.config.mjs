/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle for a small production Docker image.
  output: 'standalone',
  experimental: {
    workerThreads: true,
  },
};

export default nextConfig;
