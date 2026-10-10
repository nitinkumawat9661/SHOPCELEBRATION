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
    description: "एक अच्छा उपहार उसकी कीमत से नहीं, उसके पीछे की सोच से याद रहता है।"
  },
  {
    number: "02",
    title: "Made to feel personal",
    description: "हर रिश्ता अलग है। इसलिए आपके बजट और उस खास व्यक्ति की पसंद की जगह भी होनी चाहिए।"
  },
  {
    number: "03",
    title: "Clear & honest process",
    description: "बिना बनावटी वादों के—चुनने से लेकर ऑर्डर तक, बात साफ और सीधी।"
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

      <section className="ourStoryNarrative" aria-label="The Celebration story" lang="hi">
        <div className="wrap ourStoryNarrativeLayout">
          <div className="ourStoryMarginNote" aria-hidden="true"><span>01 / OUR BEGINNING</span><i /></div>
          <div className="ourStoryProse">
            <p className="ourStoryOpening">हमने Celebration की शुरुआत एक साधारण विचार से की थी —</p>
            <p>कि उपहार सिर्फ एक चीज़ नहीं होता। वो एक भावना होती है।<br />एक छोटी सी सरप्राइज, जो किसी के चेहरे पर मुस्कान ला दे।</p>
            <div className="ourStoryDivider" aria-hidden="true"><span>✧</span></div>
            <p>Celebration Sikar, Rajasthan से शुरू हुआ।</p>
            <p>हमने देखा कि लोग अच्छे उपहार देना चाहते हैं, लेकिन या तो बहुत महँगे विकल्प मिलते हैं, या फिर सस्ते लेकिन बेजान से लगने वाले।<br />हमने बीच का रास्ता चुना — सुंदर, किफायती, और दिल से बनाया हुआ।</p>
            <p>हम एंटी-टार्निश ज्वेलरी देते हैं क्योंकि हम चाहते हैं कि वो उपहार लंबे समय तक वैसा ही सुंदर रहे।<br />हम कस्टम गिफ्ट हैम्पर्स बनाते हैं क्योंकि हर रिश्ता अलग होता है, और हर बजट अलग होता है।</p>
            <p className="ourStoryClosing">हमारा वादा सिर्फ प्रोडक्ट बेचने का नहीं है।<br /><strong>हमारा वादा है — थोड़ी सी सोच, बहुत सारा प्यार।</strong></p>
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
                <p lang="hi">{promise.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ourStoryNote" aria-labelledby="our-story-note-title">
        <div className="wrap ourStoryNoteInner">
          <span className="ourStoryEyebrow">A NOTE FROM US</span>
          <h2 id="our-story-note-title">The person behind every order matters.</h2>
          <blockquote lang="hi">“हर ऑर्डर के पीछे एक असली व्यक्ति होता है जिसे हम खुश करना चाहते हैं। यही हमारी असली प्रेरणा है।”</blockquote>
          <p>— Team Celebration</p>
        </div>
      </section>

      <section className="ourStoryExplore" aria-labelledby="our-story-explore-title">
        <div className="wrap ourStoryExploreInner">
          <div><span className="ourStoryEyebrow">A LITTLE SURPRISE GOES A LONG WAY</span><h2 id="our-story-explore-title">किसी की मुस्कान का हिस्सा बनिए।</h2></div>
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
