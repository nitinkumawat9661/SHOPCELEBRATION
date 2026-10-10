import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { TrustStrip } from "../../features/shell/TrustStrip"

export const metadata: Metadata = {
  title: "Our Story",
  description: "Celebration began in Sikar, Rajasthan, with a simple idea: make gifting personal, affordable and full of feeling. Discover the story behind our jewelry and custom gift hampers.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    title: "Our Story | Celebration",
    description: "Mharo Surprise, Thari Smile. A small surprise can mean so much.",
    url: "/about"
  }
}

const promises = [
  {
    number: "01",
    title: "Thoughtful over expensive",
    description: "A meaningful gift is remembered for the thought behind it, not its price."
  },
  {
    number: "02",
    title: "Made to feel personal",
    description: "Every relationship is different. A gift should feel right for the person and your budget."
  },
  {
    number: "03",
    title: "Clear & honest process",
    description: "No exaggerated promises. Just a clear, straightforward experience, from choosing a gift to placing your order."
  }
] as const

export default function OurStoryPage() {
  return (
    <main className="ourStoryPage" id="main-content">
      <TrustStrip />
      <SiteHeader />

      <header className="ourStoryHero" aria-labelledby="our-story-title">
        <div className="wrap ourStoryHeroInner">
          <nav className="ourStoryBreadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Our Story</span></nav>
          <div className="ourStoryHeroCopy">
            <span className="ourStoryEyebrow">THE HEART BEHIND OUR GIFTS</span>
            <h1 id="our-story-title">Our <em>Story</em></h1>
            <p className="ourStoryBrand">Celebration</p>
            <p className="ourStoryTagline">Mharo Surprise, Thari Smile</p>
          </div>
          <div className="ourStoryHeroMark" aria-hidden="true"><span>♡</span></div>
          <div className="ourStoryHeroFoot"><span>Gifts worth feeling</span><span>Sikar, Rajasthan</span></div>
        </div>
      </header>

      <section className="ourStoryNarrative" aria-label="The Celebration story">
        <div className="wrap ourStoryNarrativeLayout">
          <div className="ourStoryMarginNote" aria-hidden="true"><span>01 / OUR BEGINNING</span><i /></div>
          <div className="ourStoryProse">
            <p className="ourStoryOpening">We started Celebration with one simple thought:</p>
            <p>A gift is more than an object. It is a feeling.<br />A little surprise that puts a smile on someone's face.</p>
            <div className="ourStoryDivider" aria-hidden="true"><span>✧</span></div>
            <p>Celebration began in Sikar, Rajasthan.</p>
            <p>We noticed how difficult it could be to find the right gift. Some options were too expensive, while others were affordable but felt impersonal.<br />We wanted a middle ground: something lovely, affordable, and chosen with heart.</p>
            <p>We offer anti-tarnish jewelry because we want a gift to keep looking beautiful for longer.<br />We create custom gift hampers because every relationship is different, and so is every budget.</p>
            <p className="ourStoryClosing">Our promise goes beyond selling products.<br /><strong>It is about a little thought and a lot of love.</strong></p>
          </div>
        </div>
      </section>

      <section className="ourStoryValues" aria-labelledby="our-story-values-title">
        <div className="wrap">
          <div className="ourStorySectionHeading"><span className="ourStoryEyebrow">WHAT MATTERS TO US</span><h2 id="our-story-values-title">The little things matter.</h2></div>
          <div className="ourStoryValuesGrid">
            {promises.map((promise) => (
              <article className="ourStoryValue" key={promise.number}>
                <span className="ourStoryValueNumber" aria-hidden="true">{promise.number}</span>
                <h3>{promise.title}</h3>
                <p>{promise.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ourStoryNote" aria-labelledby="our-story-note-title">
        <div className="wrap ourStoryNoteInner">
          <span className="ourStoryEyebrow">A NOTE FROM US</span>
          <h2 id="our-story-note-title">The person behind every order matters.</h2>
          <blockquote>“Behind every order is a real person we hope to make happy. That is what inspires us.”</blockquote>
          <p>— Team Celebration</p>
        </div>
      </section>

      <section className="ourStoryExplore" aria-labelledby="our-story-explore-title">
        <div className="wrap ourStoryExploreInner">
          <div><span className="ourStoryEyebrow">A LITTLE SURPRISE GOES A LONG WAY</span><h2 id="our-story-explore-title">Be part of someone's smile.</h2></div>
          <div className="ourStoryActions">
            <Link className="ourStoryPrimaryAction" href="/jewelry">Explore our collection <span aria-hidden="true">↗</span></Link>
            <Link className="ourStorySecondaryAction" href="/#budgets">Build a hamper <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
