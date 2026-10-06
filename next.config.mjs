/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.SYNCODONTO_TEST_BUILD === "1" ? ".mobile-test-build" : ".next",
  images: {
    unoptimized: true,
  },
}

export default nextConfig
