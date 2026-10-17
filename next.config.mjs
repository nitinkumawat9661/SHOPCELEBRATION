import { httpSecurity } from "./config/http-security.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const shared = [
      { key: "Content-Security-Policy", value: httpSecurity.contentSecurityPolicy },
      ...httpSecurity.headers.map(([key, value]) => ({ key, value }))
    ]
    return [
      { source: "/:path*", headers: shared },
      // Stable, first-party campaign art: one-week browser freshness instead of
      // the default no-cache public/ response. Avoid one-year immutable caching
      // because these file names are not content-addressed.
      { source: "/images/campaign/:path*", headers: [
        { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }
      ] },
      // Generated local WebPs keep their same-SKU PNG originals as fallbacks.
      { source: "/catalog/necklaces-optimized/:path*", headers: [
        { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }
      ] },
      ...httpSecurity.noStoreRoutes.map((source) => ({ source, headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }))
    ]
  }
}

export default nextConfig
