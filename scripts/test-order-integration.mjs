import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

// This disposable database is isolated from every configured production environment.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const connectionString = process.env.TEST_DATABASE_URL?.trim()
if (!connectionString) throw new Error('TEST_DATABASE_URL is required; this check resets only a dedicated local test database.')
let testUrl
try { testUrl = new URL(connectionString) } catch { throw new Error('Invalid TEST_DATABASE_URL') }
if (!['postgres:', 'postgresql:'].includes(testUrl.protocol) || testUrl.search || testUrl.hash || !['127.0.0.1', 'localhost', '[::1]'].includes(testUrl.hostname) || testUrl.pathname !== '/celebration_individual_test') {
  throw new Error('Refusing to reset a database outside loopback /celebration_individual_test.')
}
const output = await mkdtemp(join(repo, '.order-test-'))
try {
const requireRepo = createRequire(join(repo, 'package.json'))
const ts = requireRepo('typescript')
Object.assign(process.env, {
  DATABASE_URL: connectionString, DATABASE_SSL_MODE: 'disable', BUSINESS_TIMEZONE: 'Asia/Kolkata',
  ORDER_ID_PREFIX: 'LOCALTEST', TRACKING_TOKEN_SECRET: 'local-test-tracking-secret-that-is-long-enough-2026',
  ADMIN_SESSION_SECRET: 'local-test-admin-secret-that-is-long-enough-2026',
  PAYMENT_PROVIDER: 'razorpay', PAYMENT_MODE: 'test', APP_BASE_URL: 'http://127.0.0.1:3060',
  RAZORPAY_KEY_ID: 'rzp_test_local_fixture', RAZORPAY_KEY_SECRET: 'local-test-key',
  RAZORPAY_WEBHOOK_SECRET: 'local-test-webhook-secret'
})
async function compileTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name)
    if (entry.isDirectory()) { await compileTree(source); continue }
    if (!entry.name.endsWith('.ts')) continue
    const destination = join(output, relative(repo, source).replace(/\.ts$/, '.js'))
    await mkdir(dirname(destination), { recursive: true })
    const result = ts.transpileModule(await readFile(source, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: source
    })
    await writeFile(destination, result.outputText)
  }
}
await compileTree(join(repo, 'lib'))
await compileTree(join(repo, 'config'))
await cp(join(repo, 'content'), join(output, 'content'), { recursive: true })
for (const name of await readdir(join(repo, 'config'))) if (name.endsWith('.json')) await cp(join(repo, 'config', name), join(output, 'config', name))
const requireCompiled = createRequire(join(output, 'package.json'))
const { defaultCatalog } = requireCompiled(join(output, 'lib/domain/catalog.js'))
const { normalizeOrderInput } = requireCompiled(join(output, 'lib/domain/order.js'))
const { orderConfig } = requireCompiled(join(output, 'config/order.js'))
const { createOrder } = requireCompiled(join(output, 'lib/server/orders/create.js'))
const { listOrders, findOrderByTrackingToken } = requireCompiled(join(output, 'lib/server/orders/read.js'))
const { createCustomerAccount, listCustomerOrders } = requireCompiled(join(output, 'lib/server/customer-accounts.js'))
const { reservePaymentAttempt, bindPaymentAttempt, failPaymentAttempt, applyProviderPaymentResult, getPaymentOrder } = requireCompiled(join(output, 'lib/server/payments/store.js'))
const { recordTelegramOrderReply, listCustomerOrderMessages, acknowledgeCustomerOrderMessages } = requireCompiled(join(output, 'lib/server/telegram-order-messages.js'))
const control = new pg.Client({ connectionString, ssl: false })
await control.connect()
try {
  assert.equal((await control.query('SELECT current_database() AS name')).rows[0].name, 'celebration_individual_test')
  await control.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now());')
  const migrations = (await readdir(join(repo, 'db/migrations'))).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()
  for (const name of migrations.filter((name) => Number(name.split('_')[0]) <= 8)) {
    await control.query(await readFile(join(repo, 'db/migrations', name), 'utf8'))
    await control.query('INSERT INTO schema_migrations(name) VALUES($1)', [name])
  }
  // Seed a pre-009 legacy hamper without an account association. Current
  // createCustomerAccount requires later migrations (phone_verified_at in 011,
  // session_version in a later migration), so create accounts only after all
  // schema migrations have finished.
  await control.query(`INSERT INTO orders(id,public_id,idempotency_key,tracking_token_hash,tracking_expires_at,tier_id,tier_name,amount_paise,subtotal_paise,required_date,occasion,customer_name,phone,receiver_name,address,pincode,payment_status,status,policy_version)
    VALUES($1,'LOCALTEST-LEGACY',$2,'legacy-tracking',now()+interval '1 day','t499','Legacy Hamper',49900,49900,current_date+7,'Birthday','Local Checkout Tester','9000000001','Test Receiver','Local test delivery address','332001','pending','payment_verification_pending',$3)`, [randomUUID(), randomUUID(), orderConfig.policyVersion])
  for (const name of migrations.filter((name) => Number(name.split('_')[0]) > 8)) {
    await control.query(await readFile(join(repo, 'db/migrations', name), 'utf8'))
    await control.query('INSERT INTO schema_migrations(name) VALUES($1)', [name])
  }
  const account = await createCustomerAccount({ phone: '9000000001', password: 'Local-test-password-2026!', displayName: 'Local Checkout Tester' })
  const otherAccount = await createCustomerAccount({ phone: '9000000002', password: 'Local-test-password-2026!', displayName: 'Other Local Tester' })
  await control.query("UPDATE orders SET customer_account_id = $1 WHERE public_id = 'LOCALTEST-LEGACY'", [account.id])
  const legacy = (await control.query(`SELECT order_type,line_items,tier_id,amount_paise FROM orders WHERE public_id='LOCALTEST-LEGACY'`)).rows[0]
  assert.deepEqual(legacy, { order_type: 'hamper', line_items: [], tier_id: 't499', amount_paise: 49900 })
  const fixtureProducts = [
    { id: 'test-bracelet', name: 'Test Bracelet (Local fixture)', category: 'Jewelry', minTier: 0, points: 1, note: 'Local verification fixture. Never published to production.', active: true, sellIndividually: true, salePricePaise: 34950 },
    { id: 'test-ring', name: 'Test Ring (Local fixture)', category: 'Jewelry', minTier: 0, points: 1, note: 'Local verification fixture. Never published to production.', active: true, sellIndividually: true, salePricePaise: 25000 }
  ]
  const catalog = { ...defaultCatalog, products: [...defaultCatalog.products, ...fixtureProducts] }
  const publish = async (next) => control.query(`INSERT INTO catalog_config(id,payload,version) VALUES('primary',$1::jsonb,1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,version=catalog_config.version+1`, [JSON.stringify(next)])
  await publish(catalog)
  const requiredDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 7 * 86400000))
  const body = { orderType: 'individual', expectedSubtotalPaise: 94900, items: [{ productId: 'test-bracelet', quantity: 2 }, { productId: 'test-ring', quantity: 1 }], requiredDate, customerName: account.displayName, phone: account.phone, receiverName: 'Test Receiver', address: 'Local test delivery address', city: 'Sikar', state: 'Rajasthan', pincode: '332001', policyVersion: orderConfig.policyVersion, policyAccepted: true, idempotencyKey: randomUUID() }
  const normalize = (changes = {}, current = catalog) => normalizeOrderInput({ ...body, ...changes }, 'Asia/Kolkata', current, { requirePaymentReference: false, checkExpectedSubtotal: false })
  const auto = { paymentProvider: 'razorpay' }
  const created = await createOrder(normalize(), account.id, undefined, auto)
  assert.equal(created.pricing.payablePaise, 94900)

  // Telegram integration uses only the disposable local test database.
  const queuedNewOrder = await control.query(
    `SELECT q.id,q.snapshot
       FROM telegram_notification_outbox q JOIN orders o ON o.id=q.order_id
      WHERE o.public_id=$1 AND q.source='order_event'
        AND q.event_type='order_created'`,
    [created.publicId]
  )
  assert.equal(queuedNewOrder.rows.length, 1, 'New orders must enqueue one Telegram alert')
  assert.equal(queuedNewOrder.rows[0].snapshot.paymentStatus, 'pending',
    'Queued order alerts must retain the unpaid event-time snapshot')

  // Simulate Telegram delivery locally without hitting Telegram's API.
  await control.query(
    `UPDATE telegram_notification_outbox SET sent_at=now(),telegram_message_id=912345678
      WHERE id=$1`, [queuedNewOrder.rows[0].id]
  )
  const replyInput = {
    updateId: 812345678, messageId: 712345678, replyToMessageId: 912345678,
    text: 'Your Celebration order is being prepared.'
  }
  const messageSaved = await recordTelegramOrderReply(replyInput)
  assert.equal(messageSaved.ok, true, 'Admin Telegram reply must map to a real order')
  assert.equal(messageSaved.duplicate, false)
  assert.equal(messageSaved.publicId, created.publicId)
  const replay = await recordTelegramOrderReply(replyInput)
  assert.equal(replay.ok, true)
  assert.equal(replay.duplicate, true, 'Telegram repeated delivery must not duplicate the message')
  const unknown = await recordTelegramOrderReply({ ...replyInput, updateId: 812345679,
    messageId: 712345679, replyToMessageId: 999999999 })
  assert.equal(unknown.ok, false, 'Replies to unrecognized bot messages must not reach buyers')
  const ownedMessages = await listCustomerOrderMessages(created.publicId, account.id)
  assert.equal(ownedMessages.messages.length, 1)
  assert.equal(ownedMessages.unreadCount, 1)
  assert.equal(ownedMessages.messages[0].body, replyInput.text)
  assert.equal(await listCustomerOrderMessages(created.publicId, otherAccount.id), null,
    'A different signed-in customer must not read this order message')
  assert.equal(await acknowledgeCustomerOrderMessages(created.publicId, otherAccount.id), null,
    'A different customer must not mark another order as read')
  const ack = await acknowledgeCustomerOrderMessages(created.publicId, account.id)
  assert.equal(ack.acknowledged, 1)
  assert.equal((await listCustomerOrderMessages(created.publicId, account.id)).unreadCount, 0)

  const saved = (await control.query('SELECT order_type,line_items,tier_id,amount_paise FROM orders WHERE public_id=$1', [created.publicId])).rows[0]
  assert.equal(saved.order_type, 'individual')
  assert.equal(saved.tier_id, null)
  assert.equal(saved.line_items[0].quantity, 2)
  assert.equal(saved.line_items[0].unitPricePaise, 34950)
  assert.equal(saved.line_items[0].lineTotalPaise, 69900)
  const repriced = { ...catalog, products: catalog.products.map((p) => p.id === 'test-bracelet' ? { ...p, salePricePaise: 40000 } : p) }
  await publish(repriced)
  const retry = await createOrder(normalize({}, repriced), account.id, undefined, auto)
  assert.equal(retry.publicId, created.publicId)
  assert.equal(retry.pricing.payablePaise, 94900)
  await assert.rejects(createOrder(normalize({ items: [{ productId: 'test-bracelet', quantity: 1 }] }), account.id, undefined, auto), { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' })
  await assert.rejects(createOrder(normalize(), otherAccount.id, undefined, auto), /IDEMPOTENCY_OWNER_MISMATCH/)
  const staleKey = randomUUID()
  await assert.rejects(createOrder(normalize({ idempotencyKey: staleKey }), account.id, undefined, auto), { code: 'CART_PRICE_CHANGED' })
  assert.equal((await control.query('SELECT count(*)::int AS n FROM orders WHERE idempotency_key=$1', [staleKey])).rows[0].n, 0, 'Stale buyer amount must not create an order')
  const fresh = await createOrder(normalize({ idempotencyKey: randomUUID(), expectedSubtotalPaise: 105000 }), account.id, undefined, auto)
  assert.equal(fresh.pricing.payablePaise, 105000, 'New order must read latest transaction catalog, not stale normalized input')
  const raceKey = randomUUID()
  const races = await Promise.all([createOrder(normalize({ idempotencyKey: raceKey, expectedSubtotalPaise: 105000 }), account.id, undefined, auto), createOrder(normalize({ idempotencyKey: raceKey, expectedSubtotalPaise: 105000 }), account.id, undefined, auto)])
  assert.equal(races[0].publicId, races[1].publicId)
  assert.equal((await control.query('SELECT count(*)::int AS n FROM orders WHERE idempotency_key=$1', [raceKey])).rows[0].n, 1)
  const publisher = new pg.Client({ connectionString, ssl: false })
  await publisher.connect()
  try {
    await publisher.query('BEGIN')
    await publisher.query("SELECT payload FROM catalog_config WHERE id='primary' FOR UPDATE")
    const pending = createOrder(normalize({ idempotencyKey: randomUUID(), expectedSubtotalPaise: 105000 }), account.id, undefined, auto)
    assert.equal(await Promise.race([pending.then(() => 'saved'), new Promise((resolve) => setTimeout(() => resolve('blocked'), 150))]), 'blocked', 'Creation did not wait for the concurrent published catalog lock')
    await publisher.query('ROLLBACK')
    assert.equal((await pending).pricing.payablePaise, 105000)
  } finally { await publisher.query('ROLLBACK'); await publisher.end() }
  const disabled = { ...catalog, products: catalog.products.map((p) => p.id === 'test-bracelet' ? { ...p, active: false } : p) }
  await publish(disabled)
  await assert.rejects(createOrder(normalize({ idempotencyKey: randomUUID() }), account.id, undefined, auto), { code: 'INVALID_PRODUCT' })
  await publish(catalog)
  const manual = normalizeOrderInput({ ...body, idempotencyKey: randomUUID(), paymentReference: 'LOCALUPITEST01' }, 'Asia/Kolkata', catalog)
  await assert.rejects(createOrder(manual, account.id), { code: 'MANUAL_PAYMENT_NOT_SUPPORTED' })
  const hamperInput = normalizeOrderInput({ ...body, orderType: 'hamper', tierId: 't499', selectedProductIds: ['custom-card'], occasion: 'Birthday', idempotencyKey: randomUUID() }, 'Asia/Kolkata', catalog, { requirePaymentReference: false })
  const hamper = await createOrder(hamperInput, account.id, undefined, auto)
  const hamperRetry = await createOrder(hamperInput, account.id, undefined, auto)
  assert.equal(hamper.publicId, hamperRetry.publicId)
  assert.equal(hamper.pricing.payablePaise, 49900)
  const manualHamperInput = normalizeOrderInput({ ...body, orderType: 'hamper', tierId: 't499', selectedProductIds: ['custom-card'], occasion: 'Birthday', idempotencyKey: randomUUID(), paymentReference: 'LOCALUPIHAMPER01' }, 'Asia/Kolkata', catalog)
  const manualHamper = await createOrder(manualHamperInput, account.id)
  const manualRow = (await control.query('SELECT payment_status,payment_reference FROM orders WHERE public_id=$1', [manualHamper.publicId])).rows[0]
  assert.equal(manualRow.payment_status, 'verification_pending')
  assert.equal(manualRow.payment_reference, 'LOCALUPIHAMPER01')
  const customerRows = await listCustomerOrders(account.id)
  assert.equal(customerRows.find((p) => p.publicId === created.publicId).lineItems[0].quantity, 2)
  const adminRows = await listOrders()
  assert.equal(adminRows.find((p) => p.publicId === created.publicId).orderType, 'individual')
  const tracked = await findOrderByTrackingToken(created.trackingToken)
  assert.equal(tracked.lineItems[0].unitPricePaise, 34950)
  const reserved = await reservePaymentAttempt(created.publicId, account.id, 'razorpay')
  await bindPaymentAttempt(reserved.attemptId, { provider: 'razorpay', mode: 'test', providerOrderId: 'order_local_fixture', keyId: 'rzp_test_fixture', amountPaise: 94900, currency: 'INR' })
  const providerResult = { provider: 'razorpay', providerOrderId: 'order_local_fixture', providerPaymentId: 'pay_local_fixture', status: 'paid', amountPaise: 94900, eventId: 'evt_local_fixture', eventType: 'payment.captured', payload: { localFixture: true } }
  await assert.rejects(applyProviderPaymentResult({ ...providerResult, amountPaise: 1 }), /PAYMENT_AMOUNT_MISMATCH/)
  await assert.rejects(applyProviderPaymentResult({ ...providerResult, amountPaise: null }), /PAYMENT_AMOUNT_MISMATCH/)
  await applyProviderPaymentResult(providerResult)
  await applyProviderPaymentResult(providerResult)
  const paid = await getPaymentOrder(created.publicId, account.id)
  assert.equal(paid.paymentStatus, 'paid')
  assert.equal(paid.status, 'payment_verified')

  const paidNotifications = await control.query(
    `SELECT q.source,q.event_type,q.snapshot,q.payload
       FROM telegram_notification_outbox q JOIN orders o ON o.id=q.order_id
      WHERE o.public_id=$1 AND q.event_type IN ('payment.captured','payment_status_changed')
      ORDER BY q.id`,
    [created.publicId]
  )
  assert.equal(paidNotifications.rows.filter(row => row.event_type === 'payment.captured').length, 1,
    'Repeated provider webhook must not create another payment event notification')
  const paymentState = paidNotifications.rows.find(row =>
    row.event_type === 'payment_status_changed' && row.snapshot.paymentStatus === 'paid')
  assert.ok(paymentState, 'A successful payment must enqueue a paid-state alert')
  assert.equal(paymentState.snapshot.amountPaise, 94900)
  assert.ok(paymentState.snapshot.paidAt, 'Payment notification must carry verified paid time')

  assert.equal((await control.query('SELECT count(*)::int AS n FROM payment_events WHERE provider_event_id=$1', [providerResult.eventId])).rows[0].n, 1)
  await control.query("UPDATE orders SET payment_status='verified',status='preparing' WHERE public_id='LOCALTEST-LEGACY'")
  const verifiedLegacy = await getPaymentOrder('LOCALTEST-LEGACY', account.id)
  assert.equal(verifiedLegacy.paymentStatus, 'paid', 'Advanced legacy verified order looked unpaid to gateway APIs')
  const legacyRetry = await reservePaymentAttempt('LOCALTEST-LEGACY', account.id, 'razorpay')
  assert.equal(legacyRetry.attemptId, '', 'Previously verified legacy order created another payment attempt')
  const verifiedReserved = await reservePaymentAttempt(fresh.publicId, account.id, 'razorpay')
  await bindPaymentAttempt(verifiedReserved.attemptId, { provider: 'razorpay', mode: 'test', providerOrderId: 'order_local_verified', keyId: 'rzp_test_fixture', amountPaise: fresh.pricing.payablePaise, currency: 'INR' })
  await control.query("UPDATE orders SET payment_status='verified',status='shipped' WHERE public_id=$1", [fresh.publicId])
  await applyProviderPaymentResult({ ...providerResult, providerOrderId: 'order_local_verified', providerPaymentId: null, amountPaise: fresh.pricing.payablePaise, status: 'failed', eventId: 'evt_local_late_failure', eventType: 'payment.failed' })
  await failPaymentAttempt(verifiedReserved.attemptId, 'LOCAL_LATE_FAILURE')
  assert.equal((await control.query('SELECT payment_status FROM orders WHERE public_id=$1', [fresh.publicId])).rows[0].payment_status, 'verified', 'Late failure downgraded a confirmed legacy payment')
  const cancelled = await createOrder(normalize({ idempotencyKey: randomUUID() }), account.id, undefined, auto)
  await control.query("UPDATE orders SET status='cancelled' WHERE public_id=$1", [cancelled.publicId])
  await assert.rejects(reservePaymentAttempt(cancelled.publicId, account.id, 'razorpay'), /PAYMENT_ORDER_CANCELLED/)
  assert.equal((await control.query('SELECT payment_attempt_count FROM orders WHERE public_id=$1', [cancelled.publicId])).rows[0].payment_attempt_count, 0, 'Cancelled order created a payment attempt')
  const bindingRace = await createOrder(normalize({ idempotencyKey: randomUUID() }), account.id, undefined, auto)
  const bindingReserved = await reservePaymentAttempt(bindingRace.publicId, account.id, 'razorpay')
  await control.query("UPDATE orders SET status='cancelled' WHERE public_id=$1", [bindingRace.publicId])
  await assert.rejects(bindPaymentAttempt(bindingReserved.attemptId, { provider: 'razorpay', mode: 'test', providerOrderId: 'order_local_cancel_race', keyId: 'rzp_test_fixture', amountPaise: bindingRace.pricing.payablePaise, currency: 'INR' }), /PAYMENT_ORDER_CANCELLED/)
  const confirmationRace = await createOrder(normalize({ idempotencyKey: randomUUID() }), account.id, undefined, auto)
  const confirmationReserved = await reservePaymentAttempt(confirmationRace.publicId, account.id, 'razorpay')
  await control.query("UPDATE orders SET payment_status='verified',status='preparing' WHERE public_id=$1", [confirmationRace.publicId])
  await assert.rejects(bindPaymentAttempt(confirmationReserved.attemptId, { provider: 'razorpay', mode: 'test', providerOrderId: 'order_local_confirm_race', keyId: 'rzp_test_fixture', amountPaise: confirmationRace.pricing.payablePaise, currency: 'INR' }), /PAYMENT_ALREADY_CONFIRMED/)
  await assert.rejects(control.query(`UPDATE orders SET order_type='individual' WHERE public_id='LOCALTEST-LEGACY'`), { code: '23514' })
  await assert.rejects(control.query('UPDATE orders SET line_items=$1::jsonb WHERE public_id=$2', ['{}', created.publicId]), { code: '23514' })
  console.log('TELEGRAM_POSTGRES_CHECKS_PASSED: new order snapshot, paid events, reply-to mapping, replay deduplication, customer isolation, read receipts')
  console.log('REAL_POSTGRES_CHECKS_PASSED: migrations001..009, legacyhamper, individualsnapshot, staleprice, pausedavailability, samecartretry, changedcartreject, ownermismatch, concurrentidempotency, catalogpublishlock, individualmanualrejected, hampermanualpreserved, customer/admin/trackingreads, provideramountmismatch, duplicatepaidwebhook, verifiedpaymentpreserved, cancelledretryblocked, cancelledbindingrace, confirmedbindingrace, DBconstraints')
} finally { await control.end() }
} finally {
  assert.equal(dirname(output), repo)
  assert.ok(basename(output).startsWith('.order-test-'))
  await rm(output, { recursive: true, force: true })
}
process.exit(0)

