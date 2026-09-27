export const httpSecurity = {
  contentSecurityPolicy: [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' https://*.razorpay.com https://*.cashfree.com",
    "frame-ancestors 'none'",
    "frame-src 'self' https://*.razorpay.com https://*.cashfree.com https://www.google.com https://recaptcha.google.com",
    "object-src 'none'",
    "img-src 'self' data: blob: https://*.razorpay.com https://*.cashfree.com https://www.gstatic.com https://www.google.com",
    "media-src 'self' blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://sdk.cashfree.com https://verify.msg91.com https://www.google.com https://www.gstatic.com",
    "connect-src 'self' https://*.r2.cloudflarestorage.com https://*.razorpay.com https://*.cashfree.com https://verify.msg91.com https://control.msg91.com https://www.google.com https://www.gstatic.com"
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
  noStoreRoutes: ["/admin/:path*", "/track", "/api/admin/:path*", "/api/track", "/api/payments/:path*", "/api/account/password-reset/:path*"]
}
