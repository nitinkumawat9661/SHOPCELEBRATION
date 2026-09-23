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
      ...httpSecurity.noStoreRoutes.map((source) => ({ source, headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }))
    ]
  }
}

export default nextConfig
