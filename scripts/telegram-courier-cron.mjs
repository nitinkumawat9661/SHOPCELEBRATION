// Call from a controlled VPS cron/PM2 schedule AFTER migration+deployment.
// Example: node --env-file=/var/www/celebration/shared/.env.production
//   /var/www/celebration/current/scripts/telegram-courier-cron.mjs
const site = process.env.APP_BASE_URL?.trim() || "";
const secret = process.env.TELEGRAM_COURIER_POLL_SECRET?.trim() || "";
let destination;
try { destination = new URL("/api/integrations/telegram/courier-poll", site); }
catch { console.error("APP_BASE_URL is invalid"); process.exit(1); }
if (!site || !secret || secret.length < 32 || destination.protocol !== "https:") {
  console.error("Courier watcher is disabled or not configured for HTTPS.");
  process.exit(1);
}
try {
  const response = await fetch(destination, {
    method: "POST",
    headers: { "x-celebration-telegram-cron-secret": secret },
    signal: AbortSignal.timeout(55000)
  });
  if (!response.ok) throw new Error("HTTP_" + response.status);
  const data = await response.json();
  if (!data.ok) throw new Error("POLL_REJECTED");
  console.log("Courier watch completed:", data.checked, "checked,", data.failures, "failed");
} catch (error) {
  console.error("Courier watch unsuccessful:", error instanceof Error ? error.message : "ERROR");
  process.exitCode = 1;
}
