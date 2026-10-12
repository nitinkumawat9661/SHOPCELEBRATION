// Celebration Telegram order alerts. Run as a separate, supervised VPS process.
// Requires DATABASE_URL, DATABASE_SSL_MODE, TELEGRAM_BOT_TOKEN,
// TELEGRAM_ADMIN_CHAT_ID in the environment. No customer-facing route is exposed.
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
if (!databaseUrl || !botToken || !adminChatId || !/^-?[0-9]+$/.test(adminChatId)) {
  console.error("Missing database or Telegram worker configuration.");
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true },
  max: 2,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000
});
const once = process.argv.includes("--once");
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const money = (paise) => "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const str = (value) => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
const time = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
  }).format(date) + " IST";
};
const yes = (value) => value === true ? "Yes" : value === false ? "No" : "Unknown";

function describeEvent(row) {
  const event = str(row.event_type);
  const details = row.payload && typeof row.payload === "object" ? row.payload : {};
  if (row.source === "payment_event") return ["💳 PAYMENT EVENT", "Gateway event: " + event];

  if (event === "payment_status_changed") {
    return ["💳 PAYMENT STATUS CHANGED",
      "Payment: " + str(details.from || "unknown") + " → " + str(details.to || "unknown")];
  }
  if (event === "courier_observed") {
    return ["🚚 CARRIER STATUS OBSERVED",
      "Carrier code: " + str(details.code || "unknown"),
      "Verified status: " + str(details.label || details.stage || "unknown"),
      "Scan time: " + time(details.scanOccurredAt),
      "Last location: " + str(details.lastLocation || "Not provided")];
  }
  if (event === "order_created") return ["📦 NEW ORDER"];
  if (event === "shipping_updated") return ["🚚 SHIPPING UPDATED"];
  if (event === "packing_video_uploaded") return ["🎬 PACKING VIDEO UPLOADED"];
  if (event === "customer_approved_packing") return ["✅ PACKING APPROVED"];
  if (event === "issue_reported") return ["⚠️ CUSTOMER ISSUE REPORTED",
    "Issue type: " + str(details.issueType || "Not provided")];
  if (event === "status_changed") {
    const from = str(details.from) || "unknown";
    const to = str(details.to) || "unknown";
    const heading = to === "cancelled" ? "🚫 ORDER CANCELLED"
      : to === "payment_verified" ? "✅ PAYMENT CONFIRMED"
      : ["shipped", "out_for_delivery", "delivered"].includes(to) ? "🚚 SHIPPING STATUS"
      : "🔔 ORDER STATUS CHANGED";
    const lines = [heading, "Status: " + from + " → " + to];
    if (to === "cancelled") {
      const beforeDispatch = !["shipped", "out_for_delivery", "delivered"].includes(from);
      lines.push("Cancellation stage: " + (beforeDispatch ? "Before dispatch" : "After dispatch"));
      lines.push("Cancelled by: " + (details.source === "customer" ? "Customer" : details.source === "admin" ? "Admin" : "Not recorded"));
      lines.push("Courier cancellation confirmed: " + yes(details.shipwayCancelled));
      lines.push("Cancellation time: " + time(row.occurred_at));
    }
    return lines;
  }
  return ["🔔 ORDER EVENT", "Event: " + event];
}

function productSummary(row) {
  const items = Array.isArray(row.line_items) ? row.line_items : [];
  if (row.order_type === "individual" && items.length) {
    return items.slice(0, 12).map((item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.lineTotalPaise ?? (Number(item.unitPricePaise || 0) * quantity));
      return "• " + str(item.name || item.productId || "Product") + " × " + quantity + " = " + money(price);
    });
  }
  const names = Array.isArray(row.selected_product_names) ? row.selected_product_names : [];
  if (names.length) return names.slice(0, 15).map((name) => "• " + str(name));
  return ["• " + str(row.tier_name || "Custom hamper")];
}

