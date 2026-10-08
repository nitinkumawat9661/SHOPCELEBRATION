import type { Metadata } from "next"
import Link from "next/link"
import { SeoJsonLd } from "../../features/seo/SeoJsonLd"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"

export const metadata: Metadata = {
  title: "Celebration vs GIVA, PALMONAS, Everstylish, FNP & IGP",
  description: "Compare Celebration with GIVA, PALMONAS, Everstylish, FNP and IGP by product focus, materials, price positioning and gifting experience before choosing where to shop.",
  alternates: { canonical: "/compare" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: "/compare",
    title: "Celebration vs Popular Jewelry & Gifting Stores",
    description: "A transparent comparison of Celebration with GIVA, PALMONAS, Everstylish, FNP and IGP."
  }
}

const comparisons = [
  {
    name: "GIVA",
    focus: "Primarily fine and precious-material jewellery, including a large 925 sterling-silver catalogue.",
    fit: "Choose GIVA when certified precious-metal jewellery and a much larger established catalogue matter more than entry-level fashion-jewellery pricing."
  },
  {
    name: "PALMONAS",
    focus: "Demi-fine jewellery with gold-plated and premium everyday-wear positioning.",
    fit: "Choose PALMONAS when demi-fine material construction and that category are your priority."
  },
  {
    name: "Everstylish",
    focus: "Very broad fashion-jewellery marketplace with extensive anti-tarnish, occasion, colour and style filters.",
    fit: "Choose Everstylish when catalogue breadth and deep fashion filtering are more important than a smaller curated store."
  },
  {
    name: "FNP",
    focus: "Large gifting platform covering hampers, flowers, personalised gifts and occasion-led delivery.",
    fit: "Choose FNP when you need a broad national gifting catalogue across many product types."
  },
  {
    name: "IGP",
    focus: "Large gifting catalogue with hampers, personalised gifts and occasion-based options.",
    fit: "Choose IGP when broad gifting choice and a large established gift marketplace are the main requirement."
  }
]

const faq = [
  {
    q: "Is Celebration a GIVA alternative?",
    a: "It can be an alternative for shoppers looking for affordable fashion jewellery or gift-ready pieces, but it is not a like-for-like substitute for GIVA's certified 925 sterling-silver catalogue. Compare the material declaration on the exact product before buying."
  },
  {
    q: "Is Celebration a PALMONAS alternative?",
    a: "For some everyday jewellery and gifting searches, yes, but PALMONAS focuses on demi-fine jewellery while Celebration currently mixes affordable fashion jewellery with custom gifting. The material category and price point can differ substantially."
  },
  {
    q: "How is Celebration different from Everstylish?",
    a: "Everstylish has a much larger fashion-jewellery catalogue and deeper filters. Celebration is intentionally smaller and combines individual jewellery with custom hamper gifting, live stock checks and direct order support."
  },
  {
    q: "Is Celebration an alternative to FNP or IGP for gift hampers?",
    a: "Celebration can be considered when you want a smaller custom-hamper experience. FNP and IGP operate much broader gifting catalogues, so they may suit shoppers who want more categories or established large-platform coverage."
  }
]

export default function ComparePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }))
  }

  return <main>
    <SeoJsonLd data={faqSchema} />
    <TrustStrip />
    <SiteHeader />
    <section>
      <div className="wrap policyWrap">
        <div className="policyHero">
          <div className="kicker">COMPARE BEFORE YOU BUY</div>
          <h1 className="policyTitle">Celebration vs popular jewellery and gifting stores</h1>
          <p className="policyLead">There is no single “best” store. Material, catalogue size, price and gifting service matter differently. This guide explains where Celebration fits beside GIVA, PALMONAS, Everstylish, FNP and IGP.</p>
          <div className="privacyMeta">Comparison reviewed: October 2026</div>
        </div>

        <div className="privacySections">
          <article className="privacySection">
            <h2>Where Celebration fits</h2>
            <p>Celebration currently focuses on affordable individual jewellery plus custom gift hampers. Individual listings show their own material and product declarations, stock is checked before payment, and only products explicitly marked with the 6-month anti-tarnish guarantee receive that commercial coverage.</p>
            <p><Link href="/jewelry">Browse Celebration jewellery →</Link> · <Link href="/#budgets">Explore custom hampers →</Link></p>
          </article>

          {comparisons.map((item) => <article className="privacySection" key={item.name}>
            <h2>Celebration vs {item.name}</h2>
            <p><b>{item.name} focus:</b> {item.focus}</p>
            <p><b>Who it may suit:</b> {item.fit}</p>
          </article>)}

          <article className="privacySection">
            <h2>What to compare on any jewellery product</h2>
            <ul>
              <li>Actual material and plating, not just the colour or product photo.</li>
              <li>Whether an anti-tarnish claim has a stated duration and exclusions.</li>
              <li>Final payable price, delivery charges and return conditions.</li>
              <li>Current stock, product dimensions and declared manufacturer/importer details where applicable.</li>
              <li>Whether reviews are verified rather than decorative testimonials.</li>
            </ul>
          </article>

          <article className="privacySection">
            <h2>Frequently asked comparisons</h2>
            {faq.map((item) => <div key={item.q}><h3>{item.q}</h3><p>{item.a}</p></div>)}
          </article>
        </div>

        <div className="policyNotice">
          <strong>Independent comparison</strong>
          <span>Celebration is not affiliated with, endorsed by or presented as GIVA, PALMONAS, Everstylish, FNP or IGP. Their names are used only to help shoppers compare different buying options. Product ranges and policies can change, so check the relevant store before purchase.</span>
        </div>

        <div className="policySupport">
          <h2>Ready to compare the actual products?</h2>
          <div className="policySupportActions"><Link className="primary" href="/jewelry">Shop jewellery</Link><Link className="secondary" href="/policies">Read Celebration policies</Link></div>
        </div>
      </div>
    </section>
    <SiteFooter />
  </main>
}
