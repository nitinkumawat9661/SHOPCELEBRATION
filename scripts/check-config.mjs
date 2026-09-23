const required = [
  "DATABASE_URL",
  "BUSINESS_TIMEZONE",
  "ORDER_ID_PREFIX",
  "TRACKING_TOKEN_SECRET",
  "ADMIN_PASSWORD_SCRYPT",
  "ADMIN_SESSION_SECRET",
  "ADMIN_SESSION_VERSION",
  "ISSUE_REPORT_WINDOW_HOURS",
  "NEXT_PUBLIC_CELEBRATION_WHATSAPP",
  "NEXT_PUBLIC_CELEBRATION_UPI_ID",
  "NEXT_PUBLIC_CELEBRATION_UPI_NAME",
  "NEXT_PUBLIC_CELEBRATION_SUPPORT_EMAIL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET"
]
const missing = required.filter((key) => !process.env[key]?.trim())
if (missing.length) {
  console.error(`Missing launch configuration:\n${missing.join("\n")}`)
  process.exit(1)
}
console.log("Launch configuration is complete.")
