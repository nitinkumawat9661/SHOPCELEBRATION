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
  ISSUE_REPORT_WINDOW_HOURS: '48',
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
const { createStagedSelfBuildOrder } = requireCompiled(join(output, 'lib/server/orders/self-build-create.js'))
const { createSelfBuildNoInventoryOrder } = requireCompiled(join(output,'lib/server/orders/self-build-no-inventory.js'))
const { listSelfBuildPaymentReviews,documentSelfBuildRefundReference } = requireCompiled(join(output,'lib/server/self-build-payment-reviews.js'))
const { settleStagedSelfBuildPaymentWithClient } = requireCompiled(join(output, 'lib/server/self-build-payment-settlement.js'))
const { removeDeliveredSelfBuildOrderPhotos } = await import('./cleanup-self-build-delivered-photos.mjs')
const { listOrders, findOrderByTrackingToken } = requireCompiled(join(output, 'lib/server/orders/read.js'))
const { createCustomerAccount, listCustomerOrders } = requireCompiled(join(output, 'lib/server/customer-accounts.js'))
const { reservePaymentAttempt, bindPaymentAttempt, failPaymentAttempt, applyProviderPaymentResult, getPaymentOrder } = requireCompiled(join(output, 'lib/server/payments/store.js'))
const { recordTelegramOrderReply, listCustomerOrderMessages, acknowledgeCustomerOrderMessages, sendCustomerOrderMessage } = requireCompiled(join(output, 'lib/server/telegram-order-messages.js'))
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
    { id: 'test-ring', name: 'Test Ring (Local fixture)', category: 'Jewelry', minTier: 0, points: 1, note: 'Local verification fixture. Never published to production.', active: true, sellIndividually: true, salePricePaise: 25000 },
    { id: 'test-hamper-card', name: 'Test Hamper Card (Local fixture)', category: 'Gift Extras', minTier: 0, points: 1, note: 'Local hamper-only fixture. Never published to production.', active: true, sellIndividually: false }
  ]
  const catalog = { ...defaultCatalog, products: [...defaultCatalog.products, ...fixtureProducts] }
  const publish = async (next) => control.query(`INSERT INTO catalog_config(id,payload,version) VALUES('primary',$1::jsonb,1) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,version=catalog_config.version+1`, [JSON.stringify(next)])
  await publish(catalog)
  // The real checkout reserves stock for every individual item. Seed only
  // disposable fixture SKUs with sufficient stock for the whole regression
  // suite; the production inventory remains untouched.
  await control.query(`INSERT INTO product_inventory (product_id, available_quantity)
    VALUES ('test-bracelet', 1000), ('test-ring', 1000)
    ON CONFLICT (product_id) DO UPDATE
      SET available_quantity = EXCLUDED.available_quantity, updated_at = now()`)
  const requiredDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 7 * 86400000))
  const body = { orderType: 'individual', expectedSubtotalPaise: 94900, items: [{ productId: 'test-bracelet', quantity: 2 }, { productId: 'test-ring', quantity: 1 }], requiredDate, customerName: account.displayName, phone: account.phone, receiverName: 'Test Receiver', address: 'Local test delivery address', city: 'Sikar', state: 'Rajasthan', pincode: '332001', policyVersion: orderConfig.policyVersion, policyAccepted: true, idempotencyKey: randomUUID() }
  const normalize = (changes = {}, current = catalog) => normalizeOrderInput({ ...body, ...changes }, 'Asia/Kolkata', current, { requirePaymentReference: false, checkExpectedSubtotal: false })
  // Individual checkout requires an explicit verified shipping quote. A zero
  // shipping amount is a valid local fixture; never contact live couriers.
  const auto = { paymentProvider: 'razorpay', shippingPaise: 0 }
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

  // Real isolated PostgreSQL: private customer -> Telegram outbox -> owner
  // replies to that notification -> correct buyer sees response in inbox.
  const clientId = randomUUID()
  assert.equal((await sendCustomerOrderMessage(created.publicId, otherAccount.id, 'I cannot access this order', randomUUID())).reason, 'ORDER_NOT_FOUND')
  const outgoing = await sendCustomerOrderMessage(created.publicId, account.id, 'Please confirm my parcel.', clientId)
  assert.equal(outgoing.ok, true)
  assert.equal(outgoing.message.sender, 'customer')
  const outgoingReplay = await sendCustomerOrderMessage(created.publicId, account.id, 'Please confirm my parcel.', clientId)
  assert.equal(outgoingReplay.ok, true)
  assert.equal(outgoingReplay.message.id, outgoing.message.id)
  const customerAlert = await control.query(
    `SELECT q.id,q.telegram_message_id FROM telegram_notification_outbox q
     JOIN orders o ON o.id=q.order_id
     WHERE o.public_id=$1 AND q.source='customer_message'`, [created.publicId])
  assert.equal(customerAlert.rows.length, 1, 'Customer message must enqueue owner alert once')
  assert.equal(customerAlert.rows[0].telegram_message_id, null)
  await control.query(`UPDATE telegram_notification_outbox
    SET telegram_message_id=712345681,sent_at=now()
    WHERE id=$1`,[customerAlert.rows[0].id])
  const responseToCustomer = await recordTelegramOrderReply({
    updateId: 812345681, messageId: 712345682,
    replyToMessageId: 712345681, text:'Your parcel is being prepared.'
  })
  assert.equal(responseToCustomer.ok, true)
  assert.equal(responseToCustomer.publicId, created.publicId)
  const conversation = await listCustomerOrderMessages(created.publicId,account.id)
  assert.equal(conversation.messages.length, 3)
  assert.equal(conversation.messages[1].sender, 'customer')
  assert.equal(conversation.messages[2].sender, 'celebration_support')
  assert.equal(conversation.unreadCount, 1, 'Buyer outgoing messages cannot count as unread')
  assert.equal(await listCustomerOrderMessages(created.publicId,otherAccount.id), null)
  assert.equal((await acknowledgeCustomerOrderMessages(created.publicId,account.id)).acknowledged, 1)
  assert.equal((await listCustomerOrderMessages(created.publicId,account.id)).unreadCount, 0)
  assert.equal((await sendCustomerOrderMessage(created.publicId,account.id,'',randomUUID())).ok, false)
  assert.equal((await sendCustomerOrderMessage(created.publicId,account.id,'Bad id', 'not-a-uuid')).ok, false)

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
  const hamperInput = normalizeOrderInput({ ...body, orderType: 'hamper', tierId: 't499', selectedProductIds: ['test-hamper-card'], occasion: 'Birthday', idempotencyKey: randomUUID() }, 'Asia/Kolkata', catalog, { requirePaymentReference: false })
  const hamper = await createOrder(hamperInput, account.id, undefined, auto)
  const hamperRetry = await createOrder(hamperInput, account.id, undefined, auto)
  assert.equal(hamper.publicId, hamperRetry.publicId)
  assert.equal(hamper.pricing.payablePaise, 49900)
  const manualHamperInput = normalizeOrderInput({ ...body, orderType: 'hamper', tierId: 't499', selectedProductIds: ['test-hamper-card'], occasion: 'Birthday', idempotencyKey: randomUUID(), paymentReference: 'LOCALUPIHAMPER01' }, 'Asia/Kolkata', catalog)
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
  // REAL staged Self-Build order/reservation integration: disposable PostgreSQL
  // ONLY. Production checkout remains blocked by a DB CHECK constraint.
  const stagedDraftId = randomUUID()
  await control.query(`INSERT INTO self_build_drafts
    (id,customer_account_id,tier_id,selections,other_request_text,expires_at)
    VALUES ($1,$2,'t499',$3::jsonb,'Wrap it carefully',now()+interval '1 day')`,
    [stagedDraftId, account.id, JSON.stringify([{kind:'category',id:'bangles',quantity:1}])])
  const selfBuildKey=randomUUID()
  const stagedInput={
    accountId:account.id,draftId:stagedDraftId,paymentProvider:'razorpay',
    customerDetails:{...body,idempotencyKey:selfBuildKey,occasion:'Birthday'}
  }
  await assert.rejects(createStagedSelfBuildOrder(stagedInput),{code:'SELF_BUILD_NOT_LIVE'})
  assert.equal((await control.query('SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key=$1',[selfBuildKey])).rows[0].n,0,
    'Closed customer gate must prevent creating an order or Telegram outbox event')
  // Enable staged schema only inside loopback /celebration_individual_test.
  // Never relax the production CHECK(customer_enabled=false).
  const stagingConstraint=await control.query(`SELECT conname FROM pg_constraint
    WHERE conrelid='self_build_configuration'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%customer_enabled%'`)
  assert.equal(stagingConstraint.rows.length,1)
  assert(/^[a-z_]+$/.test(stagingConstraint.rows[0].conname))
  await control.query('ALTER TABLE self_build_configuration DROP CONSTRAINT "'+stagingConstraint.rows[0].conname+'"')
  await control.query("UPDATE self_build_configuration SET customer_enabled=true WHERE id='primary'")
  await control.query(`INSERT INTO self_build_category_capacity(category_id,available_units,verified)
     VALUES ('bangles',2,true)`)
  await control.query(`INSERT INTO self_build_tier_allowances(tier_id,allowance_paise,enabled)
     VALUES ('t499',20000,true)
     ON CONFLICT(tier_id) DO UPDATE SET allowance_paise=20000,enabled=true`)
  const staged=await createStagedSelfBuildOrder(stagedInput)
  assert.equal(staged.created,true)
  assert.equal(staged.payablePaise,49900)
  assert.equal(staged.reservationStatus,'reserved')
  const storedStaged=await control.query(`SELECT o.id,o.payment_status,o.order_type,o.selected_product_ids,
    b.status,s.other_request_text, s.selections
    FROM orders o
    JOIN self_build_order_reservation_batches b ON b.order_id=o.id
    JOIN self_build_order_snapshots s ON s.order_id=o.id
    WHERE o.public_id=$1`,[staged.orderId])
  assert.equal(storedStaged.rows[0].payment_status,'pending')
  assert.equal(storedStaged.rows[0].order_type,'hamper')
  assert.deepEqual(storedStaged.rows[0].selected_product_ids,[],'No catalogue SKU mapping')
  assert.equal(storedStaged.rows[0].other_request_text,'Wrap it carefully')
  assert.equal(storedStaged.rows[0].selections[0].id,'bangles')
  assert.equal(storedStaged.rows[0].status,'reserved')
  const retryStaged=await createStagedSelfBuildOrder(stagedInput)
  assert.equal(retryStaged.created,false)
  assert.equal(retryStaged.orderId,staged.orderId)
  assert.equal((await control.query(`SELECT COUNT(*)::int AS n FROM self_build_order_reservation_items WHERE order_id=$1`,
    [storedStaged.rows[0].id])).rows[0].n,1,'Idempotent retry never double-reserves')
  assert.equal((await control.query("SELECT reserved_units FROM self_build_category_capacity WHERE category_id='bangles'")).rows[0].reserved_units,1)
  const notice=await control.query(`SELECT COUNT(*)::int AS n FROM telegram_notification_outbox
    WHERE order_id=$1 AND event_type='order_created'`,[storedStaged.rows[0].id])
  assert.equal(notice.rows[0].n,1,'One durable owner notification, no duplicate')
  await assert.rejects(createStagedSelfBuildOrder({...stagedInput,accountId:otherAccount.id}),{
    code:'SELF_BUILD_DRAFT_NOT_FOUND'
  })
  await control.query(`UPDATE self_build_drafts SET other_request_text='A different gift'
    WHERE id=$1`,[stagedDraftId])
  await assert.rejects(createStagedSelfBuildOrder(stagedInput),{
    code:'RESERVATION_PAYLOAD_MISMATCH'
  })
  await control.query(`UPDATE self_build_drafts SET other_request_text='Wrap it carefully',
     selections=$2::jsonb WHERE id=$1`,
    [stagedDraftId,JSON.stringify([{kind:'category',id:'bangles',quantity:2}])])
  const overbookKey=randomUUID()
  await assert.rejects(createStagedSelfBuildOrder({
    ...stagedInput,customerDetails:{...stagedInput.customerDetails,idempotencyKey:overbookKey}
  }),{code:'INSUFFICIENT_VERIFIED_CATEGORY_CAPACITY'})
  assert.equal((await control.query('SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key=$1',
    [overbookKey])).rows[0].n,0,'Insufficient stock rolls back order + notification + reservation together')
  const curatedKey=randomUUID()
  const curatedEmpty=normalizeOrderInput({...body,orderType:'hamper',tierId:'t499',
    selectedProductIds:[],occasion:'Birthday',idempotencyKey:curatedKey},'Asia/Kolkata',catalog,
    {requirePaymentReference:false})
  await createOrder(curatedEmpty,account.id,undefined,auto)
  await control.query(`UPDATE self_build_drafts SET selections=$2::jsonb
    WHERE id=$1`,[stagedDraftId,JSON.stringify([{kind:'category',id:'bangles',quantity:1}])])
  await assert.rejects(createStagedSelfBuildOrder({
    ...stagedInput,customerDetails:{...stagedInput.customerDetails,idempotencyKey:curatedKey}
  }),{code:'SELF_BUILD_IDEMPOTENCY_COLLISION'})
  // Delivery-linked private photo retention. Fake object keys stay in
  // disposable loopback DB; R2 mock proves the exact verified deletion time.
  const photoDraftId=randomUUID()
  await control.query(`INSERT INTO self_build_drafts
    (id,customer_account_id,tier_id,selections,other_request_text,expires_at)
    VALUES ($1,$2,'t499',$3::jsonb,'photo gift',now()+interval '1 day')`,
    [photoDraftId,otherAccount.id,JSON.stringify([{kind:'category',id:'personalised-photos',quantity:1}])])
  await control.query(`INSERT INTO self_build_category_capacity(category_id,available_units,verified)
    VALUES ('personalised-photos',3,true)`)
  const makePhotoOrder=(key)=>createStagedSelfBuildOrder({
    accountId:otherAccount.id,draftId:photoDraftId,paymentProvider:'razorpay',
    customerDetails:{...body,idempotencyKey:key,occasion:'Birthday'}
  })
  const firstPhotoOrderKey=randomUUID()
  await assert.rejects(makePhotoOrder(firstPhotoOrderKey),
    {code:'SELF_BUILD_ORDER_PHOTO_COUNT_MISMATCH'})
  assert.equal((await control.query("SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key=$1",
    [firstPhotoOrderKey])).rows[0].n,0,'Missing photo rolls back staged order')
  const firstPhotoId=randomUUID(),firstObjectKey=`self-build/private/${photoDraftId}/${firstPhotoId}.webp`
  await control.query(`INSERT INTO self_build_draft_photos
    (id,draft_id,customer_account_id,object_key,image_bytes)
    VALUES($1::uuid,$2,$3,$4,421)`,[firstPhotoId,photoDraftId,otherAccount.id,firstObjectKey])
  const stagedPhoto=await makePhotoOrder(firstPhotoOrderKey)
  const stagedPhotoRetry=await makePhotoOrder(firstPhotoOrderKey)
  assert.equal(stagedPhotoRetry.created,false,'Photo order retry is idempotent')
  assert.equal(stagedPhotoRetry.orderId,stagedPhoto.orderId)
  const photoOrderId=(await control.query("SELECT id FROM orders WHERE public_id=$1",[stagedPhoto.orderId])).rows[0].id
  assert.equal((await control.query("SELECT COUNT(*)::int AS n FROM self_build_draft_photos WHERE draft_id=$1",
    [photoDraftId])).rows[0].n,0,'Draft cleanup cannot remove a photo transferred to order')
  assert.equal((await control.query("SELECT source_draft_id,deleted_at,object_key FROM self_build_order_photos WHERE order_id=$1",
    [photoOrderId])).rows[0].source_draft_id,photoDraftId)
  const dryDeletes=[]
  const mockRemove=async key=>{dryDeletes.push(key)}
  assert.equal(await removeDeliveredSelfBuildOrderPhotos(control,mockRemove),0,
    'Photo must remain during initial payment/shipping lifecycle')
  await control.query(`UPDATE orders SET status='shipped',payment_status='paid',
    delivered_at=now()-interval '50 hours' WHERE id=$1`,[photoOrderId])
  assert.equal(await removeDeliveredSelfBuildOrderPhotos(control,mockRemove),0,
    'Shipment and even a stale delivered_at cannot trigger delete before delivered state')
  await control.query(`UPDATE orders SET status='delivered',
    delivered_at=now()-interval '47 hours' WHERE id=$1`,[photoOrderId])
  assert.equal(await removeDeliveredSelfBuildOrderPhotos(control,mockRemove),0,
    '47 hours after delivery is too early')
  await control.query(`UPDATE orders SET delivered_at=now()-interval '49 hours' WHERE id=$1`,[photoOrderId])
  assert.equal(await removeDeliveredSelfBuildOrderPhotos(control,mockRemove),1,
    'Delete only 48+ hours after actual delivered status')
  assert.deepEqual(dryDeletes,[firstObjectKey])
  assert.equal(await removeDeliveredSelfBuildOrderPhotos(control,mockRemove),0,
    'Repeated cron runs must be idempotent')
  const erasedPhoto=(await control.query(`
    SELECT object_key,deleted_at FROM self_build_order_photos WHERE id=$1::uuid`,
    [firstPhotoId])).rows[0]
  assert.equal(erasedPhoto.object_key,null,'R2 key is removed from database after deletion')
  assert.ok(erasedPhoto.deleted_at,'Deleted-at audit evidence preserved')

  // Separate delayed R2 failure must preserve DB reference for safe retry.
  const secondPhotoId=randomUUID(),secondObjectKey=`self-build/private/${photoDraftId}/${secondPhotoId}.webp`
  await control.query(`INSERT INTO self_build_draft_photos
    (id,draft_id,customer_account_id,object_key,image_bytes)
    VALUES($1::uuid,$2,$3,$4,281)`,[secondPhotoId,photoDraftId,otherAccount.id,secondObjectKey])
  const secondPhotoOrder=await makePhotoOrder(randomUUID())
  const secondPhotoOrderId=(await control.query(
    "SELECT id FROM orders WHERE public_id=$1",[secondPhotoOrder.orderId])).rows[0].id
  await control.query(`UPDATE orders SET status='delivered',
    payment_status='paid',delivered_at=now()-interval '49 hours' WHERE id=$1`,[secondPhotoOrderId])
  await assert.rejects(removeDeliveredSelfBuildOrderPhotos(control,async ()=>{throw Error('SIMULATED_R2_OUTAGE')}),/SIMULATED_R2_OUTAGE/)
  assert.equal((await control.query("SELECT COUNT(*)::int AS n FROM self_build_order_photos WHERE id=$1::uuid AND deleted_at IS NULL",
    [secondPhotoId])).rows[0].n,1,'R2 failure leaves metadata queued')
  assert.equal(await removeDeliveredSelfBuildOrderPhotos(control,mockRemove),1,'Storage recovery retries unfinished photo')
  assert.deepEqual(dryDeletes,[firstObjectKey,secondObjectKey])
  console.log('SELF_BUILD_DELIVERY_PHOTO_RETENTION_POSTGRES_PASSED: transfer ownership, missing photo rollback, shipping guard, 47h wait, 49h deletion, R2 retry, metadata scrub, and idempotency')

  // No provider checkout requests, phone numbers, private budgets or photos
  // are sent over the network in any of these local DB fixtures.
  // Payment reconciliation tests execute the ACTUAL settlement service against
  // disposable loopback Postgres: no gateway API calls or live customer orders.
  const settleTest = async (orderId,result) => {
    await control.query('BEGIN')
    try {
      const outcome = await settleStagedSelfBuildPaymentWithClient(control,{orderId,result})
      await control.query('COMMIT')
      return outcome
    } catch (error) {
      await control.query('ROLLBACK')
      throw error
    }
  }
  const attachSignedEventFixture = async (orderId, status, suffix) => {
    const providerOrderId = 'order_staging_'+suffix
    const eventId = 'evt_staging_'+suffix
    const providerPaymentId = 'pay_staging_'+suffix
    await control.query(`UPDATE orders SET
      payment_provider='razorpay',provider_order_id=$2,payment_status=$3
      WHERE id=$1`,[orderId,providerOrderId,status])
    await control.query(`INSERT INTO payment_attempts
      (id,order_id,attempt_no,provider,provider_order_id,provider_payment_id,status)
      VALUES ($1,$2,1,'razorpay',$3,$4,$5)`,
      [randomUUID(),orderId,providerOrderId,providerPaymentId,status])
    await control.query(`INSERT INTO payment_events
      (id,provider,provider_event_id,order_id,event_type,payload)
      VALUES ($1,'razorpay',$2,$3,$4,'{}'::jsonb)`,
      [randomUUID(),eventId,orderId,status==='paid'?'payment.captured':'payment.failed'])
    return {provider:'razorpay',providerOrderId,providerPaymentId,status,amountPaise:49900,
      eventId,eventType:status==='paid'?'payment.captured':'payment.failed',payload:{localFixture:true}}
  }

  // Curated hamster orders must never be interpreted as category reservations.
  const curatedInternalId=(await control.query('SELECT id FROM orders WHERE public_id=$1',[manualHamper.publicId])).rows[0].id
  assert.equal((await settleTest(curatedInternalId,{
    provider:'razorpay',providerOrderId:'unused',status:'pending',
    eventId:'unrecognized',eventType:'payment.pending',amountPaise:49900,payload:{}
  })).status,'not_self_build','Legacy curated checkout is not touched')

  const stageId=storedStaged.rows[0].id
  const paidSelfBuild=await attachSignedEventFixture(stageId,'paid','paid_one')
  await assert.rejects(settleTest(stageId,{...paidSelfBuild,eventId:'missing-event'}),
    /SELF_BUILD_PAYMENT_EVENT_NOT_RECORDED/)
  await assert.rejects(settleTest(stageId,{...paidSelfBuild,amountPaise:1}),
    /SELF_BUILD_PAYMENT_AMOUNT_MISMATCH/)
  const paidStockBefore=(await control.query(
    "SELECT available_units,reserved_units FROM self_build_category_capacity WHERE category_id='bangles'")).rows[0]
  assert.equal(paidStockBefore.available_units,2)
  assert.equal(paidStockBefore.reserved_units,1)
  const settled=await settleTest(stageId,paidSelfBuild)
  assert.deepEqual(settled,{status:'committed',changed:true})
  assert.deepEqual(await settleTest(stageId,paidSelfBuild),{status:'committed',changed:false},
    'Verified repeated webhook never double-consumes capacity')
  const postPaidStock=(await control.query(
    "SELECT available_units,reserved_units FROM self_build_category_capacity WHERE category_id='bangles'")).rows[0]
  assert.equal(postPaidStock.available_units,1)
  assert.equal(postPaidStock.reserved_units,0)

  // A real recorded current provider failure releases reserved capacity once.
  const failedKey=randomUUID()
  const failedOrder=await createStagedSelfBuildOrder({
    ...stagedInput,customerDetails:{...stagedInput.customerDetails,idempotencyKey:failedKey}
  })
  const failedId=(await control.query('SELECT id FROM orders WHERE public_id=$1',[failedOrder.orderId])).rows[0].id
  const failedSelfBuild=await attachSignedEventFixture(failedId,'failed','failed_one')
  const failedReleased=await settleTest(failedId,failedSelfBuild)
  assert.deepEqual(failedReleased,{status:'released',changed:true})
  assert.deepEqual(await settleTest(failedId,failedSelfBuild),{status:'released',changed:false},
    'Provider failure replay remains idempotently released')
  assert.equal((await control.query(
    "SELECT reserved_units FROM self_build_category_capacity WHERE category_id='bangles'")).rows[0].reserved_units,0)
  assert.deepEqual(await settleTest(failedId,{...failedSelfBuild,status:'paid'}),
    {status:'needs_manual_review',changed:false,code:'RESERVATION_ALREADY_RELEASED'},
    'Late paid callback after release requires reconciliation, never charge as delivered')

  // Paid-after-reservation-expiry must never consume inventory without fresh
  // verification. The hold stays visible for manual payment reconciliation.
  const expiredOrder=await createStagedSelfBuildOrder({
    ...stagedInput,customerDetails:{...stagedInput.customerDetails,idempotencyKey:randomUUID()}
  })
  const expiredId=(await control.query('SELECT id FROM orders WHERE public_id=$1',[expiredOrder.orderId])).rows[0].id
  const expiredPayment=await attachSignedEventFixture(expiredId,'paid','expired_one')
  await control.query("UPDATE self_build_order_reservation_batches SET expires_at=now()-interval '1 minute' WHERE order_id=$1",[expiredId])
  assert.deepEqual(await settleTest(expiredId,expiredPayment),
    {status:'needs_manual_review',changed:false,code:'PAID_AFTER_RESERVATION_EXPIRY'})
  assert.equal((await control.query("SELECT status FROM self_build_order_reservation_batches WHERE order_id=$1",[expiredId])).rows[0].status,'reserved')
  assert.equal((await control.query(
    "SELECT available_units,reserved_units FROM self_build_category_capacity WHERE category_id='bangles'")).rows[0].available_units,1)

  // New owner-requested category-only Self-Build mode: no stock ever changes.
  // The former capacity/reservation stage above remains untouched for legacy
  // test coverage; this new order path never calls that inventory code.
  const inventoryBefore=(await control.query(`
    SELECT category_id,available_units,reserved_units,verified
    FROM self_build_category_capacity ORDER BY category_id`)).rows
  const optionBefore=(await control.query(`
    SELECT option_id,available_units,reserved_units,verified
    FROM self_build_option_capacity ORDER BY option_id`)).rows
  // Owner private target: ₹499×80%=₹399.20, one final selection may
  // use the extra 5 percentage-point headroom (absolute ₹424.15 cap).
  // Count ALL units including repeats: maxChoices=3 for t499.
  await control.query(`UPDATE self_build_drafts SET selections=$2::jsonb WHERE id=$1`,
    [stagedDraftId,JSON.stringify([
      {kind:'category',id:'bangles',quantity:2},
      {kind:'option',id:'chocolate-extra-100',quantity:1}
    ])])
  const toleranceOrder=await createSelfBuildNoInventoryOrder({
    accountId:account.id,draftId:stagedDraftId,paymentProvider:'razorpay',
    customerDetails:{...body,idempotencyKey:randomUUID(),occasion:'Birthday'}
  })
  const allowed=(await control.query(`SELECT s.total_internal_budget_paise,s.tier_budget_paise
    FROM orders o JOIN self_build_order_snapshots s ON s.order_id=o.id
    WHERE o.public_id=$1`,[toleranceOrder.orderId])).rows[0]
  assert.equal(allowed.total_internal_budget_paise,40000,
    '₹400 private cost is just above the ₹399.20 target but within approved tolerance')
  assert.equal(allowed.tier_budget_paise,42415)
  await control.query(`UPDATE self_build_drafts SET selections=$2::jsonb WHERE id=$1`,
    [stagedDraftId,JSON.stringify([{kind:'category',id:'bangles',quantity:3}])])
  const overBudgetKey=randomUUID()
  await assert.rejects(createSelfBuildNoInventoryOrder({
    accountId:account.id,draftId:stagedDraftId,paymentProvider:'razorpay',
    customerDetails:{...body,idempotencyKey:overBudgetKey,occasion:'Birthday'}
  }),{code:'SELF_BUILD_PRIVATE_BUDGET_EXCEEDED'})
  assert.equal((await control.query('SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key=$1',
    [overBudgetKey])).rows[0].n,0,'Overbudget order rolls back entirely')
  await control.query(`UPDATE self_build_drafts SET selections=$2::jsonb WHERE id=$1`,
    [stagedDraftId,JSON.stringify([{kind:'category',id:'premium-necklaces',quantity:4}])])
  const overSlotsKey=randomUUID()
  await assert.rejects(createSelfBuildNoInventoryOrder({
    accountId:account.id,draftId:stagedDraftId,paymentProvider:'razorpay',
    customerDetails:{...body,idempotencyKey:overSlotsKey,occasion:'Birthday'}
  }),{code:'SELF_BUILD_MAX_ITEMS_EXCEEDED'})
  assert.equal((await control.query('SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key=$1',
    [overSlotsKey])).rows[0].n,0,'Repeated same category 4× cannot bypass 3 total tier slots')
  await control.query(`UPDATE self_build_drafts SET selections=$2::jsonb WHERE id=$1`,
    [stagedDraftId,JSON.stringify([{kind:'category',id:'bangles',quantity:1}])])
  const noStockKey=randomUUID()
  const noStockInput={
    accountId:account.id,draftId:stagedDraftId,paymentProvider:'razorpay',
    customerDetails:{...body,idempotencyKey:noStockKey,occasion:'Birthday'}
  }
  const noStockOrder=await createSelfBuildNoInventoryOrder(noStockInput)
  assert.equal(noStockOrder.created,true)
  assert.equal(noStockOrder.payablePaise,54900)
  const selfBuildCharge=(await control.query(
    'SELECT subtotal_paise,shipping_paise,amount_paise FROM orders WHERE public_id=$1',
    [noStockOrder.orderId])).rows[0]
  assert.equal(selfBuildCharge.subtotal_paise,49900)
  assert.equal(selfBuildCharge.shipping_paise,5000)
  assert.equal(selfBuildCharge.amount_paise,54900,
    'Self-Build payment must include ₹50 delivery without changing the hamper tier price')
  const noStockReplay=await createSelfBuildNoInventoryOrder(noStockInput)
  assert.equal(noStockReplay.created,false)
  assert.equal(noStockReplay.orderId,noStockOrder.orderId)
  const noStockInternal=(await control.query(`
    SELECT o.id,s.selections,s.total_internal_budget_paise,
      s.tier_budget_paise,s.other_request_text
    FROM orders o JOIN self_build_order_snapshots s ON s.order_id=o.id
    WHERE o.public_id=$1`,[noStockOrder.orderId])).rows[0]
  assert.equal(noStockInternal.total_internal_budget_paise,15000)
  assert.equal(noStockInternal.tier_budget_paise,42415,
    '₹499 Self-Build checkout maximum is 85% including 5 percentage points of flexibility; primary target is 80%')
  assert.equal(noStockInternal.selections[0].id,'bangles')
  assert.equal((await control.query(`
    SELECT COUNT(*)::int AS n FROM self_build_order_reservation_batches
    WHERE order_id=$1`,[noStockInternal.id])).rows[0].n,0,
    'No inventory/category reservation rows created')
  assert.deepEqual((await control.query(`
    SELECT category_id,available_units,reserved_units,verified
    FROM self_build_category_capacity ORDER BY category_id`)).rows,inventoryBefore,
    'No category inventory read-write change')
  assert.deepEqual((await control.query(`
    SELECT option_id,available_units,reserved_units,verified
    FROM self_build_option_capacity ORDER BY option_id`)).rows,optionBefore,
    'No option inventory changes')
  await assert.rejects(createSelfBuildNoInventoryOrder({...noStockInput,accountId:otherAccount.id}),
    {code:'SELF_BUILD_DRAFT_NOT_FOUND'})
  await control.query("UPDATE self_build_drafts SET other_request_text='Modified after purchase' WHERE id=$1",[stagedDraftId])
  await assert.rejects(createSelfBuildNoInventoryOrder(noStockInput),
    {code:'SELF_BUILD_IDEMPOTENCY_PAYLOAD_MISMATCH'})
  await control.query("UPDATE self_build_drafts SET other_request_text='Wrap it carefully' WHERE id=$1",[stagedDraftId])
  await control.query("UPDATE self_build_configuration SET customer_enabled=false WHERE id='primary'")
  await assert.rejects(createSelfBuildNoInventoryOrder({...noStockInput,
    customerDetails:{...body,idempotencyKey:randomUUID(),occasion:'Birthday'}}),
    {code:'SELF_BUILD_NOT_LIVE'})
  await control.query("UPDATE self_build_configuration SET customer_enabled=true WHERE id='primary'")

  // Exercise EXISTING signed-provider persistence and callbacks against
  // this REAL no-stock Self-Build mode, never the old stock-reservation code.
  // This uses locally synthesized verified gateway event fixtures ONLY.
  const paymentStockSnapshot = (await control.query(`
    SELECT category_id,available_units,reserved_units,verified
    FROM self_build_category_capacity ORDER BY category_id`)).rows
  const providerNoStockOrder=await createSelfBuildNoInventoryOrder({
    ...noStockInput,customerDetails:{...body,idempotencyKey:randomUUID(),occasion:'Birthday'}
  })
  const newAttempt=await reservePaymentAttempt(providerNoStockOrder.orderId,account.id,'razorpay')
  assert.equal(newAttempt.attemptNo,1)
  await bindPaymentAttempt(newAttempt.attemptId,{
    provider:'razorpay',mode:'test',providerOrderId:'order_no_stock_paid',
    keyId:'rzp_test_fixture',amountPaise:providerNoStockOrder.payablePaise,currency:'INR'
  })
  const signedPaymentFixture={
    ...providerResult,providerOrderId:'order_no_stock_paid',
    providerPaymentId:'pay_no_stock_paid',amountPaise:providerNoStockOrder.payablePaise,
    eventId:'evt_no_stock_paid'
  }
  await assert.rejects(applyProviderPaymentResult({...signedPaymentFixture,amountPaise:1}),
    /PAYMENT_AMOUNT_MISMATCH/,'Wrong gateway charge must be rejected')
  await applyProviderPaymentResult(signedPaymentFixture)
  await applyProviderPaymentResult(signedPaymentFixture)
  const livePaid=await getPaymentOrder(providerNoStockOrder.orderId,account.id)
  assert.equal(livePaid.paymentStatus,'paid')
  assert.equal(livePaid.status,'payment_verified')
  const currentEventCount=await control.query(`
    SELECT COUNT(*)::int AS n FROM payment_events
    WHERE provider_event_id='evt_no_stock_paid'`)
  assert.equal(currentEventCount.rows[0].n,1,'Provider replay cannot duplicate paid records')
  assert.deepEqual((await control.query(`
    SELECT category_id,available_units,reserved_units,verified
    FROM self_build_category_capacity ORDER BY category_id`)).rows,paymentStockSnapshot,
    'Self-Build payment must NEVER touch category inventory/capacity')
  const noStockFailed=await createSelfBuildNoInventoryOrder({
    ...noStockInput,customerDetails:{...body,idempotencyKey:randomUUID(),occasion:'Birthday'}
  })
  const failedAttempt=await reservePaymentAttempt(noStockFailed.orderId,account.id,'razorpay')
  await bindPaymentAttempt(failedAttempt.attemptId,{
    provider:'razorpay',mode:'test',providerOrderId:'order_no_stock_failed',
    keyId:'rzp_test_fixture',amountPaise:noStockFailed.payablePaise,currency:'INR'
  })
  const failedPaymentFixture={
    ...providerResult,providerOrderId:'order_no_stock_failed',
    providerPaymentId:null,status:'failed',amountPaise:noStockFailed.payablePaise,
    eventId:'evt_no_stock_failed',eventType:'payment.failed'
  }
  await applyProviderPaymentResult(failedPaymentFixture)
  await applyProviderPaymentResult(failedPaymentFixture)
  assert.equal((await getPaymentOrder(noStockFailed.orderId,account.id)).paymentStatus,'failed')
  const recoveryAttempt=await reservePaymentAttempt(noStockFailed.orderId,account.id,'razorpay')
  assert.equal(recoveryAttempt.attemptNo,2,'Buyer can retry same failed Self-Build order')
  assert.deepEqual((await control.query(`
    SELECT category_id,available_units,reserved_units,verified
    FROM self_build_category_capacity ORDER BY category_id`)).rows,paymentStockSnapshot,
    'Failed payment and retry must never change inventory')

  // Real Cashfree merchant Sandbox separately confirmed: paid, failed,
  // and failed -> paid on the SAME gateway order. This isolated PostgreSQL
  // contract checks the WEBSITE's persisted retry, callback replay and
  // no-inventory invariants using synthetic Cashfree event fixtures.
  const cfOrder=await createSelfBuildNoInventoryOrder({
    ...noStockInput,customerDetails:{...body,idempotencyKey:randomUUID(),occasion:'Birthday'}
  })
  assert.equal(cfOrder.payablePaise,54900,'Cashfree Self-Build ₹499 + ₹50 must remain ₹549')
  const cfFirst=await reservePaymentAttempt(cfOrder.orderId,account.id,'cashfree')
  assert.equal(cfFirst.attemptNo,1)
  await bindPaymentAttempt(cfFirst.attemptId,{
    provider:'cashfree',mode:'test',providerOrderId:'sbqa_pg_cf_first',
    paymentSessionId:'session_pg_cf_first',amountPaise:cfOrder.payablePaise,currency:'INR'
  })
  const cfFailed={
    provider:'cashfree',providerOrderId:'sbqa_pg_cf_first',
    providerPaymentId:'cf_fixture_failed',status:'failed',
    amountPaise:cfOrder.payablePaise,eventId:'PAYMENT_FAILED_WEBHOOK:cf_fixture_failed',
    eventType:'PAYMENT_FAILED_WEBHOOK',payload:{testFixture:true}
  }
  await assert.rejects(applyProviderPaymentResult({...cfFailed,amountPaise:49900}),
    /PAYMENT_AMOUNT_MISMATCH/,'Cashfree amount excluding shipping MUST NOT settle')
  await applyProviderPaymentResult(cfFailed)
  await applyProviderPaymentResult(cfFailed)
  assert.equal((await getPaymentOrder(cfOrder.orderId,account.id)).paymentStatus,'failed',
    'Cashfree signed failure must leave Self-Build unpaid')
  const cfSecond=await reservePaymentAttempt(cfOrder.orderId,account.id,'cashfree')
  assert.equal(cfSecond.attemptNo,2,'Cashfree retry creates a second attempt on same WEBSITE order')
  await bindPaymentAttempt(cfSecond.attemptId,{
    provider:'cashfree',mode:'test',providerOrderId:'sbqa_pg_cf_retry',
    paymentSessionId:'session_pg_cf_retry',amountPaise:cfOrder.payablePaise,currency:'INR'
  })
  const cfSuccess={
    ...cfFailed,providerOrderId:'sbqa_pg_cf_retry',providerPaymentId:'cf_fixture_success',
    status:'paid',eventId:'PAYMENT_SUCCESS_WEBHOOK:cf_fixture_success',
    eventType:'PAYMENT_SUCCESS_WEBHOOK'
  }
  await applyProviderPaymentResult(cfSuccess)
  await applyProviderPaymentResult(cfSuccess)
  // Delayed duplicate failure from attempt 1 must never undo attempt 2 success.
  await applyProviderPaymentResult({...cfFailed,
    eventId:'PAYMENT_FAILED_WEBHOOK:cf_fixture_failed_delayed'})
  const cfSettled=await getPaymentOrder(cfOrder.orderId,account.id)
  assert.equal(cfSettled.paymentStatus,'paid','Delayed failed Cashfree webhook downgraded paid order')
  assert.equal(cfSettled.status,'payment_verified','Cashfree success did not verify Self-Build order')
  assert.equal(cfSettled.paymentAttemptCount,2,'Unexpected extra Cashfree payment attempt')
  const cfDbEvents=await control.query(`
    SELECT provider_event_id,COUNT(*)::int AS n FROM payment_events
    WHERE provider='cashfree' AND provider_event_id IN
      ('PAYMENT_FAILED_WEBHOOK:cf_fixture_failed',
       'PAYMENT_SUCCESS_WEBHOOK:cf_fixture_success',
       'PAYMENT_FAILED_WEBHOOK:cf_fixture_failed_delayed')
    GROUP BY provider_event_id`)
  assert.equal(cfDbEvents.rows.length,3,'Cashfree payment event records missing')
  assert.ok(cfDbEvents.rows.every(event=>event.n===1),
    'Cashfree webhook replay wrote duplicate provider event')
  const cfAttempts=await control.query(`
    SELECT attempt_no,provider,provider_order_id,status FROM payment_attempts
    WHERE order_id=(SELECT id FROM orders WHERE public_id=$1) ORDER BY attempt_no`,[cfOrder.orderId])
  assert.equal(cfAttempts.rows.length,2,'Payment retry duplicated the WEBSITE order attempt')
  assert.equal(cfAttempts.rows[0].status,'failed')
  assert.equal(cfAttempts.rows[1].status,'paid')
  assert.deepEqual((await control.query(`
    SELECT category_id,available_units,reserved_units,verified
    FROM self_build_category_capacity ORDER BY category_id`)).rows,paymentStockSnapshot,
    'Cashfree Self-Build retry/replay must NEVER change category inventory')
  console.log('CASHFREE_SELF_BUILD_ISOLATED_POSTGRES_PASSED: ₹549, mismatch rejected, failure, retry, paid, signed-provider event replay and stale failure preserved paid without inventory writes')

  console.log('SELF_BUILD_NO_STOCK_PROVIDER_POSTGRES_PASSED: verified paid, replay, bad amount, failed payment and same-order retry with zero inventory writes')

  // Live money transfer is never simulated; tests only validate a durable
  // reconciliation queue on the isolated database's payment/status rows.
  await control.query("UPDATE orders SET payment_status='paid' WHERE id=$1",[noStockInternal.id])
  await control.query("UPDATE orders SET status='cancelled' WHERE id=$1",[noStockInternal.id])
  const reviews=await listSelfBuildPaymentReviews()
  assert.equal(reviews.filter(x=>x.publicOrderId===noStockOrder.orderId&&
    x.reason==='PAID_ORDER_CANCELLED').length,1,
    'Paid cancellation must create one manual refund review')
  await control.query("UPDATE orders SET status='cancelled' WHERE id=$1",[noStockInternal.id])
  assert.equal((await control.query("SELECT COUNT(*)::int AS n FROM self_build_payment_reviews WHERE order_id=$1",
    [noStockInternal.id])).rows[0].n,1,'Identical events cannot create duplicate refund tasks')
  await assert.rejects(documentSelfBuildRefundReference({
    publicOrderId:noStockOrder.orderId,reason:'PAID_ORDER_CANCELLED',
    externalReference:'bad',note:'done'
  }),/INVALID_REFUND_DOCUMENTATION/)
  assert.deepEqual(await documentSelfBuildRefundReference({
    publicOrderId:noStockOrder.orderId,reason:'PAID_ORDER_CANCELLED',
    externalReference:'refund_TEST_2026',note:'Verified manually in gateway panel'
  }),{documented:true})
  assert.equal((await control.query("SELECT payment_status FROM orders WHERE id=$1",
    [noStockInternal.id])).rows[0].payment_status,'paid',
    'Documenting a reference does not fake a gateway refund or change money state')

  const late=await createSelfBuildNoInventoryOrder({...noStockInput,
    customerDetails:{...body,idempotencyKey:randomUUID(),occasion:'Birthday'}})
  const lateId=(await control.query("SELECT id FROM orders WHERE public_id=$1",[late.orderId])).rows[0].id
  await control.query("UPDATE orders SET status='cancelled' WHERE id=$1",[lateId])
  await control.query("UPDATE orders SET payment_status='paid' WHERE id=$1",[lateId])
  assert.equal((await control.query(`
    SELECT COUNT(*)::int AS n FROM self_build_payment_reviews
    WHERE order_id=$1 AND reason='LATE_PAYMENT_AFTER_CANCELLATION'`,
    [lateId])).rows[0].n,1,'Paid after cancellation needs separate gateway reconciliation')
  assert.equal((await control.query(`
    SELECT COUNT(*)::int AS n FROM self_build_order_reservation_batches
    WHERE order_id IN ($1,$2)`,[noStockInternal.id,lateId])).rows[0].n,0)
  console.log('SELF_BUILD_NO_INVENTORY_CHECKOUT_POSTGRES_PASSED: no capacity/stock changes, category-only trusted price, idempotency, own draft, altered draft rejection, hard customer gate, cancelled paid review, late paid review, manual reference without auto refund')

  console.log('SELF_BUILD_PAYMENT_SETTLEMENT_POSTGRES_PASSED: provider-event required, price verified, atomic commit, duplicate paid replay, current failed release, duplicate failed replay, late paid needs review, expired paid freeze, curated isolation')
  console.log('SELF_BUILD_ATOMIC_ORDER_POSTGRES_PASSED: disabled production gate, buyer ownership, order+capacity+Telegram atomicity, price, idempotency, no SKU mapping, insufficient-stock rollback, curated-key collision and private photo order ownership')

  console.log('TELEGRAM_POSTGRES_CHECKS_PASSED: payment, owner reply, customer chat, durable owner outbox, idempotency, A/B isolation and read receipts')
  console.log('REAL_POSTGRES_CHECKS_PASSED: migrations001..009, legacyhamper, individualsnapshot, staleprice, pausedavailability, samecartretry, changedcartreject, ownermismatch, concurrentidempotency, catalogpublishlock, individualmanualrejected, hampermanualpreserved, customer/admin/trackingreads, provideramountmismatch, duplicatepaidwebhook, verifiedpaymentpreserved, cancelledretryblocked, cancelledbindingrace, confirmedbindingrace, DBconstraints')
} finally { await control.end() }
} finally {
  assert.equal(dirname(output), repo)
  assert.ok(basename(output).startsWith('.order-test-'))
  await rm(output, { recursive: true, force: true })
}
process.exit(0)

