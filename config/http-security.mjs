export const httpSecurity = {
  contentSecurityPolicy: [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.r2.cloudflarestorage.com"
  ].join("; "),
  headers: [
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "no-referrer"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ["Cross-Origin-Resource-Policy", "same-origin"],
    ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"]
  ],
  noStoreRoutes: ["/admin/:path*", "/track", "/api/admin/:path*", "/api/track"]
}
