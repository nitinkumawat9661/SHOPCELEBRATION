import type { Metadata } from "next"
import Link from "next/link"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about Celebration delivery, jewelry sizing, anti-tarnish coverage, returns, refunds, packing videos and order tracking.",
  alternates: { canonical: "/faq" }
}

const groups = [
  {
    title: "Delivery and orders",
    questions: [
      {
        question: "How much does delivery cost?",
        answer: "An individual item marked “Delivery included” has no additional standard delivery fee at checkout. For other orders, check the final amount before paying. Delivery is subject to serviceability at your pincode."
      },
      {
        question: "When will my order arrive?",
        answer: "An estimated delivery date is not a guaranteed arrival date unless Celebration expressly confirms it. Timing depends on your pincode, courier serviceability and dispatch. Check your order for available tracking updates."
      },
      {
        question: "Where can I track my order?",
        answer: "Open My Celebration to view your orders, or use the order-tracking page with your order ID and the required phone digits."
      }
    ]
  },
  {
    title: "Jewelry and sizing",
    questions: [
      {
        question: "Is every jewelry item covered by a six-month anti-tarnish guarantee?",
        answer: "No. The six-month anti-tarnish guarantee applies only to products specifically marked as covered. It is subject to normal-use requirements, verification and the exclusions in our published policy. A guarantee is not a promise that the finish cannot change."
      },
      {
        question: "How should I care for anti-tarnish jewelry?",
        answer: "Put your jewelry on after perfume, sanitizer and lotion have dried. Remove it before showering, swimming or sleeping. Gently wipe it and keep it dry. Exposure to chemicals and prolonged moisture can affect the finish."
      },
      {
        question: "What if my ring, bracelet or necklace does not have measurements listed?",
        answer: "Please ask Celebration support for the specific piece’s dimensions before ordering. Some rings and bangles are described as adjustable, but an adjustable fit is not a guarantee that every size will fit. We do not publish guessed diameters or chain lengths."
      }
    ]
  },
  {
    title: "Returns, refunds and hampers",
    questions: [
      {
        question: "Can I return an item if I change my mind?",
        answer: "Change-of-mind returns for standard items are available only when the product page or Celebration support expressly confirms them before purchase. Customized or personalized items are generally not eligible after preparation has begun. Your legal rights for wrong, damaged, defective or misdescribed items remain unaffected."
      },
      {
        question: "What if I receive a damaged, defective or incorrect item?",
        answer: "Report the issue from your order tracking as soon as possible and within the reporting period shown there. Keep the packaging and label, and provide relevant photos or video if requested. Celebration will assess an appropriate remedy under its policy and applicable law."
      },
      {
        question: "Will I receive a packing video before my hamper is dispatched?",
        answer: "Where a packing video is provided, you can review the visible presentation before dispatch. Video approval does not remove your statutory rights relating to hidden defects, courier damage or wrong and missing items."
      },
      {
        question: "How are approved refunds processed?",
        answer: "Accepted refunds are normally initiated to the original payment method without unreasonable delay, generally within two business days of approval. The bank or payment app may take longer to show the credit. Celebration never needs your UPI PIN, card PIN or banking OTP to refund you."
      }
    ]
  }
] as const

export default async function FaqPage() {
  const settings = (await getStoreSettings().catch(() => null))?.settings || defaultStoreSettings
  return (
    <main className="faqPage">
      <TrustStrip />
      <StorefrontHeader settings={settings} />
      <div className="wrap faqShell">
        <div className="faqIntro">
          <span className="faqEyebrow">Shopping made simpler</span>
          <h1>Questions? Start here.</h1>
          <p>From finding the right fit to understanding returns, these are the details worth knowing before you order.</p>
        </div>
        {groups.map((group) => (
          <section className="faqGroup" aria-label={group.title} key={group.title}>
            <h2>{group.title}</h2>
            <div className="faqQuestions">
              {group.questions.map((item) => (
                <details className="faqItem" key={item.question}>
                  <summary>{item.question}<span aria-hidden="true">+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <aside className="faqHelp">
          <h2>Need a hand with a specific order?</h2>
          <p>For order-specific questions, keep your order ID handy. The full policy explains coverage and the exceptions in detail.</p>
          <div><Link href="/policies">Read the full policy →</Link><Link href="/track">Track an order →</Link><Link href="/claim">Raise a claim →</Link></div>
        </aside>
      </div>
      <SiteFooter />
    </main>
  )
}
