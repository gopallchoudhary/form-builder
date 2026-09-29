/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * The browser tests bring their own dev server, and two `next dev` processes cannot share
   * one build directory — the second one fails on a lock. That made the suite impossible to
   * run while a developer's `pnpm dev` was up, which is exactly when it is most useful.
   * Pointed at its own directory, they coexist.
   */
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
