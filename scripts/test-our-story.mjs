import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [page, styles, globals, plan, footer, routes, sitemap] = await Promise.all([
  read("app/about/page.tsx"),
  read("styles/our-story.css"),
  read("app/globals.css"),
  read("docs/WEBSITE_FINAL_IMPROVEMENT_PLAN.md"),
  read("features/shell/SiteFooter.tsx"),
  read("config/routes.ts"),
  read("app/sitemap.ts")
])
const storyStart = plan.indexOf("## 4. About Us / Our Story")
const storyEnd = plan.indexOf("## 5. How to Style / How to Wear", storyStart)
assert(storyStart >= 0 && storyEnd > storyStart, "Follow the original Section 4 plan")
const section4 = plan.slice(storyStart, storyEnd)
const sourceHindi = [
  "हमने Celebration की शुरुआत एक साधारण विचार से की थी",
  "Celebration Sikar, Rajasthan से शुरू हुआ।",
  "हमारा वादा है — थोड़ी सी सोच, बहुत सारा प्यार।",
  "हर ऑर्डर के पीछे एक असली व्यक्ति होता है जिसे हम खुश करना चाहते हैं। यही हमारी असली प्रेरणा है।"
]
for (const value of sourceHindi) {
  assert(section4.includes(value), `Original owner-provided copy missing in plan: ${value}`)
}
const translated = [
  "Mharo Surprise, Thari Smile",
  "We started Celebration with one simple thought:",
  "A gift is more than an object. It is a feeling.",
  "Celebration began in Sikar, Rajasthan.",
  "something lovely, affordable, and chosen with heart.",
  "We offer anti-tarnish jewelry",
  "We create custom gift hampers",
  "It is about a little thought and a lot of love.",
  "Thoughtful over expensive",
  "Made to feel personal",
  "Clear & honest process",
  "Behind every order is a real person we hope to make happy.",
  "Team Celebration",
  "Be part of someone's smile.",
  "Explore our collection",
  "Build a hamper"
]
for (const value of translated) {
  assert(page.includes(value), `English story copy missing from page: ${value}`)
}
assert(!/[\u0900-\u097f]/u.test(page), "Our Story page must have English text, not Hindi")
assert(page.includes('title: "Our Story"'), "Use exact Our Story page title")
assert(page.includes('alternates: { canonical: "/about" }'), "Page canonical is missing")
assert(page.includes('href="/jewelry"'), "Collection CTA must link to live jewelry collection")
assert(page.includes('href="/#budgets"'), "Hamper CTA must link to live builder entry")
assert(page.includes("<SiteHeader />") && page.includes("<SiteFooter />"), "Reuse store navigation and footer")
assert(!page.includes('lang="hi"'), "English narrative must not declare Hindi")
assert(!page.includes("Lorem ipsum") && !page.includes("Founder Name"), "Do not invent a founder or use placeholder copy")
assert(styles.includes("@media(max-width:600px)") && styles.includes(".ourStoryValue"), "Provide responsive value cards")
assert(globals.includes('our-story.css'), "Story stylesheet missing from global imports")
assert(footer.includes('href={routes.about}'), "Story must be discoverable from site footer")
assert(routes.includes('about: "/about"'), "About route must be centralized")
assert(sitemap.includes('`${base}/about`'), "About page must be in site sitemap")
console.log("Our Story checks passed: English narrative, preserved original Hindi in plan, brand line, cards, team note, links, metadata and mobile CSS.")