function composeMessage(row) {
  // Financial, payment and shipment fields MUST match the event transaction,
  // not the latest order row when a delayed notification is finally sent.
  const snapshot = row.event_snapshot && typeof row.event_snapshot === "object"
    ? row.event_snapshot : {};
  const eventRow = {
    ...row,
    status: snapshot.status ?? row.status,
    payment_status: snapshot.paymentStatus ?? row.payment_status,
    payment_provider: snapshot.paymentProvider ?? row.payment_provider,
    paid_at: snapshot.paidAt ?? row.paid_at,
    amount_paise: snapshot.amountPaise ?? row.amount_paise,
    subtotal_paise: snapshot.subtotalPaise ?? row.subtotal_paise,
    discount_paise: snapshot.discountPaise ?? row.discount_paise,
    shipping_paise: snapshot.shippingPaise ?? row.shipping_paise,
    shipping_provider: snapshot.shippingProvider ?? row.shipping_provider,
    shipping_tracking_number: snapshot.trackingNumber ?? row.shipping_tracking_number
  };
  row = eventRow;
  const lines = [
    ...describeEvent(row),
    "",
    "Order ID: " + str(row.public_id),
    "Event time: " + time(row.occurred_at),
    "Event ID: " + str(row.source_event_id),
    "Customer: " + str(row.customer_name),
    "Phone: " + str(row.phone),
    "Order type: " + (row.order_type === "individual" ? "Jewellery / individual" : "Gift hamper"),
    "Products:",
    ...productSummary(row),
    "",
    "Subtotal: " + money(row.subtotal_paise),
    "Discount: " + money(row.discount_paise),
    "Shipping charged: " + money(row.shipping_paise),
    "Order total: " + money(row.amount_paise),
    "Payment status: " + str(row.payment_status),
    "Payment method: " + str(row.payment_provider || "Not recorded"),
    "Paid amount: " + (["paid", "verified"].includes(str(row.payment_status).toLowerCase()) ? money(row.amount_paise) : "Not confirmed"),
    "Paid at: " + time(row.paid_at),
    "Current order status: " + str(row.status),
    "AWB: " + str(row.shipping_tracking_number || "Not assigned"),
    "Courier: " + str(row.shipping_provider || "Not assigned")
  ];
  if (row.status === "cancelled") {
    lines.push("Refund: " + (["paid", "verified"].includes(str(row.payment_status).toLowerCase())
      ? "Review required; no refund completion confirmed"
      : "No confirmed payment to refund"));
  }
  if (row.event_type === "order_created") {
    lines.push("Receiver: " + str(row.receiver_name || row.customer_name));
    lines.push("Address: " + [row.address, row.city, row.state, row.pincode].map(str).filter(Boolean).join(", "));
    lines.push("Required date: " + str(row.required_date));
    if (str(row.gift_message)) lines.push("Gift message: " + str(row.gift_message));
  }
  return lines.join("\n").slice(0, 3900);
}

async function sendTelegram(message) {
  const result = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: adminChatId, text: message, link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(12000)
  });
  const body = await result.json().catch(() => null);
  if (!result.ok || !body?.ok || !Number.isSafeInteger(body?.result?.message_id)) {
    // Do not print response body, API URL, or token into PM2 logs.
    throw new Error("TELEGRAM_SEND_FAILED_" + result.status);
  }
  return body.result.message_id;
}

async function dispatchBatch() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT q.id, q.source, q.source_event_id, q.event_type, q.payload, q.snapshot AS event_snapshot, q.occurred_at, q.attempts," +
      " o.public_id, o.order_type, o.line_items, o.tier_name, o.selected_product_names," +
      " o.customer_name, o.phone, o.receiver_name, o.address, o.city, o.state, o.pincode, o.gift_message," +
      " o.required_date, o.subtotal_paise, o.discount_paise, o.shipping_paise, o.amount_paise," +
      " o.payment_status, o.payment_provider, o.paid_at, o.status, o.shipping_provider, o.shipping_tracking_number" +
      " FROM telegram_notification_outbox q JOIN orders o ON o.id = q.order_id" +
      " WHERE q.sent_at IS NULL AND q.next_attempt_at <= now()" +
      " ORDER BY q.id LIMIT 5 FOR UPDATE OF q SKIP LOCKED"
    );
    for (const row of rows) {
      try {
        const telegramMessageId = await sendTelegram(composeMessage(row));
        await client.query(
          "UPDATE telegram_notification_outbox SET sent_at = now(), telegram_message_id = $2," +
          " attempts = attempts + 1, last_error = NULL WHERE id = $1",
          [row.id, telegramMessageId]
        );
      } catch (error) {
        const errorCode = error instanceof Error ? error.message.slice(0, 150) : "TELEGRAM_SEND_FAILED";
        const delaySeconds = Math.min(3600, 30 * (2 ** Math.min(Number(row.attempts), 7)));
        await client.query(
          "UPDATE telegram_notification_outbox SET attempts = attempts + 1, last_error = $2," +
          " next_attempt_at = now() + ($3 * interval '1 second') WHERE id = $1",
          [row.id, errorCode, delaySeconds]
        );
        console.error("Telegram send failed; event queued for retry:", errorCode);
      }
    }
    await client.query("COMMIT");
    return rows.length;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

try {
  do {
    try {
      const count = await dispatchBatch();
      if (once) console.log("Telegram worker checked " + count + " queued events.");
      if (!count && !once && !stopping) await sleep(5000);
    } catch (error) {
      console.error("Telegram outbox worker:", error instanceof Error ? error.message : "Unknown error");
      if (once) process.exitCode = 1;
      if (!once && !stopping) await sleep(5000);
    }
  } while (!once && !stopping);
} finally {
  await pool.end();
}
