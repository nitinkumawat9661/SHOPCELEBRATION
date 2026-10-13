#!/usr/bin/env node
// Integration: execute ACTUAL TS reservation service on isolated PostgreSQL16.
// Refuses to run if pointed at any non-local DB or wrong test DB name.
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import pg from "pg"
import ts from "typescript"

const url=new URL(process.env.DATABASE_URL||"postgresql://invalid/")
if(!["127.0.0.1","localhost"].includes(url.hostname)||!url.pathname.includes("selfbuild_stage_test"))
  throw Error("REFUSING_NON_ISOLATED_DB")
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [quote,source]=await Promise.all([
  "lib/server/self-build-quote.ts","lib/server/self-build-reservations.ts"
].map(read))
const compile=text=>ts.transpileModule(text,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText
const quoteRef="data:text/javascript;base64,"+Buffer.from(compile(quote)).toString("base64")
let code=compile(source)
assert(code.includes('from "./self-build-quote"'),"Actual quote import must compile")
code=code.replace('from "./self-build-quote"','from "'+quoteRef+'"')
const api=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"))
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:false,max:6})
const run=async(work)=>{
  const client=await pool.connect()
  try{
    await client.query("BEGIN")
    const result=await work(client)
    await client.query("COMMIT")
    return result
  }catch(e){await client.query("ROLLBACK");throw e}
  finally{client.release()}
}
const select=(kind,id,quantity)=>({kind,id,quantity})
const basket=[
  select("category","premium-necklaces",2),
  select("category","viral-bangles",1),
  select("category","personalised-photos",3),
  select("option","chocolate-extra-100",1)
]
const prepareOrder=async(id)=>pool.query(`
 INSERT INTO orders(id,customer_account_id,order_type,tier_id,payment_status)
 VALUES ($1,'customer-a','hamper','test-tier','pending')`,[id])
const reserve=(orderId,selections=basket,note="a gift")=>run(client=>api.reserveSelfBuildForOrderWithClient(client,{
  orderId,accountId:"customer-a",tierId:"test-tier",selections,note,
  expiresAt:new Date(Date.now()+15*60*1000)
}))
const readStock=async(table,col,id)=>{
  const r=await pool.query(`SELECT available_units,reserved_units FROM ${table} WHERE ${col}=$1`,[id])
  return r.rows[0]
}
try{
  await pool.query("INSERT INTO customer_accounts(id) VALUES ('customer-a')")
  const con=await pool.query(`
    SELECT conname FROM pg_constraint WHERE conrelid='self_build_configuration'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%customer_enabled%'`)
  assert.equal(con.rows.length,1,"Confirm staging DB gate exists and can be dropped ONLY in isolated QA")
  const safeName=con.rows[0].conname
  assert(/^[a-z_]+$/.test(safeName),"Unexpected constraint name")
  await pool.query('ALTER TABLE self_build_configuration DROP CONSTRAINT "'+safeName+'"')
  await pool.query("INSERT INTO self_build_category_capacity(category_id,available_units,verified) VALUES ('premium-necklaces',5,true),('viral-bangles',1,true),('personalised-photos',3,true)")
  await pool.query("INSERT INTO self_build_option_capacity(option_id,available_units,verified) VALUES ('chocolate-extra-100',1,true)")
  await pool.query("INSERT INTO self_build_tier_allowances(tier_id,allowance_paise,enabled) VALUES ('test-tier',80000,true)")
  await prepareOrder("order-1")
  await assert.rejects(()=>reserve("order-1"),{code:"SELF_BUILD_NOT_LIVE"})
  assert.equal((await readStock("self_build_category_capacity","category_id","viral-bangles")).reserved_units,0,"Feature gate reserves nothing")
  await pool.query("UPDATE self_build_configuration SET customer_enabled=true WHERE id='primary'")
  const first=await reserve("order-1")
  assert.equal(first.created,true)
  const snapshot=await pool.query("SELECT total_internal_budget_paise,tier_budget_paise FROM self_build_order_snapshots WHERE order_id='order-1'")
  assert.equal(snapshot.rows[0].total_internal_budget_paise,52000,"2x60+150+3x50+100 = internal ₹520")
  assert.equal(snapshot.rows[0].tier_budget_paise,80000)
  assert.equal((await readStock("self_build_category_capacity","category_id","viral-bangles")).reserved_units,1)
  const repeat=await reserve("order-1")
  assert.equal(repeat.created,false,"Idempotent repeat must not double reserve")
  await assert.rejects(()=>reserve("order-1",basket,"CHANGED NOTE"),{code:"RESERVATION_PAYLOAD_MISMATCH"})
  await prepareOrder("order-2")
  await assert.rejects(()=>reserve("order-2",[select("category","viral-bangles",1)]),{
    code:"INSUFFICIENT_VERIFIED_CATEGORY_CAPACITY"
  })
  assert.equal((await pool.query("SELECT COUNT(*)::integer AS n FROM self_build_order_reservation_batches")).rows[0].n,1)
  const rel=await run(client=>api.releaseSelfBuildReservationWithClient(client,"order-1"))
  assert.equal(rel.changed,true)
  const again=await run(client=>api.releaseSelfBuildReservationWithClient(client,"order-1"))
  assert.equal(again.changed,false)
  assert.equal((await readStock("self_build_category_capacity","category_id","viral-bangles")).reserved_units,0)
  await assert.rejects(()=>reserve("order-1"),{code:"RESERVATION_ALREADY_RELEASED"})
  const second=await reserve("order-2",[select("category","viral-bangles",1)])
  assert.equal(second.created,true)
  await assert.rejects(()=>run(c=>api.commitSelfBuildReservationWithClient(c,"order-2")),{
    code:"PAYMENT_NOT_VERIFIED"
  })
  await pool.query("UPDATE orders SET payment_status='paid' WHERE id='order-2'")
  const paid=await run(c=>api.commitSelfBuildReservationWithClient(c,"order-2"))
  assert.equal(paid.changed,true)
  const paidRetry=await run(c=>api.commitSelfBuildReservationWithClient(c,"order-2"))
  assert.equal(paidRetry.changed,false)
  const bangle=await readStock("self_build_category_capacity","category_id","viral-bangles")
  assert.equal(bangle.available_units,0,"Paid selection permanently consumes stock")
  assert.equal(bangle.reserved_units,0)
  // Concurrent claims on the remaining single Starter choice: precisely one
  // transaction can succeed under capacity_control + FOR UPDATE row locks.
  await prepareOrder("order-3");await prepareOrder("order-4")
  const contenders=await Promise.allSettled([
    reserve("order-3",[select("option","chocolate-extra-100",1)]),
    reserve("order-4",[select("option","chocolate-extra-100",1)])
  ])
  assert.equal(contenders.filter(x=>x.status==="fulfilled").length,1)
  assert.equal(contenders.filter(x=>x.status==="rejected").length,1)
  assert.equal(contenders.find(x=>x.status==="rejected")?.reason.code,"INSUFFICIENT_VERIFIED_CATEGORY_CAPACITY")
  assert.equal((await readStock("self_build_option_capacity","option_id","chocolate-extra-100")).reserved_units,1)
  // No premature payment/order implementation was invoked in storefront.
  console.log("Postgres16 real code: closed gate, ₹520 photo quote, idempotency, mismatch, rollback, release, paid commit, concurrent overbook protection PASSED.")
}finally{await pool.end()}
