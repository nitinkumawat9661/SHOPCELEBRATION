#!/usr/bin/env node
// Read-only Chromium test: intercepts customer account and message APIs.
// No real login, order creation, payment, customer data or Telegram writes.
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright-core"
const base = (process.env.BASE_URL || "https://shopcelebration.in").replace(/\/$/, "")
const binary = [process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(x=>x&&existsSync(x))
if (!binary) throw Error("Chromium executable not found")
const browser=await chromium.launch({headless:true,executablePath:binary,args:["--no-sandbox","--disable-dev-shm-usage"]})
const root="artifacts/telegram-inbox"
await mkdir(root,{recursive:true})
const time="2026-10-13T07:30:00Z"
const conversations={
  A:[{id:"support-1",sender:"celebration_support",body:"Your bracelet is being packed.",sentAt:time,readAt:null}],
  B:[{id:"support-2",sender:"celebration_support",body:"Your own order is confirmed.",sentAt:time,readAt:null}]
}
const response=(data,status=200)=>({status,contentType:"application/json",headers:{"Cache-Control":"private, no-store"},body:JSON.stringify(data)})
async function mockDevice(width,who){
  const context=await browser.newContext({viewport:{width,height:820},deviceScaleFactor:1})
  const orderId="CEL-DEMO-"+who
  let unread=1
  await context.route("**/api/account/me",route=>route.fulfill(response({ok:true,account:{id:"demo-"+who,displayName:"Browser QA",phoneVerified:true}})))
  await context.route("**/api/account/orders/message-unread",route=>route.fulfill(response({ok:true,unread:unread?[{publicId:orderId,unreadCount:unread}]:[]})))
  await context.route("**/api/account/notifications",route=>route.fulfill(response({ok:true,threads:[{
    orderId,title:"Premium Jewelry",orderType:"individual",createdAt:time,
    unreadCount:unread,lastBody:conversations[who].at(-1)?.body||null,
    lastSender:conversations[who].at(-1)?.sender||null,lastAt:time
  }]})))
  await context.route("**/api/account/orders/*/messages*",async route=>{
    const path=new URL(route.request().url()).pathname
    if(!path.includes(orderId))return route.fulfill(response({ok:false,error:"ORDER_NOT_FOUND"},404))
    if(path.endsWith("/send")){
      const body=route.request().postDataJSON()
      const message={id:body.requestId,sender:"customer",body:body.text,sentAt:time,readAt:null}
      conversations[who].push(message)
      return route.fulfill(response({ok:true,message}))
    }
    if(route.request().method()==="POST"){unread=0;return route.fulfill(response({ok:true,acknowledged:1}))}
    return route.fulfill(response({ok:true,orderId,messages:conversations[who],unreadCount:unread}))
  })
  await context.route("**/api/**",async route=>{
    const m=route.request().method()
    if(m!=="GET"&&m!=="HEAD")return route.abort("blockedbyclient")
    return route.continue()
  })
  return {context,orderId,page:await context.newPage()}
}
try{
  for(const width of [320,390,768,1280]){
    const {context,page}=await mockDevice(width,"A")
    await page.goto(base+"/notifications",{waitUntil:"domcontentloaded",timeout:30000})
    await page.locator(".notificationBubble.fromCelebration").first().waitFor({timeout:20000})
    assert(await page.getByText("Your bracelet is being packed.").count()>=1,"Owner message visible")
    assert.equal(await page.locator(".notificationBubble.fromCustomer").count(),0)
    const icon=page.locator(".celebrationNotificationLink")
    const cart=page.locator(".celebrationCartLink")
    const a=await icon.boundingBox(),b=await cart.boundingBox()
    assert(a&&b&&a.x+a.width<=b.x+4,"Notification bell sits immediately left of cart")
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)
    assert.equal(overflow,false,"No page horizontal overflow at "+width)
    await page.screenshot({path:`${root}/inbox-${width}.png`,fullPage:true})
    if(width===390){
      await page.locator(".notificationComposer textarea").fill("Where is my parcel?")
      await page.getByRole("button",{name:"Send message"}).click()
      await page.getByText("Where is my parcel?").waitFor({timeout:10000})
      assert.equal(await page.locator(".notificationBubble.fromCustomer").count(),1,"Chat composer sends buyer message")
      await page.screenshot({path:`${root}/inbox-chat-390.png`,fullPage:true})
    }
    await context.close()
    console.log("INBOX_BROWSER_PASS",width)
  }
  const {context,page}=await mockDevice(390,"B")
  await page.goto(base+"/notifications",{waitUntil:"domcontentloaded"})
  await page.getByText("Your own order is confirmed.").waitFor({timeout:15000})
  assert.equal(await page.getByText("Your bracelet is being packed.").count(),0,"Buyer B cannot view A mock conversation")
  await context.close()
  console.log("TELEGRAM_NOTIFICATION_INBOX_BROWSER_QA_PASSED")
}finally{await browser.close()}
